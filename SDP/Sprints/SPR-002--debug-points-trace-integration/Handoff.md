# SPR-002 Handoff

## Current state

The post-Slice-1 DAP design is rebaselined to consume the emulator-owned breakpoint/watchpoint/tracepoint runtime.

Implementation is **not activated**. The sprint is dependency-gated on:

1. `emuSA80535-N` Issue #14 accepting SLC-015..017 and freezing facade/versioning/paging; and
2. a separately reviewed emulator wire-extension slice exposing the accepted debug-point runtime, required CPU event producers and safe-boundary watchpoint stop path.

Phase A documentation-only `IT-002-000 / SL-002-000-001` is active under DAP
Issue #6. Fresh `RVW-002-000-001` returned CHANGES_REQUIRED against reviewed
HEAD `4659c7be9b3218880dea205f0f8fcb7284324e92`. The corrective worker has
submitted `CR-023`–`CR-027` for independent `RVW-002-000-002`; findings remain
open/in-progress until that re-review and `VER-002-000-001` disposition them.

Current dependency evidence:

- Gate A is not satisfied: emulator Issue #14 is OPEN; takeover PR #16 is
  OPEN/CLEAN and unmerged at
  `1e588d28fb168a7c5a42c4c7dc4b51f84d29d1ed`; current emulator `master` is
  `bc86d2633b6057529e6fd1e666896c24d72822aa` and does not contain PR #16.
- Gate B is not satisfied: PR #16 explicitly excludes CPU producers,
  safe-boundary CPU stop application, and `emu-debug` wire extension; no
  accepted successor wire issue/PR exists.
- PRs #11/#12 and WIP `356836637…` remain unmerged inputs, not a frozen consumer
  contract.

The planned product sprint is now split:

- `IT-002-001 / SL-002-001-001` is the thin stopping-watchpoint Slice 2A:
  optional negotiation, native `A/B/PSW/SP` SFR origins, data-breakpoint
  lifecycle/replacement, safe-boundary stop/correlation, regression, and
  cross-platform fake-real/package proof.
- `IT-002-002 / SL-002-002-001` is the later rich non-stopping trace Slice 2B:
  tracepoints, sessions, routes, gates, interrupt policy, paging, output,
  notifications, and UI. It is separately planned and not activated.

Both remain under `SPR-002` and dependency-gated.

## DAP Codex next action

Run fresh `RVW-002-000-002` on the corrective documentation commit, then
`VER-002-000-001`. Do not mark `CR-023`–`CR-027` resolved before those
independent dispositions. Do not reconcile to exact wire names until Gate B
supplies accepted names, and do not activate product work.

Only after Steering activates Slice 2 should it implement `SPR-002`.

The later Slice-2A worker must preserve the complete accepted Slice-1
regression suite and prove optional-extension absence leaves Slice-1 behavior
unchanged.
