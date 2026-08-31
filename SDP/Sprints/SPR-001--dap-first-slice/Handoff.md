# Handoff — SPR-001 readiness

## Current objective

Obtain a separate re-review of the corrective documentation, then verify the
Issue #1 package before the Master decides whether to record
`READY-FOR-SLICE-1` and open the documentation-only PR. Do not start product
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

- Inspected emulator default `master`/`5dc6812` and open PR #1/`62f4012`.
- Cited authoritative DAP, VS Code debugger, scoped Node SDK, and VSIX sources.
- Authored mandate through design and the minimum cross-repository contract.
- Defined a narrow candidate Slice 1 and explicit non-scope/acceptance.
- Updated planned workflow documents and worker traceability.
- Corrected `CR-001`–`CR-007` at documentation level without marking them
  resolved: exact DAP stop/address/step semantics, honest backward
  disassembly, minimum emulator surface, child/adapter state, and JSON fences.
- Normalized traceability vocabulary and retained planned product
  `IT-001-002` / `SL-001-002-001`.

## Not done

- Corrective re-review or independent verification report.
- Master reconciliation, commit, push, PR, or readiness decision.
- Any production or test implementation.
- Any emulator-repository change, Issue, or PR.
- Product `SPR-001` start.

## Exact next step

A separate fresh reviewer executes `RVW-001-001-001` against the corrected
contracts and appends its disposition to reviewer-owned
`SDP/CodeReview/DAP-SDP-REV-001.md`. The reviewer, not this worker, decides
whether `CR-001`–`CR-007` are resolved. Verification runs only after an accepted
re-review.

## Worker checks completed

Worker-level mechanical checks passed for diff whitespace, every JSON fence,
both YAML files, every ledger line, relation endpoints/duplicate IDs/status
vocabulary, and the documentation-only allowlist. Exact commands/results were
reported to the Master. These do not substitute for `VER-001-001-001`.

## Traceability IDs in play

`M-001`, `S-001`, `UC-001`, `R-001`–`R-031`, `A-001`–`A-008`,
`D-001`–`D-010`, `SPR-001`, `IT-001-000`, `SL-001-000-001`,
`RVW-001-000-001`, `CR-001`–`CR-007`, `IT-001-001`,
`SL-001-001-001`, `RVW-001-001-001`, `VER-001-001-001`,
`IT-001-002`, and `SL-001-002-001`.

## Traceability update state

- CurrentIndex: one active iteration; corrective slice `in_review`; findings
  `in_progress`; candidate product iteration/slice remain planned.
- Relations: findings link to the corrective slice and every design decision
  links to the planned product slice; re-review and verification remain linked.
- Ledger: append-only corrective `slice_completed` event recorded; re-review
  and verification events remain pending their independent passes.

## Open Steering decisions

These do not change the frozen minimum behavior but must be approved before
implementation:

1. Assign/accept ownership, branch/release, and versioning for
   `EMU-BLK-001`–`EMU-BLK-010` in `emuSA80535-N`.
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

- The current emulator default lacks the entire merged headless protocol.
- Candidate PR #1 is valuable feasibility evidence but cannot satisfy a
  default-branch dependency while open.
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
