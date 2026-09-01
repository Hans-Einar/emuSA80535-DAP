import path from "node:path";

import yauzl from "yauzl";

export const EXPECTED_VSIX_ENTRIES = Object.freeze([
  "[Content_Types].xml",
  "extension.vsixmanifest",
  "extension/LICENSE.txt",
  "extension/node_modules/@vscode/debugadapter/License.txt",
  "extension/node_modules/@vscode/debugadapter/README.md",
  "extension/node_modules/@vscode/debugadapter/lib/debugSession.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/debugSession.js",
  "extension/node_modules/@vscode/debugadapter/lib/handles.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/handles.js",
  "extension/node_modules/@vscode/debugadapter/lib/internalLogger.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/internalLogger.js",
  "extension/node_modules/@vscode/debugadapter/lib/logger.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/logger.js",
  "extension/node_modules/@vscode/debugadapter/lib/loggingDebugSession.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/loggingDebugSession.js",
  "extension/node_modules/@vscode/debugadapter/lib/main.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/main.js",
  "extension/node_modules/@vscode/debugadapter/lib/messages.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/messages.js",
  "extension/node_modules/@vscode/debugadapter/lib/protocol.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/protocol.js",
  "extension/node_modules/@vscode/debugadapter/lib/runDebugAdapter.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/runDebugAdapter.js",
  "extension/node_modules/@vscode/debugadapter/lib/web/internalLoggerStub.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/web/internalLoggerStub.js",
  "extension/node_modules/@vscode/debugadapter/lib/web/runDebugAdapterStub.d.ts",
  "extension/node_modules/@vscode/debugadapter/lib/web/runDebugAdapterStub.js",
  "extension/node_modules/@vscode/debugadapter/package.json",
  "extension/node_modules/@vscode/debugadapter/thirdpartynotices.txt",
  "extension/node_modules/@vscode/debugprotocol/License.txt",
  "extension/node_modules/@vscode/debugprotocol/README.md",
  "extension/node_modules/@vscode/debugprotocol/lib/debugProtocol.d.ts",
  "extension/node_modules/@vscode/debugprotocol/lib/debugProtocol.js",
  "extension/node_modules/@vscode/debugprotocol/package.json",
  "extension/out/adapter/src/breakpoints.js",
  "extension/out/adapter/src/disassembly.js",
  "extension/out/adapter/src/emulatorClient.js",
  "extension/out/adapter/src/launchConfiguration.js",
  "extension/out/adapter/src/main.js",
  "extension/out/adapter/src/memoryReference.js",
  "extension/out/adapter/src/session.js",
  "extension/out/adapter/src/state.js",
  "extension/out/extension/src/adapterExecutable.js",
  "extension/out/extension/src/configuration.js",
  "extension/out/extension/src/extension.js",
  "extension/package.json",
  "extension/readme.md",
]);

function safeArchivePath(entry) {
  if (
    entry.length === 0 ||
    entry.includes("\\") ||
    entry.startsWith("/") ||
    path.posix.normalize(entry) !== entry ||
    entry.split("/").includes("..")
  ) {
    throw new Error(`unsafe VSIX entry path: ${JSON.stringify(entry)}`);
  }
}

export function validateVsixEntries(entries) {
  const actual = [...entries];
  const seen = new Set();
  for (const entry of actual) {
    safeArchivePath(entry);
    if (seen.has(entry)) {
      throw new Error(`duplicate VSIX entry: ${entry}`);
    }
    seen.add(entry);
  }

  const expected = new Set(EXPECTED_VSIX_ENTRIES);
  const missing = EXPECTED_VSIX_ENTRIES.filter((entry) => !seen.has(entry));
  const unexpected = actual.filter((entry) => !expected.has(entry));
  if (missing.length > 0 || unexpected.length > 0) {
    const details = [];
    if (missing.length > 0) {
      details.push(`missing: ${missing.join(", ")}`);
    }
    if (unexpected.length > 0) {
      details.push(`unexpected: ${unexpected.join(", ")}`);
    }
    throw new Error(`VSIX contents violate the exact allowlist (${details.join("; ")})`);
  }
  return actual.length;
}

export function readVsixEntries(vsixPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(vsixPath, { lazyEntries: true, strictFileNames: true }, (error, zip) => {
      if (error !== null || zip === undefined) {
        reject(error ?? new Error("could not open VSIX archive"));
        return;
      }
      const entries = [];
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        entries.push(entry.fileName);
        zip.readEntry();
      });
      zip.on("end", () => resolve(entries));
      zip.readEntry();
    });
  });
}
