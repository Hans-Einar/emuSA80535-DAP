# Handoff — SPR-001 readiness

## Current objective

Repository-correctable work for `IT-001-002 / SL-001-002-001` is implemented,
independently reviewed, and verified on branch `codex/dap-first-slice`. Final
disposition is `NOT_READY` only because the accepted real-emulator contract and
VS Code F5/disassembly/safety gates cannot run on current emulator default.

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

- Real-emulator contract integration and real VS Code F5/disassembly/safety
  acceptance.
- Any emulator-repository change, Issue, or PR.
- Merge disposition for implementation PR #4; it remains draft and unmerged by
  Issue #3 authority.

## Exact next step

A fresh reviewer performs `RVW-001-002-010` against exact corrective commit
`b4a48ddd52f4b2083c5f3bf6ecc19a16ae95ce1e`, verifies explicit run #1–#3
control, pause/event ordering, unique final-boundary promotion, no run #4,
100-run stability, and unchanged real-client/contract coverage. Then Master
pushes and requires all four exact-head Actions jobs.

## Verification completed

`VER-001-001-002` passed the full Issue #1 evidence plan: exact source/live
baseline, all substantive deliverables, DAP semantics, diff whitespace and
documentation-only allowlist, JSON/YAML/NDJSON parsing, unique trace IDs and
relations, end-to-end relation chains, internal and bounded external links,
static Mermaid structure, P1000 neutrality, README status, and PR #2 state.
The report records the bounded npmjs automation response and lack of a local
Mermaid renderer as non-blocking limitations.

For Issue #3, final `VER-001-002-002` revalidated `emuSA80535-N/master` at
`c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`. No real Slice-1 integration
evidence exists because that tree has no compatible server.

All four exact Ubuntu/Windows push/PR jobs on `3bb4264…` passed build/test,
contract, fixture, package policy, isolated VSIX floor install, packaged fake
entry-stop, clean disconnect, exactly-one termination, and zero-orphan checks.

## Traceability IDs in play

`M-001`, `S-001`, `UC-001`, `R-001`–`R-031`, `A-001`–`A-008`,
`D-001`–`D-010`, `SPR-001`, `IT-001-000`, `SL-001-000-001`,
`RVW-001-000-001`, `CR-001`–`CR-007`, `IT-001-001`,
`SL-001-001-001`, `RVW-001-001-001`, `VER-001-001-001`, `CR-008`,
`SL-001-001-002`, `RVW-001-001-002`, `VER-001-001-002`, `IT-001-002`,
and `SL-001-002-001`, `RVW-001-002-001`–`RVW-001-002-009`,
`CR-009`–`CR-021`, `VER-001-002-001`, and `VER-001-002-002`.

## Traceability update state

- CurrentIndex: `SPR-001`/`IT-001-002` remain active for the external gate;
  `SL-001-002-001` is implemented/current; reviews are closed; both final
  verifications are blocked/current; all repo-correctable findings are resolved.
- Relations: implementation, every review/finding, and both verification passes
  are linked to the slice and requirements.
- Ledger: complete through corrective re-verification and the NOT_READY
  external-blocker checkpoint.

## Steering decisions and remaining gate

Issue #3 resolved the implementation-time choices: repository-root package
layout with `extension/` and `adapter/` boundaries, Node.js/TypeScript, version
`0.1.0`, local identifier `emuSA80535-dap` subject to manifest normalization,
Linux CI, and mandatory Windows acceptance. Marketplace publication remains
out of scope. The remaining external gate is:

1. Assign/accept ownership, branch/release, and versioning for every remaining
   partial/missing part of `EMU-BLK-001`–`EMU-BLK-010` in `emuSA80535-N`;
   `EMU-BLK-004` is already satisfied by the current core.

VS Code floor 1.95.0 and Node CI 22.20.0 are pinned and proven for package
install/fake-entry smoke. Real disassembly/F5 acceptance remains blocked.

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
A CR-022 worker/reviewer cycle is intentionally active; no other agent remains
open.
