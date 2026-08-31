import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  LaunchConfigurationError,
  validateLaunchConfiguration,
} from "../adapter/src/launchConfiguration";
import { createAdapterExecutableSpec } from "../extension/src/adapterExecutable";
import { applyWorkspaceEmulatorPath } from "../extension/src/configuration";

const repositoryRoot = path.resolve(__dirname, "..", "..");

function frame(message: object): Buffer {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, "ascii"),
    payload,
  ]);
}

function readDapMessages(stream: NodeJS.ReadableStream): {
  messages: object[];
  next: () => Promise<object>;
} {
  let buffer = Buffer.alloc(0);
  const messages: object[] = [];
  const waiters: Array<(message: object) => void> = [];

  stream.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        return;
      }

      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const lengthMatch = /^Content-Length: (\d+)$/im.exec(header);
      assert.notEqual(lengthMatch, null, `invalid DAP header: ${header}`);
      const length = Number.parseInt(lengthMatch?.[1] ?? "", 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) {
        return;
      }

      const message = JSON.parse(
        buffer.subarray(bodyStart, bodyStart + length).toString("utf8"),
      ) as object;
      buffer = buffer.subarray(bodyStart + length);
      const waiter = waiters.shift();
      if (waiter === undefined) {
        messages.push(message);
      } else {
        waiter(message);
      }
    }
  });

  return {
    messages,
    next: async () =>
      new Promise<object>((resolve) => {
        const existing = messages.shift();
        if (existing !== undefined) {
          resolve(existing);
          return;
        }
        waiters.push(resolve);
      }),
  };
}

void test("manifest contributes only a launch debugger and the frozen setting", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as {
    name: string;
    version: string;
    contributes: {
      configuration: { properties: Record<string, unknown> };
      debuggers: Array<{
        type: string;
        configurationAttributes: Record<string, unknown>;
      }>;
    };
  };

  assert.equal(manifest.name, "emuSA80535-dap");
  assert.equal(manifest.version, "0.1.0");
  assert.deepEqual(
    Object.keys(manifest.contributes.configuration.properties),
    ["emuSA80535.emulatorPath"],
  );
  assert.equal(manifest.contributes.debuggers.length, 1);
  assert.equal(manifest.contributes.debuggers[0]?.type, "emuSA80535");
  assert.deepEqual(
    Object.keys(
      manifest.contributes.debuggers[0]?.configurationAttributes ?? {},
    ),
    ["launch"],
  );
});

void test("launch configuration defaults and validates the frozen foundation fields", () => {
  assert.deepEqual(
    validateLaunchConfiguration({ program: "firmware.bin" }),
    {
      program: "firmware.bin",
      entryAddress: 0,
      resetSeed: 525109,
    },
  );

  assert.throws(
    () =>
      validateLaunchConfiguration({
        program: "firmware.bin",
        entryAddress: "0x10000",
      }),
    (error: unknown) =>
      error instanceof LaunchConfigurationError &&
      error.code === "CONFIG_ENTRY_ADDRESS",
  );
  assert.throws(
    () =>
      validateLaunchConfiguration({
        program: "firmware.bin",
        stopOnEntry: false,
      }),
    (error: unknown) =>
      error instanceof LaunchConfigurationError &&
      error.code === "CONFIG_STOP_ON_ENTRY",
  );
});

void test("explicit launch emulatorPath wins over the workspace setting", () => {
  const explicit = { emulatorPath: "explicit-emulator" };
  assert.equal(
    applyWorkspaceEmulatorPath(explicit, "workspace-emulator"),
    explicit,
  );
  assert.deepEqual(applyWorkspaceEmulatorPath({}, "workspace-emulator"), {
    emulatorPath: "workspace-emulator",
  });
  assert.deepEqual(applyWorkspaceEmulatorPath({}, ""), {});
});

void test("adapter executable is a separate Electron-as-Node process", () => {
  const spec = createAdapterExecutableSpec(
    "extension-root",
    "code-runtime",
    { SAFE_VALUE: "kept", OMITTED: undefined },
  );
  assert.equal(spec.command, "code-runtime");
  assert.equal(spec.args.length, 1);
  assert.match(
    spec.args[0] ?? "",
    /out[\\/]adapter[\\/]src[\\/]main\.js$/,
  );
  assert.equal(spec.env.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(spec.env.SAFE_VALUE, "kept");
  assert.equal("OMITTED" in spec.env, false);
});

void test("compiled adapter speaks DAP framing over stdio", { timeout: 10_000 }, async () => {
  const adapter = spawn(
    process.execPath,
    [path.join(repositoryRoot, "out", "adapter", "src", "main.js")],
    {
      cwd: repositoryRoot,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const dap = readDapMessages(adapter.stdout);

  try {
    adapter.stdin.write(
      frame({
        seq: 1,
        type: "request",
        command: "initialize",
        arguments: {
          adapterID: "emuSA80535",
          pathFormat: "path",
          linesStartAt1: true,
          columnsStartAt1: true,
        },
      }),
    );
    assert.deepEqual(await dap.next(), {
      seq: 1,
      type: "response",
      request_seq: 1,
      command: "initialize",
      success: true,
      body: { supportsConfigurationDoneRequest: true },
    });

    adapter.stdin.write(
      frame({
        seq: 2,
        type: "request",
        command: "disconnect",
        arguments: {},
      }),
    );
    const response = await dap.next();
    const event = await dap.next();
    assert.deepEqual(response, {
      seq: 2,
      type: "response",
      request_seq: 2,
      command: "disconnect",
      success: true,
    });
    assert.deepEqual(event, {
      seq: 3,
      type: "event",
      event: "terminated",
    });
  } finally {
    adapter.stdin.end();
    if (adapter.exitCode === null) {
      adapter.kill();
      await once(adapter, "exit");
    }
  }
});

void test("foundation launch fails without fake success and terminates once", { timeout: 10_000 }, async () => {
  const adapter = spawn(
    process.execPath,
    [path.join(repositoryRoot, "out", "adapter", "src", "main.js")],
    {
      cwd: repositoryRoot,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const dap = readDapMessages(adapter.stdout);

  try {
    adapter.stdin.write(
      frame({
        seq: 1,
        type: "request",
        command: "initialize",
        arguments: {
          adapterID: "emuSA80535",
          pathFormat: "path",
          linesStartAt1: true,
          columnsStartAt1: true,
        },
      }),
    );
    await dap.next();

    adapter.stdin.write(
      frame({
        seq: 2,
        type: "request",
        command: "launch",
        arguments: {
          type: "emuSA80535",
          request: "launch",
          name: "foundation check",
          program: "firmware.bin",
          entryAddress: "0x0000",
          resetSeed: 525109,
          stopOnEntry: true,
          trace: "off",
        },
      }),
    );

    const launchResponse = await dap.next() as {
      type: string;
      command: string;
      success: boolean;
      message: string;
    };
    assert.equal(launchResponse.type, "response");
    assert.equal(launchResponse.command, "launch");
    assert.equal(launchResponse.success, false);
    assert.match(launchResponse.message, /^EMU_INTEGRATION_PENDING:/);
    assert.deepEqual(await dap.next(), {
      seq: 3,
      type: "event",
      event: "terminated",
    });

    adapter.stdin.write(
      frame({
        seq: 3,
        type: "request",
        command: "disconnect",
        arguments: {},
      }),
    );
    assert.deepEqual(await dap.next(), {
      seq: 4,
      type: "response",
      request_seq: 3,
      command: "disconnect",
      success: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.deepEqual(dap.messages, []);
  } finally {
    adapter.stdin.end();
    if (adapter.exitCode === null) {
      adapter.kill();
      await once(adapter, "exit");
    }
  }
});
