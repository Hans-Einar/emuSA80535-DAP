# DAP-STEERING-REV-001 — Steering review of Slice-1 readiness

**Reviewed PR:** #2
**Reviewed HEAD:** `cfe1871b180f7f93dc9cb9f47656ef1816b173d4`
**Disposition:** **APPROVED**

## Scope

Independent Steering review of the complete Issue #1 SDP package before opening product implementation work.

## Findings

No blocking finding remains.

The final package correctly:

- separates DAP stdio from the emulator-control NDJSON channel;
- uses a separate Node.js/TypeScript adapter process rather than coupling emulator execution to the VS Code extension host;
- keeps the adapter firmware-neutral and free of P1000 semantics;
- distinguishes opaque DAP memory/instruction references from numeric disassembly addresses;
- uses the correct DAP `instruction breakpoint` stop reason;
- defines bounded-run pause semantics without pretending the synchronous emulator child executes between commands;
- exposes only a truthful current-PC stack frame in Slice 1 and defers logical call/IRQ stack history;
- keeps raw memory browsing, source breakpoints, source maps, watchpoints, writes, attach, bundling, and Marketplace publication outside Slice 1;
- freezes a versioned `emu-debug` 1.0 process contract instead of consuming private emulator structs;
- makes all remaining emulator-side prerequisites explicit.

The candidate first slice is thin enough to review and verify as a vertical product increment: launch, entry stop, one MCU thread/current frame, basic registers, minimal disassembly, one instruction breakpoint, bounded continue/pause, and instruction-level step.

## Live dependency note

Since the Issue #1 evidence baseline, `emuSA80535-N` has advanced beyond `a20815e`. Timer0/Timer1 Stage-1 timing PR #4 has merged as `c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`. This does not satisfy the missing headless `emu-debug` 1.0 server/process prerequisites, so real-emulator Slice-1 acceptance remains gated on the `EMU-BLK` contract in `protocol/EMU_DEBUG_API_REQUIREMENTS.md`.

Adapter implementation may be developed and tested against a contract-faithful fake server, but the slice cannot be declared complete until a compatible real emulator server/release satisfies the frozen minimum contract and the end-to-end acceptance tests pass.

## Steering decisions

For the first implementation issue:

- package root: repository root, with `extension/` and `adapter/` retained as the primary source boundaries unless implementation proves a simpler layout;
- implementation language/runtime: Node.js + TypeScript as selected by the accepted SDP;
- initial extension version: `0.1.0`;
- extension identifier: `emuSA80535-dap` unless VS Code manifest validation requires normalization;
- publisher remains a packaging parameter and is not required for local `.vsix` acceptance;
- Linux is mandatory CI; Windows is mandatory before Slice-1 acceptance;
- Marketplace publication remains out of scope.

## Result

PR #2 documentation is accepted as the implementation baseline. A separate product issue may activate `IT-001-002 / SL-001-002-001` subject to its explicit emulator integration gate.
