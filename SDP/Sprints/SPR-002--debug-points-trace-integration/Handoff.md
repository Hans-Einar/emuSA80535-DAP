# SPR-002 Handoff

## Current state

The post-Slice-1 DAP design is rebaselined to consume the emulator-owned breakpoint/watchpoint/tracepoint runtime.

Implementation is **not activated**. The sprint is dependency-gated on:

1. `emuSA80535-N` Issue #14 accepting SLC-015..017 and freezing facade/versioning/paging; and
2. a separately reviewed emulator wire-extension slice exposing the accepted debug-point runtime, required CPU event producers and safe-boundary watchpoint stop path.

Phase A documentation-only `IT-002-000 / SL-002-000-001` is active under DAP
Issue #6. Corrective `RVW-002-000-002` was accepted at review commit
`c8a387df6a99279816d5856f1c2c9170128fe672`: `CR-023`–`CR-027` are resolved
and no new review finding was raised. `VER-002-000-001` passed every other
semantic, mechanical, regression, scope, and dependency check but returned
`PHASE_A_FAIL` and raised `CR-028` for this bounded one-file Handoff correction.
`CR-028` remains open/in-progress pending fresh `RVW-002-000-003` and
`VER-002-000-002`.

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

Run fresh `RVW-002-000-003` on only the bounded `CR-028` Handoff correction,
then run fresh `VER-002-000-002` on the corrected exact integrated HEAD. PR #5
must remain unmerged until that fresh review and verification are accepted.
Do not reconcile to exact wire names until Gate B supplies accepted names, and
do not activate product work. Gate A remains unsatisfied while emulator Issue
#14 and PR #16 are open; Gate B remains unsatisfied because no accepted
successor wire extension exists. If the bounded local correction passes, the
expected Phase-A dependency disposition remains
`WAITING_FOR_EMULATOR_CONTRACT`.

Only after Steering activates Slice 2 should it implement `SPR-002`.

The later Slice-2A worker must preserve the complete accepted Slice-1
regression suite and prove optional-extension absence leaves Slice-1 behavior
unchanged.
