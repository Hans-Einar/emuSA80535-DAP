# Handoff — SPR-001 readiness

## Current objective

`IT-001-002 / SL-001-002-001` is independently reviewed and verified READY on
branch `codex/dap-first-slice`. Final real-runtime verification passed against
current emulator master `d9f80eba…` (runtime merge `1a6aa397…`) without changing
`emu-debug` 1.0.

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

## Done by Slice 1

- Implemented and reviewed extension, external DAP adapter, strict protocol
  client, contract fake, fixture, debug behavior, lifecycle, VSIX, and
  dual-platform installed-package CI smoke on DAP product HEAD `36639b48…`.
- Resolved every implementation/review finding `CR-009`–`CR-022` through fresh
  worker/reviewer cycles and exact-head remote verification.
- Independently passed emulator Windows GCC/Clang and Linux GCC/sanitizer
  regression/facade/process suites at current default `d9f80eba…`.
- Independently passed real Windows/Linux DAP contract/equivalence and installed
  VS Code F5/disassembly/register/breakpoint/step/continue/pause/cleanup smoke.
- Closed AC-001–AC-011 and EMU-BLK-001–010 with `VER-001-002-003`; Slice 1 is
  READY and the frozen protocol remains unchanged.

## Not done

- Any emulator-repository change, Issue, or PR.
- Merge of DAP implementation PR #4; merge remains a separate Steering action.
- Any next-slice scope beyond Issue #3.

## Exact next step

Steering reviews ready PR #4 and decides merge separately; this Master must not
merge it. Plan the next DAP slice only under a new explicit issue/slice contract.

## Verification completed

`VER-001-001-002` passed the full Issue #1 evidence plan: exact source/live
baseline, all substantive deliverables, DAP semantics, diff whitespace and
documentation-only allowlist, JSON/YAML/NDJSON parsing, unique trace IDs and
relations, end-to-end relation chains, internal and bounded external links,
static Mermaid structure, P1000 neutrality, README status, and PR #2 state.
The report records the bounded npmjs automation response and lack of a local
Mermaid renderer as non-blocking limitations.

At the prior blocked Issue #3 checkpoint, `VER-001-002-002` revalidated
`emuSA80535-N/master` at
`c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`. No real Slice-1 integration
evidence exists because that tree has no compatible server.

All four exact Ubuntu/Windows push/PR jobs on `3bb4264…` passed build/test,
contract, fixture, package policy, isolated VSIX floor install, packaged fake
entry-stop, clean disconnect, exactly-one termination, and zero-orphan checks.

Final `VER-001-002-003` passed the corresponding real-runtime contract and
installed-package F5/disassembly/debug behavior on Windows and Linux using
current master `d9f80eba…` (runtime merge `1a6aa397…`). AC-001–AC-011 and
EMU-BLK-001–010 all pass.

## Traceability IDs in play

`M-001`, `S-001`, `UC-001`, `R-001`–`R-031`, `A-001`–`A-008`,
`D-001`–`D-010`, `SPR-001`, `IT-001-000`, `SL-001-000-001`,
`RVW-001-000-001`, `CR-001`–`CR-007`, `IT-001-001`,
`SL-001-001-001`, `RVW-001-001-001`, `VER-001-001-001`, `CR-008`,
`SL-001-001-002`, `RVW-001-001-002`, `VER-001-001-002`, `IT-001-002`,
and `SL-001-002-001`, `RVW-001-002-001`–`RVW-001-002-010`,
`CR-009`–`CR-022`, `VER-001-002-001`, `VER-001-002-002`, and
`VER-001-002-003`.

## Traceability update state

- CurrentIndex: `SPR-001` and `SL-001-002-001` verified/current;
  `IT-001-002` closed/current; final real verification verified/current; all
  findings resolved.
- Relations: implementation, every review/finding, and all verification passes
  are linked to the slice and requirements.
- Ledger: complete through real-runtime PASS, READY, and iteration closure.

## Steering decisions and remaining gate

Issue #3 resolved the implementation-time choices: repository-root package
layout with `extension/` and `adapter/` boundaries, Node.js/TypeScript, version
`0.1.0`, local identifier `emuSA80535-dap` subject to manifest normalization,
Linux CI, and mandatory Windows acceptance. Marketplace publication remains
out of scope. Accepted emulator Issue #6 / PR #9 and DAP
`VER-001-002-003` close every `EMU-BLK-001`–`EMU-BLK-010`.

VS Code floor 1.95.0 and Node CI 22.20.0 are pinned and proven for package
install/fake-entry smoke and real Windows/Linux F5/disassembly acceptance.

The breakpoint minimum is not open: protocol negotiates
`maxBreakpoints >= 1`, and Slice-1 acceptance uses exactly one. Emulator
bundling, attach, source mapping, writes, watchpoints, logical stacks, and
Marketplace publication remain later scoped decisions.

## Risks and ambiguities

- Future emulator changes must preserve protocol 1.0 compatibility or trigger a
  new reviewed negotiation design; no incompatibility exists at current
  `d9f80eba…`.
- Scoped Node DAP packages remain pinned at 1.68.0; any future upgrade requires
  a new schema and real VS Code compatibility pass.
- Minimal disassembly and instruction-breakpoint round trip are verified in real
  VS Code; later richer disassembly remains separately scoped.

## Worktree/agent notes

The branch is `codex/dap-first-slice`, based on PR #2 branch HEAD `ede8226`.
PR #2 still targets `main`; the Slice-1 implementation PR must also target
`main` so its accepted SDP ancestry is visible, and it must not be merged.
No worker/reviewer/verifier agent remains open.
