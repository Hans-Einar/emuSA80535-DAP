# SPR-002 Handoff

## Current state

The post-Slice-1 DAP design is rebaselined to consume the emulator-owned breakpoint/watchpoint/tracepoint runtime.

Implementation is **not activated**. The sprint is dependency-gated on:

1. `emuSA80535-N` Issue #14 accepting SLC-015..017 and freezing facade/versioning/paging; and
2. a separately reviewed emulator wire-extension slice exposing the accepted debug-point runtime, required CPU event producers and safe-boundary watchpoint stop path.

## DAP Codex next action

A future DAP worker should first revalidate those exact emulator authorities and reconcile `protocol/EMU_DEBUG_POINTS_EXTENSION_REQUIREMENTS.md` to the final wire command/capability/event names.

Only after Steering activates Slice 2 should it implement `SPR-002`.

The worker must preserve the complete accepted Slice-1 regression suite and prove optional-extension absence leaves Slice-1 behavior unchanged.
