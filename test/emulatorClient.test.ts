import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  EmulatorClient,
  EmulatorControlError,
  EmulatorLaunchBackend,
  inspectRawCodeImage,
  RAW_CODE_IMAGE_BYTES,
  REQUIRED_EMULATOR_CAPABILITIES,
  resolveEmulatorExecutable,
} from "../adapter/src/emulatorClient";
import { EmuDebugSession } from "../adapter/src/session";

const repositoryRoot = path.resolve(__dirname, "..", "..");
const fakeServer = path.join(
  repositoryRoot,
  "out",
  "test-fixtures",
  "fake-emulator",
  "server.js",
);
const fixture = path.join(
  repositoryRoot,
  "test-fixtures",
  "firmware",
  "synthetic-loop.bin",
);
const fixtureHash =
  "1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88";
type JsonObject = Record<string, unknown>;

function fakeArguments(
  scenario: string,
  additional: readonly string[] = [],
): string[] {
  return [fakeServer, "--headless-debug", "--scenario", scenario, ...additional];
}

async function startFake(
  scenario = "compatible",
  options: {
    commandTimeoutMs?: number;
    terminationTimeoutMs?: number;
    onDiagnostic?: (message: string) => void;
    onFatal?: (error: EmulatorControlError) => void;
    additionalArguments?: readonly string[];
  } = {},
): Promise<EmulatorClient> {
  return EmulatorClient.spawn(
    process.execPath,
    fakeArguments(scenario, options.additionalArguments),
    {
      commandTimeoutMs: options.commandTimeoutMs ?? 1_000,
      terminationTimeoutMs: options.terminationTimeoutMs ?? 250,
      onDiagnostic: options.onDiagnostic,
      onFatal: options.onFatal,
    },
  );
}

interface RawFake {
  child: ChildProcessWithoutNullStreams;
  records: Array<{ body: JsonObject; bytes: number }>;
  next: () => Promise<{ body: JsonObject; bytes: number }>;
  closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  send: (record: JsonObject | string) => void;
}

function startRawFake(scenario = "compatible"): RawFake {
  const child = spawn(process.execPath, fakeArguments(scenario), {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const records: Array<{ body: JsonObject; bytes: number }> = [];
  const waiters: Array<(record: { body: JsonObject; bytes: number }) => void> = [];
  let stdout = Buffer.alloc(0);
  child.stdout.on("data", (chunk: Buffer) => {
    stdout = Buffer.concat([stdout, chunk]);
    for (;;) {
      const newline = stdout.indexOf(0x0a);
      if (newline < 0) {
        return;
      }
      const line = stdout.subarray(0, newline);
      stdout = stdout.subarray(newline + 1);
      const record = {
        body: JSON.parse(line.toString("utf8")) as JsonObject,
        bytes: line.length,
      };
      const waiter = waiters.shift();
      if (waiter === undefined) {
        records.push(record);
      } else {
        waiter(record);
      }
    }
  });
  const closed = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  return {
    child,
    records,
    next: async () =>
      new Promise((resolve) => {
        const existing = records.shift();
        if (existing !== undefined) {
          resolve(existing);
        } else {
          waiters.push(resolve);
        }
      }),
    closed,
    send: (record) => {
      child.stdin.write(`${typeof record === "string" ? record : JSON.stringify(record)}\n`);
    },
  };
}

function helloRequest(id: number, padding = ""): JsonObject {
  return {
    type: "request",
    id,
    command: "hello",
    arguments: {
      protocol: { major: 1, minor: 0 },
      requiredCapabilities: [...REQUIRED_EMULATOR_CAPABILITIES],
      padding,
    },
  };
}

function recordWithExactBytes(target: number): string {
  const request = helloRequest(1);
  const initial = JSON.stringify(request);
  const paddingBytes = target - Buffer.byteLength(initial, "utf8");
  assert.ok(paddingBytes >= 0);
  const argumentsObject = request.arguments as JsonObject;
  argumentsObject.padding = "x".repeat(paddingBytes);
  const record = JSON.stringify(request);
  assert.equal(Buffer.byteLength(record, "utf8"), target);
  return record;
}

function assertControlError(error: unknown, code: string | RegExp): boolean {
  assert.ok(error instanceof EmulatorControlError);
  if (typeof code === "string") {
    assert.equal(error.code, code);
  } else {
    assert.match(error.code, code);
  }
  assert.equal(error.retryable, false);
  return true;
}

async function assertReaped(client: EmulatorClient): Promise<void> {
  await client.closed;
  const pid = client.processId;
  if (pid === undefined) {
    return;
  }
  assert.throws(() => process.kill(pid, 0));
}

async function establishEntry(client: EmulatorClient): Promise<void> {
  await client.handshake();
  await client.loadImage(await inspectRawCodeImage(fixture));
  await client.reset(1, 0);
}

void test("synthetic raw image has exact size, bytes, and reviewed SHA-256", () => {
  const image = fs.readFileSync(fixture);
  assert.equal(image.length, RAW_CODE_IMAGE_BYTES);
  assert.deepEqual([...image.subarray(0, 5)], [0x74, 0x01, 0x04, 0x80, 0xfd]);
  assert.equal(createHash("sha256").update(image).digest("hex"), fixtureHash);
  assert.equal(image.subarray(5).every((byte) => byte === 0x00), true);
});

void test("compatible fake implements the exact serialized Slice-1 command contract", { timeout: 10_000 }, async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "emu-contract-"));
  const requestsLog = path.join(temporary, "requests.ndjson");
  const client = await startFake("compatible", {
    additionalArguments: ["--requests-log", requestsLog],
  });
  try {
    const hello = await client.handshake();
    assert.deepEqual(hello.protocol, { major: 1, minor: 0 });
    assert.equal(hello.variants.includes("sab80535"), true);
    assert.deepEqual(
      REQUIRED_EMULATOR_CAPABILITIES.filter(
        (capability) => !hello.capabilities.includes(capability),
      ),
      [],
    );

    const image = await inspectRawCodeImage(fixture);
    assert.equal(path.isAbsolute(image.path), true);
    assert.equal(image.sha256, fixtureHash);
    assert.deepEqual(await client.loadImage(image), { sha256: fixtureHash });

    const entry = await client.reset(525109, 0x0000);
    assert.equal(entry.reason, "entry");
    assert.equal(entry.pc, 0);
    assert.equal(entry.registers.sp, 7);
    assert.deepEqual(entry.registers.r, [0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(await client.getState(), entry);

    const decode = await client.decodeCode(0, 0, 0, 3);
    assert.deepEqual(decode.instructions, [
      { address: 0, size: 2, valid: true, text: "MOV A,#0x01" },
      { address: 2, size: 1, valid: true, text: "INC A" },
      { address: 3, size: 2, valid: true, text: "SJMP 0x0002" },
    ]);
    assert.deepEqual(
      (await client.decodeCode(3, 0, -2, 3)).instructions.map(
        ({ address, valid }) => ({ address, valid }),
      ),
      [
        { address: 0, valid: true },
        { address: 2, valid: true },
        { address: 3, valid: true },
      ],
    );
    assert.deepEqual(await client.decodeCode(0x0010, 0, -2, 2), {
      instructions: [
        {
          address: 0x000e,
          size: 1,
          valid: false,
          text: "<invalid>",
          reason: "unknown-predecessor",
        },
        {
          address: 0x000f,
          size: 1,
          valid: false,
          text: "<invalid>",
          reason: "unknown-predecessor",
        },
      ],
    });
    await assert.rejects(
      client.decodeCode(0, -1, 0, 1),
      (error: unknown) => assertControlError(error, "RANGE"),
    );
    assert.deepEqual(await client.replaceCodeBreakpoints([0x0002]), {
      accepted: [0x0002],
      rejected: [],
      limit: 1,
    });
    const breakpoint = await client.run(16);
    assert.equal(breakpoint.reason, "breakpoint");
    assert.equal(breakpoint.pc, 0x0002);
    assert.equal(breakpoint.instructionCount, 1);
    assert.equal(breakpoint.registers.a, 1);
    const stepped = await client.stepInstruction();
    assert.equal(stepped.reason, "step");
    assert.equal(stepped.pc, 0x0003);
    assert.equal(stepped.instructionCount, 2);

    await client.terminate();
    await assertReaped(client);
    const commands = fs
      .readFileSync(requestsLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => (JSON.parse(line) as { command: string }).command);
    assert.deepEqual(commands, [
      "hello",
      "load",
      "reset",
      "getState",
      "decodeCode",
      "decodeCode",
      "decodeCode",
      "decodeCode",
      "replaceCodeBreakpoints",
      "run",
      "stepInstruction",
      "terminate",
    ]);
  } finally {
    await client.forceClose();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

void test("commands are serialized even when callers overlap", { timeout: 10_000 }, async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "emu-serialized-"));
  const requestsLog = path.join(temporary, "requests.ndjson");
  const client = await startFake("compatible", {
    additionalArguments: [
      "--requests-log",
      requestsLog,
      "--delay-command",
      "getState",
      "--delay-ms",
      "50",
    ],
  });
  try {
    await client.handshake();
    await client.loadImage(await inspectRawCodeImage(fixture));
    await client.reset(1, 0);
    const [state, decode] = await Promise.all([
      client.getState(),
      client.decodeCode(0, 0, 0, 1),
    ]);
    assert.equal(state.pc, 0);
    assert.equal(decode.instructions[0]?.address, 0);
    const commands = fs
      .readFileSync(requestsLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => (JSON.parse(line) as { command: string }).command);
    assert.deepEqual(commands.slice(-2), ["getState", "decodeCode"]);
  } finally {
    await client.terminate();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

void test("a newer compatible minor and unknown fields are tolerated", { timeout: 10_000 }, async () => {
  const client = await startFake("minor-compatible");
  try {
    const hello = await client.handshake();
    assert.deepEqual(hello.protocol, { major: 1, minor: 7 });
  } finally {
    await client.terminate();
  }
});

void test("fatal handshake failures are stable and reap the child", async (context) => {
  for (const testCase of [
    { scenario: "major-mismatch", code: "EMU_VERSION_MAJOR" },
    { scenario: "missing-capability", code: "EMU_VERSION_CAPABILITY" },
    { scenario: "malformed-hello", code: "EMU_TRANSPORT_MALFORMED" },
    { scenario: "invalid-utf8", code: "EMU_TRANSPORT_MALFORMED" },
    { scenario: "mismatch-id", code: "EMU_TRANSPORT_CORRELATION" },
    { scenario: "mismatch-command", code: "EMU_TRANSPORT_CORRELATION" },
  ] as const) {
    await context.test(testCase.scenario, { timeout: 10_000 }, async () => {
      const client = await startFake(testCase.scenario);
      await assert.rejects(
        client.handshake(),
        (error: unknown) => assertControlError(error, testCase.code),
      );
      await assertReaped(client);
    });
  }
});

void test("client rejects and reaps an independently oversized response", { timeout: 10_000 }, async () => {
  const script = [
    "process.stdin.once('data', () => {",
    "const response = {type:'response',id:1,command:'hello',success:true,body:{padding:'x'.repeat(65536)}};",
    "process.stdout.write(JSON.stringify(response) + '\\n');",
    "});",
    "setInterval(() => {}, 1000);",
  ].join("");
  const client = await EmulatorClient.spawn(process.execPath, ["-e", script], {
    commandTimeoutMs: 1_000,
    terminationTimeoutMs: 250,
  });
  await assert.rejects(
    client.handshake(),
    (error: unknown) => assertControlError(error, "EMU_TRANSPORT_OVERSIZE"),
  );
  await assertReaped(client);
});

void test("hello timeout kills and reaps without proving a boundary", { timeout: 10_000 }, async () => {
  const client = await startFake("timeout-hello", {
    commandTimeoutMs: 75,
    terminationTimeoutMs: 100,
  });
  await assert.rejects(
    client.handshake(),
    (error: unknown) => assertControlError(error, "EMU_TRANSPORT_TIMEOUT"),
  );
  await assertReaped(client);
});

void test("child crash/EOF is terminal and reaped", { timeout: 10_000 }, async () => {
  const client = await startFake("crash-hello");
  await assert.rejects(
    client.handshake(),
    (error: unknown) =>
      assertControlError(error, /^EMU_TRANSPORT_(?:EOF|EXIT)$/),
  );
  await assertReaped(client);
});

void test("a schema-invalid response after launch is fatal and reaped", { timeout: 10_000 }, async () => {
  const client = await startFake("malformed-state");
  await client.handshake();
  await client.loadImage(await inspectRawCodeImage(fixture));
  await client.reset(1, 0);
  await assert.rejects(
    client.getState(),
    (error: unknown) => assertControlError(error, "EMU_TRANSPORT_SCHEMA"),
  );
  await assertReaped(client);
});

void test("hostile command responses are fatal and reap the child", async (context) => {
  for (const testCase of [
    {
      name: "load digest mismatch",
      scenario: "hostile-load-hash",
      expectedCode: "EMU_IMAGE_HASH",
      invoke: async (client: EmulatorClient) => {
        await client.handshake();
        await client.loadImage(await inspectRawCodeImage(fixture));
      },
    },
    {
      name: "reset unadvertised variant",
      scenario: "hostile-reset-variant",
      expectedCode: "EMU_TRANSPORT_SCHEMA",
      invoke: async (client: EmulatorClient) => {
        await client.handshake();
        await client.loadImage(await inspectRawCodeImage(fixture));
        await client.reset(1, 0);
      },
    },
    {
      name: "reset result kind",
      scenario: "hostile-reset-kind",
      expectedCode: "EMU_TRANSPORT_SCHEMA",
      invoke: async (client: EmulatorClient) => {
        await client.handshake();
        await client.loadImage(await inspectRawCodeImage(fixture));
        await client.reset(1, 0);
      },
    },
    {
      name: "getState register width",
      scenario: "hostile-state-register-width",
      expectedCode: "EMU_TRANSPORT_SCHEMA",
      invoke: async (client: EmulatorClient) => {
        await establishEntry(client);
        await client.getState();
      },
    },
    {
      name: "decode order and placeholder",
      scenario: "hostile-decode-window",
      expectedCode: "EMU_TRANSPORT_SCHEMA",
      invoke: async (client: EmulatorClient) => {
        await establishEntry(client);
        await client.decodeCode(0, 0, 0, 2);
      },
    },
    {
      name: "breakpoint response partition",
      scenario: "hostile-breakpoint-partition",
      expectedCode: "EMU_TRANSPORT_SCHEMA",
      invoke: async (client: EmulatorClient) => {
        await establishEntry(client);
        await client.replaceCodeBreakpoints([2]);
      },
    },
    {
      name: "run entry stop",
      scenario: "hostile-run-entry",
      expectedCode: "EMU_TRANSPORT_SCHEMA",
      invoke: async (client: EmulatorClient) => {
        await establishEntry(client);
        await client.run(1);
      },
    },
    {
      name: "step yield",
      scenario: "hostile-step-yield",
      expectedCode: "EMU_TRANSPORT_SCHEMA",
      invoke: async (client: EmulatorClient) => {
        await establishEntry(client);
        await client.stepInstruction();
      },
    },
  ] as const) {
    await context.test(testCase.name, { timeout: 10_000 }, async () => {
      const client = await startFake(testCase.scenario);
      await assert.rejects(
        testCase.invoke(client),
        (error: unknown) => assertControlError(error, testCase.expectedCode),
      );
      await assertReaped(client);
    });
  }
});

void test("invalid terminate acknowledgment is fatal and reaped", { timeout: 10_000 }, async () => {
  const fatal: EmulatorControlError[] = [];
  const client = await startFake("hostile-terminate-ack", {
    onFatal: (error) => fatal.push(error),
  });
  await client.handshake();
  await client.terminate();
  await assertReaped(client);
  assert.equal(fatal.length, 1);
  assert.equal(fatal[0]?.code, "EMU_TRANSPORT_SCHEMA");
});

void test("stderr diagnostics stay separate from stdout protocol records", { timeout: 10_000 }, async () => {
  const diagnostics: string[] = [];
  const client = await startFake("stderr-diagnostic", {
    onDiagnostic: (message) => diagnostics.push(message),
  });
  try {
    const hello = await client.handshake();
    assert.equal(hello.product, "emuSA80535-N");
    assert.deepEqual(diagnostics.map((line) => JSON.parse(line)), [
      {
        level: "info",
        code: "FAKE_READY",
        message: "headless debug server ready",
      },
    ]);
  } finally {
    await client.terminate();
  }
});

void test("image inspection rejects short and long files before launch", async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "emu-images-"));
  try {
    for (const [name, size] of [
      ["short.bin", RAW_CODE_IMAGE_BYTES - 1],
      ["long.bin", RAW_CODE_IMAGE_BYTES + 1],
    ] as const) {
      const file = path.join(temporary, name);
      fs.writeFileSync(file, Buffer.alloc(size));
      await assert.rejects(
        inspectRawCodeImage(file),
        (error: unknown) => assertControlError(error, "EMU_IMAGE_SIZE"),
      );
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

void test("executable resolution honors explicit path and reports missing PATH", async () => {
  assert.equal(
    await resolveEmulatorExecutable(process.execPath),
    path.resolve(process.execPath),
  );
  await assert.rejects(
    resolveEmulatorExecutable(undefined, {
      env: { PATH: "" },
      executableName: "definitely-missing-emu-debug",
    }),
    (error: unknown) => assertControlError(error, "CONFIG_EMULATOR_NOT_FOUND"),
  );
});

void test(
  "Windows resolution skips shell wrappers and honors direct PATHEXT ordering without fallback",
  { skip: process.platform !== "win32", timeout: 10_000 },
  async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "emu-path-win32-"));
    const native = path.join(temporary, "emu-debug.EXE");
    const wrapper = path.join(temporary, "emu-debug.CMD");
    try {
      fs.copyFileSync(process.execPath, native);
      fs.writeFileSync(wrapper, "@echo off\r\nexit /b 0\r\n", "utf8");
      const resolved = await resolveEmulatorExecutable(undefined, {
        env: { PATH: temporary, PATHEXT: ".CMD;.EXE;.BAT" },
        executableName: "emu-debug",
        platform: "win32",
      });
      assert.equal(resolved.toLowerCase(), native.toLowerCase());
      const directExit = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(resolved, ["--version"], {
          shell: false,
          stdio: ["ignore", "ignore", "ignore"],
          windowsHide: true,
        });
        child.once("error", reject);
        child.once("close", resolve);
      });
      assert.equal(directExit, 0);

      await assert.rejects(
        resolveEmulatorExecutable(undefined, {
          env: { PATH: temporary, PATHEXT: ".CMD;.BAT" },
          executableName: "emu-debug",
          platform: "win32",
        }),
        (error: unknown) => assertControlError(error, "CONFIG_EMULATOR_NOT_FOUND"),
      );
      await assert.rejects(
        resolveEmulatorExecutable(wrapper, { platform: "win32" }),
        (error: unknown) => assertControlError(error, "CONFIG_EMULATOR_NOT_FOUND"),
      );
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  },
);

void test("direct spawn failure is stable and does not hang cleanup", async () => {
  await assert.rejects(
    EmulatorClient.spawn(
      path.join(os.tmpdir(), "missing-emu-debug-executable-for-contract-test"),
      ["--headless-debug"],
      { commandTimeoutMs: 100, terminationTimeoutMs: 100 },
    ),
    (error: unknown) => assertControlError(error, "EMU_TRANSPORT_SPAWN"),
  );
});

void test("launch backend performs hello, absolute load/hash, then reset", { timeout: 10_000 }, async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "emu-backend-"));
  const requestsLog = path.join(temporary, "requests.ndjson");
  const backend = new EmulatorLaunchBackend({
    childArguments: fakeArguments("compatible", ["--requests-log", requestsLog]),
    commandTimeoutMs: 1_000,
    terminationTimeoutMs: 250,
  });
  try {
    const result = await backend.launch({
      program: fixture,
      entryAddress: 0,
      resetSeed: 525109,
      emulatorPath: process.execPath,
    });
    assert.equal(result.entrySnapshot.reason, "entry");
    assert.equal(result.image.path, path.resolve(fixture));
    assert.equal(result.image.sha256, fixtureHash);
    const observed = fs
      .readFileSync(requestsLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { command: string; arguments: JsonObject });
    assert.deepEqual(
      observed.map((item) => item.command),
      ["hello", "load", "reset"],
    );
    assert.equal(observed[1]?.arguments.path, path.resolve(fixture));
    assert.equal(observed[1]?.arguments.expectedSha256, fixtureHash);
  } finally {
    await backend.disconnect();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

void test("hung terminate is forcibly cleaned up and reaped", { timeout: 10_000 }, async () => {
  const backend = new EmulatorLaunchBackend({
    childArguments: fakeArguments("terminate-hang"),
    commandTimeoutMs: 75,
    terminationTimeoutMs: 100,
  });
  const result = await backend.launch({
    program: fixture,
    entryAddress: 0,
    resetSeed: 1,
    emulatorPath: process.execPath,
  });
  await backend.disconnect();
  await assertReaped(result.client);
});

void test("disconnect during a pending handshake cancels and reaps the launch-owned child", { timeout: 10_000 }, async () => {
  const backend = new EmulatorLaunchBackend({
    childArguments: fakeArguments("timeout-hello"),
    commandTimeoutMs: 1_000,
    terminationTimeoutMs: 100,
  });
  const launch = backend.launch({
    program: fixture,
    entryAddress: 0,
    resetSeed: 1,
    emulatorPath: process.execPath,
  });
  for (let attempt = 0; attempt < 50 && backend.ownedProcessId === undefined; attempt += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  const pid = backend.ownedProcessId;
  assert.notEqual(pid, undefined);
  await backend.disconnect();
  await assert.rejects(launch, (error: unknown) => {
    assert.ok(error instanceof EmulatorControlError);
    assert.match(error.code, /^EMU_(?:LAUNCH_CANCELLED|TRANSPORT_)/);
    return true;
  });
  if (pid !== undefined) {
    assert.throws(() => process.kill(pid, 0));
  }
});

interface DapMessage {
  type: string;
  event?: string;
  command?: string;
  success?: boolean;
  body?: unknown;
}

function frame(message: object): Buffer {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, "ascii"),
    payload,
  ]);
}

function dapReader(output: PassThrough): { next: () => Promise<DapMessage> } {
  let buffer = Buffer.alloc(0);
  const queued: DapMessage[] = [];
  const waiters: Array<(message: DapMessage) => void> = [];
  output.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const length = Number.parseInt(/Content-Length: (\d+)/i.exec(header)?.[1] ?? "", 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return;
      const message = JSON.parse(
        buffer.subarray(bodyStart, bodyStart + length).toString("utf8"),
      ) as DapMessage;
      buffer = buffer.subarray(bodyStart + length);
      const waiter = waiters.shift();
      if (waiter === undefined) queued.push(message);
      else waiter(message);
    }
  });
  return {
    next: async () =>
      new Promise<DapMessage>((resolve) => {
        const message = queued.shift();
        if (message !== undefined) resolve(message);
        else waiters.push(resolve);
      }),
  };
}

void test("session uses the real backend and publishes only the entry stop after configuration", { timeout: 10_000 }, async () => {
  const backend = new EmulatorLaunchBackend({
    childArguments: fakeArguments("compatible"),
    commandTimeoutMs: 1_000,
    terminationTimeoutMs: 250,
  });
  const input = new PassThrough();
  const output = new PassThrough();
  const dap = dapReader(output);
  new EmuDebugSession(undefined, true, backend).start(input, output);
  const send = (seq: number, command: string, args: object): void => {
    input.write(frame({ seq, type: "request", command, arguments: args }));
  };
  try {
    send(1, "initialize", {
      adapterID: "emuSA80535",
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: "path",
    });
    assert.equal((await dap.next()).success, true);
    send(2, "launch", {
      type: "emuSA80535",
      request: "launch",
      name: "fake-backed launch",
      program: fixture,
      emulatorPath: process.execPath,
      entryAddress: "0x0000",
      resetSeed: 525109,
      stopOnEntry: true,
      trace: "off",
    });
    assert.equal((await dap.next()).event, "initialized");
    send(3, "configurationDone", {});
    assert.deepEqual(
      [await dap.next(), await dap.next(), await dap.next()].map((message) =>
        message.type === "response" ? message.command : message.event,
      ),
      ["configurationDone", "launch", "stopped"],
    );
    send(4, "disconnect", {});
    assert.equal((await dap.next()).success, true);
    assert.equal((await dap.next()).event, "terminated");
  } finally {
    input.destroy();
    output.destroy();
    await backend.disconnect();
  }
});

void test("fake rejects unknown required capabilities and remains in a clean failed-handshake state", { timeout: 10_000 }, async () => {
  const fake = startRawFake();
  try {
    const request = helloRequest(1);
    const args = request.arguments as JsonObject;
    args.requiredCapabilities = [
      ...REQUIRED_EMULATOR_CAPABILITIES,
      "unknown-required-capability",
    ];
    fake.send(request);
    const rejected = await fake.next();
    assert.equal(rejected.body.success, false);
    assert.equal((rejected.body.error as JsonObject).code, "UNSUPPORTED_CAPABILITY");
    assert.ok(rejected.bytes <= 65_536);

    fake.send({ type: "request", id: 2, command: "getState" });
    const state = await fake.next();
    assert.equal(state.body.success, false);
    assert.equal((state.body.error as JsonObject).code, "INVALID_STATE");
    assert.ok(state.bytes <= 65_536);
    fake.child.stdin.end();
    assert.equal((await fake.closed).code, 0);
  } finally {
    fake.child.kill();
  }
});

void test("fake rejects a reused positive request id session-wide without corrupting state", { timeout: 10_000 }, async () => {
  const fake = startRawFake();
  try {
    fake.send(helloRequest(1));
    assert.equal((await fake.next()).body.success, true);
    fake.send({ type: "request", id: 1, command: "getState" });
    const duplicate = await fake.next();
    assert.equal(duplicate.body.success, false);
    assert.equal((duplicate.body.error as JsonObject).code, "INVALID_REQUEST");
    fake.send({ type: "request", id: 2, command: "getState" });
    const fresh = await fake.next();
    assert.equal(fresh.body.success, false);
    assert.equal((fresh.body.error as JsonObject).code, "INVALID_STATE");
    fake.child.stdin.end();
    assert.equal((await fake.closed).code, 0);
  } finally {
    fake.child.kill();
  }
});

for (const inputBytes of [65_535, 65_536] as const) {
  void test(`fake accepts an exact ${inputBytes}-byte hello record and bounds all responses`, { timeout: 10_000 }, async () => {
    const fake = startRawFake();
    try {
      fake.send(recordWithExactBytes(inputBytes));
      const hello = await fake.next();
      assert.equal(hello.body.success, true);
      assert.ok(hello.bytes <= 65_536);
      fake.child.stdin.end();
      assert.equal((await fake.closed).code, 0);
    } finally {
      fake.child.kill();
    }
  });
}

void test("fake cleanly terminates on an input record beyond maxRecordBytes", { timeout: 10_000 }, async () => {
  const fake = startRawFake();
  try {
    fake.send(recordWithExactBytes(65_537));
    const exit = await fake.closed;
    assert.equal(exit.code, 65);
    assert.deepEqual(fake.records, []);
  } finally {
    fake.child.kill();
  }
});

void test("fake bounds an oversized generated response with a structured error", { timeout: 10_000 }, async () => {
  const fake = startRawFake("oversize-hello");
  try {
    fake.send(helloRequest(1));
    const response = await fake.next();
    assert.equal(response.body.success, false);
    assert.equal((response.body.error as JsonObject).code, "RESPONSE_TOO_LARGE");
    assert.ok(response.bytes <= 65_536);
    fake.child.stdin.end();
    assert.equal((await fake.closed).code, 0);
  } finally {
    fake.child.kill();
  }
});

void test("fake terminates rather than echoing an unbounded near-limit command", { timeout: 10_000 }, async () => {
  const fake = startRawFake();
  try {
    const request: JsonObject = {
      type: "request",
      id: 1,
      command: "",
    };
    const initial = JSON.stringify(request);
    (request as { command: string }).command = "x".repeat(
      65_489 - Buffer.byteLength(initial, "utf8"),
    );
    const record = JSON.stringify(request);
    assert.equal(Buffer.byteLength(record, "utf8"), 65_489);
    fake.send(record);
    const exit = await fake.closed;
    assert.equal(exit.code, 65);
    assert.deepEqual(fake.records, []);
  } finally {
    fake.child.kill();
  }
});

void test("fake server itself rejects a non-hello first command", { timeout: 10_000 }, async () => {
  const child = spawn(process.execPath, fakeArguments("compatible"), {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const response = new Promise<JsonObject>((resolve) => {
    child.stdout.once("data", (chunk: Buffer) => {
      resolve(JSON.parse(chunk.toString("utf8")) as JsonObject);
    });
  });
  child.stdin.write(
    `${JSON.stringify({ type: "request", id: 1, command: "getState" })}\n`,
  );
  const record = await response;
  assert.equal(record.success, false);
  assert.equal((record.error as JsonObject).code, "INVALID_STATE");
  child.stdin.end();
});
