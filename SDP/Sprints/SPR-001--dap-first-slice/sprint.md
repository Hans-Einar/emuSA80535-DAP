# SPR-001 — DAP first implementation slice

## Status

- Product implementation sprint: **active under Issue #3**
- Reviewed foundation iteration: `IT-001-000` — historical rework required
- Corrective documentation iteration: `IT-001-001` — closed
- Accepted DAP-semantics correction: `SL-001-001-001` — verification blocked by dependency drift
- Factual-baseline correction: `SL-001-001-002` — verified
- Documentation gate: **READY-FOR-SLICE-1** (`VER-001-001-002`)
- Steering/Master authority: [GitHub Issue #3](https://github.com/Hans-Einar/emuSA80535-DAP/issues/3)
- Active iteration/slice: `IT-001-002` / `SL-001-002-001`
- Real-emulator gate: **required before READY**; current revalidated emulator
  default is `c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`, which does not yet expose
  the frozen headless `emu-debug` 1.0 process contract.

Issue #1 defines and verifies the contract only. It must stop at
`READY-FOR-SLICE-1`; no item below is an implementation-status claim.

## Documentation readiness contract (`SL-001-000-001`)

### Goal

Produce an evidence-backed, independently reviewed SDP baseline that lets a
fresh future worker execute the candidate product slice without inventing DAP,
transport, packaging, or emulator API assumptions.

### Expected documentation changes

- `README.md`
- `protocol/EMU_DEBUG_API_REQUIREMENTS.md`
- `SDP/01--Mandate` through `SDP/05--Design`
- this sprint's planning, notes, iterations, and handoff
- independent review and verification reports
- `SDP/Traceability/CurrentIndex.yaml`, `Relations.yaml`, and `Ledger.ndjson`

### Invariants

- At the original 2026-08-31 evidence cut, emulator default `master` at
  `5dc6812` was correctly distinguished from then-open PR #1 at `62f4012`.
- The refreshed current baseline is `master` at `a20815e`; merged core seams
  are classified separately from the still-missing headless process contract.
- Public DAP, VS Code, package, and VSIX claims cite authoritative sources.
- Cross-repository needs use a stable headless contract, not private C structs.
- DAP stdio and emulator NDJSON use different pipes and framing.
- The contract contains no P1000 semantics and performs no physical host I/O.
- Only documentation and document-supporting metadata change in Issue #1.

### Non-goals

- Any production/test implementation, manifest, dependency/build configuration,
  emulator change, Issue, or non-documentation artifact.
- Starting this candidate product sprint.
- Self-approving the authored package without fresh review/verification.

### Traceability

`M-001`, `S-001`, `UC-001`, `R-001`–`R-031`, `A-001`–`A-008`,
`D-001`–`D-010`, `SPR-001`, `IT-001-000`, `SL-001-000-001`,
`RVW-001-000-001`, `IT-001-001`, `SL-001-001-001`,
`RVW-001-001-001`, `VER-001-001-001`, `CR-008`, `SL-001-001-002`,
`RVW-001-001-002`, `VER-001-001-002`, `IT-001-002`, and `SL-001-002-001`.

### Completion signal

Review and verification reports accept the documentation-only package, the PR
is open, and traceability records `READY-FOR-SLICE-1` while `SPR-001` remains
planned/not started.

## Candidate product Slice 1

**Planned iteration:** `IT-001-002`

**Planned slice:** `SL-001-002-001`

**State:** active; fake-backed implementation authorized, real-emulator final
acceptance blocked until every required `EMU-BLK-001`–`EMU-BLK-010` item passes

### Goal

From an installed VS Code extension, launch a compatible separate headless
`emuSA80535-N` with a synthetic exactly 64-KiB raw CODE image; stop
deterministically at entry; expose one MCU thread, one current-PC frame, and
basic registers; show minimal address-level disassembly; replace a one-entry
instruction-breakpoint set; continue/pause; and execute instruction-granularity
`stepIn`.

### Exact scope

1. A Node.js/TypeScript external adapter, using pinned/current scoped
   `@vscode/debugadapter` and `@vscode/debugprotocol`, runs on DAP stdio.
2. A minimal VS Code debugger contribution launches that adapter.
3. The adapter resolves a separately installed emulator via explicit
   `emulatorPath`, workspace setting, then `PATH`.
4. It spawns one headless emulator child and completes `emu-debug` 1.0 hello,
   image load/hash, deterministic reset, and entry stop.
5. DAP lifecycle covers initialize (once), launch, initialized/configuration,
   configurationDone, disconnect, and termination.
6. DAP capabilities include configurationDone, instruction breakpoints,
   disassemble, and stepping granularity. Omitted/`statement`/`instruction`
   `stepIn` each mean one instruction; `line` fails without resume.
7. One logical thread, one current frame with `code:HHHH`
   `instructionPointerReference`, one read-only Registers scope, and variables
   PC/A/B/PSW/SP/DPTR/R0–R7 derive from one stopped snapshot.
8. `disassemble` takes an opaque `code:HHHH` reference and returns exactly the
   requested instruction count with numeric `0xHHHH` addresses. Negative
   offsets use known predecessors or explicit invalid one-byte placeholders,
   never guessed authoritative boundaries.
9. `setInstructionBreakpoints` accepts the numeric address returned by
   disassembly, applies its signed offset once, canonicalizes the target, and
   globally replaces the set. The protocol negotiates `maxBreakpoints >= 1`;
   acceptance exercises exactly one. A child `breakpoint` stop maps to DAP
   reason `instruction breakpoint`.
10. Continue uses synchronous bounded emulator run chunks. At every yield the
    child is idle at a boundary while the adapter remains logically running.
    Adapter-local pause is acknowledged first, waits for the active chunk or
    uses the latest yield, schedules no next chunk, and emits a pause stop.
11. `stepIn` executes exactly one architectural instruction under the accepted
    granularities. Because no DAP capability flags exist for `next`/`stepOut`,
    their handlers fail `notSupported` without a child command or state change.
12. Errors, logs, handle epochs, child cleanup, Linux/Windows process behavior,
    and `.vsix` packaging follow the frozen design.

### Explicit non-scope

- Source `setBreakpoints`, `breakpointLocations`, source mapping, rich/symbolic
  disassembly, or symbol ingestion in the accepted path;
- call-aware `next`, `stepOut`, caller history, IRQ frames, or stack recovery;
- DAP `readMemory` UI, IRAM/SFR/XDATA views, evaluate, exceptionInfo, writes,
  register modification, data breakpoints, or watchpoints;
- attach, TCP/socket transport, remote debugging, emulator bundling,
  auto-download, or Marketplace publication;
- Intel HEX or non-64-KiB fixture formats;
- P1000 fixtures/semantics or any physical serial/GPIO/machine integration.

## Acceptance criteria

| AC | Given / when / then |
|---|---|
| `AC-001` | Given the packaged extension and compatible fake/real contract server, when F5 launches the synthetic fixture, then hello precedes load/reset and VS Code stops at configured entry with reason `entry`. |
| `AC-002` | While stopped, `threads -> stackTrace -> scopes -> variables` yields one thread, one valid required-field current frame, and the exact basic-register snapshot. |
| `AC-003` | A disassemble request returns exactly N ordered records with numeric `0xHHHH` addresses. Forward and known-predecessor records contain emulator decoder output; unknown predecessors are clearly invalid one-byte placeholders. Range crossing fails without wrap/partial output, and the chosen `engines.vscode` build displays the result. |
| `AC-004` | Setting one instruction breakpoint from VS Code's disassembly UI sends the returned numeric address back through `instructionReference`; a tested non-zero offset is applied once and canonicalized, overflow is rejected, the valid target globally replaces the child table, and its hit emits DAP reason `instruction breakpoint` before that instruction executes. |
| `AC-005` | `stepIn` from stop with omitted, `statement`, or `instruction` granularity advances exactly one completed instruction and emits one `step` stop; `line`, `next`, and `stepOut` fail `notSupported` without resume. |
| `AC-006` | Pause requested during continue is acknowledged before its event, waits no more than the current negotiated chunk (or uses the latest idle yield boundary), schedules no new chunk, and emits one `pause` stop; timeout/disconnect never promotes an unproven snapshot. |
| `AC-007` | Frame/scope/variable handles from one stop fail after resume and new handles reflect the next stop epoch. |
| `AC-008` | Missing executable, version/capability mismatch, malformed record, timeout, and child crash each produce a failed DAP response or terminal event as designed, actionable diagnostics, and no orphan. |
| `AC-009` | Disconnect terminates/reaps the launch-owned child, closes pipes, and emits `terminated` exactly once. |
| `AC-010` | Linux and Windows lanes build/test/package, inspect the VSIX contents, install it, and smoke the launch path; emulator binary is absent from the archive. |
| `AC-011` | Tests require no hardware and prove no serial/GPIO/bus endpoint is opened; inspection finds no P1000 semantic in product defaults, protocol messages/schema, or fixture (references that explicitly prohibit such coupling are allowed). |

## Emulator API dependencies

Every blocker `EMU-BLK-001` through `EMU-BLK-010` in
`protocol/EMU_DEBUG_API_REQUIREMENTS.md` is a hard precondition. Specifically,
the accepted emulator default/release must supply the headless NDJSON server,
protocol 1.0 hello, exact raw loader, deterministic reset, atomic snapshot,
required exact-count `decodeCode` behavior, replacement breakpoints, bounded
run, exact step, and clean lifecycle. Raw CODE read is near-term, not a Slice-1
blocker. Current default `a20815e` satisfies the core beneath `EMU-BLK-004` and
partially supplies the core beneath `EMU-BLK-006`–`009`; the missing wire,
snapshot, scheduling, replacement-table, and process-lifecycle parts remain hard
preconditions. Newly merged IRQ support does not expand this candidate slice.

## Test fixtures

- `synthetic-loop.bin`: exactly 65,536 bytes, minimal reviewed SAB80535
  instructions at known addresses, deterministic entry and one reachable
  breakpoint; remaining bytes use a documented neutral fill.
- Scripted fake-emulator scenarios: compatible hello, major mismatch, missing
  capability, exact snapshots, breakpoint stop, pause after a maximal chunk,
  malformed JSON, timeout, and crash.
- No fixture contains P1000 firmware or depends on physical hardware.

Fixture bytes and fake code are future Slice-1 implementation outputs, not
artifacts created by Issue #1.

## Expected commands (future)

Exact package scripts are frozen during Slice-1 planning, but acceptance must
provide equivalents of:

```text
npm ci
npm run lint
npm run build
npm test
npm run test:integration
npm run package
npx @vscode/vsce package
```

`package` must run the extension prepublish bundle. CI must validate the
manifest/schema, inspect VSIX contents, install the VSIX into supported VS Code
on Linux and Windows, run extension/DAP/disassembly smoke tests, and run the
emulator contract suite against the accepted binary.

## Review gate

Before product implementation begins:

1. Issue #1's independent review has no unresolved blocking finding.
2. Verification proves deliverable presence, link/example syntax, traceability,
   documentation-only diff, and cross-document consistency.
3. Steering approves the open decisions in `Handoff.md`.
4. A compatible implementation of the frozen emulator protocol is accepted on
   the emulator default/release and identified by version/commit.
5. Master explicitly opens a new implementation iteration/slice; readiness or
   PR merge alone does not start `SPR-001`.

Issue #3 and `SteeringActivation.md` satisfy item 5 and explicitly permit
contract-faithful fake-backed implementation while the real emulator is
completed. They do not satisfy the final real-emulator integration gate.
