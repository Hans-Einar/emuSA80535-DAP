# DAP-SLICE2-VER-001 — Independent Phase-A verification

**Verification ID:** `VER-002-000-001`

**Steering/Master authority:**
[`Hans-Einar/emuSA80535-DAP` Issue #6](https://github.com/Hans-Einar/emuSA80535-DAP/issues/6)

**Branch:** `steering/debug-points-rebaseline`

**Documentation pull request:**
[#5](https://github.com/Hans-Einar/emuSA80535-DAP/pull/5)

**Initial PR #5 baseline:**
`6fc619845f159f4ff0fb1b2caa608c9073b58de4`

**Corrective documentation commit:**
`1e83b25bc3c6b6964d1915bc1b7626524f04d31f`

**Accepted review commits:**
`9bf20caea217259b73ed9addf71f2feb1642ae0f` and
`c8a387df6a99279816d5856f1c2c9170128fe672`

**Exact integrated documentation HEAD verified:**
`f20e10f348a5923f3731383f30055839279400da`

**Accepted Slice-1 authority base:**
`b1b1c2d55d8379fff74110372c8095e3095920cf`

**Verification time:** 2026-09-02T11:33:53Z

**Recorded review disposition:** **ACCEPTED** — corrective review
`RVW-002-000-002` accepted `CR-023` through `CR-027` with no new finding.

**Verification disposition:** **PHASE_A_FAIL**

**External dependency disposition:** **WAITING_FOR_EMULATOR_CONTRACT**

**Product readiness:** **NOT READY / NOT ACTIVATED**

## Scope and independence

This is the fresh independent verification required by Issue #6 for
documentation-only `IT-002-000 / SL-002-000-001`. The verifier read Issue #6,
the complete Phase-A study, requirements, architecture, design, protocol
consumer requirements, sprint, iterations, implementation notes, handoff,
Steering record, both review passes, and the complete current traceability
surface. The verifier independently checked the fourteen required semantic
points against the official DAP 1.71.0 schema and current native VS Code
data-breakpoint path.

No adapter, extension, fake, test, fixture, script, package, emulator, sprint,
review, or traceability source was edited. This verification report is the
only verifier-authored path. The verifier did not push, merge, close, retarget,
or otherwise mutate PR #5 or either repository's issues and pull requests.

## Blocking Phase-A defect

The integrated handoff is not internally or traceably current.

`SDP/Sprints/SPR-002--debug-points-trace-integration/Handoff.md` lines 12–16,
under the heading **Current state**, say that the corrective worker merely
submitted `CR-023`–`CR-027` for independent `RVW-002-000-002` and that the
findings remain open/in-progress until that re-review and verification.

That statement is false at exact integrated HEAD `f20e10f...`:

- `RVW-002-000-002` was already completed and accepted at
  `c8a387df6a99279816d5856f1c2c9170128fe672`;
- `ScrumIterations.md` lines 123–138 record the accepted corrective re-review;
- `CurrentIndex.yaml` marks `CR-023`–`CR-027` resolved/current and
  `RVW-002-000-002` closed/current;
- ledger event `LE-000088` records the accepted review and resolved findings;
  and
- the same `Handoff.md`, lines 44–47, instructs the next agent to verify the
  already accepted corrective documentation.

This is a current-handoff contradiction, not a historical narrative label.
It violates the Phase-A requirement that requirements, architecture, design,
protocol, sprint, handoff, review, and trace agree well enough for a fresh
agent to continue solely from the repository. Therefore the otherwise sound
Phase-A package cannot receive `PHASE_A_PASS` on `f20e10f...`.

Required correction is bounded: replace the stale current-state paragraph
with the accepted `RVW-002-000-002` / resolved-findings state while retaining
`VER-002-000-001` as the active/failed verification checkpoint. A fresh
independent review of that correction and a fresh verification on the new
exact integrated HEAD are required before PR #5 can be considered mergeable.
No product, fake, or provisional wire change is needed or authorized.

## Official DAP 1.71 semantic evidence

The normative reference was the official Microsoft Debug Adapter Protocol
1.71.0 schema at tag/commit
`51d95ea4e692b34c5d06601bbd1bebc1ff3fbdd4`:

- https://microsoft.github.io/debug-adapter-protocol/specification
- https://raw.githubusercontent.com/microsoft/debug-adapter-protocol/v1.71.0/debugAdapterProtocol.json

The schema independently confirms:

- `supportsDataBreakpoints` gates `dataBreakpointInfo` and
  `setDataBreakpoints`;
- `DataBreakpointInfoArguments.name` is required, and
  `variablesReference + name` is the native child-variable origin;
- a supplied `variablesReference` must come from the current suspended state;
- `bytes` and `asAddress` are client-usable only when
  `supportsDataBreakpointBytes` is true;
- the response requires a string-or-null `dataId` and a description, while
  `canPersist` specifically describes cross-session persistence;
- a breakpoint installed from a `dataId` may outlive that discovery identity;
- `setDataBreakpoints` replaces the complete DAP data-breakpoint set, an empty
  input clears it, and response elements correspond to request elements;
- each response `Breakpoint` requires `verified`, while `Breakpoint.id` and
  rejection `message` support installed identity and actionable failure;
- a hit uses `stopped.reason = "data breakpoint"`; and
- `hitBreakpointIds` contains integer `Breakpoint.id` values for all known
  triggering breakpoints.

Official VS Code source at
`c3a0ee2b9889e58a2640b16087e91ccbea8e2121` was also checked. Its Variables
view exposes Break on Value Change/Access/Read and retains the returned
variable `dataId` for `setDataBreakpoints`; the access actions map to `write`,
`readWrite`, and `read`. The accepted Slice-1 Registers scope is therefore a
real native origin and does not need an extension-only Add Watchpoint command.

### Exact register-origin evidence

Accepted Slice-1 product code exposes one current stop-epoch Registers
container with exact children `PC`, `A`, `B`, `PSW`, `SP`, `DPTR`, and
bank-selected `R0`–`R7`. Current emulator `master` file `emu8051.h`, blob
`150982fb9f1d24ab3507bf380cdaa4a0cb60a00b`, defines:

| DAP child | Emulator definition | Exact SFR target | Phase-A result |
|---|---|---|---|
| `A` | `REG_ACC = 0xE0 - 0x80` | `sfr:0xe0..0xe0`, 1 byte | watchable |
| `B` | `REG_B = 0xF0 - 0x80` | `sfr:0xf0..0xf0`, 1 byte | watchable |
| `PSW` | `REG_PSW = 0xD0 - 0x80` | `sfr:0xd0..0xd0`, 1 byte | watchable |
| `SP` | `REG_SP = 0x81 - 0x80` | `sfr:0x81..0x81`, 1 byte | watchable |

The corrected contract returns `read`, `write`, and `readWrite` for those four
exact, case-sensitive byte targets. `PC` is not an SFR data target, `DPTR` is
composite, and `R0`–`R7` are selected by PSW bank state; they and all other
well-formed aggregate/dynamic/unknown, expression/frame, and address/range
origins return success with `dataId: null`. Malformed arguments and
stale/foreign nonzero handles fail with a bounded actionable message. The
adapter does not infer an address from display text or a displayed value.

### Discovery, installation, correlation, and lifecycle

The corrected documents consistently separate:

1. the stop-epoch Registers `variablesReference`;
2. an opaque adapter discovery `dataId`, private to one session and
   target/configuration generation, with `canPersist: false`;
3. an installed positive integer DAP `Breakpoint.id`;
4. the emulator's public frontend correlation identity;
5. the exact accepted emulator configuration revision; and
6. later trace cursor/generation/sequence domains.

DAP's portable guarantee for a variable-derived `dataId` is the current
suspended state. The proposed same-session/same-target-generation acceptance
after resume/new-stop is explicitly a bounded stronger adapter-internal
guarantee, not a client persistence promise: the source Registers handle still
expires per stop epoch, `canPersist` remains false, and restart, process or
variant/configuration replacement, load, reset, disconnect, and a new session
invalidate discovery tokens conservatively. Trace clear does not enter this
identity domain. Token expiry alone never deletes or rewrites an installed
watch.

`setDataBreakpoints` resolves and prevalidates the complete input before any
mutation. Stale tokens, unsupported access/condition, duplicate/conflicting
entries, invalid targets, limit failures, or emulator rejection preserve the
previous installed set, DAP ids, public-correlation map, and exact revision.
The response remains one actionable `Breakpoint` per input in input order.
Successful unchanged normalized watches retain their DAP ids; changed/removed
watches retire ids without session-local reuse. Installed-configuration
changes on reset/load remain governed by the future accepted emulator result,
not by source-token invalidation.

## Issue #6 fourteen-point matrix

| # | Required semantic point | Verification result |
|---|---|---|
| 1 | Native `dataBreakpointInfo` / `setDataBreakpoints` mapping | **PASS** — correct capability gate, exact native Registers origin, nullable unsupported results, full-set replacement, ordered response, and packaged native path are required. |
| 2 | `dataId` lifetime/opacity and no private identity leakage | **PASS** — opaque session/generation token, `canPersist: false`, explicit portable-vs-internal lifetime distinction, no pointer/C-layout/private-emulator identity. |
| 3 | Safe-boundary stop and standard reason | **PASS, dependency-gated** — emulator completes the architectural operation and returns an atomic stopped snapshot; adapter maps public trigger correlation to `data breakpoint` and all available installed integer `hitBreakpointIds`. |
| 4 | RMW mapping and no adapter synthesis | **PASS, dependency-gated** — RMW remains one canonical architectural emulator event; final read/write inclusion is copied from the accepted wire contract, never decomposed in TypeScript. |
| 5 | Bounded deterministic conditions | **PASS, dependency-gated** — only an exact future accepted subset may compile; otherwise every non-empty condition/hit condition rejects atomically; no JavaScript live-state evaluation. |
| 6 | Tracepoints remain non-stopping | **PASS, planned Slice 2B** — trace, output, and availability/status notifications do not create `stopped` or a stop epoch. |
| 7 | Emulator-owned high-rate retention/paging | **PASS, planned Slice 2B** — bounded retained rings, non-destructive pull paging, explicit loss/overwrite/suppression, and no required per-record DAP firehose. |
| 8 | Custom requests/events only for non-native trace semantics | **PASS, planned Slice 2B** — sessions/routes/gates/status/page controls use extension surfaces; standard DAP is retained where it has exact semantics. |
| 9 | Coexistence and ownership domains | **PASS, dependency-gated** — Slice-1 CODE breakpoints, DAP-owned stopping watches, and rich trace/watch/session configuration are three separate replacement domains. |
| 10 | Reset/load/clear and stale identity handling | **PASS, dependency-gated** — discovery invalidation, installed configuration, revision, and trace lifecycle are explicitly separated; exact emulator preservation/invalidation remains gated. |
| 11 | JavaScript precision for wide values | **PASS, dependency-gated** — uint64 sequence/generation/revision/counter values remain strings or another exact accepted representation and are never rounded through `number`. |
| 12 | Optional-extension absence preserves Slice 1 | **PASS** — data-breakpoint advertisement and trace controls remain absent/unsupported while every accepted Slice-1 operation remains functional. |
| 13 | No P1000 semantic or physical I/O | **PASS** — generic targets only, explicit prohibitions, firmware presets only as user/workspace data, and cross-platform no-I/O acceptance. |
| 14 | Thin candidate product slice | **PASS** — stopping-watch-only Slice 2A is planned/gated; rich trace Slice 2B is separately planned, unactivated, and may be decomposed again. |

The semantic content accepted by `RVW-002-000-002` therefore remains sound.
The Phase-A failure comes solely from the false current handoff status, not
from a request to redesign this contract.

## Emulator semantic ownership and no provisional wire freeze

Requirements, architecture, design, protocol consumer requirements, and
sprint consistently leave these behaviors emulator-owned:

- canonical event production and source/derived/before/after sequencing;
- watch/point matching and deterministic point ordering;
- conditions, hit/skip counters, change-only behavior, and stop coalescing;
- safe-boundary stop timing and atomic stopped snapshots;
- routes, gates, interrupt policy, and trace-session state;
- bounded retention, paging, overwrite/loss/suppression, and status; and
- reset/load/clear effects on emulator configuration and revisions.

The adapter is limited to negotiated transport, DAP translation, installed-id
correlation, bounded output, low-volume notification, and extension UI. It
does not poll memory to synthesize matches or reconstruct missing canonical
events.

No new emulator capability, command, event, schema, condition subset, RMW
rule, or lifecycle result is frozen. The `emu.*` request and `emuTrace*` event
strings in `DAP-DES-002` are explicitly future DAP-extension API suggestions,
not emulator wire names. Existing `replaceCodeBreakpoints` and the canonical
control-flow event vocabulary are cited only as already accepted/base or
future semantic authorities. The frozen `emu-debug` 1.0 contract is unchanged.

## Slice shape and document consistency

The product plan is correctly decomposed:

- `IT-002-001 / SL-002-001-001` (Slice 2A) is planned, dependency-gated, and
  not activated. It contains optional negotiation plus the usable native
  stopping-watch vertical only: four exact SFR origins, discovery/installed
  identity, atomic replacement, exact access/RMW/condition behavior,
  safe-boundary stop/correlation, optional absence, Slice-1 regression, and
  Windows/Linux fake-real/package/native-VS-Code proof.
- `IT-002-002 / SL-002-002-001` (Slice 2B) is separately planned,
  dependency-gated, and not activated. It retains rich non-stopping trace
  points, sessions, routes, gates, interrupt policy, bounded paging,
  loss/status/output/notifications, and UI.

`R-027` remains historical target/deferred evidence in `DAP-REQ-001`.
`DAP-REQ-002` and machine trace now make `R-036` the stopping-watch phase
replacement and `R-040` the separately planned non-stopping trace replacement;
`S-002` remains a separate `contextualized_by` relation.

The study, requirements, architecture, design, protocol requirements, sprint,
Scrum iterations, reviews, and traceability agree on those semantics and
states. Only the handoff-current-state contradiction recorded above prevents
the requested complete document-consistency pass.

## Mechanical, traceability, and regression evidence

### Exact diff gates

All commands completed without diagnostics:

```text
git diff --check b1b1c2d55d8379fff74110372c8095e3095920cf f20e10f348a5923f3731383f30055839279400da
git diff --check 6fc619845f159f4ff0fb1b2caa608c9073b58de4 1e83b25bc3c6b6964d1915bc1b7626524f04d31f
git diff --check 1e83b25bc3c6b6964d1915bc1b7626524f04d31f f20e10f348a5923f3731383f30055839279400da
```

The complete accepted-Slice-1-to-integrated-Phase-A delta contains exactly 14
paths: eleven added Slice-2 documentation/protocol paths and the three modified
traceability files. It contains no adapter, extension, fake, test, fixture,
script, manifest, lockfile, package, CI, build, or emulator product change.

An explicit path diff over all Slice-1 product and authority surfaces was
empty. Of 67 files tracked at `b1b1c2d...`, only the three traceability files
changed; all 64 pre-existing non-trace blobs are byte-identical at
`f20e10f...`. Accepted Slice-1 product commit
`36639b48ddb2ffbafa14c00da794fe1734f7483b` remains an ancestor. PR #4 is
merged through merge commit `2e4c2dae2bb3637c4f3dbf803b83cc3f7e246301`.

### Parse and topology checks

- All seven JSON fences in tracked Markdown parse as complete JSON values.
- All three tracked YAML files parse: `.github/workflows/ci.yml`,
  `CurrentIndex.yaml`, and `Relations.yaml`.
- `CurrentIndex.yaml` has 152 items and 152 unique IDs.
- `Relations.yaml` has 388 unique relations, no duplicate tuple, and no
  unknown `from` or `to` endpoint.
- All 89 non-empty `Ledger.ndjson` lines parse and all 89 `eventId` values are
  unique.
- All tracked local Markdown links resolve. All checked backtick-named SDP and
  protocol document references resolve after creation of this expected
  verification report.

The relevant current trace state is otherwise honest:

- `SPR-001` and `SL-001-002-001` are verified/current;
- `IT-001-002` is closed/current and `VER-001-002-003` is verified/current;
- `SPR-002`, Slice 2A, and Slice 2B remain planned/target;
- Phase-A `IT-002-000` is active/current and `SL-002-000-001` is
  implemented/current pending verification disposition integration;
- both reviews are closed/current; `CR-023`–`CR-027` are resolved/current;
- `VER-002-000-001` remains in_progress/target at the pre-verification input;
  and
- `DEP-002-001` and `DEP-002-002` remain blocked/target.

This report-only verifier does not alter those registry, relation, ledger,
sprint, implementation-note, or handoff states. Master must integrate the
failed-verification result and corrective next step.

### Slice-1 regression

`npm test` passed on Node `v24.11.0` and npm `11.6.1`:

```text
tests 99
pass 99
fail 0
cancelled 0
skipped 0
todo 0
```

The suite includes the TypeScript build and accepted launch, registers,
disassembly, instruction-breakpoint, continue/pause/step, transport/lifecycle,
fake-contract, framing, fixture, packaging-policy, and cleanup behavior.

## Current emulator dependency matrix

Live GitHub state was read on 2026-09-02 and was not inferred from the prior
reviews.

| Dependency evidence | Exact current state | Gate result |
|---|---|---|
| Emulator default | `master` at `bc86d2633b6057529e6fd1e666896c24d72822aa` | Base authority only |
| Frozen Slice-1 runtime merge | `1a6aa397993d3f24cef8d41248ae2928d352966a` is an ancestor; current master is 30 commits ahead and has no `emu_debug.c`, `emu_debug.h`, or `emu_debug_server.c` delta | `emu-debug` 1.0 remains unchanged |
| Emulator Issue #14 | **OPEN**, no READY/accepted closure | Gate A **NOT SATISFIED** |
| Takeover PR #16 | **OPEN/CLEAN/unmerged**, no GitHub review decision, head `1e588d28fb168a7c5a42c4c7dc4b51f84d29d1ed`; stacked on PR #11 branch rather than `master` | Evidence only; Gate A **NOT SATISFIED** |
| PR #11 | **OPEN/DIRTY/unmerged**, head `9144567d07ff73e43eb914add5e81fe9717aa980` | Design input only |
| PR #12 | **OPEN/CLEAN/unmerged**, head `f25e7ebee46f78405bc3ec713724a56401aec8c0` | Runtime input only |
| Preserved WIP | `356836637d5ff432d91fc508fd55b2f17b45cdb3` | Explicitly non-authoritative |
| CPU producers / safe-boundary CPU stop / wire exposure | PR #16 explicitly excludes all three | Gate B **NOT SATISFIED** |
| Successor wire authority | Complete repository inventory has no separately authorized and accepted issue, PR, release, tag, merge, or commit for the additive debug-point wire extension | Gate B **NOT SATISFIED** |

Current master contains only protocol 1.0 and the accepted base capability set
(`rawCode64k`, `deterministicReset`, `snapshotBasicRegisters`, `decodeCode`,
`replaceCodeBreakpoints`, `boundedRun`, and the other Slice-1 base
capabilities). A current-master source scan found no debug-point/watchpoint/
tracepoint wire command or runtime integration. PR #16's internal facade and
verification evidence cannot be promoted to an accepted external consumer
contract while Issue #14 and the stacked PR remain open; in addition, PR #16
explicitly leaves Gate-B work for a separate slice.

No emulator release or tag exists, and the only newer open issue after Issue
#14 is unrelated Timer2 work. Therefore no exact Slice-2 emulator capability,
command, event, RMW, condition, lifecycle, paging, or stop-result schema may be
frozen, and no fake/product implementation may begin.

## PR topology and final disposition

- PR #4 is merged; Slice 1 remains accepted, verified, closed, and
  byte-unchanged.
- PR #5 is **OPEN**, not draft, unmerged, and cleanly mergeable at its pushed
  remote head `6fc619845f159f4ff0fb1b2caa608c9073b58de4`.
- The local PR branch's pre-report integrated documentation HEAD is
  `f20e10f348a5923f3731383f30055839279400da`, six commits ahead of the pushed
  PR head. Those commits contain review/correction/integration documentation
  and trace only.
- This verifier did not push the local correction/review/verification chain or
  mutate PR #5.

`RVW-002-000-002` remains an accepted review of corrective commit `1e83b25...`,
but verification of integrated HEAD `f20e10f...` fails on the stale handoff
current-state paragraph. Correct that paragraph through the worker/reviewer
procedure, integrate this verification disposition into SDP/traceability, and
run a fresh independent verification before merging PR #5.

Even after that local correction, external Gate A still requires accepted
Issue #14/runtime-facade authority and Gate B still requires a separately
accepted additive `emu-debug` wire/CPU-producer/safe-stop exposure. The frozen
1.0 contract must not change unless a new verified incompatibility is found.

**`PHASE_A_FAIL / WAITING_FOR_EMULATOR_CONTRACT`**

**`NOT READY_FOR_SLICE_2_IMPLEMENTATION`**

## Phase-A corrective re-verification `VER-002-000-002`

**Steering/Master authority:**
[`Hans-Einar/emuSA80535-DAP` Issue #6](https://github.com/Hans-Einar/emuSA80535-DAP/issues/6)

**Branch:** `steering/debug-points-rebaseline`

**Documentation pull request:**
[#5](https://github.com/Hans-Einar/emuSA80535-DAP/pull/5)

**Exact integrated HEAD verified:**
`530c8788bc4a423d651859e145bf31f4ea70bf14`

**Bounded Handoff correction:**
`56eb23c3690b27fe9046cf1915ea6edfd04bde35`

**Accepted correction review:**
`RVW-002-000-003` at
`0d294f19efcb1950239dd7b117dd01d39a23f1a7`

**Prior failed verification report:**
`VER-002-000-001` at
`92b7d3843b592644500c4041d8b808c180241de2`

**Accepted Slice-1 authority base:**
`b1b1c2d55d8379fff74110372c8095e3095920cf`

**Evidence refreshed:** 2026-09-02T12:03:07Z

**Recorded review disposition:** **ACCEPTED** — `RVW-002-000-002` and
`RVW-002-000-003` accept the corrected Phase-A package; `CR-023` through
`CR-028` are resolved and no new finding was raised.

**Verification disposition:** **PHASE_A_PASS**

**External dependency disposition:** **WAITING_FOR_EMULATOR_CONTRACT**

**Product readiness:** **NOT READY / NOT ACTIVATED**

### Scope and independence

This is the fresh independent full-matrix rerun required after the bounded
`CR-028` Handoff correction. The verifier reread Issue #6 in full, the current
study, requirements, architecture, design, protocol consumer requirements,
sprint, iterations, implementation notes, Handoff, Steering record, all three
review passes, `VER-002-000-001`, and the complete current traceability
surface. The full substantive and mechanical matrix was rerun against exact
integrated HEAD `530c8788...`; prior passing results were not merely inherited.

No adapter, extension, fake, fixture, test, script, manifest, package,
protocol, sprint, review, handoff, implementation-note, traceability, issue,
pull request, or emulator source was edited by this verifier. This appended
section is the only verifier-authored path. The verifier did not push, merge,
close, retarget, or otherwise mutate PR #5 or either repository's issues and
pull requests.

### `CR-028` closure reproduced

The exact one-file corrective diff from
`f206d9f654a1c504ec7ccf11469c1a08aa5db48e` to `56eb23c...` changes only
`SDP/Sprints/SPR-002--debug-points-trace-integration/Handoff.md`. It replaces
the false current claim that `RVW-002-000-002` and `CR-023` through `CR-027`
were pending/open with the exact accepted review and resolved-finding state,
and moves the next action to `RVW-002-000-003` followed by
`VER-002-000-002`.

Fresh `RVW-002-000-003` then accepted that correction at `0d294f1...`.
Integrated HEAD `530c878...` updates the Handoff current state and next action
again so that they now agree with all current authorities:

- corrective `RVW-002-000-002` is accepted at `c8a387d...`;
- bounded `RVW-002-000-003` is accepted at `0d294f1...`;
- `CR-023` through `CR-027` are resolved;
- `CR-028` is resolved for review with no new finding;
- the failed `VER-002-000-001` remains accurate historical evidence; and
- fresh `VER-002-000-002` is the sole remaining Phase-A gate at the verified
  pre-report input.

The current-state and next-action sections contain no stale claim that any of
those reviews or findings remain pending/open. `ScrumIterations.md`,
`implementationNotes.md`, `CurrentIndex.yaml`, `Relations.yaml`, and ledger
events `LE-000088` through `LE-000094` agree with that state. `CR-028` is
therefore **VERIFIED RESOLVED**.

### Official DAP 1.71 semantic rerun

The normative schema was fetched again from the official Microsoft Debug
Adapter Protocol v1.71.0 lightweight tag/commit
`51d95ea4e692b34c5d06601bbd1bebc1ff3fbdd4`. Programmatic schema assertions
all passed:

- `supportsDataBreakpoints` gates native data-breakpoint support and
  `supportsDataBreakpointBytes` remains a separate capability;
- `DataBreakpointInfoArguments.name` is required and
  `variablesReference`/`frameId` are standard origins;
- response `dataId` is string-or-null and `description` is required;
- a variable/frame-derived `dataId` is guaranteed for the current suspended
  state, while an installed breakpoint may outlive that discovery identity;
- `canPersist` describes persistence across sessions;
- `setDataBreakpoints` supplies the full input array and the response array
  elements correspond to it;
- every returned `Breakpoint` requires `verified`, and `Breakpoint.id` is an
  integer; and
- `stopped.reason` includes the standard `data breakpoint` value while
  `hitBreakpointIds` is an integer array.

Official VS Code source commit
`c3a0ee2b9889e58a2640b16087e91ccbea8e2121` remains the native-client
reference used by the accepted corrective review: the Variables-view path
passes a child variable name plus its parent reference to
`dataBreakpointInfo`, retains returned `dataId`, and maps its value-change,
access, and read actions to DAP write/readWrite/read semantics. The corrected
contract therefore uses the real native UI path rather than an extension-only
Add Watchpoint command.

The accepted Slice-1 adapter at exact verified HEAD still exposes the current
Registers container children `PC`, `A`, `B`, `PSW`, `SP`, `DPTR`, and
bank-selected `R0` through `R7`. Live emulator `master` has `emu8051.h` blob
`150982fb9f1d24ab3507bf380cdaa4a0cb60a00b`, which independently confirms
`REG_ACC = 0xE0 - 0x80`, `REG_B = 0xF0 - 0x80`,
`REG_PSW = 0xD0 - 0x80`, and `REG_SP = 0x81 - 0x80`. The exact supported
Slice-2A origins remain:

| DAP child | Exact target | Result |
|---|---|---|
| `A` | `sfr:0xe0..0xe0`, one byte | opaque token; read/write/readWrite |
| `B` | `sfr:0xf0..0xf0`, one byte | opaque token; read/write/readWrite |
| `PSW` | `sfr:0xd0..0xd0`, one byte | opaque token; read/write/readWrite |
| `SP` | `sfr:0x81..0x81`, one byte | opaque token; read/write/readWrite |

`PC`, composite `DPTR`, bank-selected `R0` through `R7`, and every other
well-formed non-exact/unsupported origin return success with `dataId: null`.
Malformed arguments and stale/foreign nonzero handles fail actionably. No
target is inferred from display text or a displayed value.

### Complete substantive matrix

| Required semantic point | Rerun result |
|---|---|
| Native `dataBreakpointInfo` / `setDataBreakpoints` and exact A/B/PSW/SP origin | **PASS** — official DAP semantics, nullable non-exact origins, packaged Variables-view path, and exact SFR identities agree. |
| Opaque `dataId`, `canPersist`, and lifecycle | **PASS** — stop-epoch Registers handle, session/target-generation discovery token, installed watch, and cross-session persistence promise are explicitly separated. Resume/new-stop is a bounded stronger adapter guarantee; reset/load/restart/process/variant/session invalidation remains conservative. |
| Separate installed, correlation, and revision identities | **PASS** — positive integer DAP id, opaque discovery string, public emulator correlation identity, exact configuration revision, and later trace cursor/generation/sequence domains do not alias or leak private C identity. |
| Atomic replacement and ordered results | **PASS** — complete prevalidation, empty/full-set replacement, stable unchanged ids, retired id non-reuse, one result per input in order, and rollback of set/correlation/ids/revision on any failure are normative. |
| Safe-boundary stop and standard DAP result | **PASS, dependency-gated** — the emulator owns completion to an atomic safe boundary; the adapter creates one normal stop epoch and maps public trigger correlation to `reason="data breakpoint"` plus all available integer `hitBreakpointIds`. |
| RMW ownership and no adapter event synthesis | **PASS, dependency-gated** — one canonical emulator RMW event is never decomposed into TypeScript read/write events; final inclusion rules must be copied from the accepted wire authority. |
| Bounded conditions and no live JavaScript evaluation | **PASS, dependency-gated** — only an exact accepted finite emulator subset may compile; until then every non-empty condition/hit condition rejects the entire proposal atomically. |
| Emulator semantic ownership | **PASS, dependency-gated** — matching, canonical/source/derived ordering, counters, gates, routes, interrupt policy, stop coalescing, safe-stop timing, retention, paging, and loss/suppression remain emulator-owned. |
| Trace non-stop behavior | **PASS, planned Slice 2B** — trace records, output, and low-volume availability/status/loss notifications never create a DAP stopped event or stop epoch. |
| Retention, paging, uint64, and custom surfaces | **PASS, planned Slice 2B** — authoritative bounded rings and non-destructive page reads remain in the emulator; wide values stay lossless strings/accepted exact forms; custom requests/events are limited to semantics native DAP lacks and never form a per-record firehose. |
| Ownership-domain coexistence and optional absence | **PASS** — Slice-1 CODE breakpoints, DAP-owned stopping watches, and rich trace/watch/session state are distinct replacement domains; absent optional support leaves the complete Slice-1 path and frozen 1.0 behavior intact. |
| Thin product decomposition | **PASS** — `IT-002-001 / SL-002-001-001` is the stopping-watch-only Slice 2A; rich non-stopping trace work remains separately planned in `IT-002-002 / SL-002-002-001` and may be split again. Neither is activated. |
| `R-027` supersession | **PASS** — historical target/deferred evidence remains in `DAP-REQ-001`; direct `phase_superseded_by` relations point to replacement requirements `R-036` and `R-040`, while `S-002` is separately `contextualized_by`. |
| No provisional wire names, P1000 semantics, or physical I/O | **PASS** — no Slice-2 name exists in product/fake code; suggested `emu.*` requests and `emuTrace*` events are explicitly future DAP-extension suggestions, not emulator wire names. Generic prohibitions/preset-as-data language introduces no P1000 or host-I/O behavior. |

No new incompatibility with the frozen `emu-debug` 1.0 contract was found.

### Mechanical, traceability, and regression evidence

All exact whitespace gates completed without diagnostics:

```text
git diff --check b1b1c2d55d8379fff74110372c8095e3095920cf 530c8788bc4a423d651859e145bf31f4ea70bf14
git diff --check 6fc619845f159f4ff0fb1b2caa608c9073b58de4 1e83b25bc3c6b6964d1915bc1b7626524f04d31f
git diff --check 1e83b25bc3c6b6964d1915bc1b7626524f04d31f 530c8788bc4a423d651859e145bf31f4ea70bf14
git diff --check f206d9f654a1c504ec7ccf11469c1a08aa5db48e 56eb23c3690b27fe9046cf1915ea6edfd04bde35
git diff --check 56eb23c3690b27fe9046cf1915ea6edfd04bde35 530c8788bc4a423d651859e145bf31f4ea70bf14
```

Scope and preservation checks passed:

- the `f206d9f...` to `56eb23c...` correction changes exactly one Handoff;
- `56eb23c...` to review commit `0d294f1...` changes only the review report;
- `0d294f1...` to exact integrated HEAD `530c878...` changes only the Handoff,
  Scrum iterations, implementation notes, and three traceability files;
- the complete accepted-Slice-1-to-integrated-Phase-A delta contains 15
  documentation/protocol/traceability paths and no product path;
- of the 67 files tracked at accepted base `b1b1c2d...`, only the three
  traceability files differ; all 64 pre-existing non-trace blobs are
  byte-identical;
- explicit diffs for every adapter, extension, fake, fixture, test, script,
  manifest, lockfile, build/CI/package path and every accepted Slice-1 mandate,
  study, requirement, architecture, design, sprint, review, verification,
  README, license, and base protocol authority are empty; and
- accepted product commit `36639b48ddb2ffbafa14c00da794fe1734f7483b`
  remains an ancestor through merged PR #4.

Parsing and topology checks passed:

- all seven tracked Markdown JSON fences parse as complete JSON values;
- all three tracked YAML files parse;
- `CurrentIndex.yaml` contains 155 items and 155 unique IDs;
- `Relations.yaml` contains 394 unique relation tuples and no duplicate or
  unknown endpoint;
- all 94 non-empty `Ledger.ndjson` records parse and all 94 `eventId` values
  are unique; and
- all tracked local Markdown links and 38 checked backtick-named SDP/protocol
  references resolve.

The exact pre-report trace state is coherent: `SPR-001`,
`SL-001-002-001`, and `VER-001-002-003` are verified/current;
`IT-001-002` is closed/current; all `CR-023` through `CR-028` are
resolved/current; both corrective reviews are closed/current;
`IT-002-000` is active/current, its documentation slice is
implemented/current, and `VER-002-000-002` is in-progress/target.
`SPR-002`, Slice 2A, and Slice 2B remain planned/target, while both external
dependencies remain blocked/target. Master must integrate this verifier result
after the report-only commit; the verifier does not mutate machine trace.

`npm test` passed on Node `v24.11.0` and npm `11.6.1`, including the
TypeScript build and the full accepted Slice-1 suite:

```text
tests 99
pass 99
fail 0
cancelled 0
skipped 0
todo 0
```

### Fresh emulator dependency matrix

Live GitHub state was read again rather than inherited from either review or
`VER-002-000-001`.

| Dependency evidence | Exact current evidence | Gate result |
|---|---|---|
| Emulator default | `master` = `bc86d2633b6057529e6fd1e666896c24d72822aa` | Base authority only |
| Frozen Slice-1 runtime | merge `1a6aa397993d3f24cef8d41248ae2928d352966a`; current-master blobs `emu_debug.c` = `c8112f695d6bf3fd0e64df0d5216c258fd8bdccc`, `emu_debug.h` = `d7418d6efed146bd22cdbeec899082a7ea490d79`, and `emu_debug_server.c` = `4b5b32b4774843c50d1691a7bb5c15d7aa3db4bc` are identical to that merge | Frozen 1.0 unchanged |
| Emulator Issue #14 | **OPEN**, no COMPLETE/READY/accepted closure | Gate A **NOT SATISFIED** |
| Takeover PR #16 | **OPEN/CLEAN/MERGEABLE/unmerged**, no recorded review decision, head `1e588d28fb168a7c5a42c4c7dc4b51f84d29d1ed`; compare with master is diverged, 15 ahead/25 behind, merge base `d9f80eba172dd9d7281aaa9e5cfef461b6b9709b` | Evidence only; Gate A **NOT SATISFIED** |
| PR #11 | **OPEN/DIRTY/CONFLICTING/unmerged**, head `9144567d07ff73e43eb914add5e81fe9717aa980` | Design input only |
| PR #12 | **OPEN/CLEAN/MERGEABLE/unmerged**, head `f25e7ebee46f78405bc3ec713724a56401aec8c0` | Runtime input only |
| Preserved SLC-017 WIP | `356836637d5ff432d91fc508fd55b2f17b45cdb3` | Explicitly non-authoritative input |
| CPU producers, safe-boundary CPU stop, and wire exposure | PR #16's current body explicitly excludes all three and its 28-file list contains no `emu_debug_server.c` or CPU/opcode integration path | Gate B **NOT SATISFIED** |
| Accepted successor wire extension | Complete current issue/PR inventory and release inventory contain no separately authorized, reviewed, merged, released, or accepted additive debug-point `emu-debug` wire extension; there are zero releases, and the only newer open issue is unrelated Timer2 work | Gate B **NOT SATISFIED** |

Gate A therefore still lacks the required accepted Issue #14/runtime-facade
authority. Gate B still lacks accepted additive wire commands/capabilities,
CPU canonical event producers, safe-boundary watchpoint-stop application, and
the exact RMW/condition/lifecycle/paging/stop-result schemas. No exact name or
schema may be frozen in this repository, and no fake or product implementation
is authorized.

### PR topology and Phase-A disposition

PR #5 remains **OPEN**, not draft, unmerged, clean, and mergeable, targeting
`main` from `steering/debug-points-rebaseline`. Its pushed GitHub head remains
the initial Steering commit
`6fc619845f159f4ff0fb1b2caa608c9073b58de4`; four Linux/Windows push/PR jobs
on that remote head are successful. The exact locally verified integrated
input `530c878...` is eleven commits ahead and has not been pushed by this
verifier, so those remote jobs are not misrepresented as exact-input CI.

The corrected Phase-A documentation, review, trace, handoff, and regression
surface now passes completely. The earlier sole local blocking defect
`CR-028` is closed by fresh review and this verification, with no new local
finding. Accordingly the Phase-A result is:

**`PHASE_A_PASS / WAITING_FOR_EMULATOR_CONTRACT`**

`SPR-002`, thin stopping-watch Slice 2A, and separately planned rich-trace
Slice 2B remain planned, dependency-gated, and unactivated. PR #5 must remain
unmerged until Master integrates this fresh disposition. Product work must
not begin until Gate A has an accepted Issue #14/runtime merge, Gate B has an
accepted additive wire/CPU-producer/safe-stop exposure, exact authority is
reconciled, and Steering separately activates the slice.

**`NOT READY_FOR_SLICE_2_IMPLEMENTATION`**
