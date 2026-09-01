# Scrum iterations — SPR-001

## IT-001-000 — SDP foundation and Slice-1 readiness

**State:** Historical rework; superseded by `IT-001-001`
**Slice:** `SL-001-000-001`
**Authority:** GitHub Issue #1

### Why now

The repository had only bootstrap folders. DAP semantics, process ownership,
actual emulator seams, cross-repository prerequisites, packaging, and the first
vertical acceptance path had to be frozen before implementation could safely
start.

### Worker assignment

Author only the documents and traceability named in the slice contract. Inspect
the current emulator and public primary sources. Make target/current labels
explicit. Do not create production/test code, manifests, build configuration,
Issues, PRs, review conclusions, or verification conclusions.

### Worker result

The documentation implementation pass produced the planned authored artifacts
and a frozen minimum `emu-debug` 1.0 requirement. It selected:

- external Node.js/TypeScript adapter on DAP stdio;
- separate launch-owned headless emulator child on NDJSON stdio;
- launch-first, separately installed emulator resolution;
- raw 64-KiB/address-level Slice 1 with one thread/current frame/registers,
  authoritative minimal disassembly, one accepted instruction breakpoint,
  bounded continue/adapter-local pause, and instruction `stepIn`.

It identified `EMU-BLK-001`–`EMU-BLK-010` as hard cross-repository
prerequisites. `SPR-001` remains planned/not started.

### Required next passes

1. Fresh reviewer performs `RVW-001-000-001` and records findings in
   `SDP/CodeReview/DAP-SDP-REV-001.md`.
2. If blocking findings exist, Master opens a corrective documentation
   iteration and assigns a fresh worker.
3. Fresh verifier performs `VER-001-000-001` only after accepted review and
   records repeatable evidence in `SDP/Verification/DAP-SDP-VER-001.md`.
4. Master reconciles sprint documents and traceability, opens the
   documentation-only PR, and decides whether the gate is
   `READY-FOR-SLICE-1`.

### Verification plan

- required-document and substantive-content checks;
- authoritative URL and emulator permalink checks;
- fenced JSON parsing, YAML parsing, and NDJSON per-line parsing;
- Mermaid block inventory/syntax review;
- requirement ID definition/reference and relation-chain checks;
- repository diff allowlist proving documentation-only changes;
- no production code/config/test/fixture creation and no P1000 semantic;
- review of DAP sequencing, breakpoint replacement, handle epochs, stopped
  reasons, disassemble count, pause bound, and launch-owned cleanup.

### Carry-forward

Open Steering decisions are documented in `Handoff.md`. No product
implementation task may be inferred or started from this iteration.

### Independent review `RVW-001-000-001`

**Reviewed commit:** `ab231769fb78bcb44a11ecdc5791d1f69b66ea3c`

**Disposition:** **changes-required**

**Next iteration:** corrective documentation; product Slice 1 remains not started

The fresh review confirmed the default-emulator/candidate-PR distinction,
process boundary, private-internal exclusion, firmware neutrality, logical
stack restraint, broad deferrals, and the credible Linux/Windows VSIX path. It
raised these blocking findings:

- `CR-001`: instruction-breakpoint hits use the wrong DAP stopped reason;
- `CR-002`: `code:HHHH` memory references are conflated with DAP numeric
  disassembly addresses;
- `CR-003`: `supportsSteppingGranularity` is advertised without complete
  request semantics;
- `CR-004`: authoritative backward decoding is not defensible for ambiguous
  variable-length raw CODE without a rule;
- `CR-005`: raw CODE `readMemory` is an unused accidental Slice-1 blocker;
- `CR-006`: child state across bounded `run` yields and adapter-local pause is
  undefined;
- `CR-007`: the two-record handshake fence is NDJSON, not one valid JSON value.

Full evidence and required corrections are in
`SDP/CodeReview/DAP-SDP-REV-001.md`. `VER-001-000-001` must not start until a
fresh corrective worker resolves these findings and a separate re-review
accepts the correction.

## IT-001-001 — Corrective SDP review closure

**State:** Closed after `VER-001-001-002`

**Slices:** `SL-001-001-001` (implemented; historical verification block) and
`SL-001-001-002` (verified)

**Authority:** Issue #1 plus `RVW-001-000-001` / `CR-001`–`CR-007`

### Goal

Resolve all seven blocking review findings at documentation level, normalize
the traceability status vocabulary, and make the candidate product slice
traceable as planned without implementing it.

### Files expected to change

- `SDP/02--Study/DAP-STU-001.md`
- `SDP/03--Requirements/DAP-REQ-001.md`
- `SDP/04--Architecture/DAP-ARCH-001.md`
- `SDP/05--Design/DAP-DES-001.md`
- `protocol/EMU_DEBUG_API_REQUIREMENTS.md`
- sprint planning/handoff/notes in this folder
- `SDP/CodeReview/DAP-SDP-REV-001.md` only for a reviewer-owned re-review addendum
- `SDP/Traceability/CurrentIndex.yaml`, `Relations.yaml`, and `Ledger.ndjson`

### Invariants and non-goals

- Preserve the selected external TypeScript adapter and launch-owned child
  boundary unless review evidence proves it invalid.
- Preserve the original evidence-cut current/candidate labels as dated history;
  do not silently rewrite what the first review observed.
- Use exact DAP wire semantics and separate them from emulator-internal terms.
- Keep Slice 1 address-level, hardware-free, and firmware-generic.
- Do not create product/test code, package manifests, build configuration,
  fixtures, Issues, PRs, or emulator-repository changes.

### Required corrections

1. Map an emulator CODE-breakpoint stop to DAP reason `instruction breakpoint`.
2. Separate opaque `memoryReference` values from numeric disassembly addresses
   and freeze the VS Code instruction-breakpoint round trip.
3. Define `statement`, `instruction`, omitted, and unsupported `line` stepping
   granularity behavior; `next` and `stepOut` must fail explicitly because DAP
   has no capability flags for them.
4. Replace the unsupported claim of authoritative backward disassembly with an
   honest deterministic exact-count placeholder/boundary rule.
5. Remove raw CODE read from the Slice-1 minimum when `decodeCode` is the only
   disassembly consumer; leave debugger `readMemory` near-term.
6. Separate adapter logical running state from an idle child at synchronous
   chunk boundaries and define every yield/pause/error transition.
7. Make each `json` fence one valid JSON document.
8. Normalize traceability statuses to the repository status model and add a
   planned product iteration/slice distinct from this documentation rework.

### Traceability and verification

`SL-001-001-001` addresses `CR-001`–`CR-007`, is re-reviewed by
`RVW-001-001-001`, and is verified by `VER-001-001-001`. Re-review must
reproduce the corrected DAP/schema semantics. Verification must parse all
examples, YAML, and NDJSON; validate relations; check links and Mermaid; and
prove the final diff remains documentation-only.

### Completion signal

The re-review resolves `CR-001`–`CR-007` with no new blocker. Only then may the
independent verifier run; the product sprint remains planned/not started.

### Corrective worker result

The documentation pass distinguishes the child `breakpoint` reason from DAP
`instruction breakpoint`; separates opaque `code:HHHH` references from numeric
`0xHHHH` disassembly addresses and freezes reference/offset canonicalization;
defines every stepping granularity plus explicit `next`/`stepOut` failure;
defines honest exact-count backward disassembly placeholders; removes raw CODE
read from the minimum emulator contract; and separates adapter logical state
from synchronous child command state across yield, pause, timeout, disconnect,
and snapshot invalidation. Every `json` fence is intended to contain one JSON
document.

The worker also normalized the traceability status vocabulary and retained the
candidate product work as planned `IT-001-002` / `SL-001-002-001`. No product
or test implementation was created. `CR-001`–`CR-007` remain `in_progress`,
not resolved, pending independent `RVW-001-001-001`; the corrective slice is
therefore handed off as `in_review`.

### Corrective re-review `RVW-001-001-001`

**Reviewed commit:** `e76936c02957fa92b784d947a86837c1fe3be70f`

**Disposition:** **accepted; no blocking review finding remains**

The fresh reviewer reproduced the corrected DAP instruction-breakpoint reason,
opaque-versus-numeric address and offset round trip, complete Slice-1 stepping
failure semantics, honest exact-count negative disassembly placeholders,
minimum contract without raw CODE read, separate adapter/child states through
yield/pause/timeout/disconnect, and single-document JSON fences. YAML, NDJSON,
relation endpoints, status vocabulary, fence balance, and the documentation-only
diff also passed re-review.

`CR-001`–`CR-007` are resolved, `RVW-001-001-001` is closed, and
`SL-001-001-001` is implemented awaiting `VER-001-001-001`. The corrective
iteration remains active only for verification and Master integration. Product
`IT-001-002` / `SL-001-002-001` remains planned and must not start.

## SL-001-001-002 — Refresh merged emulator baseline

**State:** In review after factual correction

**Authority:** `VER-001-001-001` live-state check and `CR-008`

### Why this correction exists

During final verification, `emuSA80535-N` PR #1 and the stacked Stage-1 PR #3
were merged. Default `master` moved to `a20815e24778760a308130cf1f9aa6d0f55b6af3`.
The architecture package was accurate at its earlier evidence cut, but its
current-state labels became stale before READY-FOR-SLICE-1.

### Goal and files

Refresh the factual current-emulator baseline and blocker classifications in
the mandate, study, requirements, architecture, protocol contract, sprint
notes/handoff, and traceability. Preserve the first study/review observations
as explicitly dated history. No runtime, transport, DAP scope, source layout,
or candidate product acceptance decision changes merely because the emulator
dependency advanced.

### Required evidence and invariants

- Record current default `master` at `a20815e…`, Stage-0 merge `0cf6792…`, and
  Stage-1 merge/PR #3 at `a20815e…` with permanent links.
- Re-inspect the merged headers/source. Classify deterministic reset/raw load,
  bounded run/exact step, one core breakpoint, generic trace, and IRQ
  observer/state as current core seams.
- Keep missing headless NDJSON/version handshake, debugger snapshot,
  `decodeCode` wire command, and replacement breakpoint table explicit.
- Mark satisfied/partial prerequisites honestly rather than calling merged APIs
  absent. Do not remove a protocol requirement only because its lower-level
  core primitive now exists.
- Keep IRQ-aware frames and interrupt scopes outside candidate Slice 1.
- Keep P1000 and physical host I/O outside the contract.
- Make documentation/traceability changes only; do not alter either repository's
  product code, create emulator work, or start product Slice 1.

### Traceability and completion

`SL-001-001-002` addresses `CR-008`, is reviewed by `RVW-001-001-002`, and is
verified by `VER-001-001-002`. Completion requires a fresh review of the live
baseline and a full verification rerun against the open DAP PR #2.

### Worker handoff

The worker refreshed mandate, study, requirements, architecture, protocol
contract, sprint/notes/handoff, and traceability against live default
`a20815e`. The original `5dc6812`/then-unmerged `62f4012` study and first-review
observations remain explicitly dated history. Current core seams are separated
from the missing versioned process contract, and the protocol blocker IDs now
carry satisfied/partial/missing status without changing the frozen target
behavior. Product `IT-001-002` / `SL-001-002-001` remains planned and unstarted.

`CR-008` remains `in_progress` for independent review. The slice moves to
`in_review`; `RVW-001-001-002` and `VER-001-001-002` remain planned and must be
performed by fresh agents.

### Baseline-refresh review `RVW-001-001-002`

**Reviewed commit:** `4982f34143d465107758d5101f9973057928d7a0`

**Disposition:** **accepted; no blocking review finding remains**

The fresh reviewer independently confirmed live emulator `master` at
`a20815e`, the PR #1/PR #3 merge states and commits, the cited current core
seams, and the satisfied/partial/missing `EMU-BLK-001`–`010` matrix. The dated
`5dc6812`/`62f4012` record is retained as history and explicitly superseded for
live-state use. Stage-1 IRQ support remains outside candidate Slice 1, and the
architecture, requirements, protocol contract, and sprint remain consistent.

`CR-008` is resolved, `RVW-001-001-002` is closed/current, and
`SL-001-001-002` is implemented awaiting `VER-001-001-002`. Product
`IT-001-002` / `SL-001-002-001` remains planned and unstarted.

### Final verification `VER-001-001-002`

**Verified content commit:** `e210c4bbfb8e8690f0d4b82f6cc4be2c3853950f`

**Disposition:** **PASS — READY-FOR-SLICE-1**

The fresh verifier reconfirmed live emulator `master` at `a20815e`, merged PR
#1/#3 state, exact source claims, and the `EMU-BLK` classification. The full
Issue #1 deliverable set, corrected DAP semantics, generic symbol schema,
documentation-only allowlist, JSON/YAML/NDJSON parsing, traceability chains,
internal links, bounded external links, static Mermaid structure, README
status, and open PR #2 state passed. The npmjs HTML page rejected automated
HEAD access, but the npm registry queries succeeded; Mermaid was statically
checked without installing a renderer. Both are documented non-blocking
limitations in `SDP/Verification/DAP-SDP-VER-001.md`.

`IT-001-001` is closed and `SL-001-001-002` is verified. The historical
`VER-001-000-001` and `VER-001-001-001` blocked records are retained. Product
`SPR-001`, `IT-001-002`, and `SL-001-002-001` remain planned and unstarted.
Readiness authorizes no implementation; Steering decisions in `Handoff.md` and
explicit Master activation remain mandatory.

## IT-001-002 — DAP first product implementation

**State:** Active under Issue #3

**Slice:** `SL-001-002-001`

**Authority:** GitHub Issue #3, accepted PR #2 baseline, and
`SteeringActivation.md`

### Slice contract

**Goal:** Implement only Slice 1: a packaged Node.js/TypeScript VS Code
debugger that launches a separate contract-compatible emulator, stops at entry,
exposes one MCU thread/current frame/basic-register scope, disassembles CODE,
replaces one instruction breakpoint, continues with bounded chunks, pauses at a
proven boundary, and executes exact instruction-level `stepIn`.

**Why now:** `VER-001-001-002` established the documentation gate and Issue #3
explicitly re-baselined the start gate so adapter work may use a
contract-faithful fake. The same tests must later pass against an accepted real
emulator before READY.

**Expected modules/files:** repository-root package/build/CI configuration;
`extension/`; `adapter/`; `test-fixtures/fake-emulator/`;
`test-fixtures/firmware/`; automated unit/contract/DAP/package tests; and the
active sprint, review, verification, and traceability records.

**Invariants:** DAP and child NDJSON use separate pipes; the child is launched
without a shell; protocol stdout is never human logging; state is exposed only
from proven stopped epochs; addresses never wrap; breakpoints replace globally;
pause schedules no next chunk; timeouts never promote an unproven boundary;
child cleanup and `terminated` are exactly once; no emulator private structs,
P1000 semantics, physical I/O, fake-only product command, or bundled emulator.

**Non-goals:** every item in Issue #3's Non-scope section, including source
breakpoints/maps, richer stacks, `readMemory`, `evaluate`, writes, watchpoints,
attach/TCP, emulator bundling/auto-download, and Marketplace publication.

**Traceability:** `M-001`, `S-001`, `UC-001`, Slice-1 requirements `R-001`–
`R-008`, `R-011`–`R-013`, `R-017`, `R-022`–`R-026`, `R-029`–`R-031`,
`A-001`–`A-008`, `D-001`–`D-010`, `SPR-001`, `IT-001-002`,
`SL-001-002-001`, `RVW-001-002-001`–`RVW-001-002-003`, and
`VER-001-002-001`.

**Required verification:** automated `AC-001`–`AC-011`; focused protocol,
address, scheduler, handle-epoch, lifecycle, safety, Linux/Windows, installable
VSIX, and real VS Code smoke evidence listed in Issue #3; exact package/lock,
Node/VS Code, adapter HEAD, and emulator commit capture; and a fresh
`EMU-BLK-001`–`EMU-BLK-010` evidence map against the real default/runtime.

**Expected completion signal:** all three responsibility passes independently
reviewed with no blocking finding; complete verification PASS against both the
fake and accepted real runtime; all ACs pass; the implementation PR remains
open and unmerged. Without the real gate, disposition is `NOT_READY`.

### Worker and review sequence

1. Worker A — package/extension/DAP foundation; independent
   `RVW-001-002-001`.
2. Worker B — strict emulator protocol client and contract-faithful fake;
   independent `RVW-001-002-002`.
3. Worker C — stop epochs, registers, disassembly, breakpoints, bounded
   continue/pause, and exact step; independent `RVW-001-002-003`.
4. Fresh verifier — `VER-001-002-001`, including real-emulator and VS Code
   integration gates.

Each worker must keep changes within this single active Slice-1 contract,
produce a reviewable commit, run focused checks, and hand off exact evidence.
Review findings are recorded before the next responsibility pass begins.

### Activation evidence

- Branch: `codex/dap-first-slice`, based on accepted PR #2 HEAD
  `ede8226f23c21a13c44b0da99fe63be9ac1ea1c4` (whose independently reviewed
  content baseline is `cfe1871b180f7f93dc9cb9f47656ef1816b173d4`).
- Revalidated `emuSA80535-N/master`:
  `c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`.
- At activation, the real default contains the Stage-1 timer merge but no
  headless `emu-debug` server PR/issue evidence; real integration remains
  blocked and cannot be inferred from the core seams.

### Worker A result

**Implementation commit:** `a30129bfcbd17c8fd0e57696700ff9f2440bb639`

Worker A added the repository-root manifest/lockfile, pinned TypeScript/lint/test
tooling, VS Code debugger contribution and launch schema/setting, external
adapter-process descriptor, DAP lifecycle skeleton, VSIX allowlist/packaging,
Linux CI foundation, README usage, and six focused foundation tests. Launch
fails explicitly with `EMU_INTEGRATION_PENDING` rather than claiming an
emulator integration that belongs to Worker B.

Worker evidence passed `npm ci`, lint, build/test (6/6), VSIX package and
contents policy, and local VSIX installation in VS Code 1.134.0 on Windows.
The generated package contained no emulator binary; its worker-stage SHA-256
was `92F8EC943F48E7F7A6F3B378EF9DA04AAD525E10E96310A806CD4386B6DDE04B`.
Linux CI has been authored but not yet run remotely, and `actionlint` was not
available locally. These remain review/verification items.

The product slice remains in progress. `RVW-001-002-001` must independently
review this exact commit before Worker B starts.

### Worker A review `RVW-001-002-001`

**Reviewed commit:** `a30129bfcbd17c8fd0e57696700ff9f2440bb639`

**Review commit:** `bd1b8b7bac41c9cba71bb5d099ba21ca2fc024cd`

**Disposition:** **changes-required**

The fresh reviewer reproduced the worker checks and package/install boundary,
then raised three persistent findings:

- `CR-009` (blocking/high): an asynchronous launch can complete after
  disconnect, emit `initialized` after `terminated`, and later succeed both
  `configurationDone` and the stale launch request; cleanup rejection is also
  swallowed.
- `CR-010` (medium): raw DAP launch validation accepts wrong JSON types for
  `stopOnEntry` and `emulatorPath`.
- `CR-011` (low): README incorrectly says Worker B/C integration already
  exists.

Worker B remains paused. A fresh corrective worker must fix only these findings
and add adversarial regression tests. A separate fresh reviewer performs
`RVW-001-002-004` before forward work resumes.

### Worker A corrective result

**Corrective commit:** `a01c48c917186a98152d849565660081ff11746e`

The fresh corrective worker addressed `CR-009`–`CR-011` without adding Worker
B/C scope. The session now has monotonic lifecycle, launch/termination
generations, post-await ownership guards, exactly-once pending-launch settling,
configuration invalidation, duplicate/post-terminal request rejection,
coalesced cleanup, and structured cleanup-failure reporting. Launch validation
now rejects wrong runtime JSON types, and README states the real current limit.

Worker evidence passed lint, build, 18/18 tests, VSIX package/content policy,
and diff whitespace checks. The worker-stage VSIX SHA-256 was
`8F0B006416483CABFFEB5E4BBB284D9BA952D6D6E509E58A18EE78094B17FEA7`.
`CR-009`–`CR-011` remain in progress until independent
`RVW-001-002-004` accepts the exact corrective commit.

### Corrective re-review `RVW-001-002-004`

**Reviewed commit:** `a01c48c917186a98152d849565660081ff11746e`

**Review commit:** `6d4d09f89539d21f955e0b81445fe0132906960d`

**Disposition:** **accepted; no blocking Worker A finding remains**

The second fresh reviewer independently reproduced the original late-resolve
and late-reject defect on `a30129b`, then proved monotonic termination,
exactly-one launch settlement/termination, duplicate and post-terminal request
rejection, cleanup-failure disposition, strict raw JSON types with an untouched
backend, and truthful README on `a01c48c`. Lint/build, 18/18 tests, package,
contents, isolated VSIX install, and safety/scope scans passed. `CR-009`–
`CR-011` are resolved. Worker B may begin; complete Slice 1 remains in progress.

### Worker B result

**Implementation commit:** `33a83a5a62b3be827fac6ea052517cb588d899e2`

Worker B added the strict serialized bounded UTF-8 NDJSON client, hello-first
version/capability/limit validation, request correlation, timeout/fatal
cleanup, no-shell executable/PATH resolution, exact image/hash launch
orchestration, entry-stop session backend, typed command surface for Worker C,
contract-faithful fake server, and reproducible generic 65,536-byte fixture.
Fault scripting remains outside the product protocol, and no Worker C DAP
capability/handler was added.

Worker evidence passed lint/build, 41/41 full tests, 23/23 contract tests,
fixture check, package/content policy, and diff whitespace. Fixture SHA-256 is
`1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88`;
worker-stage VSIX SHA-256 is
`536fe3e8acce8d8e7fbbf0bbcc2121a9707d873a2b84aad350ff44dc20aed5b7`.
The real-emulator gate remains unproven. `RVW-001-002-002` now reviews this
exact commit before Worker C begins.

### Worker B review `RVW-001-002-002`

**Reviewed commit:** `33a83a5a62b3be827fac6ea052517cb588d899e2`

**Review commit:** `34f30b6401db17265ddede1f9e3adf9d6edb6bb1`

**Disposition:** **changes-required**

The fresh reviewer reproduced three material gaps despite the green worker
suite:

- `CR-012` (blocking/high): the client accepts invalid command-specific
  semantics, including unordered/incorrect `decodeCode`, forbidden
  `run.reason=entry`, unadvertised snapshot variants, and insufficiently bound
  breakpoint replacement results.
- `CR-013` (blocking/high): the fake accepts unknown required capabilities and
  reused request IDs, and can emit a response larger than its advertised
  `maxRecordBytes`.
- `CR-014` (medium): Windows resolution selects `.CMD`/`.BAT`, but mandatory
  `shell:false` spawn fails them with `EINVAL`.

Worker C remains paused. A fresh corrective worker addresses only these
findings, followed by independent `RVW-001-002-005`.

### Worker B corrective result

**Corrective commit:** `6000ec8235ee8f568db80c4d6fe02f84d1982045`

The fresh corrective worker tightened command-specific client validation,
strict fake required-capability/request-ID/outbound-record behavior, and
shell-free directly spawnable Windows resolution. It changed only the client,
fake server, and contract tests and added adversarial coverage for every
`CR-012`–`CR-014` reproduction.

Worker evidence passed clean install, lint/build, 60/60 full tests, 42/42
contract tests, fixture check, package/content/safety policy, process cleanup,
and diff whitespace. Worker-stage VSIX SHA-256 is
`58F3679C554D7457485B75BBFA33647BDD657B46C84FF17184C66359FC0983B0`.
The findings remain in progress pending fresh `RVW-001-002-005`.

### Worker B corrective re-review `RVW-001-002-005`

**Reviewed commit:** `6000ec8235ee8f568db80c4d6fe02f84d1982045`

**Review commit:** `2610bf783b27fe3302bd097f7a02961c18096ace`

**Disposition:** **changes-required**

The fresh reviewer accepted `CR-013` and `CR-014` as resolved and confirmed
the original `CR-012` hostile classes now fail and reap the child. Two residual
gaps keep Worker C paused:

- `CR-015` (blocking/high): with a negative instruction offset whose magnitude
  exceeds the returned count, the client can accept a decode window that has
  already reached/crossed the base reference too early.
- `CR-016` (medium): a valid server-advertised breakpoint limit above the
  client's undisclosed local hard cap is rejected when echoed by the response.

`CR-012` remains partial until `CR-015` is resolved. A fresh narrow correction
and `RVW-001-002-006` are required.
