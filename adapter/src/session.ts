import {
  DebugSession,
  InitializedEvent,
  OutputEvent,
  StoppedEvent,
  TerminatedEvent,
} from "@vscode/debugadapter";
import type { DebugProtocol } from "@vscode/debugprotocol";

import {
  mapBreakpointReplacementResult,
  planInstructionBreakpointReplacement,
} from "./breakpoints";
import { mapDisassembledInstructions } from "./disassembly";
import {
  EmulatorControlError,
  EmulatorLaunchBackend,
  type DecodeCodeResult,
  type EmulatorHello,
  type EmulatorLaunchResult,
  type EmulatorSnapshot,
  type ReplaceCodeBreakpointsResult,
} from "./emulatorClient";
import {
  LaunchConfigurationError,
  type EmuLaunchRequestArguments,
  type ValidatedLaunchConfiguration,
  validateLaunchConfiguration,
} from "./launchConfiguration";
import {
  CodeReferenceError,
  canonicalCodeReference,
  numericCodeAddress,
  parseOpaqueCodeReference,
} from "./memoryReference";
import {
  type AdapterLogicalState,
  type ChildBoundaryState,
  StopEpochStore,
} from "./state";

const ERROR_IDS = {
  DAP_INITIALIZE_ONCE: 1001,
  DAP_INITIALIZE_REQUIRED: 1002,
  DAP_SESSION_TERMINATED: 1003,
  DAP_UNSUPPORTED: 1004,
  CONFIG_INVALID: 1100,
  EMU_LAUNCH_FAILED: 1200,
  EMU_OPERATION_FAILED: 1201,
  EMU_STATE_NOT_CONFIGURING: 1300,
  EMU_LAUNCH_ALREADY_STARTED: 1301,
  EMU_LAUNCH_CANCELLED: 1302,
  EMU_STATE_NOT_STOPPED: 1303,
  EMU_STATE_NOT_RUNNING: 1304,
  EMU_STATE_CHILD_BUSY: 1305,
  EMU_THREAD_INVALID: 1306,
  EMU_HANDLE_STALE: 1307,
  EMU_STACKTRACE_INVALID: 1308,
  EMU_CLEANUP_FAILED: 1400,
  EMU_MEMORY_INVALID: 1500,
  EMU_BREAKPOINT_FAILED: 1600,
} as const;

const MCU_THREAD_ID = 1;
const MCU_THREAD_NAME = "SAB80535";

interface ActiveLaunch {
  generation: number;
  response: DebugProtocol.LaunchResponse;
}

interface TerminationOperation {
  generation: number;
  cleanup: Promise<Error | undefined>;
}

export interface LaunchBackend {
  launch(
    configuration: ValidatedLaunchConfiguration,
  ): Promise<EmulatorLaunchResult | void>;
  disconnect(): Promise<void>;
  decodeCode?(
    reference: number,
    byteOffset: number,
    instructionOffset: number,
    instructionCount: number,
  ): Promise<DecodeCodeResult>;
  replaceCodeBreakpoints?(
    addresses: readonly number[],
  ): Promise<ReplaceCodeBreakpointsResult>;
  run?(maxInstructions: number): Promise<EmulatorSnapshot>;
  stepInstruction?(): Promise<EmulatorSnapshot>;
}

/** Complete Slice-1 DAP session over one launch-owned emulator child. */
export class EmuDebugSession extends DebugSession {
  private initializeReceived = false;
  private logicalState: AdapterLogicalState = "starting";
  private childState: ChildBoundaryState = "starting";
  private launchStarted = false;
  private configurationOpen = false;
  private terminatedSent = false;
  private launchGeneration = 0;
  private activeLaunch: ActiveLaunch | undefined;
  private launchResult: EmulatorLaunchResult | undefined;
  private pendingEntrySnapshot: EmulatorSnapshot | undefined;
  private terminationGeneration = 0;
  private terminationOperation: TerminationOperation | undefined;
  private disconnectWaiters = 0;
  private cleanupFailureReported = false;
  private readonly launchBackend: LaunchBackend;
  private readonly stops = new StopEpochStore();
  private runGeneration = 0;
  private pauseIntent = false;
  private latestYield: EmulatorSnapshot | undefined;

  public constructor(
    debuggerLinesAndColumnsStartAt1?: boolean,
    isServer?: boolean,
    launchBackend?: LaunchBackend,
  ) {
    super(debuggerLinesAndColumnsStartAt1, isServer);
    this.launchBackend =
      launchBackend ??
      new EmulatorLaunchBackend({
        onDiagnostic: (message) => {
          this.sendEvent(new OutputEvent(`[emulator] ${message}\n`, "stderr"));
        },
        onTransportFailure: (error) => {
          void this.handleUnexpectedTransportFailure(error);
        },
      });
    this.setDebuggerLinesStartAt1(false);
    this.setDebuggerColumnsStartAt1(false);
  }

  protected override initializeRequest(
    response: DebugProtocol.InitializeResponse,
  ): void {
    if (this.initializeReceived) {
      this.fail(
        response,
        ERROR_IDS.DAP_INITIALIZE_ONCE,
        "DAP_INITIALIZE_ONCE: initialize is accepted exactly once per session",
      );
      return;
    }
    this.initializeReceived = true;
    response.body = {
      supportsConfigurationDoneRequest: true,
      supportsInstructionBreakpoints: true,
      supportsDisassembleRequest: true,
      supportsSteppingGranularity: true,
    };
    this.sendResponse(response);
  }

  protected override launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: EmuLaunchRequestArguments,
  ): void {
    if (this.isTerminatingOrTerminated()) {
      this.fail(
        response,
        ERROR_IDS.DAP_SESSION_TERMINATED,
        "DAP_SESSION_TERMINATED: launch is not accepted after session termination",
      );
      return;
    }
    if (!this.initializeReceived) {
      this.fail(
        response,
        ERROR_IDS.DAP_INITIALIZE_REQUIRED,
        "DAP_INITIALIZE_REQUIRED: initialize must precede launch",
      );
      return;
    }
    if (this.launchStarted) {
      this.fail(
        response,
        ERROR_IDS.EMU_LAUNCH_ALREADY_STARTED,
        "EMU_LAUNCH_ALREADY_STARTED: one launch already owns this DAP session",
      );
      return;
    }

    this.launchStarted = true;
    const generation = ++this.launchGeneration;
    this.activeLaunch = { generation, response };
    void this.beginLaunch(generation, args);
  }

  private async beginLaunch(
    generation: number,
    args: EmuLaunchRequestArguments,
  ): Promise<void> {
    let configuration: ValidatedLaunchConfiguration;
    try {
      configuration = validateLaunchConfiguration(args);
    } catch (error: unknown) {
      const message =
        error instanceof LaunchConfigurationError
          ? `${error.code}: ${error.message}`
          : "CONFIG_INVALID: invalid launch configuration";
      if (!this.isLiveLaunch(generation)) {
        return;
      }
      this.logicalState = "terminating";
      this.childState = "terminating";
      this.configurationOpen = false;
      this.settleLaunchFailure(generation, ERROR_IDS.CONFIG_INVALID, message);
      this.finishTerminationWithoutCleanup();
      return;
    }

    try {
      const launchResult = await this.launchBackend.launch(configuration);
      if (!this.isLiveLaunch(generation)) {
        return;
      }
      if (launchResult !== undefined) {
        this.launchResult = launchResult;
        this.pendingEntrySnapshot = launchResult.entrySnapshot;
      }
      this.childState = "idle-at-boundary";
      this.configurationOpen = true;
      this.sendEvent(new InitializedEvent());
    } catch (error: unknown) {
      if (!this.isLiveLaunch(generation)) {
        return;
      }
      const stableError = this.asControlError(error, "EMU_LAUNCH_FAILED");
      const termination = this.beginTermination();
      this.settleLaunchFailure(
        generation,
        ERROR_IDS.EMU_LAUNCH_FAILED,
        `${stableError.code}: ${stableError.message}`,
      );
      await this.finishCleanupWhenUnobserved(termination);
    }
  }

  protected override configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
  ): void {
    if (this.isTerminatingOrTerminated()) {
      this.fail(
        response,
        ERROR_IDS.DAP_SESSION_TERMINATED,
        "DAP_SESSION_TERMINATED: configurationDone is not accepted after session termination",
      );
      return;
    }
    if (!this.configurationOpen) {
      this.fail(
        response,
        ERROR_IDS.EMU_STATE_NOT_CONFIGURING,
        "EMU_STATE_NOT_CONFIGURING: no launch configuration phase is active",
      );
      return;
    }
    if (!this.requireChildIdle(response)) {
      return;
    }

    this.configurationOpen = false;
    this.logicalState = "stopped";
    this.sendResponse(response);
    const launch = this.activeLaunch;
    if (launch !== undefined) {
      this.activeLaunch = undefined;
      this.sendResponse(launch.response);
    }
    const entrySnapshot = this.pendingEntrySnapshot;
    this.pendingEntrySnapshot = undefined;
    if (entrySnapshot !== undefined) {
      this.activateStoppedSnapshot(entrySnapshot, "entry");
    }
  }

  protected override threadsRequest(
    response: DebugProtocol.ThreadsResponse,
  ): void {
    if (!this.requireStopped(response)) {
      return;
    }
    response.body = { threads: [{ id: MCU_THREAD_ID, name: MCU_THREAD_NAME }] };
    this.sendResponse(response);
  }

  protected override stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
  ): void {
    if (
      !this.requireThread(response, args?.threadId) ||
      !this.requireStopped(response)
    ) {
      return;
    }
    const stop = this.stops.active;
    if (stop === undefined) {
      this.failNotStopped(response);
      return;
    }
    const pagination = this.stackTracePagination(response, args);
    if (pagination === undefined) {
      return;
    }
    const { startFrame, levels } = pagination;
    const includeFrame = startFrame === 0 && (levels === 0 || levels > 0);
    response.body = {
      stackFrames: includeFrame
        ? [
            {
              id: stop.frameId,
              name: numericCodeAddress(stop.snapshot.pc),
              line: 0,
              column: 0,
              instructionPointerReference: canonicalCodeReference(
                stop.snapshot.pc,
              ),
            },
          ]
        : [],
      totalFrames: 1,
    };
    this.sendResponse(response);
  }

  protected override scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
  ): void {
    if (!this.requireStopped(response)) {
      return;
    }
    const stop = this.stops.active;
    if (stop === undefined || !this.stops.isCurrentFrame(args?.frameId)) {
      this.fail(
        response,
        ERROR_IDS.EMU_HANDLE_STALE,
        "EMU_HANDLE_STALE: frame handle does not belong to the current stop epoch",
      );
      return;
    }
    response.body = {
      scopes: [
        {
          name: "Registers",
          presentationHint: "registers",
          variablesReference: stop.registersReference,
          namedVariables: 14,
          expensive: false,
        },
      ],
    };
    this.sendResponse(response);
  }

  protected override variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): void {
    if (!this.requireStopped(response)) {
      return;
    }
    const stop = this.stops.active;
    if (
      stop === undefined ||
      !this.stops.isCurrentRegistersReference(args?.variablesReference)
    ) {
      this.fail(
        response,
        ERROR_IDS.EMU_HANDLE_STALE,
        "EMU_HANDLE_STALE: variables handle does not belong to the current stop epoch",
      );
      return;
    }

    const snapshot = stop.snapshot;
    const byte = (value: number): string =>
      `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
    const word = (value: number): string =>
      `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
    const variables: DebugProtocol.Variable[] = [
      { name: "PC", value: word(snapshot.pc), variablesReference: 0 },
      { name: "A", value: byte(snapshot.registers.a), variablesReference: 0 },
      { name: "B", value: byte(snapshot.registers.b), variablesReference: 0 },
      { name: "PSW", value: byte(snapshot.registers.psw), variablesReference: 0 },
      { name: "SP", value: byte(snapshot.registers.sp), variablesReference: 0 },
      {
        name: "DPTR",
        value: word(snapshot.registers.dptr),
        variablesReference: 0,
      },
      ...snapshot.registers.r.map((value, index) => ({
        name: `R${index}`,
        value: byte(value),
        variablesReference: 0,
      })),
    ];
    response.body = { variables };
    this.sendResponse(response);
  }

  protected override disassembleRequest(
    response: DebugProtocol.DisassembleResponse,
    args: DebugProtocol.DisassembleArguments,
  ): void {
    void this.disassemble(response, args);
  }

  private async disassemble(
    response: DebugProtocol.DisassembleResponse,
    args: DebugProtocol.DisassembleArguments,
  ): Promise<void> {
    if (!this.requireStopped(response)) {
      return;
    }
    let reference: number;
    let byteOffset: number;
    let instructionOffset: number;
    try {
      if (typeof args?.memoryReference !== "string") {
        throw new CodeReferenceError(
          "EMU_MEMORY_REFERENCE",
          "memoryReference must be a string",
        );
      }
      reference = parseOpaqueCodeReference(args.memoryReference).address;
      byteOffset = args?.offset ?? 0;
      instructionOffset = args?.instructionOffset ?? 0;
      if (!Number.isSafeInteger(byteOffset)) {
        throw new CodeReferenceError(
          "EMU_MEMORY_RANGE",
          "disassembly byte offset must be a signed integer",
        );
      }
      if (!Number.isSafeInteger(instructionOffset)) {
        throw new CodeReferenceError(
          "EMU_MEMORY_RANGE",
          "disassembly instruction offset must be a signed integer",
        );
      }
      if (instructionOffset < -0x1_0000 || instructionOffset > 0x1_0000) {
        throw new CodeReferenceError(
          "EMU_MEMORY_RANGE",
          "disassembly instruction offset exceeds the protocol 16-bit traversal bound",
        );
      }
      if (
        !Number.isSafeInteger(args?.instructionCount) ||
        args.instructionCount <= 0
      ) {
        throw new CodeReferenceError(
          "EMU_MEMORY_RANGE",
          "disassembly instructionCount must be a positive integer",
        );
      }
      const adjusted = reference + byteOffset;
      if (adjusted < 0 || adjusted > 0xffff) {
        throw new CodeReferenceError(
          "EMU_MEMORY_RANGE",
          "disassembly byte offset leaves the 16-bit CODE range",
        );
      }
      const maximum = this.hello?.limits.maxDisassembleInstructions;
      if (maximum !== undefined && args.instructionCount > maximum) {
        throw new CodeReferenceError(
          "EMU_MEMORY_RANGE",
          `disassembly instructionCount exceeds negotiated limit ${maximum}`,
        );
      }
    } catch (error: unknown) {
      const stable =
        error instanceof CodeReferenceError
          ? error
          : new CodeReferenceError(
              "EMU_MEMORY_REFERENCE",
              "invalid disassembly reference",
            );
      this.fail(
        response,
        ERROR_IDS.EMU_MEMORY_INVALID,
        `${stable.code}: ${stable.message}`,
      );
      return;
    }

    const operation = this.launchBackend.decodeCode;
    if (operation === undefined) {
      this.fail(
        response,
        ERROR_IDS.EMU_OPERATION_FAILED,
        "EMU_STATE_NOT_LAUNCHED: decodeCode operation is unavailable",
      );
      return;
    }
    if (!this.beginOtherChildCommand(response)) {
      return;
    }
    try {
      const result = await operation.call(
        this.launchBackend,
        reference,
        byteOffset,
        instructionOffset,
        args.instructionCount,
      );
      if (this.logicalState !== "stopped") {
        return;
      }
      this.finishOtherChildCommand();
      response.body = {
        instructions: mapDisassembledInstructions(result.instructions),
      };
      this.sendResponse(response);
    } catch (error: unknown) {
      this.finishOtherChildCommand();
      const stable = this.failOperation(
        response,
        error,
        ERROR_IDS.EMU_MEMORY_INVALID,
      );
      if (stable.code.startsWith("EMU_TRANSPORT_")) {
        await this.terminateAfterRuntimeFailure(stable);
      }
    }
  }

  protected override setInstructionBreakpointsRequest(
    response: DebugProtocol.SetInstructionBreakpointsResponse,
    args: DebugProtocol.SetInstructionBreakpointsArguments,
  ): void {
    void this.setInstructionBreakpoints(response, args);
  }

  private async setInstructionBreakpoints(
    response: DebugProtocol.SetInstructionBreakpointsResponse,
    args: DebugProtocol.SetInstructionBreakpointsArguments,
  ): Promise<void> {
    if (
      !this.configurationOpen &&
      (this.logicalState !== "stopped" || this.stops.active === undefined)
    ) {
      this.failNotStopped(response);
      return;
    }
    if (!Array.isArray(args?.breakpoints)) {
      this.fail(
        response,
        ERROR_IDS.EMU_BREAKPOINT_FAILED,
        "EMU_BREAKPOINT_INVALID: breakpoints must be an array",
      );
      return;
    }
    const maximum = this.hello?.limits.maxBreakpoints;
    if (maximum === undefined) {
      this.fail(
        response,
        ERROR_IDS.EMU_BREAKPOINT_FAILED,
        "EMU_STATE_NOT_LAUNCHED: compatible emulator limits are unavailable",
      );
      return;
    }
    const operation = this.launchBackend.replaceCodeBreakpoints;
    if (operation === undefined) {
      this.fail(
        response,
        ERROR_IDS.EMU_OPERATION_FAILED,
        "EMU_STATE_NOT_LAUNCHED: replaceCodeBreakpoints operation is unavailable",
      );
      return;
    }
    if (!this.beginOtherChildCommand(response)) {
      return;
    }
    const plan = planInstructionBreakpointReplacement(args.breakpoints, maximum);
    try {
      const result = await operation.call(this.launchBackend, plan.addresses);
      if (this.isTerminatingOrTerminated()) {
        return;
      }
      this.finishOtherChildCommand();
      response.body = {
        breakpoints: mapBreakpointReplacementResult(plan, result),
      };
      this.sendResponse(response);
    } catch (error: unknown) {
      this.finishOtherChildCommand();
      const stable = this.failOperation(
        response,
        error,
        ERROR_IDS.EMU_BREAKPOINT_FAILED,
      );
      if (stable.code.startsWith("EMU_TRANSPORT_")) {
        await this.terminateAfterRuntimeFailure(stable);
      }
    }
  }

  protected override continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments,
  ): void {
    if (
      !this.requireThread(response, args?.threadId) ||
      !this.requireStopped(response)
    ) {
      return;
    }
    if (this.launchBackend.run === undefined) {
      this.fail(
        response,
        ERROR_IDS.EMU_OPERATION_FAILED,
        "EMU_STATE_NOT_LAUNCHED: bounded run operation is unavailable",
      );
      return;
    }
    if (!this.requireChildIdle(response)) {
      return;
    }

    const generation = this.resumeFromStop();
    response.body = { allThreadsContinued: true };
    this.sendResponse(response);
    void this.runContinuously(generation);
  }

  private async runContinuously(generation: number): Promise<void> {
    const operation = this.launchBackend.run;
    const maximum = this.hello?.limits.maxRunChunkInstructions;
    if (operation === undefined || maximum === undefined) {
      await this.terminateAfterRuntimeFailure(
        new EmulatorControlError(
          "EMU_STATE_NOT_LAUNCHED",
          "bounded run limits are unavailable",
        ),
      );
      return;
    }

    while (this.isCurrentRun(generation)) {
      if (this.pauseIntent && this.latestYield !== undefined) {
        this.completePause(this.latestYield);
        return;
      }
      this.latestYield = undefined;
      this.childState = "run-command-active";
      let snapshot: EmulatorSnapshot;
      try {
        snapshot = await operation.call(this.launchBackend, maximum);
      } catch (error: unknown) {
        if (this.isCurrentRun(generation)) {
          await this.terminateAfterRuntimeFailure(
            this.asControlError(error, "EMU_RUN_FAILED"),
          );
        }
        return;
      }
      if (!this.isCurrentRun(generation)) {
        return;
      }
      this.childState = "idle-at-boundary";

      if (this.pauseIntent) {
        this.completePause(snapshot);
        return;
      }
      if (snapshot.resultKind === "yield") {
        this.latestYield = snapshot;
        await new Promise<void>((resolve) => setImmediate(resolve));
        continue;
      }
      if (snapshot.reason === "breakpoint") {
        this.activateStoppedSnapshot(snapshot, "instruction breakpoint");
        return;
      }
      if (snapshot.reason === "exception") {
        this.activateStoppedSnapshot(
          snapshot,
          "exception",
          snapshot.exception?.message,
        );
        return;
      }
      await this.terminateAfterRuntimeFailure(
        new EmulatorControlError(
          "EMU_EXECUTION_HALT",
          `emulator stopped with terminal reason ${snapshot.reason}`,
        ),
      );
      return;
    }
  }

  protected override pauseRequest(
    response: DebugProtocol.PauseResponse,
    args: DebugProtocol.PauseArguments,
  ): void {
    if (!this.requireThread(response, args?.threadId)) {
      return;
    }
    if (this.logicalState !== "running") {
      this.fail(
        response,
        ERROR_IDS.EMU_STATE_NOT_RUNNING,
        "EMU_STATE_NOT_RUNNING: pause requires a logically running session",
      );
      return;
    }
    if (this.pauseIntent) {
      this.fail(
        response,
        ERROR_IDS.EMU_STATE_NOT_RUNNING,
        "EMU_STATE_PAUSE_PENDING: a pause request is already pending",
      );
      return;
    }

    this.pauseIntent = true;
    this.sendResponse(response);
    if (
      this.childState === "idle-at-boundary" &&
      this.latestYield !== undefined
    ) {
      this.completePause(this.latestYield);
    }
  }

  private completePause(snapshot: EmulatorSnapshot): void {
    if (this.logicalState !== "running" || !this.pauseIntent) {
      return;
    }
    this.activateStoppedSnapshot(snapshot, "pause");
  }

  protected override stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments,
  ): void {
    if (args?.granularity === "line" || args?.targetId !== undefined) {
      this.failUnsupported(
        response,
        "stepIn supports only omitted, statement, or instruction granularity in Slice 1",
      );
      return;
    }
    if (
      args?.granularity !== undefined &&
      args.granularity !== "statement" &&
      args.granularity !== "instruction"
    ) {
      this.failUnsupported(response, "unsupported stepIn granularity");
      return;
    }
    if (
      !this.requireThread(response, args?.threadId) ||
      !this.requireStopped(response)
    ) {
      return;
    }
    if (this.launchBackend.stepInstruction === undefined) {
      this.fail(
        response,
        ERROR_IDS.EMU_OPERATION_FAILED,
        "EMU_STATE_NOT_LAUNCHED: stepInstruction operation is unavailable",
      );
      return;
    }
    if (!this.requireChildIdle(response)) {
      return;
    }
    void this.stepInstruction(response);
  }

  private async stepInstruction(
    response: DebugProtocol.StepInResponse,
  ): Promise<void> {
    const operation = this.launchBackend.stepInstruction;
    if (operation === undefined || this.stops.active === undefined) {
      this.failNotStopped(response);
      return;
    }
    const generation = this.runGeneration;
    this.latestYield = undefined;
    this.pauseIntent = false;
    this.logicalState = "running";
    this.childState = "other-command-active";
    let snapshot: EmulatorSnapshot;
    try {
      snapshot = await operation.call(this.launchBackend);
    } catch (error: unknown) {
      const stable = this.asControlError(error, "EMU_STEP_FAILED");
      if (
        !stable.code.startsWith("EMU_TRANSPORT_") &&
        this.isCurrentRun(generation)
      ) {
        this.childState = "idle-at-boundary";
        this.logicalState = "stopped";
        this.latestYield = undefined;
        this.pauseIntent = false;
      }
      this.fail(
        response,
        ERROR_IDS.EMU_OPERATION_FAILED,
        `${stable.code}: ${stable.message}`,
      );
      if (stable.code.startsWith("EMU_TRANSPORT_")) {
        await this.terminateAfterRuntimeFailure(stable);
      }
      return;
    }
    if (!this.isCurrentRun(generation)) {
      return;
    }
    this.childState = "idle-at-boundary";
    this.sendResponse(response);
    if (snapshot.reason === "step") {
      this.activateStoppedSnapshot(snapshot, "step");
      return;
    }
    if (snapshot.reason === "exception") {
      this.activateStoppedSnapshot(
        snapshot,
        "exception",
        snapshot.exception?.message,
      );
      return;
    }
    await this.terminateAfterRuntimeFailure(
      new EmulatorControlError(
        "EMU_EXECUTION_HALT",
        `emulator stopped with terminal reason ${snapshot.reason}`,
      ),
    );
  }

  protected override nextRequest(response: DebugProtocol.NextResponse): void {
    this.failUnsupported(
      response,
      "next requires call-aware semantics and is not supported in Slice 1",
    );
  }

  protected override stepOutRequest(
    response: DebugProtocol.StepOutResponse,
  ): void {
    this.failUnsupported(
      response,
      "stepOut requires an observed caller frame and is not supported in Slice 1",
    );
  }

  protected override disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
  ): void {
    void this.disconnect(response);
  }

  private async disconnect(
    response: DebugProtocol.DisconnectResponse,
  ): Promise<void> {
    if (this.logicalState === "terminated") {
      this.sendResponse(response);
      return;
    }

    this.disconnectWaiters += 1;
    const termination = this.beginTermination();
    const launch = this.activeLaunch;
    if (launch !== undefined) {
      this.settleLaunchFailure(
        launch.generation,
        ERROR_IDS.EMU_LAUNCH_CANCELLED,
        "EMU_LAUNCH_CANCELLED: launch was cancelled by disconnect",
      );
    }

    const cleanupFailure = await termination.cleanup;
    if (!this.isCurrentTermination(termination.generation)) {
      return;
    }
    if (cleanupFailure === undefined) {
      this.sendResponse(response);
    } else {
      this.fail(
        response,
        ERROR_IDS.EMU_CLEANUP_FAILED,
        `EMU_CLEANUP_FAILED: emulator cleanup failed; verify that no child process remains: ${cleanupFailure.message}`,
      );
    }
    this.disconnectWaiters -= 1;
    if (this.disconnectWaiters === 0) {
      this.finishTermination(termination.generation);
    }
  }

  private resumeFromStop(): number {
    this.stops.invalidate();
    this.latestYield = undefined;
    this.pauseIntent = false;
    this.logicalState = "running";
    return ++this.runGeneration;
  }

  private activateStoppedSnapshot(
    snapshot: EmulatorSnapshot,
    reason: string,
    text?: string,
  ): void {
    this.logicalState = "stopped";
    this.childState = "idle-at-boundary";
    this.latestYield = undefined;
    this.pauseIntent = false;
    this.runGeneration += 1;
    this.stops.activate(snapshot);
    this.sendEvent(new StoppedEvent(reason, MCU_THREAD_ID, text));
  }

  private isCurrentRun(generation: number): boolean {
    return this.logicalState === "running" && this.runGeneration === generation;
  }

  private beginOtherChildCommand(response: DebugProtocol.Response): boolean {
    if (!this.requireChildIdle(response)) {
      return false;
    }
    this.childState = "other-command-active";
    return true;
  }

  private requireChildIdle(response: DebugProtocol.Response): boolean {
    if (this.childState === "idle-at-boundary") {
      return true;
    }
    this.fail(
      response,
      ERROR_IDS.EMU_STATE_CHILD_BUSY,
      `EMU_STATE_CHILD_BUSY: child is ${this.childState}`,
    );
    return false;
  }

  private finishOtherChildCommand(): void {
    if (this.childState === "other-command-active") {
      this.childState = "idle-at-boundary";
    }
  }

  private requireStopped(response: DebugProtocol.Response): boolean {
    if (this.logicalState === "stopped" && this.stops.active !== undefined) {
      return true;
    }
    this.failNotStopped(response);
    return false;
  }

  private failNotStopped(response: DebugProtocol.Response): void {
    this.fail(
      response,
      ERROR_IDS.EMU_STATE_NOT_STOPPED,
      `EMU_STATE_NOT_STOPPED: request requires a stopped snapshot; current state is ${this.logicalState}`,
    );
  }

  private requireThread(
    response: DebugProtocol.Response,
    threadId: unknown,
  ): boolean {
    if (threadId === MCU_THREAD_ID) {
      return true;
    }
    this.fail(
      response,
      ERROR_IDS.EMU_THREAD_INVALID,
      `EMU_THREAD_INVALID: Slice 1 exposes only thread ${MCU_THREAD_ID}`,
    );
    return false;
  }

  private stackTracePagination(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
  ): { startFrame: number; levels: number } | undefined {
    const startFrame = args?.startFrame;
    const levels = args?.levels;
    if (
      (startFrame !== undefined &&
        (!Number.isSafeInteger(startFrame) || startFrame < 0)) ||
      (levels !== undefined && (!Number.isSafeInteger(levels) || levels < 0))
    ) {
      this.fail(
        response,
        ERROR_IDS.EMU_STACKTRACE_INVALID,
        "EMU_STACKTRACE_INVALID: startFrame and levels must be non-negative safe integers when present",
      );
      return undefined;
    }
    return { startFrame: startFrame ?? 0, levels: levels ?? 0 };
  }

  private failUnsupported(
    response: DebugProtocol.Response,
    message: string,
  ): void {
    this.fail(
      response,
      ERROR_IDS.DAP_UNSUPPORTED,
      `DAP_UNSUPPORTED: ${message}`,
    );
  }

  private failOperation(
    response: DebugProtocol.Response,
    error: unknown,
    id: number,
  ): EmulatorControlError {
    const stable = this.asControlError(error, "EMU_OPERATION_FAILED");
    this.fail(response, id, `${stable.code}: ${stable.message}`);
    return stable;
  }

  private asControlError(
    error: unknown,
    fallbackCode: string,
  ): EmulatorControlError {
    return error instanceof EmulatorControlError
      ? error
      : new EmulatorControlError(
          fallbackCode,
          error instanceof Error ? error.message : "emulator operation failed",
        );
  }

  private beginTermination(): TerminationOperation {
    const existing = this.terminationOperation;
    if (existing !== undefined) {
      return existing;
    }
    this.logicalState = "terminating";
    this.childState = "terminating";
    this.configurationOpen = false;
    this.pendingEntrySnapshot = undefined;
    this.pauseIntent = false;
    this.latestYield = undefined;
    this.runGeneration += 1;
    this.stops.invalidate();
    const operation: TerminationOperation = {
      generation: ++this.terminationGeneration,
      cleanup: this.disconnectBackend(),
    };
    this.terminationOperation = operation;
    return operation;
  }

  private async disconnectBackend(): Promise<Error | undefined> {
    try {
      await this.launchBackend.disconnect();
      return undefined;
    } catch (error: unknown) {
      return error instanceof Error ? error : new Error("unknown cleanup failure");
    }
  }

  private async terminateAfterRuntimeFailure(
    error: EmulatorControlError,
  ): Promise<void> {
    if (this.isTerminatingOrTerminated()) {
      return;
    }
    this.sendEvent(new OutputEvent(`${error.code}: ${error.message}\n`, "stderr"));
    const termination = this.beginTermination();
    await this.finishCleanupWhenUnobserved(termination);
  }

  private async handleUnexpectedTransportFailure(
    error: EmulatorControlError,
  ): Promise<void> {
    if (this.isTerminatingOrTerminated()) {
      return;
    }
    const launch = this.activeLaunch;
    const termination = this.beginTermination();
    if (launch !== undefined) {
      this.settleLaunchFailure(
        launch.generation,
        ERROR_IDS.EMU_LAUNCH_FAILED,
        `${error.code}: ${error.message}`,
      );
    } else {
      this.sendEvent(new OutputEvent(`${error.code}: ${error.message}\n`, "stderr"));
    }
    await this.finishCleanupWhenUnobserved(termination);
  }

  private async finishCleanupWhenUnobserved(
    termination: TerminationOperation,
  ): Promise<void> {
    const cleanupFailure = await termination.cleanup;
    if (!this.isCurrentTermination(termination.generation)) {
      return;
    }
    if (cleanupFailure !== undefined) {
      this.reportCleanupFailureOnce(cleanupFailure);
    }
    if (this.disconnectWaiters === 0) {
      this.finishTermination(termination.generation);
    }
  }

  private isLiveLaunch(generation: number): boolean {
    return (
      this.logicalState === "starting" &&
      this.activeLaunch?.generation === generation
    );
  }

  private isTerminatingOrTerminated(): boolean {
    return (
      this.logicalState === "terminating" || this.logicalState === "terminated"
    );
  }

  private isCurrentTermination(generation: number): boolean {
    return (
      this.logicalState === "terminating" &&
      this.terminationOperation?.generation === generation
    );
  }

  private settleLaunchFailure(
    generation: number,
    id: number,
    message: string,
  ): void {
    const launch = this.activeLaunch;
    if (launch?.generation !== generation) {
      return;
    }
    this.activeLaunch = undefined;
    this.fail(launch.response, id, message);
  }

  private reportCleanupFailureOnce(error: Error): void {
    if (this.cleanupFailureReported) {
      return;
    }
    this.cleanupFailureReported = true;
    this.sendEvent(
      new OutputEvent(
        `EMU_CLEANUP_FAILED: emulator cleanup failed; verify that no child process remains: ${error.message}\n`,
        "stderr",
      ),
    );
  }

  private fail(
    response: DebugProtocol.Response,
    id: number,
    message: string,
  ): void {
    this.sendErrorResponse(response, id, message);
  }

  private finishTerminationWithoutCleanup(): void {
    this.logicalState = "terminated";
    this.childState = "exited";
    this.activeLaunch = undefined;
    this.configurationOpen = false;
    this.pendingEntrySnapshot = undefined;
    this.stops.invalidate();
    this.terminateOnce();
  }

  private finishTermination(generation: number): void {
    if (!this.isCurrentTermination(generation)) {
      return;
    }
    this.logicalState = "terminated";
    this.childState = "exited";
    this.activeLaunch = undefined;
    this.configurationOpen = false;
    this.pendingEntrySnapshot = undefined;
    this.stops.invalidate();
    this.terminateOnce();
  }

  private terminateOnce(): void {
    if (this.terminatedSent) {
      return;
    }
    this.terminatedSent = true;
    this.sendEvent(new TerminatedEvent());
  }

  private get hello(): EmulatorHello | undefined {
    return this.launchResult?.hello;
  }
}
