import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { EmulatorLaunchBackend } from "../adapter/src/emulatorClient";
import { EmuDebugSession } from "../adapter/src/session";

interface DapMessage {
  seq: number;
  type: "response" | "event";
  command?: string;
  event?: string;
  request_seq?: number;
  success?: boolean;
  message?: string;
  body?: unknown;
}

interface LoggedRequest {
  command: string;
  arguments?: Record<string, unknown>;
}

interface SessionOptions {
  scenario?: string;
  entryAddress?: string;
  delayCommand?: string;
  delayMs?: number;
  commandTimeoutMs?: number;
  logRequests?: boolean;
  emulatorPath?: string;
}

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

function frame(message: object): Buffer {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, "ascii"),
    payload,
  ]);
}

function dapReader(output: PassThrough): {
  queued: DapMessage[];
  next: () => Promise<DapMessage>;
} {
  let buffer = Buffer.alloc(0);
  const queued: DapMessage[] = [];
  const waiters: Array<(message: DapMessage) => void> = [];
  output.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        return;
      }
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const length = Number.parseInt(
        /Content-Length: (\d+)/i.exec(header)?.[1] ?? "",
        10,
      );
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) {
        return;
      }
      const message = JSON.parse(
        buffer.subarray(bodyStart, bodyStart + length).toString("utf8"),
      ) as DapMessage;
      buffer = buffer.subarray(bodyStart + length);
      const waiter = waiters.shift();
      if (waiter === undefined) {
        queued.push(message);
      } else {
        waiter(message);
      }
    }
  });
  return {
    queued,
    next: async () =>
      new Promise<DapMessage>((resolve) => {
        const message = queued.shift();
        if (message !== undefined) {
          resolve(message);
        } else {
          waiters.push(resolve);
        }
      }),
  };
}

class DapHarness {
  public readonly input = new PassThrough();
  public readonly output = new PassThrough();
  public readonly dap = dapReader(this.output);
  public readonly backend: EmulatorLaunchBackend;
  public readonly temporaryDirectory: string | undefined;
  public readonly requestsLog: string | undefined;
  private sequence = 0;

  public constructor(private readonly options: SessionOptions = {}) {
    const childArguments = [
      fakeServer,
      "--scenario",
      options.scenario ?? "compatible",
    ];
    if (options.logRequests === true) {
      this.temporaryDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), "emu-dap-behavior-"),
      );
      this.requestsLog = path.join(this.temporaryDirectory, "requests.ndjson");
      childArguments.push("--requests-log", this.requestsLog);
    }
    if (options.delayCommand !== undefined) {
      childArguments.push(
        "--delay-command",
        options.delayCommand,
        "--delay-ms",
        String(options.delayMs ?? 0),
      );
    }
    this.backend = new EmulatorLaunchBackend({
      childArguments,
      commandTimeoutMs: options.commandTimeoutMs ?? 1_000,
      terminationTimeoutMs: 250,
    });
    new EmuDebugSession(undefined, true, this.backend).start(
      this.input,
      this.output,
    );
  }

  public send(command: string, arguments_: object): number {
    const seq = ++this.sequence;
    this.input.write(
      frame({ seq, type: "request", command, arguments: arguments_ }),
    );
    return seq;
  }

  public async initialize(): Promise<DapMessage> {
    this.send("initialize", {
      adapterID: "emuSA80535",
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: "path",
    });
    return this.dap.next();
  }

  public async launchToConfiguration(): Promise<void> {
    this.sendLaunch();
    const initialized = await this.dap.next();
    assert.equal(initialized.type, "event");
    assert.equal(initialized.event, "initialized");
  }

  public sendLaunch(): number {
    return this.send("launch", {
      type: "emuSA80535",
      request: "launch",
      name: "contract fake DAP integration",
      program: fixture,
      emulatorPath: this.options.emulatorPath ?? process.execPath,
      entryAddress: this.options.entryAddress ?? "0x0000",
      resetSeed: 525109,
      stopOnEntry: true,
      trace: "off",
    });
  }

  public async configure(): Promise<DapMessage> {
    this.send("configurationDone", {});
    const configurationResponse = await this.dap.next();
    const launchResponse = await this.dap.next();
    const stopped = await this.dap.next();
    assertSuccess(configurationResponse, "configurationDone");
    assertSuccess(launchResponse, "launch");
    assert.equal(stopped.event, "stopped");
    return stopped;
  }

  public readRequests(): LoggedRequest[] {
    if (this.requestsLog === undefined || !fs.existsSync(this.requestsLog)) {
      return [];
    }
    return fs
      .readFileSync(this.requestsLog, "utf8")
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as LoggedRequest);
  }

  public async disconnect(): Promise<void> {
    this.send("disconnect", {});
    assertSuccess(await this.dap.next(), "disconnect");
    const terminated = await this.dap.next();
    assert.equal(terminated.event, "terminated");
  }

  public async close(): Promise<void> {
    this.input.destroy();
    this.output.destroy();
    await this.backend.disconnect();
    if (this.temporaryDirectory !== undefined) {
      fs.rmSync(this.temporaryDirectory, { recursive: true, force: true });
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  assert.equal(Array.isArray(value), true);
  return value as Array<Record<string, unknown>>;
}

function assertSuccess(message: DapMessage, command: string): void {
  assert.equal(message.type, "response");
  assert.equal(message.command, command);
  assert.equal(message.success, true);
}

function assertFailure(
  message: DapMessage,
  command: string,
  code: string,
): void {
  assert.equal(message.type, "response");
  assert.equal(message.command, command);
  assert.equal(message.success, false);
  assert.match(message.message ?? "", new RegExp(`^${code}:`));
}

void test("AC-001 launch advertises only completed capabilities and stops at entry after configuration", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({ logRequests: true });
  try {
    const initialize = await harness.initialize();
    assert.deepEqual(initialize.body, {
      supportsConfigurationDoneRequest: true,
      supportsInstructionBreakpoints: true,
      supportsDisassembleRequest: true,
      supportsSteppingGranularity: true,
    });
    await harness.launchToConfiguration();
    assert.deepEqual(
      harness.readRequests().map((request) => request.command),
      ["hello", "load", "reset"],
    );
    const stopped = await harness.configure();
    assert.deepEqual(stopped.body, { reason: "entry", threadId: 1 });
    assert.equal(
      harness.dap.queued.some((message) => message.event === "continued"),
      false,
    );
    await harness.disconnect();
    assert.equal(
      harness.readRequests().filter((request) => request.command === "terminate")
        .length,
      1,
    );
  } finally {
    await harness.close();
  }
});

void test("AC-002 exposes one thread, one truthful frame, and one atomic read-only register snapshot", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({ scenario: "register-snapshot" });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();

    harness.send("threads", {});
    const threads = await harness.dap.next();
    assertSuccess(threads, "threads");
    assert.deepEqual(asRecords(asRecord(threads.body).threads), [
      { id: 1, name: "SAB80535" },
    ]);

    harness.send("stackTrace", { threadId: 1 });
    const stack = await harness.dap.next();
    assertSuccess(stack, "stackTrace");
    const frames = asRecords(asRecord(stack.body).stackFrames);
    assert.equal(frames.length, 1);
    assert.deepEqual(
      {
        name: frames[0]?.name,
        line: frames[0]?.line,
        column: frames[0]?.column,
        instructionPointerReference: frames[0]?.instructionPointerReference,
      },
      {
        name: "0x0000",
        line: 0,
        column: 0,
        instructionPointerReference: "code:0000",
      },
    );
    assert.equal(typeof frames[0]?.id, "number");

    harness.send("scopes", { frameId: frames[0]?.id });
    const scopes = await harness.dap.next();
    assertSuccess(scopes, "scopes");
    const scopeEntries = asRecords(asRecord(scopes.body).scopes);
    assert.deepEqual(
      {
        name: scopeEntries[0]?.name,
        presentationHint: scopeEntries[0]?.presentationHint,
        namedVariables: scopeEntries[0]?.namedVariables,
        expensive: scopeEntries[0]?.expensive,
      },
      {
        name: "Registers",
        presentationHint: "registers",
        namedVariables: 14,
        expensive: false,
      },
    );

    harness.send("variables", {
      variablesReference: scopeEntries[0]?.variablesReference,
    });
    const variables = await harness.dap.next();
    assertSuccess(variables, "variables");
    assert.deepEqual(
      asRecords(asRecord(variables.body).variables).map((variable) => [
        variable.name,
        variable.value,
        variable.variablesReference,
      ]),
      [
        ["PC", "0x0000", 0],
        ["A", "0x12", 0],
        ["B", "0x34", 0],
        ["PSW", "0x18", 0],
        ["SP", "0x7F", 0],
        ["DPTR", "0xABCD", 0],
        ["R0", "0x10", 0],
        ["R1", "0x21", 0],
        ["R2", "0x32", 0],
        ["R3", "0x43", 0],
        ["R4", "0x54", 0],
        ["R5", "0x65", 0],
        ["R6", "0x76", 0],
        ["R7", "0x87", 0],
      ],
    );
    await harness.disconnect();
  } finally {
    await harness.close();
  }
});

void test("AC-003 disassembly maps exact decoder records, known predecessors, and whole-range failures", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({ logRequests: true });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();

    harness.send("disassemble", {
      memoryReference: "code:0000",
      offset: 0,
      instructionOffset: 0,
      instructionCount: 3,
    });
    const forward = await harness.dap.next();
    assertSuccess(forward, "disassemble");
    assert.deepEqual(asRecords(asRecord(forward.body).instructions), [
      {
        address: "0x0000",
        instruction: "MOV A,#0x01",
        presentationHint: "normal",
      },
      {
        address: "0x0002",
        instruction: "INC A",
        presentationHint: "normal",
      },
      {
        address: "0x0003",
        instruction: "SJMP 0x0002",
        presentationHint: "normal",
      },
    ]);

    harness.send("disassemble", {
      memoryReference: "code:0000",
      offset: 2,
      instructionOffset: 0,
      instructionCount: 1,
    });
    const byteOffset = await harness.dap.next();
    assertSuccess(byteOffset, "disassemble");
    assert.deepEqual(asRecords(asRecord(byteOffset.body).instructions), [
      {
        address: "0x0002",
        instruction: "INC A",
        presentationHint: "normal",
      },
    ]);

    const decodeCountBeforeOverflow = harness
      .readRequests()
      .filter((request) => request.command === "decodeCode").length;
    harness.send("disassemble", {
      memoryReference: "code:FFFF",
      offset: 1,
      instructionCount: 1,
    });
    assertFailure(
      await harness.dap.next(),
      "disassemble",
      "EMU_MEMORY_RANGE",
    );
    assert.equal(
      harness
        .readRequests()
        .filter((request) => request.command === "decodeCode").length,
      decodeCountBeforeOverflow,
    );

    harness.send("stepIn", { threadId: 1, granularity: "instruction" });
    assertSuccess(await harness.dap.next(), "stepIn");
    assert.equal((await harness.dap.next()).event, "stopped");
    harness.send("disassemble", {
      memoryReference: "code:0002",
      offset: 0,
      instructionOffset: -1,
      instructionCount: 2,
    });
    const predecessor = await harness.dap.next();
    assertSuccess(predecessor, "disassemble");
    assert.deepEqual(
      asRecords(asRecord(predecessor.body).instructions).map((entry) => [
        entry.address,
        entry.instruction,
        entry.presentationHint,
      ]),
      [
        ["0x0000", "MOV A,#0x01", "normal"],
        ["0x0002", "INC A", "normal"],
      ],
    );

    harness.send("disassemble", {
      memoryReference: "code:0000",
      instructionOffset: -1,
      instructionCount: 1,
    });
    const rangeFailure = await harness.dap.next();
    assertFailure(rangeFailure, "disassemble", "RANGE");
    assert.equal("instructions" in asRecord(rangeFailure.body), false);

    const decodeRequests = harness
      .readRequests()
      .filter((request) => request.command === "decodeCode");
    assert.deepEqual(decodeRequests[2]?.arguments, {
      reference: 2,
      byteOffset: 0,
      instructionOffset: -1,
      instructionCount: 2,
    });
    await harness.disconnect();
  } finally {
    await harness.close();
  }
});

void test("AC-003 unknown negative predecessors are explicit one-byte invalid placeholders", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({ entryAddress: "0x0002" });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();
    harness.send("disassemble", {
      memoryReference: "code:0002",
      instructionOffset: -2,
      instructionCount: 3,
    });
    const response = await harness.dap.next();
    assertSuccess(response, "disassemble");
    assert.deepEqual(asRecords(asRecord(response.body).instructions), [
      {
        address: "0x0000",
        instruction: "<invalid>",
        presentationHint: "invalid",
      },
      {
        address: "0x0001",
        instruction: "<invalid>",
        presentationHint: "invalid",
      },
      {
        address: "0x0002",
        instruction: "INC A",
        presentationHint: "normal",
      },
    ]);
    await harness.disconnect();
  } finally {
    await harness.close();
  }
});

void test("AC-004 replacement breakpoints apply offsets once, preserve order, and stop before execution", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({ logRequests: true });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    harness.send("setInstructionBreakpoints", {
      breakpoints: [{ instructionReference: "0xFFFF", offset: 1 }],
    });
    const overflow = await harness.dap.next();
    assertSuccess(overflow, "setInstructionBreakpoints");
    assert.deepEqual(asRecords(asRecord(overflow.body).breakpoints), [
      {
        verified: false,
        message:
          "EMU_MEMORY_RANGE: instruction reference plus offset leaves the 16-bit CODE range",
      },
    ]);
    harness.send("setInstructionBreakpoints", {
      breakpoints: [
        { instructionReference: "0x0001", offset: 1 },
        { instructionReference: "2" },
        { instructionReference: "0x0003" },
      ],
    });
    const breakpoints = await harness.dap.next();
    assertSuccess(breakpoints, "setInstructionBreakpoints");
    assert.deepEqual(asRecords(asRecord(breakpoints.body).breakpoints), [
      { verified: true, instructionReference: "code:0002" },
      { verified: true, instructionReference: "code:0002" },
      {
        verified: false,
        instructionReference: "code:0003",
        message: "EMU_BREAKPOINT_LIMIT: negotiated limit is 1",
      },
    ]);
    assert.deepEqual(
      harness
        .readRequests()
        .filter((request) => request.command === "replaceCodeBreakpoints")[1]
        ?.arguments,
      { addresses: [2] },
    );
    await harness.configure();

    harness.send("continue", { threadId: 1 });
    const continued = await harness.dap.next();
    assertSuccess(continued, "continue");
    assert.deepEqual(continued.body, { allThreadsContinued: true });
    const stopped = await harness.dap.next();
    assert.deepEqual(stopped.body, {
      reason: "instruction breakpoint",
      threadId: 1,
    });
    assert.equal(
      harness.dap.queued.some((message) => message.event === "continued"),
      false,
    );

    harness.send("stackTrace", { threadId: 1 });
    const stack = await harness.dap.next();
    const frameId = asRecords(asRecord(stack.body).stackFrames)[0]?.id;
    harness.send("scopes", { frameId });
    const scope = await harness.dap.next();
    const variablesReference = asRecords(asRecord(scope.body).scopes)[0]
      ?.variablesReference;
    harness.send("variables", { variablesReference });
    const variables = asRecords(
      asRecord((await harness.dap.next()).body).variables,
    );
    assert.deepEqual(
      variables.slice(0, 2).map((variable) => [variable.name, variable.value]),
      [
        ["PC", "0x0002"],
        ["A", "0x01"],
      ],
    );

    harness.send("setInstructionBreakpoints", { breakpoints: [] });
    const cleared = await harness.dap.next();
    assertSuccess(cleared, "setInstructionBreakpoints");
    assert.deepEqual(asRecord(cleared.body).breakpoints, []);
    assert.deepEqual(
      harness
        .readRequests()
        .filter((request) => request.command === "replaceCodeBreakpoints")
        .map((request) => request.arguments),
      [{ addresses: [] }, { addresses: [2] }, { addresses: [] }],
    );
    await harness.disconnect();
  } finally {
    await harness.close();
  }
});

void test("AC-005 and AC-007 exact step invalidates old handles while unsupported stepping never resumes", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({
    logRequests: true,
    delayCommand: "stepInstruction",
    delayMs: 40,
  });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();
    harness.send("stackTrace", { threadId: 1 });
    const oldStack = await harness.dap.next();
    const oldFrame = asRecords(asRecord(oldStack.body).stackFrames)[0]?.id;
    harness.send("scopes", { frameId: oldFrame });
    const oldScopeResponse = await harness.dap.next();
    const oldVariables = asRecords(asRecord(oldScopeResponse.body).scopes)[0]
      ?.variablesReference;

    harness.send("stepIn", { threadId: 1, granularity: "line" });
    assertFailure(await harness.dap.next(), "stepIn", "DAP_UNSUPPORTED");
    harness.send("next", { threadId: 1 });
    assertFailure(await harness.dap.next(), "next", "DAP_UNSUPPORTED");
    harness.send("stepOut", { threadId: 1 });
    assertFailure(await harness.dap.next(), "stepOut", "DAP_UNSUPPORTED");
    assert.equal(
      harness.readRequests().some((request) => request.command === "stepInstruction"),
      false,
    );

    harness.send("stepIn", { threadId: 1 });
    harness.send("scopes", { frameId: oldFrame });
    assertFailure(
      await harness.dap.next(),
      "scopes",
      "EMU_STATE_NOT_STOPPED",
    );
    assertSuccess(await harness.dap.next(), "stepIn");
    assert.deepEqual((await harness.dap.next()).body, {
      reason: "step",
      threadId: 1,
    });

    harness.send("scopes", { frameId: oldFrame });
    assertFailure(await harness.dap.next(), "scopes", "EMU_HANDLE_STALE");
    harness.send("variables", { variablesReference: oldVariables });
    assertFailure(await harness.dap.next(), "variables", "EMU_HANDLE_STALE");
    harness.send("stackTrace", { threadId: 1 });
    const newFrame = asRecords(
      asRecord((await harness.dap.next()).body).stackFrames,
    )[0]?.id;
    assert.notEqual(newFrame, oldFrame);

    for (const granularity of ["statement", "instruction"] as const) {
      harness.send("stepIn", { threadId: 1, granularity });
      assertSuccess(await harness.dap.next(), "stepIn");
      assert.deepEqual((await harness.dap.next()).body, {
        reason: "step",
        threadId: 1,
      });
    }
    assert.equal(
      harness
        .readRequests()
        .filter((request) => request.command === "stepInstruction").length,
      3,
    );
    await harness.disconnect();
  } finally {
    await harness.close();
  }
});

void test("AC-006 pause responds before one stop and schedules no chunk after intent", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({
    logRequests: true,
    delayCommand: "run",
    delayMs: 80,
  });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();
    harness.send("continue", { threadId: 1 });
    assertSuccess(await harness.dap.next(), "continue");
    harness.send("pause", { threadId: 1 });
    const pauseResponse = await harness.dap.next();
    assertSuccess(pauseResponse, "pause");
    const stopped = await harness.dap.next();
    assert.deepEqual(stopped.body, { reason: "pause", threadId: 1 });
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    assert.equal(
      harness.readRequests().filter((request) => request.command === "run").length,
      1,
    );
    assert.equal(
      harness.dap.queued.some((message) => message.event === "continued"),
      false,
    );
    harness.send("pause", { threadId: 1 });
    assertFailure(await harness.dap.next(), "pause", "EMU_STATE_NOT_RUNNING");
    await harness.disconnect();
  } finally {
    await harness.close();
  }
});

void test("AC-006 run timeout after pause intent terminates and never promotes an unproven boundary", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({
    logRequests: true,
    delayCommand: "run",
    delayMs: 200,
    commandTimeoutMs: 50,
  });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();
    harness.send("continue", { threadId: 1 });
    assertSuccess(await harness.dap.next(), "continue");
    harness.send("pause", { threadId: 1 });
    assertSuccess(await harness.dap.next(), "pause");
    const diagnostic = await harness.dap.next();
    assert.equal(diagnostic.event, "output");
    assert.match(
      String(asRecord(diagnostic.body).output),
      /^EMU_TRANSPORT_TIMEOUT:/,
    );
    const terminated = await harness.dap.next();
    assert.equal(terminated.event, "terminated");
    assert.equal(
      harness.dap.queued.some((message) => message.event === "stopped"),
      false,
    );
    assert.equal(
      harness.readRequests().filter((request) => request.command === "run").length,
      1,
    );
  } finally {
    await harness.close();
  }
});

void test("bounded continue remains logically running across repeated yields until pause", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({ logRequests: true });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();
    harness.send("continue", { threadId: 1 });
    assertSuccess(await harness.dap.next(), "continue");
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    harness.send("pause", { threadId: 1 });
    assertSuccess(await harness.dap.next(), "pause");
    assert.deepEqual((await harness.dap.next()).body, {
      reason: "pause",
      threadId: 1,
    });
    assert.ok(
      harness.readRequests().filter((request) => request.command === "run")
        .length > 1,
    );
    await harness.disconnect();
  } finally {
    await harness.close();
  }
});

void test("AC-008 DAP launch failures remain actionable and terminal for every required failure family", async (context) => {
  const cases: Array<{
    name: string;
    options: SessionOptions;
    code: string | RegExp;
  }> = [
    {
      name: "missing executable",
      options: {
        emulatorPath: path.join(
          repositoryRoot,
          "definitely-missing",
          "emu-debug.exe",
        ),
      },
      code: "CONFIG_EMULATOR_NOT_FOUND",
    },
    {
      name: "protocol major mismatch",
      options: { scenario: "major-mismatch" },
      code: "EMU_VERSION_MAJOR",
    },
    {
      name: "missing capability",
      options: { scenario: "missing-capability" },
      code: "EMU_VERSION_CAPABILITY",
    },
    {
      name: "malformed protocol record",
      options: { scenario: "malformed-hello" },
      code: "EMU_TRANSPORT_MALFORMED",
    },
    {
      name: "command timeout",
      options: { scenario: "timeout-hello", commandTimeoutMs: 50 },
      code: "EMU_TRANSPORT_TIMEOUT",
    },
    {
      name: "child crash or EOF",
      options: { scenario: "crash-hello" },
      code: /^EMU_TRANSPORT_(?:EOF|EXIT):/,
    },
  ];

  for (const testCase of cases) {
    await context.test(testCase.name, { timeout: 10_000 }, async () => {
      const harness = new DapHarness(testCase.options);
      try {
        await harness.initialize();
        harness.sendLaunch();
        const launch = await harness.dap.next();
        assert.equal(launch.command, "launch");
        assert.equal(launch.success, false);
        if (typeof testCase.code === "string") {
          assert.match(
            launch.message ?? "",
            new RegExp(`^${testCase.code}:`),
          );
        } else {
          assert.match(launch.message ?? "", testCase.code);
        }
        const terminated = await harness.dap.next();
        assert.equal(terminated.event, "terminated");
        assert.equal(
          harness.dap.queued.some(
            (message) =>
              message.event === "initialized" || message.event === "stopped",
          ),
          false,
        );
      } finally {
        await harness.close();
      }
    });
  }
});

void test("AC-009 disconnect during an active chunk reaps the child and emits terminated exactly once", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({
    logRequests: true,
    delayCommand: "run",
    delayMs: 80,
  });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();
    const processId = harness.backend.ownedProcessId;
    assert.equal(typeof processId, "number");
    harness.send("continue", { threadId: 1 });
    assertSuccess(await harness.dap.next(), "continue");
    harness.send("disconnect", {});
    assertSuccess(await harness.dap.next(), "disconnect");
    assert.equal((await harness.dap.next()).event, "terminated");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(
      harness.dap.queued.some(
        (message) =>
          message.event === "stopped" || message.event === "terminated",
      ),
      false,
    );
    assert.deepEqual(
      harness
        .readRequests()
        .filter(
          (request) => request.command === "run" || request.command === "terminate",
        )
        .map((request) => request.command),
      ["run", "terminate"],
    );
    if (processId !== undefined) {
      assert.throws(() => process.kill(processId, 0));
    }

    harness.send("disconnect", {});
    assertSuccess(await harness.dap.next(), "disconnect");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(harness.dap.queued.length, 0);
  } finally {
    await harness.close();
  }
});

void test("malformed Worker-C DAP arguments fail without a child command or state mutation", { timeout: 10_000 }, async () => {
  const harness = new DapHarness({ logRequests: true });
  try {
    await harness.initialize();
    await harness.launchToConfiguration();
    await harness.configure();
    const before = harness.readRequests().length;

    harness.send("stackTrace", {});
    assertFailure(await harness.dap.next(), "stackTrace", "EMU_THREAD_INVALID");
    harness.send("disassemble", {});
    assertFailure(
      await harness.dap.next(),
      "disassemble",
      "EMU_MEMORY_REFERENCE",
    );
    harness.send("setInstructionBreakpoints", {});
    assertFailure(
      await harness.dap.next(),
      "setInstructionBreakpoints",
      "EMU_BREAKPOINT_INVALID",
    );
    harness.send("continue", {});
    assertFailure(await harness.dap.next(), "continue", "EMU_THREAD_INVALID");
    harness.send("stepIn", { threadId: 1, granularity: 42 });
    assertFailure(await harness.dap.next(), "stepIn", "DAP_UNSUPPORTED");

    assert.equal(harness.readRequests().length, before);
    harness.send("threads", {});
    assertSuccess(await harness.dap.next(), "threads");
    await harness.disconnect();
  } finally {
    await harness.close();
  }
});
