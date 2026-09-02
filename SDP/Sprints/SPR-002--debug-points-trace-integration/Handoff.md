# SPR-002 Handoff

## Current state

The post-Slice-1 DAP design is rebaselined to consume the emulator-owned breakpoint/watchpoint/tracepoint runtime.

Implementation is **not activated**. The sprint is dependency-gated on:

1. `emuSA80535-N` Issue #14 accepting SLC-015..017 and freezing facade/versioning/paging; and
2. a separately reviewed emulator wire-extension slice exposing the accepted debug-point runtime, required CPU event producers and safe-boundary watchpoint stop path.

Phase A documentation-only `IT-002-000 / SL-002-000-001` is active under DAP
Issue #6. Fresh `RVW-002-000-001` reviews PR #5 HEAD `6fc619845…`; corrections,
traceability reconciliation, and `VER-002-000-001` follow.

Current dependency evidence:

- Gate A is not satisfied: emulator Issue #14 and takeover PR #16 are open.
- Gate B is not satisfied: PR #16 explicitly excludes CPU producers,
  safe-boundary CPU stop application, and `emu-debug` wire extension; no
  accepted successor wire issue/PR exists.
- PRs #11/#12 and WIP `356836637…` remain unmerged inputs, not a frozen consumer
  contract.

## DAP Codex next action

A fresh reviewer completes `RVW-002-000-001` against the fourteen Issue #6
review points. A separate correction worker handles findings, then a fresh
verifier checks documentation scope/traceability/dependencies. Do not reconcile
to exact wire names until Gate B supplies accepted names.

Only after Steering activates Slice 2 should it implement `SPR-002`.

The worker must preserve the complete accepted Slice-1 regression suite and prove optional-extension absence leaves Slice-1 behavior unchanged.
