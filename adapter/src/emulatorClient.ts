import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { constants as fsConstants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

export const EMU_DEBUG_PROTOCOL = { major: 1, minor: 0 } as const;
export const RAW_CODE_IMAGE_BYTES = 65_536;
export const REQUIRED_EMULATOR_CAPABILITIES = [
  "rawCode64k",
  "deterministicReset",
  "snapshotBasicRegisters",
  "decodeCode",
  "replaceCodeBreakpoints",
  "boundedRun",
  "stepInstruction",
] as const;

const BOOTSTRAP_MAX_RECORD_BYTES = 65_536;
const DEFAULT_COMMAND_TIMEOUT_MS = 5_000;
const DEFAULT_TERMINATION_TIMEOUT_MS = 1_000;
const MAX_DIAGNOSTIC_CHARS = 4_096;
const CLIENT_MAX_BREAKPOINTS = 1_024;
const CLIENT_MAX_RUN_CHUNK_INSTRUCTIONS = 1_000_000;
const CLIENT_MAX_DISASSEMBLE_INSTRUCTIONS = 4_096;

type JsonObject = Record<string, unknown>;

export interface ControlErrorShape {
  code: string;
  message: string;
  retryable: boolean;
  data?: JsonObject;
}

export class EmulatorControlError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly data: JsonObject = {},
  ) {
    super(message);
    this.name = "EmulatorControlError";
  }
}

export interface EmulatorLimits {
  maxBreakpoints: number;
  maxRunChunkInstructions: number;
  maxDisassembleInstructions: number;
  maxRecordBytes: number;
}

export interface EmulatorHello {
  protocol: { major: number; minor: number };
  product: string;
  productVersion: string;
  commit: string;
  variants: string[];
  capabilities: string[];
  limits: EmulatorLimits;
}

export type ArchitecturalStopReason =
  | "entry"
  | "breakpoint"
  | "step"
  | "exception"
  | "halt";

export interface BasicRegisters {
  a: number;
  b: number;
  psw: number;
  sp: number;
  dptr: number;
  r: [number, number, number, number, number, number, number, number];
}

export interface EmulatorSnapshot {
  state: "idle";
  resultKind: "architectural-stop" | "yield";
  reason: ArchitecturalStopReason | "yield";
  pc: number;
  registers: BasicRegisters;
  variant: string;
  instructionCount: number;
  machineCycleCount: number;
  exception?: { code: string; message: string };
}

export interface DecodeInstruction {
  address: number;
  size: number;
  valid: boolean;
  text: string;
  reason?: "unknown-predecessor";
}

export interface DecodeCodeResult {
  instructions: DecodeInstruction[];
}

export interface RejectedCodeBreakpoint {
  address: number;
  reason: string;
}

export interface ReplaceCodeBreakpointsResult {
  accepted: number[];
  rejected: RejectedCodeBreakpoint[];
  limit: number;
}

export interface LoadedImage {
  path: string;
  sha256: string;
}

export interface EmulatorClientOptions {
  commandTimeoutMs?: number;
  terminationTimeoutMs?: number;
  maxRecordBytes?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onDiagnostic?: (message: string) => void;
  onEvent?: (event: JsonObject) => void;
  onFatal?: (error: EmulatorControlError) => void;
}

interface PendingResponse {
  id: number;
  command: string;
  resolve: (body: JsonObject) => void;
  reject: (error: EmulatorControlError) => void;
  timer: NodeJS.Timeout;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, field: string): JsonObject {
  if (!isObject(value)) {
    throw schemaError(`${field} must be an object`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw schemaError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw schemaError(`${field} must be a boolean`);
  }
  return value;
}

function requireInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    throw schemaError(
      `${field} must be an integer from ${minimum} through ${maximum}`,
    );
  }
  return value as number;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw schemaError(`${field} must be an array`);
  }
  return value.map((item, index) =>
    requireString(item, `${field}[${index}]`),
  );
}

function schemaError(message: string): EmulatorControlError {
  return new EmulatorControlError("EMU_TRANSPORT_SCHEMA", message);
}

function transportError(
  code: string,
  message: string,
  data: JsonObject = {},
): EmulatorControlError {
  return new EmulatorControlError(code, message, false, data);
}

function validateTimeout(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("timeout must be a positive integer number of milliseconds");
  }
  return value;
}

function validateMaxRecordBytes(value: number | undefined): number {
  if (value === undefined) {
    return BOOTSTRAP_MAX_RECORD_BYTES;
  }
  if (!Number.isSafeInteger(value) || value < 256) {
    throw new TypeError("maxRecordBytes must be an integer of at least 256 bytes");
  }
  return value;
}

function validateResponseEnvelope(
  value: unknown,
  pending: PendingResponse,
): JsonObject {
  const response = requireObject(value, "response");
  if (response.type !== "response") {
    throw schemaError("received a non-response record while awaiting a response");
  }
  const id = requireInteger(response.id, "response.id", 1, Number.MAX_SAFE_INTEGER);
  const command = requireString(response.command, "response.command");
  if (id !== pending.id || command !== pending.command) {
    throw transportError(
      "EMU_TRANSPORT_CORRELATION",
      `response correlation mismatch for ${pending.command}`,
      { expectedId: pending.id, receivedId: id, expectedCommand: pending.command },
    );
  }
  const success = requireBoolean(response.success, "response.success");
  if (!success) {
    if (response.body !== undefined) {
      throw schemaError("an unsuccessful response must not carry a body");
    }
    const wireError = requireObject(response.error, "response.error");
    const code = requireString(wireError.code, "response.error.code");
    const message = requireString(wireError.message, "response.error.message");
    const retryable = requireBoolean(
      wireError.retryable,
      "response.error.retryable",
    );
    const data =
      wireError.data === undefined
        ? {}
        : requireObject(wireError.data, "response.error.data");
    throw new EmulatorControlError(code, message, retryable, data);
  }
  if (response.error !== undefined) {
    throw schemaError("a successful response must not carry an error");
  }
  return response.body === undefined
    ? {}
    : requireObject(response.body, "response.body");
}

function validateHello(body: JsonObject): EmulatorHello {
  const protocol = requireObject(body.protocol, "hello.protocol");
  const major = requireInteger(protocol.major, "hello.protocol.major", 0, 65_535);
  const minor = requireInteger(protocol.minor, "hello.protocol.minor", 0, 65_535);
  if (major !== EMU_DEBUG_PROTOCOL.major) {
    throw new EmulatorControlError(
      "EMU_VERSION_MAJOR",
      `emulator protocol ${major}.${minor} is incompatible with required ${EMU_DEBUG_PROTOCOL.major}.${EMU_DEBUG_PROTOCOL.minor}`,
      false,
      { expectedMajor: EMU_DEBUG_PROTOCOL.major, receivedMajor: major },
    );
  }

  const capabilities = requireStringArray(
    body.capabilities,
    "hello.capabilities",
  );
  const missing = REQUIRED_EMULATOR_CAPABILITIES.filter(
    (capability) => !capabilities.includes(capability),
  );
  if (missing.length > 0) {
    throw new EmulatorControlError(
      "EMU_VERSION_CAPABILITY",
      `emulator is missing required capabilities: ${missing.join(", ")}`,
      false,
      { missing },
    );
  }

  const variants = requireStringArray(body.variants, "hello.variants");
  if (!variants.includes("sab80535")) {
    throw new EmulatorControlError(
      "EMU_VERSION_VARIANT",
      "emulator does not advertise the required sab80535 variant",
      false,
      { variants },
    );
  }

  const rawLimits = requireObject(body.limits, "hello.limits");
  const limits: EmulatorLimits = {
    maxBreakpoints: requireInteger(
      rawLimits.maxBreakpoints,
      "hello.limits.maxBreakpoints",
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    maxRunChunkInstructions: requireInteger(
      rawLimits.maxRunChunkInstructions,
      "hello.limits.maxRunChunkInstructions",
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    maxDisassembleInstructions: requireInteger(
      rawLimits.maxDisassembleInstructions,
      "hello.limits.maxDisassembleInstructions",
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    maxRecordBytes: requireInteger(
      rawLimits.maxRecordBytes,
      "hello.limits.maxRecordBytes",
      256,
      Number.MAX_SAFE_INTEGER,
    ),
  };

  return {
    protocol: { major, minor },
    product: requireString(body.product, "hello.product"),
    productVersion: requireString(body.productVersion, "hello.productVersion"),
    commit: requireString(body.commit, "hello.commit"),
    variants,
    capabilities,
    limits,
  };
}

function validateRegisters(value: unknown): BasicRegisters {
  const registers = requireObject(value, "snapshot.registers");
  const rawR = registers.r;
  if (!Array.isArray(rawR) || rawR.length !== 8) {
    throw schemaError("snapshot.registers.r must contain exactly eight bytes");
  }
  const r = rawR.map((item, index) =>
    requireInteger(item, `snapshot.registers.r[${index}]`, 0, 0xff),
  ) as BasicRegisters["r"];
  return {
    a: requireInteger(registers.a, "snapshot.registers.a", 0, 0xff),
    b: requireInteger(registers.b, "snapshot.registers.b", 0, 0xff),
    psw: requireInteger(registers.psw, "snapshot.registers.psw", 0, 0xff),
    sp: requireInteger(registers.sp, "snapshot.registers.sp", 0, 0xff),
    dptr: requireInteger(registers.dptr, "snapshot.registers.dptr", 0, 0xffff),
    r,
  };
}

interface SnapshotExpectation {
  command: string;
  hello: EmulatorHello;
  architecturalReasons: readonly ArchitecturalStopReason[];
  allowYield: boolean;
}

function validateSnapshot(
  value: JsonObject,
  expectation: SnapshotExpectation,
): EmulatorSnapshot {
  if (value.state !== "idle") {
    throw schemaError("snapshot.state must be idle at a response boundary");
  }
  if (
    value.resultKind !== "architectural-stop" &&
    value.resultKind !== "yield"
  ) {
    throw schemaError(
      "snapshot.resultKind must be architectural-stop or yield",
    );
  }
  const reason = requireString(value.reason, "snapshot.reason");
  if (
    (value.resultKind === "yield" &&
      (!expectation.allowYield || reason !== "yield")) ||
    (value.resultKind === "architectural-stop" &&
      !expectation.architecturalReasons.includes(
        reason as ArchitecturalStopReason,
      ))
  ) {
    throw schemaError(
      `${expectation.command} snapshot reason does not match its result kind`,
    );
  }

  const variant = requireString(value.variant, "snapshot.variant");
  if (!expectation.hello.variants.includes(variant)) {
    throw schemaError(
      `${expectation.command} snapshot variant was not advertised by hello`,
    );
  }

  const snapshot: EmulatorSnapshot = {
    state: "idle",
    resultKind: value.resultKind,
    reason: reason as EmulatorSnapshot["reason"],
    pc: requireInteger(value.pc, "snapshot.pc", 0, 0xffff),
    registers: validateRegisters(value.registers),
    variant,
    instructionCount: requireInteger(
      value.instructionCount,
      "snapshot.instructionCount",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    machineCycleCount: requireInteger(
      value.machineCycleCount,
      "snapshot.machineCycleCount",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
  };
  if (reason === "exception") {
    const rawException = requireObject(value.exception, "snapshot.exception");
    snapshot.exception = {
      code: requireString(rawException.code, "snapshot.exception.code"),
      message: requireString(rawException.message, "snapshot.exception.message"),
    };
  }
  return snapshot;
}

function validateDecodeCode(
  body: JsonObject,
  reference: number,
  byteOffset: number,
  instructionOffset: number,
  expectedCount: number,
): DecodeCodeResult {
  if (!Array.isArray(body.instructions)) {
    throw schemaError("decodeCode.instructions must be an array");
  }
  if (body.instructions.length !== expectedCount) {
    throw schemaError(
      `decodeCode returned ${body.instructions.length} records; expected ${expectedCount}`,
    );
  }
  const instructions = body.instructions.map((item, index) => {
    const record = requireObject(item, `decodeCode.instructions[${index}]`);
    const valid = requireBoolean(
      record.valid,
      `decodeCode.instructions[${index}].valid`,
    );
    const decoded: DecodeInstruction = {
      address: requireInteger(
        record.address,
        `decodeCode.instructions[${index}].address`,
        0,
        0xffff,
      ),
      size: requireInteger(
        record.size,
        `decodeCode.instructions[${index}].size`,
        1,
        0xffff,
      ),
      valid,
      text: requireString(
        record.text,
        `decodeCode.instructions[${index}].text`,
      ),
    };
    if (!valid) {
      if (
        record.reason !== "unknown-predecessor" ||
        decoded.size !== 1 ||
        decoded.text !== "<invalid>"
      ) {
        throw schemaError(
          "invalid decode records must be exact one-byte <invalid> unknown-predecessor placeholders",
        );
      }
      decoded.reason = "unknown-predecessor";
    } else if (record.reason !== undefined) {
      throw schemaError(
        "valid decode records must not carry a placeholder reason",
      );
    }
    return decoded;
  });

  const base = reference + byteOffset;
  if (!Number.isSafeInteger(base) || base < 0 || base > 0xffff) {
    throw schemaError(
      "decodeCode returned success for an out-of-range byte offset",
    );
  }
  let sawValid = false;
  for (const [index, instruction] of instructions.entries()) {
    const end = instruction.address + instruction.size;
    if (end > 0x1_0000) {
      throw schemaError(`decodeCode.instructions[${index}] leaves CODE range`);
    }
    if (index > 0) {
      const previous = instructions[index - 1];
      if (
        previous === undefined ||
        instruction.address !== previous.address + previous.size
      ) {
        throw schemaError("decodeCode records must be ordered and contiguous");
      }
    }
    if (!instruction.valid) {
      if (
        instructionOffset >= 0 ||
        index >= -instructionOffset ||
        sawValid
      ) {
        throw schemaError(
          "unknown-predecessor placeholders are valid only as a negative-offset prefix",
        );
      }
    } else {
      sawValid = true;
    }
  }

  if (instructionOffset === 0 && instructions[0]?.address !== base) {
    throw schemaError("decodeCode zero-offset window must begin at the byte base");
  }
  if (
    instructionOffset > 0 &&
    (instructions[0] === undefined ||
      instructions[0].address < base + instructionOffset)
  ) {
    throw schemaError(
      "decodeCode forward window cannot precede its instruction offset",
    );
  }
  if (instructionOffset < 0) {
    const predecessorCount = -instructionOffset;
    if (
      instructions[0] === undefined ||
      instructions[0].address > base - predecessorCount
    ) {
      throw schemaError(
        "decodeCode predecessor window cannot follow its instruction offset",
      );
    }

    const returnedPredecessors = Math.min(
      predecessorCount,
      instructions.length,
    );
    for (let index = 0; index < returnedPredecessors; index += 1) {
      const instruction = instructions[index];
      if (instruction === undefined) {
        throw schemaError("decodeCode predecessor window is incomplete");
      }
      const remainingPredecessors = predecessorCount - index - 1;
      const end = instruction.address + instruction.size;
      if (remainingPredecessors === 0) {
        if (end !== base) {
          throw schemaError(
            "decodeCode predecessor window does not end at its byte base",
          );
        }
      } else if (end > base - remainingPredecessors) {
        throw schemaError(
          "decodeCode predecessor window reaches its byte base too early",
        );
      }
    }

    const anchorIndex = predecessorCount;
    if (
      anchorIndex < instructions.length &&
      instructions[anchorIndex]?.address !== base
    ) {
      throw schemaError(
        "decodeCode negative-offset window does not reach its byte base",
      );
    }
  }
  return { instructions };
}

function validateReplaceBreakpoints(
  body: JsonObject,
  requested: ReadonlySet<number>,
  advertisedLimit: number,
  clientWorkLimit: number,
): ReplaceCodeBreakpointsResult {
  if (!Array.isArray(body.accepted) || !Array.isArray(body.rejected)) {
    throw schemaError(
      "replaceCodeBreakpoints accepted and rejected must be arrays",
    );
  }
  const accepted = body.accepted.map((address, index) =>
    requireInteger(address, `accepted[${index}]`, 0, 0xffff),
  );
  const rejected = body.rejected.map((item, index) => {
    const rejected = requireObject(item, `rejected[${index}]`);
    return {
      address: requireInteger(
        rejected.address,
        `rejected[${index}].address`,
        0,
        0xffff,
      ),
      reason: requireString(rejected.reason, `rejected[${index}].reason`),
    };
  });
  const limit = requireInteger(body.limit, "limit", 1, Number.MAX_SAFE_INTEGER);
  if (limit !== advertisedLimit) {
    throw schemaError(
      "replaceCodeBreakpoints.limit must match the hello-negotiated limit",
    );
  }
  if (requested.size > clientWorkLimit || accepted.length > clientWorkLimit) {
    throw schemaError(
      "replaceCodeBreakpoints exceeded the client breakpoint work limit",
    );
  }
  const returned = new Set<number>();
  for (const address of accepted) {
    if (!requested.has(address) || returned.has(address)) {
      throw schemaError(
        "replaceCodeBreakpoints accepted an extra or duplicate address",
      );
    }
    returned.add(address);
  }
  for (const item of rejected) {
    if (!requested.has(item.address) || returned.has(item.address)) {
      throw schemaError(
        "replaceCodeBreakpoints rejected an extra, duplicate, or accepted address",
      );
    }
    returned.add(item.address);
  }
  if (returned.size !== requested.size) {
    throw schemaError(
      "replaceCodeBreakpoints response must partition every requested address",
    );
  }
  return { accepted, rejected, limit };
}

export class EmulatorClient {
  private readonly commandTimeoutMs: number;
  private readonly terminationTimeoutMs: number;
  private readonly localMaxRecordBytes: number;
  private readonly onDiagnostic: (message: string) => void;
  private readonly onEvent: (event: JsonObject) => void;
  private readonly onFatal: (error: EmulatorControlError) => void;
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private readonly stdoutParts: Buffer[] = [];
  private stdoutBytes = 0;
  private stderrText = "";
  private nextId = 1;
  private activeMaxRecordBytes: number;
  private commandTail: Promise<void> = Promise.resolve();
  private pending: PendingResponse | undefined;
  private helloAttempted = false;
  private helloResult: EmulatorHello | undefined;
  private advertisedMaxBreakpoints: number | undefined;
  private fatalError: EmulatorControlError | undefined;
  private cleanupPromise: Promise<void> | undefined;
  private expectedExit = false;
  private exitResolved = false;
  private readonly exitPromise: Promise<void>;
  private resolveExit!: () => void;

  private constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    options: EmulatorClientOptions,
  ) {
    this.commandTimeoutMs = validateTimeout(
      options.commandTimeoutMs,
      DEFAULT_COMMAND_TIMEOUT_MS,
    );
    this.terminationTimeoutMs = validateTimeout(
      options.terminationTimeoutMs,
      DEFAULT_TERMINATION_TIMEOUT_MS,
    );
    this.localMaxRecordBytes = validateMaxRecordBytes(options.maxRecordBytes);
    this.activeMaxRecordBytes = this.localMaxRecordBytes;
    this.onDiagnostic = options.onDiagnostic ?? (() => undefined);
    this.onEvent = options.onEvent ?? (() => undefined);
    this.onFatal = options.onFatal ?? (() => undefined);
    this.exitPromise = new Promise<void>((resolve) => {
      this.resolveExit = resolve;
    });

    child.stdout.on("data", (chunk: Buffer) => this.consumeStdout(chunk));
    child.stdout.on("end", () => this.handleEof());
    child.stderr.on("data", (chunk: Buffer) => this.consumeStderr(chunk));
    child.on("error", (error) => {
      this.failTransport(
        transportError("EMU_TRANSPORT_SPAWN", `emulator process error: ${error.message}`),
      );
    });
    child.on("exit", (code, signal) => this.handleExit(code, signal));
    child.on("close", (code, signal) => this.handleExit(code, signal));
  }

  public static async spawn(
    executable: string,
    args: readonly string[],
    options: EmulatorClientOptions = {},
  ): Promise<EmulatorClient> {
    const child = spawn(executable, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const client = new EmulatorClient(child, options);
    try {
      await once(child, "spawn");
    } catch (error: unknown) {
      await client.forceClose();
      if (client.fatalError !== undefined) {
        throw client.fatalError;
      }
      const detail = error instanceof Error ? error.message : "spawn failed";
      throw transportError("EMU_TRANSPORT_SPAWN", detail);
    }
    return client;
  }

  public get processId(): number | undefined {
    return this.child.pid;
  }

  public get hello(): EmulatorHello | undefined {
    return this.helloResult;
  }

  public get closed(): Promise<void> {
    return this.exitPromise;
  }

  public async handshake(): Promise<EmulatorHello> {
    const body = await this.request("hello", {
      protocol: EMU_DEBUG_PROTOCOL,
      requiredCapabilities: [...REQUIRED_EMULATOR_CAPABILITIES],
    });
    let hello: EmulatorHello;
    let advertisedMaxBreakpoints: number;
    try {
      const serverHello = validateHello(body);
      advertisedMaxBreakpoints = serverHello.limits.maxBreakpoints;
      hello = {
        ...serverHello,
        limits: {
          maxBreakpoints: Math.min(
            serverHello.limits.maxBreakpoints,
            CLIENT_MAX_BREAKPOINTS,
          ),
          maxRunChunkInstructions: Math.min(
            serverHello.limits.maxRunChunkInstructions,
            CLIENT_MAX_RUN_CHUNK_INSTRUCTIONS,
          ),
          maxDisassembleInstructions: Math.min(
            serverHello.limits.maxDisassembleInstructions,
            CLIENT_MAX_DISASSEMBLE_INSTRUCTIONS,
          ),
          maxRecordBytes: Math.min(
            serverHello.limits.maxRecordBytes,
            this.localMaxRecordBytes,
          ),
        },
      };
    } catch (error: unknown) {
      const stable =
        error instanceof EmulatorControlError
          ? error
          : schemaError("invalid hello response");
      this.failTransport(stable);
      throw stable;
    }
    this.helloResult = hello;
    this.advertisedMaxBreakpoints = advertisedMaxBreakpoints;
    this.activeMaxRecordBytes = hello.limits.maxRecordBytes;
    return hello;
  }

  public async loadImage(image: LoadedImage): Promise<{ sha256: string }> {
    const body = await this.request("load", {
      path: image.path,
      format: "raw-code-64k",
      expectedSha256: image.sha256,
    });
    return this.validateReceived(() => {
      const sha256 = requireString(body.sha256, "load.sha256");
      if (!/^[0-9a-f]{64}$/.test(sha256)) {
        throw schemaError(
          "load.sha256 must be 64 lowercase hexadecimal characters",
        );
      }
      if (sha256 !== image.sha256) {
        throw new EmulatorControlError(
          "EMU_IMAGE_HASH",
          "emulator returned an image digest different from the requested image",
          false,
          { expectedSha256: image.sha256, actualSha256: sha256 },
        );
      }
      return { sha256 };
    });
  }

  public async reset(seed: number, entryAddress: number): Promise<EmulatorSnapshot> {
    const hello = this.requireHello();
    const body = await this.request("reset", { seed, entryAddress });
    return this.validateReceived(() => {
      const snapshot = validateSnapshot(body, {
        command: "reset",
        hello,
        architecturalReasons: ["entry"],
        allowYield: false,
      });
      if (
        snapshot.resultKind !== "architectural-stop" ||
        snapshot.reason !== "entry" ||
        snapshot.pc !== entryAddress
      ) {
        throw schemaError(
          "reset must return an entry stop at the configured address",
        );
      }
      return snapshot;
    });
  }

  public async getState(): Promise<EmulatorSnapshot> {
    const hello = this.requireHello();
    const body = await this.request("getState");
    return this.validateReceived(() =>
      validateSnapshot(body, {
        command: "getState",
        hello,
        architecturalReasons: [
          "entry",
          "breakpoint",
          "step",
          "exception",
          "halt",
        ],
        allowYield: true,
      }),
    );
  }

  public async decodeCode(
    reference: number,
    byteOffset: number,
    instructionOffset: number,
    instructionCount: number,
  ): Promise<DecodeCodeResult> {
    const hello = this.requireHello();
    requireInteger(reference, "reference", 0, 0xffff);
    requireInteger(byteOffset, "byteOffset", -0x1_0000, 0x1_0000);
    requireInteger(
      instructionOffset,
      "instructionOffset",
      -0x1_0000,
      0x1_0000,
    );
    requireInteger(
      instructionCount,
      "instructionCount",
      1,
      hello.limits.maxDisassembleInstructions,
    );
    const body = await this.request("decodeCode", {
      reference,
      byteOffset,
      instructionOffset,
      instructionCount,
    });
    return this.validateReceived(() =>
      validateDecodeCode(
        body,
        reference,
        byteOffset,
        instructionOffset,
        instructionCount,
      ),
    );
  }

  public async replaceCodeBreakpoints(
    addresses: readonly number[],
  ): Promise<ReplaceCodeBreakpointsResult> {
    const hello = this.requireHello();
    const advertisedMaxBreakpoints = this.advertisedMaxBreakpoints;
    if (advertisedMaxBreakpoints === undefined) {
      throw new EmulatorControlError(
        "EMU_STATE_HELLO_REQUIRED",
        "hello must complete before this emulator command",
      );
    }
    if (addresses.length > hello.limits.maxBreakpoints) {
      throw new EmulatorControlError(
        "EMU_BREAKPOINT_LIMIT",
        `at most ${hello.limits.maxBreakpoints} CODE breakpoints are supported`,
      );
    }
    const unique = new Set<number>();
    for (const [index, address] of addresses.entries()) {
      requireInteger(address, `addresses[${index}]`, 0, 0xffff);
      if (unique.has(address)) {
        throw new EmulatorControlError(
          "EMU_BREAKPOINT_DUPLICATE",
          `duplicate CODE breakpoint address ${address}`,
        );
      }
      unique.add(address);
    }
    const body = await this.request("replaceCodeBreakpoints", {
      addresses: [...addresses],
    });
    return this.validateReceived(() =>
      validateReplaceBreakpoints(
        body,
        unique,
        advertisedMaxBreakpoints,
        hello.limits.maxBreakpoints,
      ),
    );
  }

  public async run(maxInstructions: number): Promise<EmulatorSnapshot> {
    const hello = this.requireHello();
    requireInteger(
      maxInstructions,
      "maxInstructions",
      1,
      hello.limits.maxRunChunkInstructions,
    );
    const body = await this.request("run", { maxInstructions });
    return this.validateReceived(() =>
      validateSnapshot(body, {
        command: "run",
        hello,
        architecturalReasons: ["breakpoint", "exception", "halt"],
        allowYield: true,
      }),
    );
  }

  public async stepInstruction(): Promise<EmulatorSnapshot> {
    const hello = this.requireHello();
    const body = await this.request("stepInstruction");
    return this.validateReceived(() => {
      return validateSnapshot(body, {
        command: "stepInstruction",
        hello,
        architecturalReasons: ["step", "exception", "halt"],
        allowYield: false,
      });
    });
  }

  public async terminate(): Promise<void> {
    if (this.exitResolved) {
      return;
    }
    if (this.fatalError !== undefined) {
      await this.forceClose();
      return;
    }
    try {
      const body = await this.request("terminate");
      this.validateReceived(() => {
        if (body.terminated !== true) {
          throw schemaError("terminate.terminated must be true");
        }
      });
      this.expectedExit = true;
      this.child.stdin.end();
      if (!(await this.waitForExit(this.terminationTimeoutMs))) {
        await this.forceClose();
      }
    } catch {
      await this.forceClose();
    }
  }

  public async forceClose(): Promise<void> {
    if (this.fatalError === undefined && !this.exitResolved) {
      const error = transportError(
        "EMU_TRANSPORT_CLOSED",
        "emulator transport was closed for cleanup",
      );
      this.fatalError = error;
      const pending = this.pending;
      if (pending !== undefined) {
        clearTimeout(pending.timer);
        this.pending = undefined;
        pending.reject(error);
      }
    }
    this.cleanupPromise ??= this.forceCloseInternal();
    return this.cleanupPromise;
  }

  private requireHello(): EmulatorHello {
    if (this.helloResult === undefined) {
      throw new EmulatorControlError(
        "EMU_STATE_HELLO_REQUIRED",
        "hello must complete before this emulator command",
      );
    }
    return this.helloResult;
  }

  private validateReceived<T>(validator: () => T): T {
    try {
      return validator();
    } catch (error: unknown) {
      const stable =
        error instanceof EmulatorControlError
          ? error
          : schemaError("invalid emulator command response");
      this.failTransport(stable);
      throw stable;
    }
  }

  private request(command: string, args?: JsonObject): Promise<JsonObject> {
    const operation = this.commandTail.then(() => this.requestNow(command, args));
    this.commandTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private requestNow(command: string, args?: JsonObject): Promise<JsonObject> {
    if (this.fatalError !== undefined) {
      return Promise.reject(this.fatalError);
    }
    if (this.exitResolved) {
      return Promise.reject(
        transportError("EMU_TRANSPORT_EOF", "emulator process has exited"),
      );
    }
    if (!this.helloAttempted && command !== "hello") {
      return Promise.reject(
        new EmulatorControlError(
          "EMU_STATE_HELLO_REQUIRED",
          "hello must be the first emulator command",
        ),
      );
    }
    if (this.helloAttempted && command === "hello") {
      return Promise.reject(
        new EmulatorControlError(
          "EMU_STATE_HELLO_ONCE",
          "hello is accepted exactly once per emulator process",
        ),
      );
    }
    if (this.helloAttempted && this.helloResult === undefined) {
      return Promise.reject(
        new EmulatorControlError(
          "EMU_STATE_HELLO_FAILED",
          "hello did not establish a compatible emulator session",
        ),
      );
    }
    if (this.pending !== undefined) {
      return Promise.reject(
        transportError("EMU_TRANSPORT_SERIALIZATION", "a command is already active"),
      );
    }

    const id = this.nextId++;
    if (command === "hello") {
      this.helloAttempted = true;
    }
    const request: JsonObject = { type: "request", id, command };
    if (args !== undefined) {
      request.arguments = args;
    }
    const record = Buffer.from(`${JSON.stringify(request)}\n`, "utf8");
    if (record.length - 1 > this.activeMaxRecordBytes) {
      return Promise.reject(
        transportError(
          "EMU_TRANSPORT_OVERSIZE",
          `outbound ${command} record exceeds the negotiated maximum`,
        ),
      );
    }

    return new Promise<JsonObject>((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = transportError(
          "EMU_TRANSPORT_TIMEOUT",
          `emulator command ${command} exceeded ${this.commandTimeoutMs} ms`,
          { command, id },
        );
        this.failTransport(error);
      }, this.commandTimeoutMs);
      this.pending = { id, command, resolve, reject, timer };
      this.child.stdin.write(record, (error) => {
        if (error !== null && error !== undefined) {
          this.failTransport(
            transportError(
              "EMU_TRANSPORT_WRITE",
              `failed to write emulator command ${command}: ${error.message}`,
            ),
          );
        }
      });
    });
  }

  private consumeStdout(chunk: Buffer): void {
    if (this.fatalError !== undefined) {
      return;
    }
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(0x0a, offset);
      const end = newline < 0 ? chunk.length : newline;
      const part = chunk.subarray(offset, end);
      this.stdoutBytes += part.length;
      if (this.stdoutBytes > this.activeMaxRecordBytes) {
        this.failTransport(
          transportError(
            "EMU_TRANSPORT_OVERSIZE",
            `emulator stdout record exceeds ${this.activeMaxRecordBytes} bytes`,
          ),
        );
        return;
      }
      if (part.length > 0) {
        this.stdoutParts.push(part);
      }
      if (newline < 0) {
        return;
      }
      this.processStdoutRecord();
      if (this.fatalError !== undefined) {
        return;
      }
      offset = newline + 1;
    }
  }

  private processStdoutRecord(): void {
    let record = Buffer.concat(this.stdoutParts, this.stdoutBytes);
    this.stdoutParts.length = 0;
    this.stdoutBytes = 0;
    if (record.length > 0 && record.at(-1) === 0x0d) {
      record = record.subarray(0, -1);
    }
    if (record.length === 0) {
      this.failTransport(
        transportError("EMU_TRANSPORT_MALFORMED", "empty emulator stdout record"),
      );
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.decoder.decode(record)) as unknown;
    } catch {
      this.failTransport(
        transportError(
          "EMU_TRANSPORT_MALFORMED",
          "emulator stdout contained malformed UTF-8 or JSON",
        ),
      );
      return;
    }
    if (isObject(parsed) && parsed.type === "event") {
      try {
        requireString(parsed.event, "event.event");
        if (parsed.body !== undefined) {
          requireObject(parsed.body, "event.body");
        }
      } catch (error: unknown) {
        this.failTransport(
          error instanceof EmulatorControlError
            ? error
            : schemaError("invalid emulator event"),
        );
        return;
      }
      try {
        this.onEvent(parsed);
      } catch {
        // Consumer diagnostics must not corrupt the protocol state machine.
      }
      return;
    }
    const pending = this.pending;
    if (pending === undefined) {
      this.failTransport(
        transportError(
          "EMU_TRANSPORT_UNSOLICITED",
          "emulator stdout contained an unsolicited response",
        ),
      );
      return;
    }
    try {
      const body = validateResponseEnvelope(parsed, pending);
      clearTimeout(pending.timer);
      this.pending = undefined;
      pending.resolve(body);
    } catch (error: unknown) {
      const stable =
        error instanceof EmulatorControlError
          ? error
          : schemaError("invalid emulator response");
      if (stable.code.startsWith("EMU_TRANSPORT_")) {
        this.failTransport(stable);
      } else {
        clearTimeout(pending.timer);
        this.pending = undefined;
        pending.reject(stable);
      }
    }
  }

  private consumeStderr(chunk: Buffer): void {
    this.stderrText += chunk.toString("utf8");
    if (this.stderrText.length > MAX_DIAGNOSTIC_CHARS * 2) {
      this.stderrText = this.stderrText.slice(-MAX_DIAGNOSTIC_CHARS);
    }
    for (;;) {
      const newline = this.stderrText.indexOf("\n");
      if (newline < 0) {
        return;
      }
      const line = this.stderrText.slice(0, newline).replace(/\r$/, "");
      this.stderrText = this.stderrText.slice(newline + 1);
      if (line.length > 0) {
        try {
          this.onDiagnostic(line.slice(0, MAX_DIAGNOSTIC_CHARS));
        } catch {
          // Diagnostics are best-effort and never protocol input.
        }
      }
    }
  }

  private handleEof(): void {
    if (!this.expectedExit && !this.exitResolved) {
      this.failTransport(
        transportError("EMU_TRANSPORT_EOF", "unexpected EOF on emulator stdout"),
      );
    }
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (!this.exitResolved) {
      this.exitResolved = true;
      this.resolveExit();
    }
    if (!this.expectedExit && this.fatalError === undefined) {
      this.failTransport(
        transportError(
          "EMU_TRANSPORT_EXIT",
          `emulator exited unexpectedly (code ${String(code)}, signal ${String(signal)})`,
          { code, signal },
        ),
      );
    }
  }

  private failTransport(error: EmulatorControlError): void {
    if (this.fatalError !== undefined) {
      return;
    }
    this.fatalError = error;
    const pending = this.pending;
    if (pending !== undefined) {
      clearTimeout(pending.timer);
      this.pending = undefined;
      pending.reject(error);
    }
    try {
      this.onFatal(error);
    } catch {
      // Cleanup remains mandatory even if an observer fails.
    }
    void this.forceClose().catch(() => undefined);
  }

  private async forceCloseInternal(): Promise<void> {
    this.expectedExit = true;
    this.child.stdin.destroy();
    this.child.stdout.destroy();
    if (this.exitResolved) {
      return;
    }
    this.child.kill();
    if (await this.waitForExit(this.terminationTimeoutMs)) {
      return;
    }
    this.child.kill("SIGKILL");
    if (!(await this.waitForExit(this.terminationTimeoutMs))) {
      throw new EmulatorControlError(
        "EMU_CLEANUP_REAP",
        "emulator child did not exit after terminate and kill",
      );
    }
  }

  private async waitForExit(timeoutMs: number): Promise<boolean> {
    if (this.exitResolved) {
      return true;
    }
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    const exited = this.exitPromise.then(() => true);
    const result = await Promise.race([exited, timedOut]);
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    return result;
  }
}

export interface ResolveExecutableOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  executableName?: string;
}

async function isExecutable(
  candidate: string,
  platform: NodeJS.Platform,
): Promise<boolean> {
  try {
    if (
      platform === "win32" &&
      ![".exe", ".com"].includes(path.extname(candidate).toLowerCase())
    ) {
      return false;
    }
    const candidateStat = await stat(candidate);
    if (!candidateStat.isFile()) {
      return false;
    }
    await access(
      candidate,
      platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
}

export async function resolveEmulatorExecutable(
  configuredPath: string | undefined,
  options: ResolveExecutableOptions = {},
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? process.platform;
  if (configuredPath !== undefined) {
    const candidate = path.resolve(cwd, configuredPath);
    if (await isExecutable(candidate, platform)) {
      return candidate;
    }
    throw new EmulatorControlError(
      "CONFIG_EMULATOR_NOT_FOUND",
      `configured emulator executable is not an accessible file: ${candidate}`,
    );
  }

  const env = options.env ?? process.env;
  const executableName = options.executableName ?? "emu-debug";
  const pathEntries = (env.PATH ?? "")
    .split(path.delimiter)
    .filter((entry) => entry.length > 0);
  let suffixes: string[];
  if (platform !== "win32") {
    suffixes = [""];
  } else if (path.extname(executableName).length > 0) {
    suffixes = [""];
  } else {
    const seen = new Set<string>();
    suffixes = (env.PATHEXT ?? ".EXE;.COM")
      .split(";")
      .map((suffix) =>
        suffix.startsWith(".")
          ? suffix.toUpperCase()
          : `.${suffix.toUpperCase()}`,
      )
      .filter((suffix) => {
        if (![".EXE", ".COM"].includes(suffix) || seen.has(suffix)) {
          return false;
        }
        seen.add(suffix);
        return true;
      });
  }
  for (const entry of pathEntries) {
    for (const suffix of suffixes) {
      const candidate = path.resolve(entry, `${executableName}${suffix}`);
      if (await isExecutable(candidate, platform)) {
        return candidate;
      }
    }
  }
  throw new EmulatorControlError(
    "CONFIG_EMULATOR_NOT_FOUND",
    `${executableName} was not found on PATH; set emulatorPath to a compatible executable`,
  );
}

export async function inspectRawCodeImage(
  configuredPath: string,
  cwd = process.cwd(),
): Promise<LoadedImage> {
  const absolutePath = path.resolve(cwd, configuredPath);
  let image: Buffer;
  try {
    const imageStat = await stat(absolutePath);
    if (!imageStat.isFile()) {
      throw new EmulatorControlError(
        "CONFIG_PROGRAM_NOT_FILE",
        `firmware image is not a regular file: ${absolutePath}`,
      );
    }
    if (imageStat.size !== RAW_CODE_IMAGE_BYTES) {
      throw new EmulatorControlError(
        "EMU_IMAGE_SIZE",
        `raw CODE image must be exactly ${RAW_CODE_IMAGE_BYTES} bytes; received ${imageStat.size}`,
        false,
        { expectedBytes: RAW_CODE_IMAGE_BYTES, actualBytes: imageStat.size },
      );
    }
    image = await readFile(absolutePath);
  } catch (error: unknown) {
    if (error instanceof EmulatorControlError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : "image read failed";
    throw new EmulatorControlError(
      "CONFIG_PROGRAM_READ",
      `cannot read firmware image: ${detail}`,
    );
  }
  if (image.length !== RAW_CODE_IMAGE_BYTES) {
    throw new EmulatorControlError(
      "EMU_IMAGE_SIZE",
      `raw CODE image changed while reading and is not ${RAW_CODE_IMAGE_BYTES} bytes`,
    );
  }
  return {
    path: absolutePath,
    sha256: createHash("sha256").update(image).digest("hex"),
  };
}

export interface EmulatorLaunchResult {
  client: EmulatorClient;
  hello: EmulatorHello;
  image: LoadedImage;
  entrySnapshot: EmulatorSnapshot;
}

export interface EmulatorLaunchBackendOptions extends EmulatorClientOptions {
  executableName?: string;
  childArguments?: readonly string[];
  onTransportFailure?: (error: EmulatorControlError) => void;
}

export class EmulatorLaunchBackend {
  private readonly options: EmulatorLaunchBackendOptions;
  private client: EmulatorClient | undefined;
  private result: EmulatorLaunchResult | undefined;
  private terminationIntent = false;
  private disconnectPromise: Promise<void> | undefined;
  private launched = false;

  public constructor(options: EmulatorLaunchBackendOptions = {}) {
    this.options = options;
  }

  public get launchResult(): EmulatorLaunchResult | undefined {
    return this.result;
  }

  public get ownedProcessId(): number | undefined {
    return this.client?.processId;
  }

  public async launch(configuration: {
    program: string;
    entryAddress: number;
    resetSeed: number;
    emulatorPath?: string;
  }): Promise<EmulatorLaunchResult> {
    if (this.client !== undefined || this.result !== undefined) {
      throw new EmulatorControlError(
        "EMU_STATE_LAUNCH_ONCE",
        "one emulator process is already owned by this backend",
      );
    }
    this.terminationIntent = false;
    const image = await inspectRawCodeImage(
      configuration.program,
      this.options.cwd,
    );
    this.throwIfTerminating();
    const executable = await resolveEmulatorExecutable(
      configuration.emulatorPath,
      {
        cwd: this.options.cwd,
        env: this.options.env,
        executableName: this.options.executableName,
      },
    );
    this.throwIfTerminating();

    const client = await EmulatorClient.spawn(
      executable,
      this.options.childArguments ?? ["--headless-debug"],
      {
        ...this.options,
        onFatal: (error) => {
          this.options.onFatal?.(error);
          if (this.launched) {
            this.options.onTransportFailure?.(error);
          }
        },
      },
    );
    this.client = client;
    try {
      this.throwIfTerminating();
      const hello = await client.handshake();
      this.throwIfTerminating();
      await client.loadImage(image);
      this.throwIfTerminating();
      const entrySnapshot = await client.reset(
        configuration.resetSeed,
        configuration.entryAddress,
      );
      this.throwIfTerminating();
      const result = { client, hello, image, entrySnapshot };
      this.result = result;
      this.launched = true;
      return result;
    } catch (error: unknown) {
      await client.forceClose();
      throw error;
    }
  }

  public disconnect(): Promise<void> {
    this.terminationIntent = true;
    this.disconnectPromise ??= this.disconnectInternal();
    return this.disconnectPromise;
  }

  public async getState(): Promise<EmulatorSnapshot> {
    return this.requireClient().getState();
  }

  public async decodeCode(
    reference: number,
    byteOffset: number,
    instructionOffset: number,
    instructionCount: number,
  ): Promise<DecodeCodeResult> {
    return this.requireClient().decodeCode(
      reference,
      byteOffset,
      instructionOffset,
      instructionCount,
    );
  }

  public async replaceCodeBreakpoints(
    addresses: readonly number[],
  ): Promise<ReplaceCodeBreakpointsResult> {
    return this.requireClient().replaceCodeBreakpoints(addresses);
  }

  public async run(maxInstructions: number): Promise<EmulatorSnapshot> {
    return this.requireClient().run(maxInstructions);
  }

  public async stepInstruction(): Promise<EmulatorSnapshot> {
    return this.requireClient().stepInstruction();
  }

  private requireClient(): EmulatorClient {
    if (this.client === undefined || this.result === undefined) {
      throw new EmulatorControlError(
        "EMU_STATE_NOT_LAUNCHED",
        "emulator launch has not completed",
      );
    }
    return this.client;
  }

  private throwIfTerminating(): void {
    if (this.terminationIntent) {
      throw new EmulatorControlError(
        "EMU_LAUNCH_CANCELLED",
        "emulator launch was cancelled by termination intent",
      );
    }
  }

  private async disconnectInternal(): Promise<void> {
    const client = this.client;
    if (client === undefined) {
      return;
    }
    await client.terminate();
    await client.closed;
    this.launched = false;
  }
}
