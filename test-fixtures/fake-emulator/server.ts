import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const MAX_RECORD_BYTES = 65_536;
const MAX_BREAKPOINTS = 1;
const MAX_RUN_CHUNK = 1_024;
const MAX_DISASSEMBLE = 256;
const CAPABILITIES = [
  "rawCode64k",
  "deterministicReset",
  "snapshotBasicRegisters",
  "decodeCode",
  "replaceCodeBreakpoints",
  "boundedRun",
  "stepInstruction",
];

type JsonObject = Record<string, unknown>;

interface FakeOptions {
  scenario: string;
  requestsLog?: string;
  delayCommand?: string;
  delayMs: number;
}

interface RequestRecord {
  type: "request";
  id: number;
  command: string;
  arguments?: JsonObject;
}

interface Snapshot {
  state: "idle";
  resultKind: "architectural-stop" | "yield";
  reason: "entry" | "breakpoint" | "step" | "exception" | "halt" | "yield";
  pc: number;
  registers: {
    a: number;
    b: number;
    psw: number;
    sp: number;
    dptr: number;
    r: number[];
  };
  variant: "sab80535";
  instructionCount: number;
  machineCycleCount: number;
}

interface Decoded {
  address: number;
  size: number;
  valid: boolean;
  text: string;
  reason?: "unknown-predecessor";
}

function parseOptions(argv: readonly string[]): FakeOptions {
  const options: FakeOptions = {
    scenario: process.env.EMU_FAKE_SCENARIO ?? "compatible",
    delayMs: 0,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--headless-debug") {
      continue;
    }
    const value = argv[index + 1];
    if (argument === "--scenario" && value !== undefined) {
      options.scenario = value;
      index += 1;
    } else if (argument === "--requests-log" && value !== undefined) {
      options.requestsLog = path.resolve(value);
      index += 1;
    } else if (argument === "--delay-command" && value !== undefined) {
      options.delayCommand = value;
      index += 1;
    } else if (argument === "--delay-ms" && value !== undefined) {
      options.delayMs = Number.parseInt(value, 10);
      index += 1;
    } else {
      process.stderr.write(`unknown fake-emulator option: ${String(argument)}\n`);
      process.exit(64);
    }
  }
  if (!Number.isSafeInteger(options.delayMs) || options.delayMs < 0) {
    process.stderr.write("--delay-ms must be a non-negative integer\n");
    process.exit(64);
  }
  return options;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= minimum &&
    (value as number) <= maximum
  );
}

class FakeEmulator {
  private firstCommand = true;
  private loadedImage: Buffer | undefined;
  private snapshot: Snapshot | undefined;
  private breakpoints = new Set<number>();
  private readonly knownPredecessor = new Map<number, number>();

  public constructor(private readonly options: FakeOptions) {
    if (options.scenario === "stderr-diagnostic") {
      process.stderr.write(
        `${JSON.stringify({
          level: "info",
          code: "FAKE_READY",
          message: "headless debug server ready",
        })}\n`,
      );
    }
  }

  public async accept(raw: unknown): Promise<void> {
    const request = this.validateRequest(raw);
    this.observe(request);
    if (this.firstCommand && request.command !== "hello") {
      this.error(
        request,
        "INVALID_STATE",
        "hello must be the first command",
      );
      return;
    }
    if (!this.firstCommand && request.command === "hello") {
      this.error(request, "INVALID_STATE", "hello is accepted exactly once");
      return;
    }
    this.firstCommand = false;

    if (this.options.delayCommand === request.command) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.options.delayMs),
      );
    }
    if (
      this.options.scenario === `timeout-${request.command}` ||
      (this.options.scenario === "timeout-hello" && request.command === "hello")
    ) {
      return;
    }
    if (
      this.options.scenario === `crash-${request.command}` ||
      (this.options.scenario === "crash-hello" && request.command === "hello")
    ) {
      process.exit(47);
    }

    switch (request.command) {
      case "hello":
        this.hello(request);
        break;
      case "load":
        this.load(request);
        break;
      case "reset":
        this.reset(request);
        break;
      case "getState":
        this.state(request);
        break;
      case "decodeCode":
        this.decodeCode(request);
        break;
      case "replaceCodeBreakpoints":
        this.replaceCodeBreakpoints(request);
        break;
      case "run":
        this.run(request);
        break;
      case "stepInstruction":
        this.stepInstruction(request);
        break;
      case "terminate":
        this.terminate(request);
        break;
      default:
        this.error(
          request,
          "UNSUPPORTED_COMMAND",
          `unsupported command ${request.command}`,
        );
    }
  }

  private validateRequest(value: unknown): RequestRecord {
    if (!isObject(value)) {
      throw new Error("request must be an object");
    }
    if (
      value.type !== "request" ||
      !integer(value.id, 1, Number.MAX_SAFE_INTEGER) ||
      typeof value.command !== "string" ||
      value.command.length === 0 ||
      (value.arguments !== undefined && !isObject(value.arguments))
    ) {
      throw new Error("invalid request envelope");
    }
    const request: RequestRecord = {
      type: "request",
      id: value.id,
      command: value.command,
    };
    if (value.arguments !== undefined) {
      request.arguments = value.arguments;
    }
    return request;
  }

  private observe(request: RequestRecord): void {
    if (this.options.requestsLog === undefined) {
      return;
    }
    fs.appendFileSync(
      this.options.requestsLog,
      `${JSON.stringify({ command: request.command, arguments: request.arguments })}\n`,
      "utf8",
    );
  }

  private hello(request: RequestRecord): void {
    const protocol = request.arguments?.protocol;
    const requiredCapabilities = request.arguments?.requiredCapabilities;
    if (
      !isObject(protocol) ||
      protocol.major !== 1 ||
      protocol.minor !== 0 ||
      !Array.isArray(requiredCapabilities) ||
      requiredCapabilities.some((capability) => typeof capability !== "string")
    ) {
      this.error(request, "INVALID_REQUEST", "invalid hello arguments");
      return;
    }
    if (this.options.scenario === "malformed-hello") {
      process.stdout.write("{not-json}\n");
      return;
    }
    if (this.options.scenario === "invalid-utf8") {
      process.stdout.write(Buffer.from([0xff, 0x0a]));
      return;
    }
    const major = this.options.scenario === "major-mismatch" ? 2 : 1;
    const minor = this.options.scenario === "minor-compatible" ? 7 : 0;
    const capabilities =
      this.options.scenario === "missing-capability"
        ? CAPABILITIES.filter((capability) => capability !== "boundedRun")
        : CAPABILITIES;
    const body: JsonObject = {
      protocol: { major, minor },
      product: "emuSA80535-N",
      productVersion: "fake-contract-1.0",
      commit: "fake-slice1-contract",
      variants: ["sab80535"],
      capabilities,
      limits: {
        maxBreakpoints: MAX_BREAKPOINTS,
        maxRunChunkInstructions: MAX_RUN_CHUNK,
        maxDisassembleInstructions: MAX_DISASSEMBLE,
        maxRecordBytes: MAX_RECORD_BYTES,
      },
    };
    if (this.options.scenario === "minor-compatible") {
      body.futureCompatibleField = { ignored: true };
    }
    if (this.options.scenario === "oversize-hello") {
      body.padding = "x".repeat(MAX_RECORD_BYTES);
    }
    const id = this.options.scenario === "mismatch-id" ? request.id + 1 : request.id;
    const command =
      this.options.scenario === "mismatch-command" ? "load" : request.command;
    this.write({
      type: "response",
      id,
      command,
      success: true,
      body,
    });
  }

  private load(request: RequestRecord): void {
    const args = request.arguments;
    if (
      args === undefined ||
      typeof args.path !== "string" ||
      !path.isAbsolute(args.path) ||
      args.format !== "raw-code-64k" ||
      typeof args.expectedSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(args.expectedSha256)
    ) {
      this.error(request, "INVALID_REQUEST", "invalid raw image load arguments");
      return;
    }
    let image: Buffer;
    try {
      image = fs.readFileSync(args.path);
    } catch (error: unknown) {
      this.error(
        request,
        "IMAGE_READ",
        error instanceof Error ? error.message : "image read failed",
      );
      return;
    }
    if (image.length !== 65_536) {
      this.error(
        request,
        "IMAGE_SIZE",
        `raw image must be exactly 65536 bytes; received ${image.length}`,
      );
      return;
    }
    const digest = createHash("sha256").update(image).digest("hex");
    if (digest !== args.expectedSha256) {
      this.error(request, "IMAGE_HASH", "raw image SHA-256 does not match");
      return;
    }
    this.loadedImage = image;
    this.snapshot = undefined;
    this.knownPredecessor.clear();
    this.success(request, { sha256: digest });
  }

  private reset(request: RequestRecord): void {
    const args = request.arguments;
    if (
      this.loadedImage === undefined ||
      args === undefined ||
      !integer(args.seed, 0, 0xffff_ffff) ||
      !integer(args.entryAddress, 0, 0xffff)
    ) {
      this.error(
        request,
        this.loadedImage === undefined ? "INVALID_STATE" : "INVALID_REQUEST",
        "reset requires a loaded image, uint32 seed, and uint16 entryAddress",
      );
      return;
    }
    this.breakpoints.clear();
    this.snapshot = this.makeSnapshot(
      args.entryAddress,
      "architectural-stop",
      "entry",
      0,
      0,
      0,
    );
    this.success(request, this.snapshot);
  }

  private state(request: RequestRecord): void {
    if (this.snapshot === undefined) {
      this.error(request, "INVALID_STATE", "no instruction boundary is available");
      return;
    }
    if (this.options.scenario === "malformed-state") {
      this.success(request, {});
      return;
    }
    this.success(request, this.snapshot);
  }

  private decodeCode(request: RequestRecord): void {
    const args = request.arguments;
    if (
      this.loadedImage === undefined ||
      args === undefined ||
      !integer(args.reference, 0, 0xffff) ||
      !integer(args.byteOffset, -0x1_0000, 0x1_0000) ||
      !integer(args.instructionOffset, -0x1_0000, 0x1_0000) ||
      !integer(args.instructionCount, 1, MAX_DISASSEMBLE)
    ) {
      this.error(
        request,
        this.loadedImage === undefined ? "INVALID_STATE" : "INVALID_REQUEST",
        "invalid decodeCode arguments",
      );
      return;
    }
    const base = args.reference + args.byteOffset;
    if (!integer(base, 0, 0xffff)) {
      this.error(request, "RANGE", "decodeCode byte offset leaves CODE range");
      return;
    }
    const records: Decoded[] = [];
    if (args.instructionOffset < 0) {
      let cursor = base;
      let predecessorKnown = true;
      for (let count = 0; count < -args.instructionOffset; count += 1) {
        const predecessor = predecessorKnown
          ? this.knownPredecessor.get(cursor)
          : undefined;
        if (predecessor === undefined) {
          predecessorKnown = false;
          cursor -= 1;
          if (cursor < 0) {
            this.error(request, "RANGE", "decodeCode window leaves CODE range");
            return;
          }
          records.unshift({
            address: cursor,
            size: 1,
            valid: false,
            reason: "unknown-predecessor",
            text: "<invalid>",
          });
        } else {
          cursor = predecessor;
          records.unshift(this.decode(cursor));
        }
      }
      let forwardCursor = base;
      while (records.length < args.instructionCount) {
        const decoded = this.decode(forwardCursor);
        records.push(decoded);
        forwardCursor += decoded.size;
        if (forwardCursor > 0x1_0000) {
          this.error(request, "RANGE", "decodeCode window leaves CODE range");
          return;
        }
      }
    } else {
      let cursor = base;
      for (let count = 0; count < args.instructionOffset; count += 1) {
        const decoded = this.decode(cursor);
        cursor += decoded.size;
        if (cursor > 0xffff) {
          this.error(request, "RANGE", "decodeCode window leaves CODE range");
          return;
        }
      }
      while (records.length < args.instructionCount) {
        const decoded = this.decode(cursor);
        records.push(decoded);
        const next = cursor + decoded.size;
        if (next > 0x1_0000) {
          this.error(request, "RANGE", "decodeCode window leaves CODE range");
          return;
        }
        this.knownPredecessor.set(next, cursor);
        cursor = next;
      }
    }
    this.success(request, { instructions: records.slice(0, args.instructionCount) });
  }

  private replaceCodeBreakpoints(request: RequestRecord): void {
    const addresses = request.arguments?.addresses;
    if (
      !Array.isArray(addresses) ||
      addresses.some((address) => !integer(address, 0, 0xffff)) ||
      new Set(addresses).size !== addresses.length
    ) {
      this.error(
        request,
        "INVALID_REQUEST",
        "addresses must be unique uint16 CODE addresses",
      );
      return;
    }
    if (addresses.length > MAX_BREAKPOINTS) {
      this.error(
        request,
        "BREAKPOINT_LIMIT",
        `at most ${MAX_BREAKPOINTS} CODE breakpoint is supported`,
      );
      return;
    }
    this.breakpoints = new Set(addresses as number[]);
    this.success(request, {
      accepted: [...this.breakpoints],
      rejected: [],
      limit: MAX_BREAKPOINTS,
    });
  }

  private run(request: RequestRecord): void {
    const maxInstructions = request.arguments?.maxInstructions;
    if (
      this.snapshot === undefined ||
      !integer(maxInstructions, 1, MAX_RUN_CHUNK)
    ) {
      this.error(
        request,
        this.snapshot === undefined ? "INVALID_STATE" : "INVALID_REQUEST",
        "run requires an idle boundary and a negotiated instruction bound",
      );
      return;
    }
    for (let count = 0; count < maxInstructions; count += 1) {
      if (this.breakpoints.has(this.snapshot.pc)) {
        this.snapshot = {
          ...this.snapshot,
          resultKind: "architectural-stop",
          reason: "breakpoint",
        };
        this.success(request, this.snapshot);
        return;
      }
      this.executeOne();
    }
    this.snapshot = {
      ...this.snapshot,
      resultKind: "yield",
      reason: "yield",
    };
    this.success(request, this.snapshot);
  }

  private stepInstruction(request: RequestRecord): void {
    if (this.snapshot === undefined) {
      this.error(request, "INVALID_STATE", "step requires an idle boundary");
      return;
    }
    this.executeOne();
    this.snapshot = {
      ...this.snapshot,
      resultKind: "architectural-stop",
      reason: "step",
    };
    this.success(request, this.snapshot);
  }

  private terminate(request: RequestRecord): void {
    if (this.options.scenario === "terminate-hang") {
      return;
    }
    this.success(request, { terminated: true });
    process.stdout.write("", () => process.exit(0));
  }

  private executeOne(): void {
    if (this.snapshot === undefined) {
      throw new Error("no snapshot");
    }
    const from = this.snapshot.pc;
    const decoded = this.decode(from);
    let next = (from + decoded.size) & 0xffff;
    let accumulator = this.snapshot.registers.a;
    if (from === 0x0000) {
      accumulator = 1;
    } else if (from === 0x0002) {
      accumulator = (accumulator + 1) & 0xff;
    } else if (from === 0x0003) {
      next = 0x0002;
    }
    this.knownPredecessor.set(next, from);
    this.snapshot = {
      ...this.snapshot,
      pc: next,
      registers: { ...this.snapshot.registers, a: accumulator },
      instructionCount: this.snapshot.instructionCount + 1,
      machineCycleCount: this.snapshot.machineCycleCount + 1,
    };
  }

  private decode(address: number): Decoded {
    if (address === 0x0000) {
      return { address, size: 2, valid: true, text: "MOV A,#0x01" };
    }
    if (address === 0x0002) {
      return { address, size: 1, valid: true, text: "INC A" };
    }
    if (address === 0x0003) {
      return { address, size: 2, valid: true, text: "SJMP 0x0002" };
    }
    return { address, size: 1, valid: true, text: "NOP" };
  }

  private makeSnapshot(
    pc: number,
    resultKind: Snapshot["resultKind"],
    reason: Snapshot["reason"],
    a: number,
    instructionCount: number,
    machineCycleCount: number,
  ): Snapshot {
    return {
      state: "idle",
      resultKind,
      reason,
      pc,
      registers: {
        a,
        b: 0,
        psw: 0,
        sp: 7,
        dptr: 0,
        r: [0, 0, 0, 0, 0, 0, 0, 0],
      },
      variant: "sab80535",
      instructionCount,
      machineCycleCount,
    };
  }

  private success(request: RequestRecord, body: JsonObject | Snapshot): void {
    this.write({
      type: "response",
      id: request.id,
      command: request.command,
      success: true,
      body,
    });
  }

  private error(request: RequestRecord, code: string, message: string): void {
    this.write({
      type: "response",
      id: request.id,
      command: request.command,
      success: false,
      error: { code, message, retryable: false, data: {} },
    });
  }

  private write(record: JsonObject): void {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
}

const options = parseOptions(process.argv.slice(2));
const fake = new FakeEmulator(options);
const decoder = new TextDecoder("utf-8", { fatal: true });
const lineParts: Buffer[] = [];
let lineBytes = 0;
let queue = Promise.resolve();

function fatalInput(message: string): void {
  process.stderr.write(`fake protocol input error: ${message}\n`);
  process.exitCode = 65;
  process.stdin.destroy();
}

function processLine(): void {
  let line = Buffer.concat(lineParts, lineBytes);
  lineParts.length = 0;
  lineBytes = 0;
  if (line.at(-1) === 0x0d) {
    line = line.subarray(0, -1);
  }
  if (line.length === 0) {
    fatalInput("empty record");
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(line)) as unknown;
  } catch {
    fatalInput("malformed UTF-8 or JSON");
    return;
  }
  queue = queue
    .then(() => fake.accept(parsed))
    .catch((error: unknown) => {
      fatalInput(error instanceof Error ? error.message : "invalid request");
    });
}

process.stdin.on("data", (chunk: Buffer) => {
  let offset = 0;
  while (offset < chunk.length) {
    const newline = chunk.indexOf(0x0a, offset);
    const end = newline < 0 ? chunk.length : newline;
    const part = chunk.subarray(offset, end);
    lineBytes += part.length;
    if (lineBytes > MAX_RECORD_BYTES) {
      fatalInput("record exceeds maxRecordBytes");
      return;
    }
    if (part.length > 0) {
      lineParts.push(part);
    }
    if (newline < 0) {
      return;
    }
    processLine();
    offset = newline + 1;
  }
});

process.stdin.on("end", () => {
  if (lineBytes !== 0) {
    fatalInput("unterminated record at EOF");
    return;
  }
  void queue.finally(() => {
    if (process.exitCode === undefined) {
      process.exitCode = 0;
    }
  });
});
