# Implementation notes — SPR-001

## Product implementation status

**Active under Issue #3.** Master activation and traceability are recorded;
product implementation is delegated through Worker A/B/C and has no verified
product result yet. Fake-backed work is authorized, but READY remains blocked
until the real-emulator gate passes.

## Documentation readiness worker pass

`SL-001-000-001` authored the target mandate, evidence study, requirements,
architecture, design, cross-repository protocol contract, and candidate sprint
contract. It distinguished emulator default `5dc6812` from unmerged
`62f4012`, selected the Node/TypeScript external adapter and headless child
transport, and made every minimum emulator prerequisite explicit. That
`5dc6812`/`62f4012` distinction records the original 2026-08-31 evidence cut;
it is historical after the later merges.

This records documentation work only. Independent review
`RVW-001-000-001`, verification `VER-001-000-001`, Master integration, and the
documentation-only PR remain separate gates. Only verified outcomes from those
passes may change readiness state.

## Corrective documentation pass

`SL-001-001-001` corrected the seven blocking documentation findings from
`RVW-001-000-001`. The changed contracts now distinguish DAP and emulator stop
reasons, define address/reference round trips and stepping requests, specify
honest negative disassembly placeholders, remove raw CODE read from the minimum
emulator contract, and define adapter-versus-child execution state and snapshot
validity. The malformed two-record JSON example was split into two valid JSON
documents.

Worker mechanical checks cover JSON fences, YAML, every NDJSON ledger record,
relation endpoints/duplicates, status vocabulary, documentation-only paths, and
`git diff --check`. These are authoring checks, not independent acceptance.
At that worker handoff, `CR-001`–`CR-007` remained `in_progress` pending
`RVW-001-001-001`, and `SL-001-001-001` was `in_review`. The independent
2026-08-31 re-review later resolved all seven; this paragraph preserves the
worker-stage history. Product `IT-001-002` / `SL-001-002-001` remains planned
and unstarted.

## Merged-emulator baseline refresh

`SL-001-001-002` refreshed current factual claims after emulator PR #1 merged
as `0cf6792` and Stage-1 PR #3 moved default `master` to `a20815e`. The current
core seams now include deterministic variant/reset/raw loading, bounded
run/run-until-PC, exact step, typed stops, one pre-execution breakpoint,
`decode()`, immutable instruction/SFR/MOVX trace, and Siemens IRQ state plus a
record-only request/accept/release observer.

The refresh does not claim that those seams form the accepted debug service.
The buildable no-curses process, NDJSON/version handshake, atomic debugger
snapshot, `decodeCode` wire contract, replacement breakpoint table, bounded
child scheduling/pause integration, and process lifecycle tests remain explicit
gaps. IRQ frames/state stay near-term; candidate Slice 1 is unchanged. The
independent refresh review resolved `CR-008`, and `VER-001-001-002` later
verified `SL-001-001-002` against the unchanged live baseline.

## Documentation readiness verification

`VER-001-001-002` independently verified exact reviewed content commit
`e210c4bbfb8e8690f0d4b82f6cc4be2c3853950f` and open documentation-only PR #2.
Required documents, live emulator evidence, the blocker matrix, corrected DAP
semantics, generic schema, JSON/YAML/NDJSON examples, traceability chains,
links, static Mermaid structure, README status, and the no-code diff all passed.
The result is `READY-FOR-SLICE-1`; `IT-001-001` is closed and
`SL-001-001-002` is verified.

This is verified documentation work only. Product `SPR-001`, `IT-001-002`, and
`SL-001-002-001` remain planned and unstarted, and no product evidence is
claimed.

## Future implementation evidence

When Steering later starts the product slice, append verified build/test/VSIX,
fake-emulator, real-emulator-contract, Linux/Windows, and VS Code disassembly UI
evidence here. Do not infer completion from file presence or capability flags.

## Worker A — foundation (awaiting independent review)

Commit `a30129bfcbd17c8fd0e57696700ff9f2440bb639` implements the package,
extension contribution, external DAP process skeleton, pinned build/test/lint
tooling, CI foundation, and VSIX packaging boundary. Worker checks passed
`npm ci`, lint, 6/6 tests, package/content policy, and a local Windows VS Code
1.134.0 install. This is worker evidence only; `RVW-001-002-001` is active and
the complete slice remains unverified.
