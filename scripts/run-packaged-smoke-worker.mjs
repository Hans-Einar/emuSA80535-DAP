import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";

import {
  downloadAndUnzipVSCode,
  runTests,
  runVSCodeCommand,
} from "@vscode/test-electron";

import {
  findMatchingProcesses,
  isProcessAlive,
  runBounded,
  waitForNoMatchingProcesses,
} from "./lib/process-control.mjs";
import {
  findInstalledExtension,
  parseInstalledExtensionListing,
  validateContractFakeLog,
  validateHarnessEvidence,
} from "./lib/smoke-evidence.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const smokeRoot = path.resolve(requiredEnvironment("EMU_SMOKE_TEMP_ROOT"));
const vscodeVersion = process.env.EMU_SMOKE_VSCODE_VERSION ?? "1.95.0";
const expectedName = "emuSA80535-dap";
const expectedVersion = "0.1.0";
const expectedId = "undefined_publisher.emusa80535-dap";
const vsixPath = path.join(
  repositoryRoot,
  "dist",
  `${expectedName}-${expectedVersion}.vsix`,
);
const cachePath = path.join(repositoryRoot, ".vscode-test");
const extensionsDirectory = path.join(smokeRoot, "extensions");
const userDataDirectory = path.join(smokeRoot, "user-data");
const workspaceDirectory = path.join(smokeRoot, "workspace");
const fakeDirectory = path.join(smokeRoot, "contract-fake");
const fakeServerPath = path.join(fakeDirectory, "server.cjs");
const firmwarePath = path.join(workspaceDirectory, "synthetic-loop.bin");
const fakeLogPath = path.join(smokeRoot, "fake-requests.ndjson");
const fakePidPath = path.join(smokeRoot, "fake.pid");
const harnessResultPath = path.join(smokeRoot, "harness-result.json");

function requiredEnvironment(name) {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function fileSha256(filePath) {
  return createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function makeFakeExecutable() {
  if (process.platform !== "win32") {
    const executablePath = path.join(fakeDirectory, "emu-debug-smoke");
    await fs.writeFile(
      executablePath,
      '#!/bin/sh\nexec "$EMU_SMOKE_NODE" "$EMU_SMOKE_SERVER" "$@"\n',
      { encoding: "utf8", mode: 0o755 },
    );
    await fs.chmod(executablePath, 0o755);
    return executablePath;
  }

  const executablePath = path.join(fakeDirectory, "emu-debug-smoke.exe");
  const sourcePath = path.join(
    repositoryRoot,
    "test",
    "packaged-smoke",
    "fake-launcher.cs",
  );
  const compilerPath = path.join(
    process.env.WINDIR ?? "C:\\Windows",
    "Microsoft.NET",
    "Framework64",
    "v4.0.30319",
    "csc.exe",
  );
  await runBounded(
    compilerPath,
    ["/nologo", "/target:exe", `/out:${executablePath}`, sourcePath],
    {
      timeoutMs: 60_000,
      env: process.env,
    },
  );
  return executablePath;
}

async function waitForFakeExit() {
  const pid = Number.parseInt((await fs.readFile(fakePidPath, "utf8")).trim(), 10);
  const deadline = Date.now() + 10_000;
  while (isProcessAlive(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (isProcessAlive(pid)) {
    throw new Error(`contract fake process ${pid} remained alive after disconnect`);
  }
  return pid;
}

await fs.mkdir(extensionsDirectory, { recursive: true });
await fs.mkdir(userDataDirectory, { recursive: true });
await fs.mkdir(workspaceDirectory, { recursive: true });
await fs.mkdir(fakeDirectory, { recursive: true });
await fs.copyFile(
  path.join(repositoryRoot, "out", "test-fixtures", "fake-emulator", "server.js"),
  fakeServerPath,
);
await fs.copyFile(
  path.join(repositoryRoot, "test-fixtures", "firmware", "synthetic-loop.bin"),
  firmwarePath,
);
const fakeExecutablePath = await makeFakeExecutable();

const initialMatches = await findMatchingProcesses([
  fakeServerPath,
  fakeExecutablePath,
]);
if (initialMatches.length > 0) {
  throw new Error("smoke started with a matching fake process already alive");
}

const vscodeExecutablePath = await downloadAndUnzipVSCode({
  version: vscodeVersion,
  cachePath,
  timeout: 60_000,
});
const profileArguments = [
  `--extensions-dir=${extensionsDirectory}`,
  `--user-data-dir=${userDataDirectory}`,
];
const commandOptions = { version: vscodeVersion, cachePath, timeout: 60_000 };
const versionResult = await runVSCodeCommand(
  ["--version", ...profileArguments],
  commandOptions,
);
const versionLines = versionResult.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0);
if (versionLines[0] !== vscodeVersion) {
  throw new Error(
    `downloaded VS Code reports ${versionLines[0] ?? "no version"}; expected ${vscodeVersion}`,
  );
}

await runVSCodeCommand(
  ["--install-extension", vsixPath, "--force", ...profileArguments],
  commandOptions,
);
const listResult = await runVSCodeCommand(
  ["--list-extensions", "--show-versions", ...profileArguments],
  commandOptions,
);
const installedListing = parseInstalledExtensionListing(listResult.stdout);
const expectedListing = `${expectedId}@${expectedVersion}`;
if (!installedListing.includes(expectedListing)) {
  throw new Error(
    `isolated VS Code install did not list ${expectedListing}: ${JSON.stringify(installedListing)}`,
  );
}

const installed = await findInstalledExtension(
  extensionsDirectory,
  expectedName,
  expectedVersion,
);
if (
  installed.manifest.main !== "./out/extension/src/extension.js" ||
  installed.manifest.engines?.vscode !== "^1.95.0"
) {
  throw new Error("installed manifest does not retain the packaged entry point and VS Code floor");
}
const installedAdapterPath = path.join(
  installed.extensionRoot,
  "out",
  "adapter",
  "src",
  "main.js",
);
await fs.access(installedAdapterPath);

await runTests({
  vscodeExecutablePath,
  extensionDevelopmentPath: path.join(
    repositoryRoot,
    "test",
    "packaged-smoke",
    "harness",
  ),
  extensionTestsPath: path.join(
    repositoryRoot,
    "test",
    "packaged-smoke",
    "harness",
    "suite.cjs",
  ),
  launchArgs: [workspaceDirectory, ...profileArguments],
  extensionTestsEnv: {
    EMU_SMOKE_EXTENSION_ID: expectedId,
    EMU_SMOKE_EXTENSION_VERSION: expectedVersion,
    EMU_SMOKE_INSTALLED_ROOT: installed.extensionRoot,
    EMU_SMOKE_FIRMWARE: firmwarePath,
    EMU_SMOKE_EMULATOR: fakeExecutablePath,
    EMU_SMOKE_RESULT_FILE: harnessResultPath,
    EMU_SMOKE_NODE: process.execPath,
    EMU_SMOKE_SERVER: fakeServerPath,
    EMU_FAKE_SCENARIO: "compatible",
    EMU_FAKE_REQUESTS_LOG: fakeLogPath,
    EMU_FAKE_PID_FILE: fakePidPath,
  },
});

const harnessEvidence = JSON.parse(await fs.readFile(harnessResultPath, "utf8"));
validateHarnessEvidence(harnessEvidence, expectedId, expectedVersion);
const fakeCommands = validateContractFakeLog(
  await fs.readFile(fakeLogPath, "utf8"),
);
const fakePid = await waitForFakeExit();
await waitForNoMatchingProcesses(
  [installedAdapterPath, fakeServerPath, fakeExecutablePath],
  10_000,
);

const evidence = {
  platform: process.platform,
  vscodeVersion: versionLines[0],
  vscodeCommit: versionLines[1],
  extensionId: expectedId,
  extensionVersion: expectedVersion,
  installedRoot: installed.extensionRoot,
  vsixSha256: await fileSha256(vsixPath),
  fakeCommands,
  fakePid,
  dapRequests: harnessEvidence.dapRequests,
  dapEvents: harnessEvidence.dapEvents,
  orphanProcesses: 0,
};
process.stdout.write(`PACKAGED_SMOKE_PASS ${JSON.stringify(evidence)}\n`);
