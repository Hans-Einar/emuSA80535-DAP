import {
  DebugSession,
  InitializedEvent,
  OutputEvent,
  TerminatedEvent,
} from "@vscode/debugadapter";
import type { DebugProtocol } from "@vscode/debugprotocol";

import {
  LaunchConfigurationError,
  type EmuLaunchRequestArguments,
  type ValidatedLaunchConfiguration,
  validateLaunchConfiguration,
} from "./launchConfiguration";

const ERROR_IDS = {
  DAP_INITIALIZE_ONCE: 1001,
  DAP_INITIALIZE_REQUIRED: 1002,
  DAP_SESSION_TERMINATED: 1003,
  CONFIG_INVALID: 1100,
  EMU_INTEGRATION_PENDING: 1200,
  EMU_STATE_NOT_CONFIGURING: 1300,
  EMU_LAUNCH_ALREADY_STARTED: 1301,
  EMU_LAUNCH_CANCELLED: 1302,
  EMU_CLEANUP_FAILED: 1400,
} as const;

type AdapterLifecycle =
  | "accepting"
  | "launching"
  | "configuring"
  | "terminating"
  | "terminated";

interface ActiveLaunch {
  generation: number;
  response: DebugProtocol.LaunchResponse;
}

interface TerminationOperation {
  generation: number;
  cleanup: Promise<Error | undefined>;
}

export interface LaunchBackend {
  launch(configuration: ValidatedLaunchConfiguration): Promise<void>;
  disconnect(): Promise<void>;
}

class UnavailableLaunchBackend implements LaunchBackend {
  public launch(): Promise<void> {
    return Promise.reject(
      new Error(
        "the emu-debug 1.0 client is not connected in the foundation pass",
      ),
    );
  }

  public disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Slice-1 DAP process and lifecycle foundation.
 *
 * Emulator ownership is deliberately not implemented here. Worker B supplies
 * the contract client and replaces the explicit launch rejection; Worker C
 * adds only capabilities whose complete request semantics exist.
 */
export class EmuDebugSession extends DebugSession {
  private initializeReceived = false;
  private lifecycle: AdapterLifecycle = "accepting";
  private configurationOpen = false;
  private terminatedSent = false;
  private launchGeneration = 0;
  private activeLaunch: ActiveLaunch | undefined;
  private terminationGeneration = 0;
  private terminationOperation: TerminationOperation | undefined;
  private disconnectWaiters = 0;
  private cleanupFailureReported = false;
  private readonly launchBackend: LaunchBackend;

  public constructor(
    debuggerLinesAndColumnsStartAt1?: boolean,
    isServer?: boolean,
    launchBackend: LaunchBackend = new UnavailableLaunchBackend(),
  ) {
    super(debuggerLinesAndColumnsStartAt1, isServer);
    this.launchBackend = launchBackend;
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
    };
    this.sendResponse(response);
  }

  protected override launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: EmuLaunchRequestArguments,
  ): void {
    if (this.lifecycle === "terminating" || this.lifecycle === "terminated") {
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

    if (this.lifecycle !== "accepting") {
      this.fail(
        response,
        ERROR_IDS.EMU_LAUNCH_ALREADY_STARTED,
        "EMU_LAUNCH_ALREADY_STARTED: one launch already owns this DAP session",
      );
      return;
    }

    const generation = ++this.launchGeneration;
    this.lifecycle = "launching";
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

      this.lifecycle = "terminating";
      this.configurationOpen = false;
      this.settleLaunchFailure(generation, ERROR_IDS.CONFIG_INVALID, message);
      this.finishTerminationWithoutCleanup();
      return;
    }

    try {
      await this.launchBackend.launch(configuration);
      if (!this.isLiveLaunch(generation)) {
        return;
      }

      this.lifecycle = "configuring";
      this.configurationOpen = true;
      this.sendEvent(new InitializedEvent());
    } catch (error: unknown) {
      if (!this.isLiveLaunch(generation)) {
        return;
      }

      const detail = error instanceof Error ? error.message : "launch failed";
      const termination = this.beginTermination();
      this.settleLaunchFailure(
        generation,
        ERROR_IDS.EMU_INTEGRATION_PENDING,
        `EMU_INTEGRATION_PENDING: ${detail}`,
      );
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
  }

  protected override configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
  ): void {
    if (this.lifecycle === "terminating" || this.lifecycle === "terminated") {
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

    this.configurationOpen = false;
    this.lifecycle = "configuring";
    this.sendResponse(response);
    const launch = this.activeLaunch;
    if (launch !== undefined) {
      this.activeLaunch = undefined;
      this.sendResponse(launch.response);
    }
  }

  protected override disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
  ): void {
    void this.disconnect(response);
  }

  private async disconnect(
    response: DebugProtocol.DisconnectResponse,
  ): Promise<void> {
    if (this.lifecycle === "terminated") {
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

  private beginTermination(): TerminationOperation {
    const existing = this.terminationOperation;
    if (existing !== undefined) {
      return existing;
    }

    this.lifecycle = "terminating";
    this.configurationOpen = false;
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

  private isLiveLaunch(generation: number): boolean {
    return (
      this.lifecycle === "launching" &&
      this.activeLaunch?.generation === generation
    );
  }

  private isCurrentTermination(generation: number): boolean {
    return (
      this.lifecycle === "terminating" &&
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
    this.lifecycle = "terminated";
    this.activeLaunch = undefined;
    this.configurationOpen = false;
    this.terminateOnce();
  }

  private finishTermination(generation: number): void {
    if (!this.isCurrentTermination(generation)) {
      return;
    }

    this.lifecycle = "terminated";
    this.activeLaunch = undefined;
    this.configurationOpen = false;
    this.terminateOnce();
  }

  private terminateOnce(): void {
    if (this.terminatedSent) {
      return;
    }

    this.terminatedSent = true;
    this.sendEvent(new TerminatedEvent());
  }
}
