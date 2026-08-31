import {
  DebugSession,
  InitializedEvent,
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
  CONFIG_INVALID: 1100,
  EMU_INTEGRATION_PENDING: 1200,
  EMU_STATE_NOT_CONFIGURING: 1300,
} as const;

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
  private configurationOpen = false;
  private terminatedSent = false;
  private pendingLaunchResponse: DebugProtocol.LaunchResponse | undefined;
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
    if (!this.initializeReceived) {
      this.fail(
        response,
        ERROR_IDS.DAP_INITIALIZE_REQUIRED,
        "DAP_INITIALIZE_REQUIRED: initialize must precede launch",
      );
      return;
    }

    void this.beginLaunch(response, args);
  }

  private async beginLaunch(
    response: DebugProtocol.LaunchResponse,
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
      this.fail(response, ERROR_IDS.CONFIG_INVALID, message);
      this.terminateOnce();
      return;
    }

    try {
      await this.launchBackend.launch(configuration);
      this.pendingLaunchResponse = response;
      this.configurationOpen = true;
      this.sendEvent(new InitializedEvent());
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "launch failed";
      this.fail(
        response,
        ERROR_IDS.EMU_INTEGRATION_PENDING,
        `EMU_INTEGRATION_PENDING: ${detail}`,
      );
      await this.disconnectBackend();
      this.terminateOnce();
    }
  }

  protected override configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
  ): void {
    if (!this.configurationOpen) {
      this.fail(
        response,
        ERROR_IDS.EMU_STATE_NOT_CONFIGURING,
        "EMU_STATE_NOT_CONFIGURING: no launch configuration phase is active",
      );
      return;
    }

    this.configurationOpen = false;
    this.sendResponse(response);
    const launchResponse = this.pendingLaunchResponse;
    this.pendingLaunchResponse = undefined;
    if (launchResponse !== undefined) {
      this.sendResponse(launchResponse);
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
    await this.disconnectBackend();
    this.sendResponse(response);
    this.terminateOnce();
  }

  private async disconnectBackend(): Promise<void> {
    try {
      await this.launchBackend.disconnect();
    } catch {
      // Worker B maps concrete child-cleanup failures to structured diagnostics.
    }
  }

  private fail(
    response: DebugProtocol.Response,
    id: number,
    message: string,
  ): void {
    this.sendErrorResponse(response, id, message);
  }

  private terminateOnce(): void {
    if (this.terminatedSent) {
      return;
    }

    this.terminatedSent = true;
    this.sendEvent(new TerminatedEvent());
  }
}
