import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import type { ValidatedLaunchConfiguration } from "../adapter/src/launchConfiguration";
import {
  EmuDebugSession,
  type LaunchBackend,
} from "../adapter/src/session";

interface DapMessage {
  type: string;
  command?: string;
  event?: string;
  request_seq?: number;
  success?: boolean;
  message?: string;
  body?: unknown;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

class ControlledBackend implements LaunchBackend {
  public readonly launchOperation = deferred<void>();
  public readonly configurations: ValidatedLaunchConfiguration[] = [];
  public disconnectCalls = 0;
  public cleanupFailure: Error | undefined;

  public launch(configuration: ValidatedLaunchConfiguration): Promise<void> {
    this.configurations.push(configuration);
    return this.launchOperation.promise;
  }

  public disconnect(): Promise<void> {
    this.disconnectCalls += 1;
    return this.cleanupFailure === undefined
      ? Promise.resolve()
      : Promise.reject(this.cleanupFailure);
  }
}

function frame(message: object): Buffer {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, "ascii"),
    payload,
  ]);
}

function readDapMessages(stream: NodeJS.ReadableStream): {
  queued: DapMessage[];
  next: () => Promise<DapMessage>;
} {
  let buffer = Buffer.alloc(0);
  const queued: DapMessage[] = [];
  const waiters: Array<(message: DapMessage) => void> = [];

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
        const existing = queued.shift();
        if (existing !== undefined) {
          resolve(existing);
          return;
        }
        waiters.push(resolve);
      }),
  };
}

function createHarness(backend: LaunchBackend): {
  input: PassThrough;
  dap: ReturnType<typeof readDapMessages>;
  close: () => void;
} {
  const input = new PassThrough();
  const output = new PassThrough();
  const dap = readDapMessages(output);
  new EmuDebugSession(undefined, undefined, backend).start(input, output);
  return {
    input,
    dap,
    close: () => {
      input.destroy();
      output.destroy();
    },
  };
}

function sendRequest(
  input: PassThrough,
  seq: number,
  command: string,
  args: object,
): void {
  input.write(
    frame({
      seq,
      type: "request",
      command,
      arguments: args,
    }),
  );
}

async function initialize(
  input: PassThrough,
  dap: ReturnType<typeof readDapMessages>,
): Promise<void> {
  sendRequest(input, 1, "initialize", {
    adapterID: "emuSA80535",
    pathFormat: "path",
    linesStartAt1: true,
    columnsStartAt1: true,
  });
  const response = await dap.next();
  assert.equal(response.command, "initialize");
  assert.equal(response.success, true);
}

function sendValidLaunch(input: PassThrough, seq = 2): void {
  sendRequest(input, seq, "launch", {
    type: "emuSA80535",
    request: "launch",
    name: "lifecycle test",
    program: "firmware.bin",
    entryAddress: "0x0000",
    resetSeed: 525109,
    stopOnEntry: true,
    trace: "off",
  });
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

async function settleEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

for (const completion of ["succeeds", "fails"] as const) {
  void test(
    `disconnect makes a pending launch terminal when the stale backend later ${completion}`,
    { timeout: 10_000 },
    async () => {
      const backend = new ControlledBackend();
      const harness = createHarness(backend);
      try {
        await initialize(harness.input, harness.dap);
        sendValidLaunch(harness.input);
        assert.equal(backend.configurations.length, 1);

        sendRequest(harness.input, 3, "disconnect", {});
        assertFailure(
          await harness.dap.next(),
          "launch",
          "EMU_LAUNCH_CANCELLED",
        );
        const disconnectResponse = await harness.dap.next();
        assert.equal(disconnectResponse.command, "disconnect");
        assert.equal(disconnectResponse.success, true);
        assert.deepEqual(await harness.dap.next(), {
          seq: 4,
          type: "event",
          event: "terminated",
        });

        if (completion === "succeeds") {
          backend.launchOperation.resolve();
        } else {
          backend.launchOperation.reject(new Error("late launch failure"));
        }
        await settleEventLoop();

        assert.equal(
          harness.dap.queued.some(
            (message) =>
              message.event === "initialized" ||
              (message.command === "launch" && message.success === true),
          ),
          false,
        );
        assert.equal(harness.dap.queued.length, 0);
      } finally {
        harness.close();
      }
    },
  );
}

void test("configurationDone is rejected after disconnect without reopening state", { timeout: 10_000 }, async () => {
  const backend = new ControlledBackend();
  const harness = createHarness(backend);
  try {
    await initialize(harness.input, harness.dap);
    sendRequest(harness.input, 2, "disconnect", {});
    assert.equal((await harness.dap.next()).success, true);
    assert.equal((await harness.dap.next()).event, "terminated");

    sendRequest(harness.input, 3, "configurationDone", {});
    assertFailure(
      await harness.dap.next(),
      "configurationDone",
      "DAP_SESSION_TERMINATED",
    );
    assert.equal(harness.dap.queued.length, 0);
  } finally {
    harness.close();
  }
});

void test("a duplicate launch is rejected while the original launch retains ownership", { timeout: 10_000 }, async () => {
  const backend = new ControlledBackend();
  const harness = createHarness(backend);
  try {
    await initialize(harness.input, harness.dap);
    sendValidLaunch(harness.input, 2);
    sendValidLaunch(harness.input, 3);
    assertFailure(
      await harness.dap.next(),
      "launch",
      "EMU_LAUNCH_ALREADY_STARTED",
    );
    assert.equal(backend.configurations.length, 1);

    backend.launchOperation.resolve();
    assert.equal((await harness.dap.next()).event, "initialized");
    sendRequest(harness.input, 4, "configurationDone", {});
    const configurationResponse = await harness.dap.next();
    assert.equal(configurationResponse.command, "configurationDone");
    assert.equal(configurationResponse.success, true);
    const launchResponse = await harness.dap.next();
    assert.equal(launchResponse.command, "launch");
    assert.equal(launchResponse.request_seq, 2);
    assert.equal(launchResponse.success, true);

    sendRequest(harness.input, 5, "disconnect", {});
    assert.equal((await harness.dap.next()).success, true);
    assert.equal((await harness.dap.next()).event, "terminated");
  } finally {
    harness.close();
  }
});

void test("launch is rejected after termination and never reaches the backend", { timeout: 10_000 }, async () => {
  const backend = new ControlledBackend();
  const harness = createHarness(backend);
  try {
    await initialize(harness.input, harness.dap);
    sendRequest(harness.input, 2, "disconnect", {});
    assert.equal((await harness.dap.next()).success, true);
    assert.equal((await harness.dap.next()).event, "terminated");

    sendValidLaunch(harness.input, 3);
    assertFailure(
      await harness.dap.next(),
      "launch",
      "DAP_SESSION_TERMINATED",
    );
    assert.equal(backend.configurations.length, 0);
  } finally {
    harness.close();
  }
});

void test("cleanup rejection fails disconnect actionably and still terminates exactly once", { timeout: 10_000 }, async () => {
  const backend = new ControlledBackend();
  backend.cleanupFailure = new Error("child did not exit");
  const harness = createHarness(backend);
  try {
    await initialize(harness.input, harness.dap);
    sendValidLaunch(harness.input);
    sendRequest(harness.input, 3, "disconnect", {});

    assertFailure(
      await harness.dap.next(),
      "launch",
      "EMU_LAUNCH_CANCELLED",
    );
    const disconnectResponse = await harness.dap.next();
    assertFailure(
      disconnectResponse,
      "disconnect",
      "EMU_CLEANUP_FAILED",
    );
    assert.match(disconnectResponse.message ?? "", /no child process remains/);
    assert.equal((await harness.dap.next()).event, "terminated");
    assert.equal(backend.disconnectCalls, 1);

    backend.launchOperation.resolve();
    await settleEventLoop();
    assert.equal(harness.dap.queued.length, 0);

    sendRequest(harness.input, 4, "disconnect", {});
    assert.equal((await harness.dap.next()).success, true);
    await settleEventLoop();
    assert.equal(harness.dap.queued.length, 0);
  } finally {
    harness.close();
  }
});

void test("cleanup rejection after launch failure emits an actionable diagnostic before termination", { timeout: 10_000 }, async () => {
  const backend = new ControlledBackend();
  backend.cleanupFailure = new Error("cleanup pipe refused close");
  const harness = createHarness(backend);
  try {
    await initialize(harness.input, harness.dap);
    sendValidLaunch(harness.input);
    backend.launchOperation.reject(new Error("handshake rejected"));

    assertFailure(
      await harness.dap.next(),
      "launch",
      "EMU_INTEGRATION_PENDING",
    );
    const diagnostic = await harness.dap.next();
    assert.equal(diagnostic.event, "output");
    const output = diagnostic.body as {
      category?: string;
      output?: string;
    };
    assert.equal(output.category, "stderr");
    assert.match(output.output ?? "", /^EMU_CLEANUP_FAILED:/);
    assert.match(output.output ?? "", /verify that no child process remains/);
    assert.equal((await harness.dap.next()).event, "terminated");
    assert.equal(backend.disconnectCalls, 1);

    sendRequest(harness.input, 3, "disconnect", {});
    assert.equal((await harness.dap.next()).success, true);
    await settleEventLoop();
    assert.equal(harness.dap.queued.length, 0);
  } finally {
    harness.close();
  }
});

void test("raw JSON types fail with stable configuration codes before any backend call", { timeout: 10_000 }, async (context) => {
  const cases: Array<{
    name: string;
    value: unknown;
    field: "stopOnEntry" | "emulatorPath";
    code: string;
  }> = [
    {
      name: "string stopOnEntry",
      field: "stopOnEntry",
      value: "false",
      code: "CONFIG_STOP_ON_ENTRY",
    },
    {
      name: "numeric stopOnEntry",
      field: "stopOnEntry",
      value: 1,
      code: "CONFIG_STOP_ON_ENTRY",
    },
    {
      name: "numeric emulatorPath",
      field: "emulatorPath",
      value: 42,
      code: "CONFIG_EMULATOR_PATH",
    },
    {
      name: "empty emulatorPath",
      field: "emulatorPath",
      value: "",
      code: "CONFIG_EMULATOR_PATH",
    },
  ];

  for (const testCase of cases) {
    await context.test(testCase.name, async () => {
      const backend = new ControlledBackend();
      const harness = createHarness(backend);
      try {
        await initialize(harness.input, harness.dap);
        const launchArguments: Record<string, unknown> = {
          type: "emuSA80535",
          request: "launch",
          name: "raw type test",
          program: "firmware.bin",
          stopOnEntry: true,
          trace: "off",
        };
        launchArguments[testCase.field] = testCase.value;
        sendRequest(harness.input, 2, "launch", launchArguments);

        assertFailure(await harness.dap.next(), "launch", testCase.code);
        assert.equal((await harness.dap.next()).event, "terminated");
        assert.equal(backend.configurations.length, 0);
        assert.equal(backend.disconnectCalls, 0);
      } finally {
        harness.close();
      }
    });
  }
});
