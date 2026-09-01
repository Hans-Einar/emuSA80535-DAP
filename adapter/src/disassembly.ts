import type { DebugProtocol } from "@vscode/debugprotocol";

import type { DecodeInstruction } from "./emulatorClient";
import { numericCodeAddress } from "./memoryReference";

export function mapDisassembledInstructions(
  instructions: readonly DecodeInstruction[],
): DebugProtocol.DisassembledInstruction[] {
  return instructions.map((record) => ({
    address: numericCodeAddress(record.address),
    instruction: record.valid ? record.text : "<invalid>",
    presentationHint: record.valid ? "normal" : "invalid",
  }));
}
