# Handoff — SPR-001 readiness

## Current objective

The Issue #1 documentation gate is `READY-FOR-SLICE-1` after independent
`RVW-001-001-002` and `VER-001-001-002`. Documentation-only PR #2 remains open.
Do not start product Slice 1 without Steering decisions and explicit Master
activation.

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
- Obtained independent baseline-refresh review and verification of exact
  reviewed commit `e210c4bbfb8e8690f0d4b82f6cc4be2c3853950f`.
- Recorded `READY-FOR-SLICE-1`, closed `IT-001-001`, and kept the product
  sprint/iteration/slice planned and unstarted.

## Not done

- Any production or test implementation.
- Any emulator-repository change, Issue, or PR.
- Product `SPR-001` start.
- Steering approval of the decisions below and merge disposition for PR #2.

## Exact next step

Steering reviews PR #2 and the open decisions below. If a later implementation
is authorized, the Master must first revalidate the emulator release/commit,
resolve every remaining partial/missing blocker, and explicitly activate
`IT-001-002` / `SL-001-002-001` under a fresh worker/reviewer/verifier cycle.

## Verification completed

`VER-001-001-002` passed the full Issue #1 evidence plan: exact source/live
baseline, all substantive deliverables, DAP semantics, diff whitespace and
documentation-only allowlist, JSON/YAML/NDJSON parsing, unique trace IDs and
relations, end-to-end relation chains, internal and bounded external links,
static Mermaid structure, P1000 neutrality, README status, and PR #2 state.
The report records the bounded npmjs automation response and lack of a local
Mermaid renderer as non-blocking limitations.

## Traceability IDs in play

`M-001`, `S-001`, `UC-001`, `R-001`–`R-031`, `A-001`–`A-008`,
`D-001`–`D-010`, `SPR-001`, `IT-001-000`, `SL-001-000-001`,
`RVW-001-000-001`, `CR-001`–`CR-007`, `IT-001-001`,
`SL-001-001-001`, `RVW-001-001-001`, `VER-001-001-001`, `CR-008`,
`SL-001-001-002`, `RVW-001-001-002`, `VER-001-001-002`, `IT-001-002`,
and `SL-001-002-001`.

## Traceability update state

- CurrentIndex: `IT-001-001` closed; `SL-001-001-002` and
  `VER-001-001-002` verified/current; prior blocked verifications retained;
  product sprint/iteration/slice planned.
- Relations: findings, corrective slices, reviews, verification, readiness,
  iteration closure, and planned product chain are linked.
- Ledger: verification, readiness, and iteration-closure events appended after
  the historical review events.

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

The branch is `codex/dap-sdp-foundation`; PR #2 targets `main`. All Issue #1
changes are documentation/traceability only. No product worker should be
started from this handoff; the Master owns later activation and PR operations.
