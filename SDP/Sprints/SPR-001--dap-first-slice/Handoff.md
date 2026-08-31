# Handoff — SPR-001 readiness

## Current objective

Refresh the merged emulator baseline under `SL-001-001-002`, obtain a separate
review, then rerun verification before the Master records
`READY-FOR-SLICE-1`. Documentation-only PR #2 is open. Do not start product
Slice 1.

## Authoritative source documents

- [GitHub Issue #1](https://github.com/Hans-Einar/emuSA80535-DAP/issues/1)
- `SDP/01--Mandate/DAP-MND-001.md`
- `SDP/02--Study/DAP-STU-001.md`
- `SDP/03--Requirements/DAP-REQ-001.md`
- `SDP/04--Architecture/DAP-ARCH-001.md`
- `SDP/05--Design/DAP-DES-001.md`
- `protocol/EMU_DEBUG_API_REQUIREMENTS.md`
- this sprint contract and traceability files

## Done by documentation worker

- Initial 2026-08-31 pass inspected then-default `master`/`5dc6812` and
  then-open PR #1/`62f4012` (historical evidence).
- Cited authoritative DAP, VS Code debugger, scoped Node SDK, and VSIX sources.
- Authored mandate through design and the minimum cross-repository contract.
- Defined a narrow candidate Slice 1 and explicit non-scope/acceptance.
- Updated planned workflow documents and worker traceability.
- Corrected `CR-001`–`CR-007` at documentation level without marking them
  resolved: exact DAP stop/address/step semantics, honest backward
  disassembly, minimum emulator surface, child/adapter state, and JSON fences.
- Normalized traceability vocabulary and retained planned product
  `IT-001-002` / `SL-001-002-001`.
- Refreshed live emulator default to `a20815e` after PR #1/Stage 0 merged as
  `0cf6792` and PR #3/Stage 1 merged as `a20815e`; retained the original
  `5dc6812`/`62f4012` observations as explicitly dated history.
- Reclassified merged core seams separately from missing headless protocol
  work and added satisfied/partial/missing status to `EMU-BLK-001`–`010`.

## Not done

- Independent review of the merged-emulator refresh or final verification
  report.
- Final Master reconciliation or readiness decision.
- Any production or test implementation.
- Any emulator-repository change, Issue, or PR.
- Product `SPR-001` start.

## Exact next step

A separate reviewer validates `SL-001-001-002` and records
`RVW-001-001-002` without treating this worker's claims as acceptance. If
accepted, a fresh verifier reruns the complete evidence plan as
`VER-001-001-002` against PR #2.

## Worker checks completed

Worker-level mechanical checks passed for diff whitespace, all seven JSON
fences, both YAML files, all 26 ledger records, 74 unique trace IDs, 150 unique
relations with valid endpoints, status vocabulary/one-active-iteration rules,
and the documentation-only allowlist. Local immutable-object inspection and the
already completed live GitHub check agree on current emulator `master` at
`a20815e`, Stage-0 merge `0cf6792`, and the PR #1/PR #3 merge state. Exact
commands/results were reported to the Master. These author checks do not
substitute for `RVW-001-001-002` or `VER-001-001-002`.

## Traceability IDs in play

`M-001`, `S-001`, `UC-001`, `R-001`–`R-031`, `A-001`–`A-008`,
`D-001`–`D-010`, `SPR-001`, `IT-001-000`, `SL-001-000-001`,
`RVW-001-000-001`, `CR-001`–`CR-007`, `IT-001-001`,
`SL-001-001-001`, `RVW-001-001-001`, `VER-001-001-001`, `CR-008`,
`SL-001-001-002`, `RVW-001-001-002`, `VER-001-001-002`, `IT-001-002`,
and `SL-001-002-001`.

## Traceability update state

- CurrentIndex: one active iteration; baseline-refresh slice `in_review`;
  `CR-008` `in_progress`; review/verification and candidate product
  iteration/slice remain planned.
- Relations: findings link to the corrective slice and every design decision
  links to the planned product slice; re-review and verification remain linked.
- Ledger: append-only baseline-refresh `slice_completed` event recorded after
  `LE-000025`; review and verification events remain pending their independent
  passes.

## Open Steering decisions

These do not change the frozen minimum behavior but must be approved before
implementation:

1. Assign/accept ownership, branch/release, and versioning for every remaining
   partial/missing part of `EMU-BLK-001`–`EMU-BLK-010` in `emuSA80535-N`;
   `EMU-BLK-004` is already satisfied by the current core.
2. Choose extension publisher/identifier, initial semantic version, and
   Marketplace ownership.
3. Freeze extension package-root layout and supported `engines.vscode`/Node
   floor after the required disassembly-UI compatibility test.
4. Approve Linux/Windows support matrix and CI runners.

The breakpoint minimum is not open: protocol negotiates
`maxBreakpoints >= 1`, and Slice-1 acceptance uses exactly one. Emulator
bundling, attach, source mapping, writes, watchpoints, logical stacks, and
Marketplace publication remain later scoped decisions.

## Risks and ambiguities

- The current emulator default includes useful core seams but still lacks the
  entire versioned headless process protocol and lifecycle evidence.
- Merged one-breakpoint, decoder, run/step, trace, and IRQ primitives must not
  be mistaken for atomic debugger snapshot, replacement-table, wire, scheduler,
  or process contracts.
- DAP is published at 1.71.0 while observed scoped Node packages are 1.68.0;
  versions/schema and VS Code engine behavior must be pinned/rechecked at
  implementation start.
- Minimal disassembly must be exercised in real VS Code, not only a DAP client,
  because the instruction-breakpoint UI depends on it.

## Worktree/agent notes

The branch is `codex/dap-sdp-foundation`. The documentation worker edited only
documentation/metadata and created no review/verification report. No worker,
reviewer, or verifier should be intentionally left idle after its bounded pass;
the Master owns agent lifecycle and PR operations.
