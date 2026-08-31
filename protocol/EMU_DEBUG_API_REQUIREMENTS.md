# Emulator debug-control API requirements

**Contract:** `emu-debug` protocol `1.0` target baseline
**Consumers:** `emuSA80535-DAP` adapter and `emuSA80535-N` headless runtime
**State:** Frozen requirement for Slice-1 planning; not implemented on the
current emulator default branch

## Authority and factual baseline

The current `emuSA80535-N` default is `master` at
[`5dc681275151c4a5d7b85ec9ff4ceb1b25abd5a8`](https://github.com/Hans-Einar/emuSA80535-N/tree/5dc681275151c4a5d7b85ec9ff4ceb1b25abd5a8).
It exposes a C CPU struct plus `reset`, machine-cycle `tick`, `decode`, and Intel
HEX loading, while run/pause/breakpoint behavior is coupled to the curses TUI.
It has no headless debug executable, version query, machine-readable control
transport, stable atomic snapshot, or debugger-safe memory API.

Open emulator
[PR #1](https://github.com/Hans-Einar/emuSA80535-N/pull/1) at
[`62f40127e1aa3b24e9d8d54c2458e847bfe86488`](https://github.com/Hans-Einar/emuSA80535-N/tree/62f40127e1aa3b24e9d8d54c2458e847bfe86488)
adds candidate deterministic reset/variant initialization, exact 64-KiB binary
loading, bounded run/step results, one core breakpoint, counts, and immutable
instruction/SFR/MOVX trace records. That work is **candidate/unmerged** and
still does not provide this headless protocol. It is evidence for feasibility,
not a current-default dependency.

No adapter may directly consume `struct em8051` fields across the process
boundary or classify an unmerged symbol as available.

## Boundary and framing

The adapter launches a separate emulator executable in explicit headless-debug
mode, without a shell. The child's stdin/stdout carries UTF-8 NDJSON: one JSON
object per line. stdout is protocol-only; structured human diagnostics go to
stderr. This stream is not DAP and never carries DAP `Content-Length` frames.

Each request has a positive session-unique integer `id`, `type: "request"`,
`command`, and optional `arguments`. Each response echoes `id` and `command`,
has `success`, and carries either `body` or a structured `error`. Server events
use `type: "event"`. Unknown fields are ignored within protocol major 1;
unknown required commands/capabilities fail explicitly.

The initial maximum line size, timeouts, execution-chunk maximum,
disassembly-count maximum, and breakpoint maximum are returned by `hello`.
Implementations must bound all allocation and work derived from input.

## Version and capability handshake

The first command is:

```json
{"type":"request","id":1,"command":"hello","arguments":{"protocol":{"major":1,"minor":0},"requiredCapabilities":["rawCode64k","deterministicReset","snapshotBasicRegisters","decodeCode","replaceCodeBreakpoints","boundedRun","stepInstruction"]}}
```

A success returns protocol major/minor, emulator product/version/commit, CPU
variants, named capabilities, and numeric limits. Major mismatch is fatal. A
minor mismatch is acceptable only when all named required capabilities are
present and message semantics are compatible. Product version/commit is
diagnostic and must not substitute for the protocol version.

The Slice-1 required capability names above are frozen. Raw CODE reading is not
required: `decodeCode` is the only Slice-1 disassembly consumer, while DAP
`readMemory` remains near-term. Adding optional capabilities is backward
compatible; renaming/removing a required capability or changing its semantics
requires a protocol-major change or an explicit compatibility design.

## Minimum needed for Slice 1

### Lifecycle and image

`load` accepts an absolute image path, format `raw-code-64k`, and expected
SHA-256. The server reads exactly 65,536 bytes, rejects shorter/longer content,
and returns the actual digest. It populates CODE only and does not infer P1000
or other firmware semantics.

`reset` accepts an unsigned 32-bit seed and 16-bit entry address. It performs a
deterministic cold reset, sets the configured entry state under an emulator-
owned rule, and returns stopped at an instruction boundary with reason `entry`.
Repeating the same accepted build, image, seed, and command sequence must
produce the same architectural state and stop sequence.

`terminate` stops execution, closes emulator-owned resources, returns an
acknowledgment when possible, and exits. EOF from the adapter also triggers
bounded cleanup. Headless mode must not initialize curses or physical host I/O.

### State and atomic snapshot

The child does not mirror the adapter's logical DAP state. Its independent
lifecycle/command state is `starting`, `idle`, `run-active`, `command-active`,
`terminating`, or `terminated`. Because commands are serialized, a successful
synchronous `run` response changes `run-active` back to `idle` at an
instruction boundary. The child is not executing between requests, even while
the adapter remains logically running and intends to send another chunk.

`getState`, `reset`, `stepInstruction`, every architectural stop result, and
every yield return one atomic instruction-boundary snapshot:

```json
{
  "state":"idle",
  "resultKind":"architectural-stop",
  "reason":"entry",
  "pc":0,
  "registers":{
    "a":0,"b":0,"psw":0,"sp":7,"dptr":0,
    "r":[0,0,0,0,0,0,0,0]
  },
  "variant":"sab80535",
  "instructionCount":0,
  "machineCycleCount":0
}
```

All numeric register values have fixed architectural widths. R0–R7 correspond
to the bank selected by the snapshot PSW. PC and registers must come from the
same point in execution. Private pointers, padding, callbacks, and struct layout
are never serialized.

When processed at `idle`, `getState` returns the latest still-valid boundary and
labels its provenance as `architectural-stop` or `yield`; it never reports a
persistent child `running` state. While a command is active no second request is
processed. Load/reset or another executing command invalidates the older
boundary as described under continue/pause.

Child architectural stop reasons are `entry`, `breakpoint`, `step`,
`exception`, and `halt`; exceptions additionally carry a stable code and
message. `pause` is not a child stop reason in Slice 1: it is synthesized by the
adapter when it promotes a yielded boundary after a DAP pause request. The
internal reason `breakpoint` is likewise not the DAP wire string; the adapter
maps it to DAP `instruction breakpoint`. A request invalid for the current
child command/lifecycle state fails and leaves state unchanged.

### Disassembly support

The required `decodeCode` command accepts a uint16 reference CODE address,
signed byte offset, signed instruction offset, and positive instruction count
within a negotiated limit. It returns exactly that many ordered records. A
valid record contains uint16 address, positive byte size, `valid: true`, and
exact emulator decoder text. An invalid predecessor placeholder contains the
selected byte address, `size: 1`, `valid: false`, stable reason
`unknown-predecessor`, and display text `<invalid>`.

The byte offset is applied first without uint16 wrapping. Non-negative
instruction offsets decode forward. For a negative instruction offset, the
server traverses only a contiguous predecessor chain whose boundaries are
known from an architectural boundary plus forward decode results or from an
observed completed sequential instruction. It must not scan raw bytes and guess
which variable-length predecessor was intended. At the first unknown
predecessor, and for further unknown slots, it moves back exactly one byte and
emits the invalid one-byte placeholder. Known records remain valid and
authoritative decoder output; placeholders are explicitly non-authoritative.

The exact returned window must fit `0x0000`–`0xFFFF`. Otherwise the command
returns a structured range error rather than wrapping or returning a partial
array. The adapter must not duplicate private opcode tables. The current C
`decode()` function is feasibility evidence but is not a cross-process
contract. A raw CODE-read operation is not in the Slice-1 command or capability
set because it has no Slice-1 consumer; debugger `readMemory` remains a
near-term requirement.

### CODE breakpoints

`replaceCodeBreakpoints` accepts the complete desired set of unique uint16 CODE
addresses. It atomically replaces all prior debugger breakpoints and returns
accepted and rejected addresses with stable reasons. Empty input clears the
set. `hello.limits.maxBreakpoints` is at least one. Breakpoints stop before the
instruction at that PC executes and return reason `breakpoint` and the same PC.
`breakpoint` is the emulator protocol's internal reason; the DAP adapter must
emit the distinct standard reason `instruction breakpoint`.

This replacement contract matches DAP `setInstructionBreakpoints`, which
replaces the global set. It must not share a TUI global or require adapter
access to emulator storage.

### Continue and pause

`run` executes no more than its requested/negotiated instruction chunk and
returns either:

- `yield` with progress counters and an atomic instruction-boundary snapshot
  when the chunk ends without an architectural stop; or
- one architectural-stop snapshot for breakpoint, exception, or halt.

The adapter schedules repeated chunks for DAP continue and keeps its DAP state
running across `yield` boundaries, although the child returns to `idle` at each
boundary and executes nothing until the next request. Before sending another
chunk, the adapter checks pause and termination intent. A DAP pause is an
adapter-local intent: the adapter acknowledges it before the eventual stopped
event, awaits an active chunk or uses the most recent still-valid yield, sends
no next chunk, and promotes that boundary snapshot to a DAP pause stop. The
child protocol has no Slice-1 `pause` command and requires no concurrent request
multiplexing. The negotiated maximum chunk supplies the deterministic service
bound. Physical elapsed time is not part of the execution result.

A yield snapshot is valid only while the child is idle with the same loaded
image. Sending the next run, load/reset, timeout, malformed response, EOF,
disconnect, or exit invalidates it. Disconnect sets termination intent and
schedules no next chunk; any snapshot returned during cleanup is not exposed as
a DAP stop. A run timeout proves no safe boundary, so the adapter kills/reaps
the child and terminates instead of assuming a stopped state.

### Single instruction

`stepInstruction` is valid while the child is `idle` at a boundary; the adapter
sends it only while the logical DAP session is stopped. It completes exactly
one architectural instruction, including required machine cycles, and returns
at the next instruction boundary with reason `step`, unless a higher-priority
exception/halt outcome is explicitly returned. This is the server primitive
for DAP `stepIn` in Slice 1. It does not imply call-aware `next` or `stepOut`.

### Errors and termination

Every failure returns:

```json
{"code":"STABLE_MACHINE_CODE","message":"actionable text","retryable":false,"data":{}}
```

Minimum families cover invalid request/schema, invalid state, range, image
size/hash, unsupported variant/capability, breakpoint limit, execution
exception, and internal error. Malformed input produces a bounded error or
clean termination; it must not be printed as successful output.

Unexpected child termination and EOF are observable to the adapter. A clean
adapter `terminate`/disconnect must not orphan the emulator.

## Explicit current cross-repository blockers

Every item below must be implemented, reviewed, and merged into the
`emuSA80535-N` default branch (or supplied by an accepted compatible release)
before DAP Slice 1 starts:

| Blocker | Missing current-default prerequisite |
|---|---|
| `EMU-BLK-001` | A buildable, documented headless-debug executable that does not initialize curses or host hardware I/O |
| `EMU-BLK-002` | NDJSON request/response server with stdout protocol isolation, correlation, bounds, and structured errors |
| `EMU-BLK-003` | `hello` version/capability/limits handshake for protocol 1.0 |
| `EMU-BLK-004` | Deterministic SAB80535 initialization/reset and exact 64-KiB raw CODE loading |
| `EMU-BLK-005` | Atomic stopped-state PC/basic-register snapshot API independent of private struct layout |
| `EMU-BLK-006` | Required `decodeCode` command/capability with exact-count valid records, deterministic invalid predecessor placeholders, and range behavior |
| `EMU-BLK-007` | Atomic replacement CODE-breakpoint table with at least one entry and pre-execution stop semantics |
| `EMU-BLK-008` | Bounded run primitive and bounded/responsive pause behavior |
| `EMU-BLK-009` | Exactly-one-instruction step primitive and stable stop reasons |
| `EMU-BLK-010` | Clean terminate/EOF/crash behavior and Linux/Windows process tests |

Candidate PR #1 may partially satisfy the core underneath `EMU-BLK-004`,
`EMU-BLK-007`, `EMU-BLK-008`, and `EMU-BLK-009`, but it is unmerged, offers one
breakpoint, and has no headless protocol. Those blockers remain open.

## Needed for later slices

- side-effect-free CODE, IRAM, SFR, and XDATA read operations and variant
  ranges for DAP `readMemory` and richer scopes;
- call/return/IRQ-entry/RETI event stream with call site, target/vector,
  return PC, priority, nesting, and monotonic sequence;
- interrupt state snapshot and exception detail;
- data/SFR/XDATA access events and configurable watchpoints;
- safe, explicitly enabled memory/register writes with ranges and invalidation;
- richer trace subscription with backpressure;
- attach to an already-running emulator over an authenticated/restricted local
  socket and independent lifecycle;
- performance counters beyond deterministic instruction/machine-cycle counts.

These later capabilities must be negotiated and are not accidental Slice-1
dependencies.

## Logical stack event requirements for later work

Events must distinguish `acall`, `lcall`, `ret`, `irqEnter`, `reti`, and reset.
Each event carries sequence, instruction address, resulting PC, architectural
return PC where applicable, and IRQ vector/priority when applicable. Nested
interrupt order must be explicit. If event loss or an unexpected RET/RETI is
detected, the adapter can mark its logical model degraded; the server must not
claim that arbitrary hardware-stack bytes are language frames.

## Safety and firmware neutrality

Headless debug mode cannot open serial, GPIO, CAN, field-bus, or machine-control
endpoints. Device models operate only inside emulator state. The protocol has
no P1000 commands, types, addresses, names, signal meanings, or hydraulic
semantics. Firmware-specific symbols enter only through the adapter's generic
symbol-map input.

## Contract verification expected in the emulator repository

- schema/unknown-field/malformed/oversize record tests;
- compatible and incompatible hello tests;
- exact-size image and hash tests;
- deterministic replay with fixed seed;
- atomic snapshot/register-bank tests;
- forward, known-predecessor, unknown-placeholder, range, and exact-count
  `decodeCode` tests;
- breakpoint replacement/clear/limit and pre-execution stop tests;
- bounded run/pause and exact-step tests;
- exception/crash/EOF/terminate cleanup tests;
- Linux and Windows stdio process tests proving stdout contains NDJSON only;
- a safety test proving headless debug performs no physical host I/O.

The accepted emulator release/version and commit must be captured in the DAP
integration test evidence. Until then this file is a target cross-repository
requirements contract, not proof of availability.
