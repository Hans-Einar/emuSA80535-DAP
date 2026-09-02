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
