import assert from "node:assert/strict";
import test from "node:test";

import {
  mapBreakpointReplacementResult,
  planInstructionBreakpointReplacement,
} from "../adapter/src/breakpoints";
import { mapDisassembledInstructions } from "../adapter/src/disassembly";
import type { EmulatorSnapshot } from "../adapter/src/emulatorClient";
import {
  CodeReferenceError,
  canonicalCodeReference,
  numericCodeAddress,
  parseInstructionReference,
  parseOpaqueCodeReference,
} from "../adapter/src/memoryReference";
import { StopEpochStore } from "../adapter/src/state";

void test("CODE references use the frozen opaque and numeric grammars", () => {
  assert.deepEqual(parseOpaqueCodeReference("code:00AF"), {
    address: 0x00af,
    canonical: "code:00AF",
  });
  assert.deepEqual(parseInstructionReference("code:00AF", undefined), {
    address: 0x00af,
    canonical: "code:00AF",
  });
  assert.deepEqual(parseInstructionReference("0xa", 2), {
    address: 12,
    canonical: "code:000C",
  });
  assert.deepEqual(parseInstructionReference("0XfFfF", 0), {
    address: 0xffff,
    canonical: "code:FFFF",
  });
  assert.deepEqual(parseInstructionReference("65535", -1), {
    address: 0xfffe,
    canonical: "code:FFFE",
  });
  assert.equal(canonicalCodeReference(0x123), "code:0123");
  assert.equal(numericCodeAddress(0x123), "0x0123");
});

void test("CODE reference parsing rejects whitespace, signs, schemes, width, and wrap", () => {
  const invalidReferences = [
    " code:0000",
    "code:0000 ",
    "code:00af",
    "CODE:0000",
    "xdata:0000",
    "+1",
    "-1",
    "0x",
    "0x00000",
    "65536",
    "1.0",
  ];
  for (const reference of invalidReferences) {
    assert.throws(
      () => parseInstructionReference(reference, 0),
      CodeReferenceError,
      reference,
    );
  }
  for (const [reference, offset] of [
    ["0", -1],
    ["65535", 1],
    ["1", 0.5],
  ] as const) {
    assert.throws(
      () => parseInstructionReference(reference, offset),
      (error: unknown) =>
        error instanceof CodeReferenceError &&
        error.code === "EMU_MEMORY_RANGE",
    );
  }
  assert.throws(() => parseOpaqueCodeReference("0x0010"), CodeReferenceError);
  assert.throws(
    () => parseInstructionReference(2 as unknown as string, 0),
    CodeReferenceError,
  );
  assert.throws(
    () => parseOpaqueCodeReference(2 as unknown as string),
    CodeReferenceError,
  );
});

void test("breakpoint replacement keeps DAP order, deduplicates the child set, and reports limits", () => {
  const plan = planInstructionBreakpointReplacement(
    [
      { instructionReference: "0x0001", offset: 1 },
      { instructionReference: "2" },
      { instructionReference: "0x0003" },
      { instructionReference: " code:0004" },
    ],
    1,
  );
  assert.deepEqual(plan.addresses, [2]);
  assert.deepEqual(
    mapBreakpointReplacementResult(plan, {
      accepted: [2],
      rejected: [],
      limit: 1,
    }),
    [
      { verified: true, instructionReference: "code:0002" },
      { verified: true, instructionReference: "code:0002" },
      {
        verified: false,
        instructionReference: "code:0003",
        message: "EMU_BREAKPOINT_LIMIT: negotiated limit is 1",
      },
      {
        verified: false,
        message:
          "EMU_MEMORY_REFERENCE: instructionReference must be code:HHHH, 0x/0X with 1-4 hex digits, or unsigned decimal",
      },
    ],
  );
  assert.deepEqual(
    planInstructionBreakpointReplacement([null, { instructionReference: 2 }], 1)
      .entries.map((entry) => entry.message),
    [
      "EMU_BREAKPOINT_INVALID: breakpoint must be an object",
      "EMU_MEMORY_REFERENCE: instructionReference must be a string",
    ],
  );
});

void test("disassembly mapping preserves addresses/text and marks placeholders invalid", () => {
  assert.deepEqual(
    mapDisassembledInstructions([
      { address: 0, size: 2, valid: true, text: "MOV A,#0x01" },
      {
        address: 2,
        size: 1,
        valid: false,
        text: "<invalid>",
        reason: "unknown-predecessor",
      },
    ]),
    [
      {
        address: "0x0000",
        instruction: "MOV A,#0x01",
        presentationHint: "normal",
      },
      {
        address: "0x0002",
        instruction: "<invalid>",
        presentationHint: "invalid",
      },
    ],
  );
});

void test("every activated stop gets fresh frame and variable handles", () => {
  const snapshot: EmulatorSnapshot = {
    state: "idle",
    resultKind: "architectural-stop",
    reason: "entry",
    pc: 0,
    registers: {
      a: 0,
      b: 0,
      psw: 0,
      sp: 7,
      dptr: 0,
      r: [0, 0, 0, 0, 0, 0, 0, 0],
    },
    variant: "sab80535",
    instructionCount: 0,
    machineCycleCount: 0,
  };
  const store = new StopEpochStore();
  const first = store.activate(snapshot);
  assert.equal(store.isCurrentFrame(first.frameId), true);
  assert.equal(
    store.isCurrentRegistersReference(first.registersReference),
    true,
  );
  store.invalidate();
  assert.equal(store.isCurrentFrame(first.frameId), false);
  const second = store.activate({ ...snapshot, pc: 2, reason: "step" });
  assert.notEqual(second.frameId, first.frameId);
  assert.notEqual(second.registersReference, first.registersReference);
  assert.equal(store.isCurrentFrame(first.frameId), false);
  assert.equal(store.stopEpoch, 2);
});
