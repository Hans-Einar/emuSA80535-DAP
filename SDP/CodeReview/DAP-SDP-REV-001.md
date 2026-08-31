# DAP-SDP-REV-001 — Independent SDP foundation review

**Review ID:** `RVW-001-000-001`

**Reviewed commit:** `ab231769fb78bcb44a11ecdc5791d1f69b66ea3c`

**Branch:** `codex/dap-sdp-foundation`

**Authority:** [GitHub Issue #1](https://github.com/Hans-Einar/emuSA80535-DAP/issues/1)

**Disposition:** **changes-required**

**Product implementation:** not started

## Scope and independence

This is a fresh review of the exact worker commit above against Issue #1 and
the seeded `SL-001-000-001` contract. The reviewer did not author or repair the
mandate, study, requirements, architecture, design, protocol contract, sprint,
or README. The review independently inspected the current emulator default and
open candidate PR, the published DAP schema, the VS Code-facing flow, the
documentation-only diff, examples, and traceability.

## Blocking findings

### `CR-001` — Instruction-breakpoint stopped reason is mapped incorrectly

**Evidence:** `DAP-ARCH-001.md` lines 95 and 105 map a CODE instruction
breakpoint to DAP `stopped(reason="breakpoint")`. The DAP
`setInstructionBreakpoints` contract says a hit generates reason
`instruction breakpoint`; both strings exist as distinct standard reasons in
the [released DAP schema](https://github.com/microsoft/debug-adapter-protocol/blob/bf8a5d27e8040044b84b863f90916e08925ee811/debugAdapterProtocol.json).

**Required correction:** Keep any emulator-internal stop code separate, but
freeze the adapter mapping as DAP reason `instruction breakpoint`, and align
architecture, requirements, design, acceptance, and tests.

### `CR-002` — Memory references and disassembly addresses are conflated

**Evidence:** `R-004`, the study, and `AC-003` require `code:HHHH` for every
returned instruction address. DAP permits an opaque `memoryReference` such as
`code:0010`, but `DisassembledInstruction.address` is defined as a decimal
string or a `0x`-prefixed hexadecimal string. `code:0010` is neither. This gap
directly threatens the real VS Code disassembly-to-instruction-breakpoint flow
that Slice 1 claims to accept.

**Required correction:** Define separate wire forms: an opaque canonical
memory/instruction reference where DAP permits it, and a DAP-compliant numeric
`DisassembledInstruction.address` (for example `0x0010`). Specify what VS Code
returns in `InstructionBreakpoint.instructionReference`, how offsets are
applied, and test the round trip in the chosen VS Code engine floor.

### `CR-003` — Advertised stepping-granularity semantics are incomplete

**Evidence:** `D-005` advertises `supportsSteppingGranularity`, while the design
only says every `stepIn` executes one instruction. In DAP, omitted granularity
means `statement`; clients may also send `line` or `instruction`. The contract
does not say which values are accepted, rejected, or mapped, so the advertised
capability promises more than the design freezes.

**Required correction:** Either omit the capability and document the adapter's
default step semantics, or explicitly define and test all accepted granularity
values. The practical VS Code disassembly instruction-step request must be one
of the tested paths.

### `CR-004` — Backward disassembly is called authoritative without a defensible rule

**Evidence:** `D-005` delegates signed negative `instructionOffset` traversal
to `decodeCode`, and `AC-003` requires authoritative forward and backward
records. SAB80535 instructions are variable length; a raw image has no inherent
predecessor-instruction boundary, may contain data, and the inspected default
emulator only decodes at a supplied address. The new contract does not define
how ambiguity is resolved or represented.

**Required correction:** Freeze a deterministic, honest rule for negative
instruction offsets, including ambiguous predecessors and invalid filler as
required by DAP's exact-count response. Do not call heuristic/raw-image
predecessors authoritative. The rule and boundary cases must be emulator
contract tests and real VS Code acceptance evidence.

### `CR-005` — A deferred CODE-read surface is accidentally a Slice-1 blocker

**Evidence:** The study places DAP `readMemory` near-term, and Slice 1 delegates
disassembly to `decodeCode`; no Slice-1 acceptance criterion consumes raw CODE
bytes. Nevertheless `readCode` is a required hello capability, child
`readMemory` is in the minimum command set, `EMU-BLK-006` requires it, and the
sprint makes that blocker a hard precondition.

**Required correction:** Remove the unused raw CODE-read capability/command
from the frozen minimum and defer it, or identify a concrete Slice-1 consumer
and acceptance test that makes it necessary. The minimum cross-repository
contract must remain genuinely minimum.

### `CR-006` — Child state across `run` yields is undefined

**Evidence:** The protocol defines server states including `stopped` and
`running`, returns a boundary snapshot on `yield`, keeps the DAP state running,
and converts a yield to a pause stop without sending a child pause command. It
never defines the child state after a yield or the legal transition used by the
next `run`, pause completion, stopped-state reads, or `stepInstruction`.

**Required correction:** Define child-state and adapter-state transitions
separately for request start, yield, next chunk, pause intent, architectural
stop, timeout, and disconnect. State/snapshot validity must be testable and
must not imply that the child is executing between synchronous requests.

### `CR-007` — The handshake example is not valid JSON under its fence

**Evidence:** Independent parsing found six `json` fences and exactly one
failure: `DAP-DES-001.md` lines 103–106 contain two consecutive NDJSON records
inside one `json` fence. `JSON.parse` fails at line 2 with trailing content.
The records are individually valid NDJSON.

**Required correction:** Split the records into separate `json` fences or mark
the example as `jsonl`/`ndjson`, then make both JSON-fence and per-record NDJSON
checks pass.

## Challenged areas without additional findings

- **Runtime and transport:** A separate TypeScript adapter and launch-owned
  child add processes but are justified by the maintained Node DAP library,
  crash isolation, absence of a stable merged emulator ABI, and avoidance of a
  per-platform Node native addon. TCP/attach and bundling remain deferred.
- **DAP lifecycle:** initialize/launch/initialized/configurationDone ordering,
  replace-all instruction breakpoints, response-only normal continue, one
  thread, stop-epoch handle invalidation, pause response before stopped event,
  and launch-owned disconnect/one terminated event are otherwise coherent.
- **8051 stack:** Slice 1 truthfully exposes only a current-PC frame. Later
  logical frames use observed call/return/IRQ/RETI events, preserve nested IRQ
  order, clear on reset, and degrade on mismatches instead of scanning RAM as a
  C ABI stack.
- **Emulator boundary:** No private pointer/struct layout is serialized. All
  required server seams are explicit cross-repository blockers.
- **Current versus candidate emulator:** GitHub and local object inspection
  independently confirmed default `master` at `5dc681275151c4a5d7b85ec9ff4ceb1b25abd5a8`
  and open PR #1 at `62f40127e1aa3b24e9d8d54c2458e847bfe86488`.
  Candidate-only functions are not claimed as current.
- **Firmware neutrality and safety:** P1000 appears only in prohibitions; no
  P1000 fixture/semantic or physical host-I/O path was introduced.
- **Slice thinness:** Source mapping, logical stacks, watchpoints, writes,
  attach, bundling, and Marketplace publication are genuinely deferred. The
  extra raw CODE-read blocker is the exception captured by `CR-005`.
- **Packaging/versioning:** The separate emulator install, executable lookup,
  semantic VSIX, archive inspection, and Linux/Windows package/smoke lanes form
  a credible path. Publisher/identifier, package root, engine/Node floor,
  emulator release ownership, and CI runner matrix correctly remain explicit
  Steering decisions.

## Independent mechanical evidence

- Diff `origin/main..ab231769...` contains Markdown, YAML, NDJSON, README, and
  placeholder deletion only; no product/test source, manifest, dependency, or
  fixture was added.
- All authored pre-review required files exist and are substantive.
- YAML parsing passed for `CurrentIndex.yaml` and `Relations.yaml`; all three
  existing ledger lines parsed independently as JSON; the recorded timestamp
  parsed as ISO-8601.
- JSON-fence parsing: 5 passed, 1 failed as `CR-007` records.
- Mermaid inventory: eight blocks (seven architecture, one design); fence
  balance and visual syntax inspection passed. Rendering remains verifier work.
- Emulator source permalinks for `emu8051.h`, `core.c`, `emu.c`, and
  `binary_loader.c` resolved at their cited commits. Default-branch and PR-head
  SHAs were checked through GitHub.
- The traceability seed has unique item IDs and resolvable relation endpoints.
  `RVW-001-000-001` and these persistent findings are added by this review;
  verification remains deliberately pending.

## Re-review gate

`SL-001-000-001` is not ready for independent verification or
`READY-FOR-SLICE-1`. A fresh corrective documentation worker must resolve
`CR-001` through `CR-007` without product implementation. A separate reviewer
must then confirm the exact DAP/schema and state-machine corrections before the
verifier runs.
