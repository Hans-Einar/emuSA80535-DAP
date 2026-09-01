# Handoff — SPR-001 readiness

## Current objective

Issue #3 has activated `IT-001-002 / SL-001-002-001` on branch
`codex/dap-first-slice`. Implement the complete narrow Slice 1 through separate
Worker A/B/C and independent reviewer passes. Preserve all completed fake-backed
work if the real runtime is unavailable, but report `NOT_READY` until the
real-emulator contract and VS Code smoke gates pass.

## Authoritative source documents

- [GitHub Issue #3](https://github.com/Hans-Einar/emuSA80535-DAP/issues/3)
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

- Worker B/C product implementation and complete Slice-1 integration.
- Any emulator-repository change, Issue, or PR.
- Product implementation/review/verification for `IT-001-002`.
- Steering approval of the decisions below and merge disposition for PR #2.

## Exact next step

A fresh reviewer performs `RVW-001-002-008` against exact corrective commit
`2ecbec37e711c80c13b5e622ebe5f65d1f5eebc5`, challenging both workflow lanes,
floor download/install, installed-artifact launch smoke, test-only launcher
isolation, timeouts/cleanup, archive policy, and truthful real-gate wording.
After acceptance Master pushes and requires both real Actions jobs before
`VER-001-002-002`.

## Verification completed

`VER-001-001-002` passed the full Issue #1 evidence plan: exact source/live
baseline, all substantive deliverables, DAP semantics, diff whitespace and
documentation-only allowlist, JSON/YAML/NDJSON parsing, unique trace IDs and
relations, end-to-end relation chains, internal and bounded external links,
static Mermaid structure, P1000 neutrality, README status, and PR #2 state.
The report records the bounded npmjs automation response and lack of a local
Mermaid renderer as non-blocking limitations.

For Issue #3, Master revalidated `emuSA80535-N/master` at
`c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`. No real Slice-1 integration
evidence exists yet.

## Traceability IDs in play

`M-001`, `S-001`, `UC-001`, `R-001`–`R-031`, `A-001`–`A-008`,
`D-001`–`D-010`, `SPR-001`, `IT-001-000`, `SL-001-000-001`,
`RVW-001-000-001`, `CR-001`–`CR-007`, `IT-001-001`,
`SL-001-001-001`, `RVW-001-001-001`, `VER-001-001-001`, `CR-008`,
`SL-001-001-002`, `RVW-001-001-002`, `VER-001-001-002`, `IT-001-002`,
and `SL-001-002-001`, `RVW-001-002-001`–`RVW-001-002-003`, and
`VER-001-002-001`.

## Traceability update state

- CurrentIndex: `SPR-001`/`IT-001-002` active and `SL-001-002-001` in progress;
  three reviews and final verification are planned.
- Relations: the active product slice is linked to all three reviews and final
  verification in addition to its requirement/design chain.
- Ledger: Issue #3 activation and `slice_started` are appended after the
  historical documentation events.

## Steering decisions and remaining gate

Issue #3 resolved the implementation-time choices: repository-root package
layout with `extension/` and `adapter/` boundaries, Node.js/TypeScript, version
`0.1.0`, local identifier `emuSA80535-dap` subject to manifest normalization,
Linux CI, and mandatory Windows acceptance. Marketplace publication remains
out of scope. The remaining external gate is:

1. Assign/accept ownership, branch/release, and versioning for every remaining
   partial/missing part of `EMU-BLK-001`–`EMU-BLK-010` in `emuSA80535-N`;
   `EMU-BLK-004` is already satisfied by the current core.

The exact supported VS Code/Node floor must be pinned and proven during package
and disassembly-UI acceptance, not guessed from the earlier study.

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

The branch is `codex/dap-first-slice`, based on PR #2 branch HEAD `ede8226`.
PR #2 still targets `main`; the Slice-1 implementation PR must also target
`main` so its accepted SDP ancestry is visible, and it must not be merged.
No worker/reviewer agent is intentionally left idle.
