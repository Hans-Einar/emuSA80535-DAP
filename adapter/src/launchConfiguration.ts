import type { DebugProtocol } from "@vscode/debugprotocol";

export interface EmuLaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  program: string;
  entryAddress?: string;
  resetSeed?: number;
  emulatorPath?: string;
  stopOnEntry?: boolean;
  trace?: "off";
}

export interface ValidatedLaunchConfiguration {
  program: string;
  entryAddress: number;
  resetSeed: number;
  emulatorPath?: string;
}

export class LaunchConfigurationError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LaunchConfigurationError";
  }
}

const ENTRY_ADDRESS = /^0x([0-9A-Fa-f]{4})$/;
const UINT32_MAX = 0xffff_ffff;

export function validateLaunchConfiguration(
  args: EmuLaunchRequestArguments,
): ValidatedLaunchConfiguration {
  if (typeof args.program !== "string" || args.program.length === 0) {
    throw new LaunchConfigurationError(
      "CONFIG_PROGRAM_REQUIRED",
      "program must name an exactly 65,536-byte raw CODE image",
    );
  }

  const entryText = args.entryAddress ?? "0x0000";
  const match = ENTRY_ADDRESS.exec(entryText);
  if (match === null) {
    throw new LaunchConfigurationError(
      "CONFIG_ENTRY_ADDRESS",
      "entryAddress must be a four-digit hexadecimal CODE address such as 0x0000",
    );
  }

  const resetSeed = args.resetSeed ?? 525109;
  if (
    !Number.isSafeInteger(resetSeed) ||
    resetSeed < 0 ||
    resetSeed > UINT32_MAX
  ) {
    throw new LaunchConfigurationError(
      "CONFIG_RESET_SEED",
      "resetSeed must be an unsigned 32-bit integer",
    );
  }

  if (args.stopOnEntry !== undefined && args.stopOnEntry !== true) {
    throw new LaunchConfigurationError(
      "CONFIG_STOP_ON_ENTRY",
      "Slice 1 requires stopOnEntry to be true",
    );
  }

  if (args.trace !== undefined && args.trace !== "off") {
    throw new LaunchConfigurationError(
      "CONFIG_TRACE",
      "trace must be 'off' in Slice 1",
    );
  }

  if (args.emulatorPath !== undefined) {
    if (
      typeof args.emulatorPath !== "string" ||
      args.emulatorPath.length === 0
    ) {
      throw new LaunchConfigurationError(
        "CONFIG_EMULATOR_PATH",
        "emulatorPath must be omitted or contain a non-empty executable path string",
      );
    }
  }

  const validated: ValidatedLaunchConfiguration = {
    program: args.program,
    entryAddress: Number.parseInt(match[1] ?? "", 16),
    resetSeed,
  };

  if (args.emulatorPath !== undefined) {
    validated.emulatorPath = args.emulatorPath;
  }

  return validated;
}
