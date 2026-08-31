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
