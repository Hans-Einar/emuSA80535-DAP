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

Independent `RVW-001-002-001` returned changes-required. `CR-009` blocks the
foundation because terminated state can be reopened by an in-flight launch;
`CR-010` requires strict raw-DAP runtime types; and `CR-011` corrects README
truthfulness. These findings are not resolved by passing build/package checks.

Corrective commit `a01c48c917186a98152d849565660081ff11746e` addresses the
three findings and adds adversarial lifecycle/type tests; worker checks pass
18/18. The correction remains in review and is not yet accepted evidence.

Fresh `RVW-001-002-004` accepted that exact commit and resolved `CR-009`–
`CR-011` with no new finding. Worker A foundation is accepted for forward
integration; this does not accept Worker B/C behavior or the full slice.

## Worker B — protocol client and fake (awaiting independent review)

Commit `33a83a5a62b3be827fac6ea052517cb588d899e2` implements the frozen
client/process/fake/fixture boundary and entry launch orchestration. Worker
checks pass 41/41 plus 23/23 contract tests. This is not yet accepted review
evidence and does not satisfy the real-emulator gate.

Independent `RVW-001-002-002` returned changes-required. `CR-012` requires
strict command-specific response semantics, `CR-013` requires a truly
contract-faithful bounded fake, and `CR-014` fixes an impossible Windows
shell-free batch launch path. Worker C cannot safely start on the current
client contract.

Corrective commit `6000ec8235ee8f568db80c4d6fe02f84d1982045` addresses
`CR-012`–`CR-014`; worker evidence passes 60/60 and 42/42 contract tests.
Independent re-review is still required before Worker C.

`RVW-001-002-005` resolved `CR-013` and `CR-014`, but returned
changes-required for `CR-015` (negative decode traversal geometry) and
`CR-016` (raw negotiated breakpoint limit versus private work cap). `CR-012`
therefore remains partial.

Second corrective commit `cd98df7a06e8f93386ac2a9c990d0e00c1f34fb4`
addresses the residual traversal/limit findings with 63/63 and 45/45 worker
tests. Fresh `RVW-001-002-006` is active; no acceptance is inferred yet.

Fresh `RVW-001-002-006` accepted exact commit `cd98df7a…` and resolved
`CR-012`, `CR-015`, and `CR-016` without a new finding. Worker B's protocol,
fake, fixture, and process boundary are accepted for Worker C integration.
Full Slice-1 acceptance and real-emulator evidence remain open.

## Worker C — DAP debug behavior (awaiting independent review)

Commit `574dd8d0b44c2970656fe7e9c0c41dc5164896cb` completes the planned fake-backed
DAP surface and maps AC-001–AC-009 in tests. Worker evidence passes 86/86,
45/45 contract, and 23/23 focused AC tests plus package/install/safety checks.
Fresh `RVW-001-002-003` is required; AC-010/011, real UI, and real-emulator
verification remain open.

Independent `RVW-001-002-003` returned changes-required: `CR-017` forbids
silent epoch mutation after rejected step, `CR-018` fixes false sequential
predecessor evidence in the contract fake, and `CR-019` adds strict raw
`stackTrace` pagination validation. AC-003 is blocked until correction.

Corrective commit `8728a965cd04bc43816cd8401638869b2615f861` addresses
`CR-017`–`CR-019` with 89/89, 45/45, and 26/26 worker tests. The correction
remains unaccepted until fresh `RVW-001-002-007`.

Fresh `RVW-001-002-007` accepted exact commit `8728a965…`, resolved
`CR-017`–`CR-019`, and raised no new finding. Fake-backed implementation and
AC-001–AC-009 are accepted for final verification. The final evidence pass,
AC-010/011, real UI, and real emulator remain mandatory.

`VER-001-002-001` verified exact integrated HEAD `fdb1ccd…` and returned
`CHANGES_REQUIRED_AND_EXTERNALLY_BLOCKED`. AC-010 has a local CI gap (`CR-020`):
no Windows lane and no install/launch-smoke on both lanes. The real runtime gate
also remains blocked at emulator commit `c0cd6f26…`; no READY claim is made.

CR-020 corrective commit `2ecbec37e711c80c13b5e622ebe5f65d1f5eebc5`
adds dual-platform package/install/fake-launch smoke. Local Windows floor-smoke
passes; fresh review and actual Linux/Windows Actions evidence remain required.

Fresh `RVW-001-002-008` accepted the CR-020 implementation for remote
verification with no new finding. `CR-020` remains open until both Actions jobs
pass exact integrated HEAD; the real runtime gate is unchanged.

On remote HEAD `3b0e482…`, both Ubuntu jobs and Windows push passed, but Windows
PR failed because an AC-006 test reused a 50 ms global command timeout intended
for `run` during launch. `CR-021` requires deterministic timing separation;
rerunning for a lucky green result is not accepted.

Corrective test commit `1e104a18a365b5ad7666e86faad4b8fa00f14715`
replaces the flakiness with a deterministic deferred timeout and passes 100/100
Windows process runs. Fresh review and exact-head Actions rerun remain required.

Fresh `RVW-001-002-009` accepted the deterministic test correction with no new
finding. Exact-head four-job Actions re-verification is the remaining CR-020/021
closure gate before `VER-001-002-002` can disposition AC-010.

`VER-001-002-002` passed all four exact Ubuntu/Windows package/install/fake
entry-smoke jobs and resolved `CR-020`/`CR-021`. The repository-correctable
Slice-1 work is implemented, independently reviewed, and verified. Final
acceptance remains externally blocked: emulator default `c0cd6f26…` has no
compatible real `emu-debug` 1.0 runtime, so real F5/disassembly/safety gates and
AC-001/003/004/010/011 remain BLOCKED. Disposition is NOT_READY.

The later documentation-only checkpoint rerun exposed `CR-022`: the repeated
yield/pause test still depended on a 30 ms sleep and real-child scheduling. It
will be made deterministic before final handoff; product behavior and the
already verified four-job `3bb4264…` evidence are unchanged.

Corrective test commit `b4a48ddd52f4b2083c5f3bf6ecc19a16ae95ce1e`
replaces repeated-yield wall-clock timing with explicit queued promises and
passes 100/100 Windows processes. Fresh review and Actions rerun remain.

Fresh `RVW-001-002-010` accepted the correction after 120/120 processes and
full smoke. Only exact-head four-job Actions success remains before CR-022
closure and restoration of the external-only NOT_READY checkpoint.
