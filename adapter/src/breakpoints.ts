import type { DebugProtocol } from "@vscode/debugprotocol";

import type { ReplaceCodeBreakpointsResult } from "./emulatorClient";
import {
  CodeReferenceError,
  parseInstructionReference,
} from "./memoryReference";

interface PlannedBreakpoint {
  address?: number;
  canonical?: string;
  selected: boolean;
  message?: string;
}

export interface BreakpointReplacementPlan {
  addresses: number[];
  entries: PlannedBreakpoint[];
}

export function planInstructionBreakpointReplacement(
  breakpoints: readonly unknown[],
  maximumUniqueAddresses: number,
): BreakpointReplacementPlan {
  const selectedAddresses = new Set<number>();
  const entries: PlannedBreakpoint[] = [];

  for (const rawBreakpoint of breakpoints) {
    if (
      typeof rawBreakpoint !== "object" ||
      rawBreakpoint === null ||
      Array.isArray(rawBreakpoint)
    ) {
      entries.push({
        selected: false,
        message: "EMU_BREAKPOINT_INVALID: breakpoint must be an object",
      });
      continue;
    }
    const breakpoint = rawBreakpoint as Partial<DebugProtocol.InstructionBreakpoint>;
    if (typeof breakpoint.instructionReference !== "string") {
      entries.push({
        selected: false,
        message:
          "EMU_MEMORY_REFERENCE: instructionReference must be a string",
      });
      continue;
    }
    if (
      breakpoint.condition !== undefined ||
      breakpoint.hitCondition !== undefined ||
      breakpoint.mode !== undefined
    ) {
      entries.push({
        selected: false,
        message:
          "DAP_UNSUPPORTED: conditional, hit-conditional, and mode instruction breakpoints are not supported in Slice 1",
      });
      continue;
    }

    try {
      const parsed = parseInstructionReference(
        breakpoint.instructionReference,
        breakpoint.offset,
      );
      if (selectedAddresses.has(parsed.address)) {
        entries.push({ ...parsed, selected: true });
        continue;
      }
      if (selectedAddresses.size >= maximumUniqueAddresses) {
        entries.push({
          ...parsed,
          selected: false,
          message: `EMU_BREAKPOINT_LIMIT: negotiated limit is ${maximumUniqueAddresses}`,
        });
        continue;
      }
      selectedAddresses.add(parsed.address);
      entries.push({ ...parsed, selected: true });
    } catch (error: unknown) {
      const stable =
        error instanceof CodeReferenceError
          ? error
          : new CodeReferenceError(
              "EMU_MEMORY_REFERENCE",
              "invalid instruction reference",
            );
      entries.push({
        selected: false,
        message: `${stable.code}: ${stable.message}`,
      });
    }
  }

  return { addresses: [...selectedAddresses], entries };
}

export function mapBreakpointReplacementResult(
  plan: BreakpointReplacementPlan,
  result: ReplaceCodeBreakpointsResult,
): DebugProtocol.Breakpoint[] {
  const accepted = new Set(result.accepted);
  const rejected = new Map(
    result.rejected.map((entry) => [entry.address, entry.reason]),
  );
  return plan.entries.map((entry) => {
    if (entry.address === undefined) {
      return { verified: false, message: entry.message };
    }
    if (!entry.selected) {
      return {
        verified: false,
        instructionReference: entry.canonical,
        message: entry.message,
      };
    }
    if (accepted.has(entry.address)) {
      return {
        verified: true,
        instructionReference: entry.canonical,
      };
    }
    return {
      verified: false,
      instructionReference: entry.canonical,
      message:
        rejected.get(entry.address) ??
        "EMU_BREAKPOINT_REJECTED: emulator did not accept the CODE address",
    };
  });
}
