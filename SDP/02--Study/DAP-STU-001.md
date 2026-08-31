# DAP-STU-001 — DAP, VS Code, and emulator integration study

**Traceability:** `S-001` supports `M-001` and `UC-001`
**Evidence cut:** 2026-08-31
**State labels:** **current-default** means merged `emuSA80535-N/master`;
**candidate/unmerged** means open emulator PR #1; **target** means this
repository's proposed design.

## Executive recommendation

Use a separate Node.js/TypeScript debug-adapter process launched by VS Code,
with DAP over the adapter's stdin/stdout. Use the current scoped
`@vscode/debugadapter` and `@vscode/debugprotocol` packages. The adapter launches
a separate headless `emuSA80535-N` child and controls it through versioned
newline-delimited JSON (NDJSON) over a second, private stdin/stdout pair. DAP
framing and emulator-control framing are distinct protocols on distinct pipes.

Ship launch support first and defer attach. Do not bundle the emulator initially.
Resolve it in this order: explicit launch `emulatorPath`, workspace setting,
then `PATH`. Slice 1 uses a raw, exactly 64-KiB CODE image and address-level
debugging with one logical thread and one current-PC frame.

## Evidence

### Public primary sources

- [DAP specification 1.71](https://microsoft.github.io/debug-adapter-protocol/specification)
  defines requests, events, capabilities, memory references, and error bodies.
- [DAP overview](https://microsoft.github.io/debug-adapter-protocol/overview)
  documents initialized/configuration ordering and the
  `threads -> stackTrace -> scopes -> variables` request waterfall.
- [Released DAP schema](https://github.com/microsoft/debug-adapter-protocol/blob/main/debugAdapterProtocol.json)
  is the authoritative machine-readable protocol model.
- [VS Code debugger extension guide](https://code.visualstudio.com/api/extension-guides/debugger-extension)
  documents debugger contributions and external, server, and inline adapter
  descriptors; an external executable communicates on stdin/stdout.
- [VS Code publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
  documents `@vscode/vsce`, `.vsix` packaging, publisher setup, and Marketplace
  publication.
- [Microsoft Node DAP repository](https://github.com/microsoft/vscode-debugadapter-node)
  and the [`@vscode/debugadapter` package](https://www.npmjs.com/package/%40vscode/debugadapter)
  establish the maintained Node implementation path and scoped package.

### Emulator repositories and revisions

- **current-default:** `Hans-Einar/emuSA80535-N`, `master`,
  [`5dc681275151c4a5d7b85ec9ff4ceb1b25abd5a8`](https://github.com/Hans-Einar/emuSA80535-N/tree/5dc681275151c4a5d7b85ec9ff4ceb1b25abd5a8).
- **candidate/unmerged:** open
  [emulator PR #1](https://github.com/Hans-Einar/emuSA80535-N/pull/1), branch
  `codex/sab80535-foundation`,
  [`62f40127e1aa3b24e9d8d54c2458e847bfe86488`](https://github.com/Hans-Einar/emuSA80535-N/tree/62f40127e1aa3b24e9d8d54c2458e847bfe86488).

The default branch remains `master` at `5dc6812`; therefore no API introduced
only in `62f4012` is treated as currently available.

## DAP capability decision

| DAP surface | Phase | Decision |
|---|---|---|
| `initialize`, `launch`, `configurationDone` | Slice 1 | Required session handshake; advertise only implemented capabilities. |
| `threads` | Slice 1 | Return one stable logical MCU execution thread. |
| `stackTrace` | Slice 1 | Return at least one current-PC frame with `instructionPointerReference`. |
| `scopes`, `variables` | Slice 1 | Expose a read-only basic-register scope including PC, A, B, PSW, SP, DPTR and R0-R7. |
| `setInstructionBreakpoints` | Slice 1 | CODE-address breakpoints; initially one, or a documented small protocol limit. |
| `disassemble` | Slice 1 | Minimal CODE disassembly around an opaque `code:` memory reference; each returned instruction has a DAP-numeric `0xHHHH` address so VS Code can originate instruction breakpoints from its disassembly view. |
| `continue`, `pause`, `stepIn` | Slice 1 | Continue executes bounded chunks so pause is serviced predictably. `stepIn` accepts omitted, `statement`, or `instruction` granularity as exactly one instruction and rejects `line` without resuming. |
| `stopped`, `terminated` | Slice 1 | Deterministic state events with reason and current PC; a normal client-requested continue uses its response, not an unsolicited `continued` event. |
| `disconnect`, optional `terminate` | Slice 1 | Clean child shutdown; advertise terminate only if implemented. |
| `setBreakpoints`, `breakpointLocations` | Near-term | Source-line breakpoints after generic source maps exist; a source request replaces the complete set for that source. |
| richer `disassemble`, `readMemory` | Near-term | Named/sourced disassembly and CODE/IRAM/SFR/XDATA memory views. |
| `next`, `stepOut` | Near-term | Require defensible logical-frame semantics, not guessed hardware-stack reconstruction. DAP has no capability flags for these requests, so Slice 1 implements handlers that fail `notSupported` without resuming. |
| `evaluate` | Near-term | Read-only register/symbol/address expressions; mutation is not implied. |
| interrupt frames/state, `exceptionInfo` | Near-term | Requires explicit emulator events/state. |
| attach | Near-term | Local socket transport only after launch protocol is stable. |
| `writeMemory`, register/set-variable mutation | Deferred | Explicit opt-in and safety review required. |
| data breakpoints/watchpoints | Deferred | Requires emulator access instrumentation. |
| deep logical stack history | Deferred | Requires call/return/IRQ/RETI observations and corruption handling. |

`supportsSteppingGranularity` is advertised because Slice 1 defines the full
`stepIn` behavior needed at this boundary: omitted granularity (DAP default
`statement`), explicit `statement`, and explicit `instruction` each execute one
architectural instruction; `line` fails as unsupported while the adapter stays
stopped. DAP defines no `next` or `stepOut` capability flags, so those requests
cannot be hidden by omitting a flag. Slice 1 deliberately handles both with a
failed `notSupported` response and no resume or state change.

### Instruction versus source breakpoints

An instruction breakpoint is keyed by a DAP `instructionReference` plus optional
signed byte offset and maps directly to a 16-bit CODE address. The adapter
accepts its opaque `code:HHHH` form and the DAP-numeric address forms it emits
from disassembly (`0xHHHH`) or their unsigned decimal equivalent. It parses the
base, applies the offset exactly once, rejects overflow/underflow, and
canonicalizes the resulting internal address to `code:HHHH`. A source
breakpoint is keyed by source path/line and is meaningful only after the
adapter resolves a generic source map. The first is Slice 1; the second is
near-term. The adapter must return actual verified/unverified breakpoints
rather than pretending a line mapping exists.

Minimal `disassemble` is a Slice-1 dependency because the practical VS Code
instruction-breakpoint UI is its disassembly view. The request and current
frame use opaque `code:HHHH` values in `memoryReference` and
`instructionPointerReference`. Each `DisassembledInstruction.address` instead
uses the DAP numeric form `0xHHHH`. Slice-1 acceptance must prove that the
chosen VS Code engine sends that returned numeric address back as the
instruction breakpoint reference and that the adapter's offset and
canonicalization rules select the same CODE byte address.

### Single-core thread and state model

DAP does not require an MCU peripheral or interrupt to be represented as a
thread. One stable thread (`id = 1`, name `SAB80535`) represents the only
instruction stream. On stop, VS Code can follow the standard DAP chain:

`threads -> stackTrace(thread 1) -> scopes(current frame) -> variables(registers)`.

Slice 1 has one truthful frame: the current execution location. Interrupt
activity is later shown as frame metadata/scopes on the same thread, never as
fake concurrent threads.

### Memory spaces

CODE, IRAM, SFR, and XDATA are separate address spaces even where numeric
addresses overlap. Canonical opaque references are `code:HHHH`, `iram:HH`,
`sfr:HH`, and `xdata:HHHH`. Slice 1 consumes CODE through emulator-owned
`decodeCode` and execution; it does not require a raw CODE-read command.
Near-term DAP `readMemory` and scopes use these identifiers and will require
side-effect-free reads that do not invoke device callbacks or change emulated
state.

### Source and symbol mapping

A firmware-generic JSON document maps a 16-bit CODE address to an optional
symbol and optional file/line/column. Producers may convert assembler listings,
linker maps, or other firmware-specific artifacts into it. Files are workspace
paths or URIs with an optional checksum. The format contains an architecture
identifier and image checksum so stale maps are rejected. P1000 is merely a
possible producer and contributes no built-in names or semantics.

When no map is supplied, the adapter remains fully address/disassembly based.
When supplied later, the adapter resolves CODE address to nearest exact symbol
and source row without changing the emulator protocol.

## VS Code architecture comparison

| Layout | Benefits | Costs/risks | Decision |
|---|---|---|---|
| Inline adapter in extension host | Few processes; simple debugging | A hung emulator client can affect the extension host; lifecycle and logs are coupled | Reject for first release |
| Separate Node/TypeScript adapter | Official library, shared language with extension, process isolation, portable VSIX | Node dependency and another process | **Select** |
| Separate native/other-runtime adapter | Could share C or use another ecosystem | Packaging per platform, more FFI/build surface, weaker reuse with extension | Reject initially |

For VS Code-to-adapter transport, stdio is the default external-executable
model, gives VS Code lifecycle ownership, requires no port allocation, and
works on Linux and Windows. TCP/server mode adds discovery, authentication,
cleanup, and port-collision concerns without benefiting local launch, so it is
reserved for adapter development or a future remote requirement.

### Implementation library comparison

| Choice | Assessment |
|---|---|
| `@vscode/debugadapter` + `@vscode/debugprotocol` | Selected: maintained Microsoft Node implementation, TypeScript protocol declarations, framing/session helpers, test-support ecosystem. |
| Raw TypeScript DAP implementation | Rejected: reimplements framing, sequencing, errors, and capability semantics. |
| Native C/C++ or another runtime library | Viable if a future platform constraint demands it, but adds cross-platform packaging and does not remove the need for a stable emulator boundary. |

The package versions will be pinned by lockfile during Slice 1; this document
does not invent a future version number.

## Actual emulator capability inspection

| Need | current-default `5dc6812` | candidate/unmerged `62f4012` | Classification/action |
|---|---|---|---|
| Reset/load | `reset`, Intel HEX `load_obj`; TUI-owned allocation | deterministic variant/reset seed and exact 64-KiB raw loader added | Partial; raw deterministic launch is unmerged |
| Run/continue | TUI `runmode` loops over `tick` | bounded `em8051_run` added | Missing stable headless service on default |
| Pause | keyboard changes TUI `runmode` | bounded run returns at a limit, but no asynchronous protocol pause | Missing; child must schedule bounded chunks |
| Single instruction | core `tick` is a machine-cycle API; TUI loops depending on option | `em8051_step_instruction` added | Missing on default; candidate unmerged |
| PC | public struct field `mPC` | still a struct field and run-result field | Value exists; stable snapshot API/protocol missing |
| Registers | SFR/IRAM are public struct storage | SFR gateway added, storage remains exposed | Data exists; stable read-only snapshot missing |
| CODE/IRAM/SFR/XDATA read | arrays/pointers exposed in `struct em8051` | SFR gateway and trace improvements only | Stable side-effect-free memory-read API missing |
| Breakpoints | one TUI global `breakpoint` | one core breakpoint added | Default is UI-only; candidate still single/unmerged |
| Instruction hooks | none as a public observer | immutable instruction/SFR/MOVX trace callback | Missing on default; candidate partial and unmerged |
| Call/return hooks | none | no dedicated events | Missing |
| IRQ entry/RETI hooks | internal `mInterruptActive`; RETI implementation | no dedicated events | Missing |
| Determinism | reset can use process `rand`; TUI timing/input | seeded reset, bounded execution/counts added | Missing on default; candidate strong but unmerged |
| Disassembly | public `decode` over current CODE | same | Low-level decode exists, but no headless protocol |
| Symbol/source map | none | none | Adapter responsibility/input format |
| Watchpoints | SFR and XDATA callbacks are functional device seams, not debugger watchpoints | immutable SFR/MOVX trace is partial instrumentation | Missing stable watchpoint contract |
| Writes | direct storage/private-style access is possible | SFR write gateway added | Deferred; unsafe as debugger contract |
| Version query/headless protocol | none | none | Missing Slice-1 blocker |

Source evidence: default
[`emu8051.h`](https://github.com/Hans-Einar/emuSA80535-N/blob/5dc681275151c4a5d7b85ec9ff4ceb1b25abd5a8/emu8051.h),
[`core.c`](https://github.com/Hans-Einar/emuSA80535-N/blob/5dc681275151c4a5d7b85ec9ff4ceb1b25abd5a8/core.c),
and [`emu.c`](https://github.com/Hans-Einar/emuSA80535-N/blob/5dc681275151c4a5d7b85ec9ff4ceb1b25abd5a8/emu.c);
candidate
[`emu8051.h`](https://github.com/Hans-Einar/emuSA80535-N/blob/62f40127e1aa3b24e9d8d54c2458e847bfe86488/emu8051.h),
[`core.c`](https://github.com/Hans-Einar/emuSA80535-N/blob/62f40127e1aa3b24e9d8d54c2458e847bfe86488/core.c),
and
[`binary_loader.c`](https://github.com/Hans-Einar/emuSA80535-N/blob/62f40127e1aa3b24e9d8d54c2458e847bfe86488/binary_loader.c).

The current structs are implementation storage, not an endorsed cross-repo API.
All minimum debug-service capabilities in
`protocol/EMU_DEBUG_API_REQUIREMENTS.md` remain emulator-repository blockers
until merged and verified on its default branch.

## Emulator transport comparison

| Option | Lifecycle/isolation | Compatibility/install | Decision |
|---|---|---|---|
| Link/embed C emulator | Adapter crash domain and ABI are coupled; Node native addon needed | Per-platform native artifacts and ABI/version matching | Reject initially |
| Launch headless child over NDJSON stdio | Adapter owns lifetime; crashes are isolated and diagnosable | Separate install; explicit protocol handshake | **Select for launch** |
| Attach over local socket/TCP | Independent lifecycle and attach | Port/security/discovery/version concerns | Defer |

The adapter spawns the configured executable without a shell, supplies a
headless/control flag, performs a version/capability handshake, loads the raw
image, resets deterministically, and stops at entry before sending DAP
`stopped`. Emulator stderr is diagnostic; emulator stdout is protocol-only.
An EOF, malformed record, timeout, or version mismatch becomes a structured DAP
error and a terminated session.

## Stack and interrupt semantics

8051 hardware RAM contains return addresses but not trustworthy language frames.
Scanning it would mislabel arbitrary bytes and fail after unusual/corrupt stack
behavior. Near-term logical frames therefore require emulator-observed events:

- `LCALL`/`ACALL`: push an observed call frame with call site, target, and
  architectural return PC;
- `RET`: pop only a matching observed call; on mismatch mark the model
  `degraded` and retain the current frame;
- interrupt entry: push an observed interrupt frame with vector, priority, and
  interrupted PC;
- `RETI`: close the matching interrupt frame; nested interrupts remain ordered;
- reset/restart: clear all logical history and create a new current frame;
- corruption, computed/unusual control flow, or missed events: surface frames
  as `observed` or `inferred`, mark confidence/degraded state, and never claim a
  C ABI stack.

Slice 1 does not depend on this model. It returns only the current PC frame.

## Packaging and installation

Target user flow:

1. install a compatible `emuSA80535-N` headless runtime;
2. install the semantically versioned `.vsix` (later Marketplace extension);
3. open a firmware/disassembly workspace;
4. select/create an `emuSA80535` launch configuration;
5. press F5.

The adapter resolves the emulator from explicit launch configuration, then
workspace setting, then `PATH`, and reports every attempted source without
leaking secrets. Auto-download and bundling are deferred pending license,
platform, provenance, release-coupling, and update studies. Linux is first-class;
Windows is expected because Node child processes and stdio are portable, but
both require CI and packaged-VSIX validation.

## Decisions and open Steering choices

Frozen for Slice-1 planning: Node/TypeScript external adapter, DAP stdio,
headless emulator child over versioned NDJSON stdio, launch-first, no bundle,
path-resolution order, one thread/current frame, raw 64-KiB CODE, basic
registers, minimal disassembly through `decodeCode`, instruction breakpoints,
bounded continue/pause, and the explicit one-instruction `stepIn` semantics
above. An emulator-internal stop reason `breakpoint` maps to the distinct DAP
stopped reason `instruction breakpoint`.

Steering must approve before implementation: the cross-repository emulator work
and release/version owner; the extension publisher/identifier and initial
semantic version; and the supported Node/VS Code engine floor. The minimum
breakpoint contract is already frozen: negotiate `maxBreakpoints >= 1`, with
Slice-1 acceptance exercising exactly one.
