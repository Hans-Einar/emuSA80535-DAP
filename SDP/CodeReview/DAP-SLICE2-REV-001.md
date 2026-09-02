# DAP-SLICE2-REV-001 — Independent Phase-A review

**Traceability:** `RVW-002-000-001` reviews `SL-002-000-001` and the
candidate `SL-002-001-001` contract under DAP Issue #6.

**Disposition:** **CHANGES_REQUIRED**

## Reviewed authority and exact revisions

- Steering/Master authority: `Hans-Einar/emuSA80535-DAP` Issue #6, read in
  full on 2026-09-02.
- Documentation PR: PR #5, open and unmerged.
- PR #5 Steering baseline: `6fc619845f159f4ff0fb1b2caa608c9073b58de4`.
- Exact content reviewed: `4659c7be9b3218880dea205f0f8fcb7284324e92` on
  `steering/debug-points-rebaseline`.
- Accepted Slice-1 comparison base:
  `b1b1c2d55d8379fff74110372c8095e3095920cf`; the accepted product commit
  `36639b48ddb2ffbafa14c00da794fe1734f7483b` is an ancestor of the reviewed
  HEAD. PR #4 is merged, and Slice 1 remains verified/closed.

The review covered all eight PR #5 documents plus the active Phase-A
`ScrumIterations.md`, `implementationNotes.md`, `CurrentIndex.yaml`,
`Relations.yaml`, and `Ledger.ndjson`. No source document was edited by this
reviewer.

## External semantic evidence

The DAP review used the official Microsoft Debug Adapter Protocol 1.71.0
schema at tag `v1.71.0`, commit
`51d95ea4e692b34c5d06601bbd1bebc1ff3fbdd4`:

- https://microsoft.github.io/debug-adapter-protocol/specification
- https://raw.githubusercontent.com/microsoft/debug-adapter-protocol/v1.71.0/debugAdapterProtocol.json

The relevant normative schema facts are:

- `supportsDataBreakpoints` gates `dataBreakpointInfo` and
  `setDataBreakpoints`.
- `dataBreakpointInfo` identifies a child using current-stop
  `variablesReference` plus `name`, or an expression/location using `name`
  and optional `frameId`; the newer address/range form additionally depends
  on `supportsDataBreakpointBytes`.
- A `dataId` derived with `variablesReference` or `frameId` is valid only in
  the current suspended state; without either it is valid indefinitely.
  A data breakpoint installed from it may outlive that `dataId`.
  `canPersist` separately states whether the potential breakpoint can be
  persisted across sessions.
- `setDataBreakpoints` replaces all DAP data breakpoints. Its response has
  one `Breakpoint` result per input in corresponding order; `verified` is
  required, and `id`/`message`/`reason` support correlation and rejection
  detail.
- A hit generates `stopped` with reason `data breakpoint`.
  `hitBreakpointIds` can carry the integer `Breakpoint.id` values that
  triggered the stop.

The emulator inputs were inspected without promoting open/internal surfaces
to wire authority:

- PR #11 is open at `9144567d07ff73e43eb914add5e81fe9717aa980`.
- PR #12 is open at `f25e7ebee46f78405bc3ec713724a56401aec8c0`.
- preserved WIP `356836637d5ff432d91fc508fd55b2f17b45cdb3` exists but is explicitly
  not accepted authority.
- Issue #14 is open; takeover PR #16 is open and unmerged at
  `1e588d28fb168a7c5a42c4c7dc4b51f84d29d1ed`.
- current emulator `master` is
  `bc86d2633b6057529e6fd1e666896c24d72822aa` and does not contain PR #16.
- PR #16's DES-090..DES-097 candidate freeze is coherent evidence for a
  future sized/versioned facade and exclusive per-ring cursor, but PR #16
  explicitly excludes CPU producers, safe-boundary CPU stop application,
  and the `emu-debug` wire extension.
- the complete emulator issue/PR inventory contains no accepted successor
  wire-extension issue, PR, release, or commit.

## Findings

### CR-023 — HIGH — Native data-breakpoint creation has no defined usable origin

**Maps to:** `R-034`, `R-035`, `R-036`, `R-037`, `R-051`, `D-011`,
`AC2-002`, `AC2-003`, and `AC2-005`.

The candidate slice requires native `dataBreakpointInfo` and
`setDataBreakpoints`, but address-preserving SFR/IRAM/XDATA/CODE identities
remain near-term in `R-051`. The accepted Slice-1 UI exposes only one
stop-epoch Registers container with children `PC`, `A`, `B`, `PSW`, `SP`,
`DPTR`, and `R0`–`R7`. The new contract does not state which, if any, of those
children is an exact watchable memory target. Several are non-memory,
composite, or bank-dependent. Nor does the contract define another concrete
native DAP request/UI path that yields the first valid `dataId`.

`DAP-DES-002` correctly says to return `dataId: null` when exact mapping is
impossible. Under the current slice boundary that rule can leave every
existing client-originated request unwatchable, while the acceptance criteria
still claim an end-to-end native watchpoint.

**Required correction:** make the first product slice include one explicit,
generic, address-preserving variable/location origin that VS Code can actually
use. Either promote a minimal part of `R-051`, or normatively list the exact
currently exposed register children that map safely to accepted address-space
targets and reject all composite/banked/PC cases whose identity cannot be
preserved. Define the exact `DataBreakpointInfoArguments` shape, target space,
width/range, allowed access types, and whether
`supportsDataBreakpointBytes` remains false. Add acceptance that exercises the
real VS Code/native request path from that origin through configuration and a
safe-boundary stop. Do not substitute an extension-only Add Watchpoint command
for proof of the native DAP path.

### CR-024 — HIGH — `dataId`, installed-breakpoint, and lifecycle identities are conflated

**Maps to:** `R-035`, `R-036`, `R-037`, `DP-CAP-001`, `DP-CAP-002`,
`AC2-002`, `AC2-003`, `AC2-005`, and `AC2-010`.

The documents protect opacity and private C layout correctly, but phrases such
as “session-owned identity”, “stable opaque id”, and “lifetime follows DAP
semantics and session configuration” are not an implementable DAP lifetime
contract. They omit the normative current-suspended-state rule when
`variablesReference` or `frameId` is supplied, the indefinite form without
those arguments, and the fact that an installed breakpoint may outlive its
source `dataId`. They also do not freeze `canPersist` behavior for a
session-table identity. Reset/load/clear text delegates to the future emulator
contract without separating DAP stop-handle expiry, source `dataId` expiry,
installed DAP breakpoint lifetime, emulator watch identity, and configuration
revision/cursor staleness.

The same gap weakens stop correlation: the contract mentions an adapter-side
correlation id, but does not require one ordered `Breakpoint` response per
request or clearly distinguish optional integer `Breakpoint.id` values from
string `dataId` and private emulator watch ids.

**Required correction:** copy the DAP 1.71 lifetime split into the normative
requirements/design. For a `variablesReference`/`frameId` origin, expire the
source `dataId` on resume/new stop while allowing the already installed
breakpoint to retain its resolved target. State whether the no-reference form
is supported. A session-handle implementation must return `canPersist: false`
or omit it and must never reuse/persist handles across sessions. Define stale
request behavior and a matrix for resume, new stop, reset, load, explicit trace
clear, data-breakpoint replacement, restart, disconnect, and a new session.
Keep DAP `dataId`, DAP `Breakpoint.id`, emulator watch id, configuration
revision, session/generation, and trace cursor as separate domains. Require
one response `Breakpoint` per input in input order, with actionable rejection
detail; when DAP breakpoint ids are assigned, use them consistently for stop
correlation, including `hitBreakpointIds` when the emulator reports sufficient
trigger identity.

### CR-025 — HIGH — The candidate product slice is not thin

**Maps to:** `R-032`–`R-050`, `D-011`, `SPR-002`, `SL-002-001-001`, and
`AC2-001`–`AC2-011`.

The single candidate vertical slice combines optional protocol negotiation,
native data-breakpoint identity and lifecycle, a bounded condition compiler,
atomic watch ownership, RMW and safe-stop behavior, full rich tracepoint and
session configuration, multi-trace routes, before/after gates, interrupt
policies, console output, custom notifications, loss/status handling,
non-destructive paging, an extension command/view surface, fake parity, two
operating systems, packaging, and real VS Code acceptance. These are at least
two independent user capabilities with different DAP surfaces, state models,
failure modes, and evidence matrices. Treating all of them as one
`SL-002-001-001` contradicts the SDP thin-slice rule and makes review/rework
needlessly coupled.

**Required correction:** keep `SPR-002` as the planned dependency-gated
umbrella, but split product work before activation. The first thin vertical
slice should cover optional negotiation plus one usable native stopping-data-
breakpoint path, exact identity/lifecycle, minimum accepted condition behavior,
RMW/safe-stop correlation, coexistence with Slice-1 CODE breakpoints,
optional-absence regression, and fake/real Windows/Linux evidence. Put rich
non-stopping trace configuration/presentation in a separate slice. If that
slice still includes sessions, destinations/routes, gates/interrupt policy,
paging/loss/status, and a view, split retained paging/status presentation from
configuration as well. Preserve all rich-model requirements and final mapping;
do not flatten or move matching, conditions, sequencing, gates, routing,
retention, or safe-stop semantics into TypeScript.

### CR-026 — MEDIUM — The R-027 supersession relation points to the study, not the replacement requirements

**Maps to:** `R-027`, `S-002`, `R-034`–`R-039`, and the traceability cleanup
required by Issue #6.

The prose in `DAP-REQ-002` and the `CurrentIndex.yaml` summary honestly retain
the old Deferred history. However, the machine relation is
`R-027 phase_superseded_by S-002`. `S-002` is the study; it is not the
`DAP-REQ-002` requirement set that changes the phase classification. This
prevents a direct machine-readable answer to the exact supersession question.

**Required correction:** preserve `R-027` and its historical document, but
link its phase supersession directly to the applicable new stopping-watchpoint
requirements owned by `DAP-REQ-002` (the bounded `R-034`–`R-039` chain, or a
single explicit requirement authority if the correction introduces one).
Retain the study relation separately as context. Do not mark `R-027` or any new
product requirement implemented/current.

### CR-027 — LOW — The documentation diff fails the whitespace gate

**Maps to:** `SL-002-000-001` Phase-A verification hygiene.

`git diff --check
b1b1c2d55d8379fff74110372c8095e3095920cf..4659c7be9b3218880dea205f0f8fcb7284324e92`
reports ten trailing-whitespace errors across `DAP-STU-002.md`,
`DAP-REQ-002.md`, `DAP-ARCH-002.md`, `DAP-DES-002.md`, and
`EMU_DEBUG_POINTS_EXTENSION_REQUIREMENTS.md`.

**Required correction:** remove the trailing spaces and require
`git diff --check` to pass on the corrected exact HEAD.

## Issue #6 semantic review matrix

| Review point | Result | Evidence / qualification |
|---|---|---|
| Native data-breakpoint mapping | **CHANGE** | Correct DAP requests and stopped reason are selected, but `CR-023` and `CR-024` leave the creation/lifetime path incomplete. |
| `dataId` opacity and private identity | **PARTIAL** | No pointer/private-layout leak; exact lifetime, persistence, and identity domains require `CR-024`. |
| Safe-boundary stop | **PASS (dependency-gated)** | Emulator-originated stop completes the architectural operation and maps to `data breakpoint`; no mid-opcode adapter stop. |
| RMW and event synthesis | **PASS (dependency-gated)** | RMW remains one canonical emulator event; final access mapping waits for accepted wire authority. |
| Conditions/hit conditions | **PASS (dependency-gated)** | Only bounded compilation to the emulator form is permitted; unsupported syntax rejects atomically; no JavaScript live-state evaluation. |
| Tracepoint non-stop | **PASS** | Trace records/output/custom notifications do not create a stop epoch or stopped event. |
| High-rate retention/paging | **PASS (dependency-gated)** | Emulator-owned bounded rings, pull paging, loss/suppression metadata, and no DAP firehose are explicit. |
| Custom request/event use | **PASS** | Used only where native DAP lacks the rich trace model. Suggested `emu.*`/`emuTrace*` names are explicitly DAP-extension suggestions, not frozen emulator wire names. Architecture placeholders are covered by an explicit no-freeze statement. |
| Three-domain ownership/coexistence | **PASS (dependency-gated)** | Slice-1 CODE, DAP-owned stopping watches, and rich trace/watch configuration are separate replacement domains. |
| Reset/load/clear and stale identities | **CHANGE** | Emulator lifecycle authority is deferred correctly, but DAP identity layers need the `CR-024` matrix. |
| uint64/JavaScript precision | **PASS (dependency-gated)** | Sequence/generation/counter values beyond `Number.MAX_SAFE_INTEGER` remain lossless strings or another exact accepted representation. |
| Optional-extension absence | **PASS** | Data-breakpoint advertisement/trace controls disable while every accepted Slice-1 operation remains available. |
| P1000/physical I/O neutrality | **PASS** | Only explicit prohibitions and safety acceptance exist; no firmware-specific address or physical endpoint is introduced. |
| Thin coherent slice | **CHANGE** | `CR-025` requires decomposition before product activation. |

## Traceability assessment

The new IDs are unique and all relation endpoints exist. `S-002`,
`R-032`–`R-055`, `A-009`, `D-011`, `DP-CAP-001`–`DP-CAP-006`,
`RVW-002-000-000`, `SPR-002`, both iterations/slices, the planned review and
verification, and both dependency records are present. Slice 1 remains
`SPR-001`/`SL-001-002-001` verified and `IT-001-002` closed.
`SPR-002`, `IT-002-001`, and `SL-002-001-001` remain planned/target and no
product implementation status is claimed. The only semantic trace defect is
`CR-026`; findings from this report must be added by the correction worker in
accordance with the role-separation instruction.

## Mechanical evidence

- Diff from `b1b1c2d55d8379fff74110372c8095e3095920cf` contains 13
  documentation/traceability paths under `SDP/` or `protocol/`; no adapter,
  extension, fake, test, manifest, package, or emulator product path changed.
- One `json` fenced example parsed successfully.
- `CurrentIndex.yaml` and `Relations.yaml` parsed successfully with
  `js-yaml`.
- All 84 `Ledger.ndjson` lines parsed; all event IDs are unique.
- `CurrentIndex.yaml`: 144 items, 144 unique IDs.
- `Relations.yaml`: 325 relations, no duplicate relation, no unknown endpoint.
- No Markdown local link exists in the reviewed changed package; all
  backtick-referenced local documents inspected for this review exist.
- `git diff --check` fails only for the ten whitespace errors in `CR-027`.

## Dependency disposition

**Gate A — NOT SATISFIED.** Emulator Issue #14 and PR #16 remain open and
unmerged. PR #16 contains strong review/verification and target-design evidence
at `1e588d28...`, but Issue #6 requires accepted/READY external authority, not
an inference from an open stacked PR.

**Gate B — NOT SATISFIED.** No separately authorized and accepted additive
`emu-debug` wire extension exists. PR #16 explicitly excludes the CPU
producers, CPU safe-boundary stop application, and wire extension required by
this gate.

Therefore no exact Slice-2 capability/command/event schema is frozen, the fake
contract cannot yet be reconciled to a real extension, and no product work is
authorized. The correct dependency state remains:

**`WAITING_FOR_EMULATOR_CONTRACT`**

## Reviewer conclusion

The architecture's central ownership decision is sound: the emulator remains
the sole owner of matching, conditions, sequencing, gates, routing,
retention/loss, and safe-boundary stop semantics, while DAP and CLI are
frontends. The documents need the five corrections above before Phase-A review
can be accepted. A fresh re-review and independent verification must assess the
corrected exact HEAD. PR #5 must remain unmerged, Slice 1 remains accepted and
closed, and `SPR-002` remains planned/dependency-gated.
