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

The initial maximum line size, timeouts, execution-chunk maximum, memory-read
maximum, and breakpoint maximum are returned by `hello`. Implementations must
bound all allocation and work derived from input.

## Version and capability handshake

The first command is:

```json
{"type":"request","id":1,"command":"hello","arguments":{"protocol":{"major":1,"minor":0},"requiredCapabilities":["rawCode64k","deterministicReset","snapshotBasicRegisters","readCode","decodeCode","replaceCodeBreakpoints","boundedRun","stepInstruction"]}}
```

A success returns protocol major/minor, emulator product/version/commit, CPU
variants, named capabilities, and numeric limits. Major mismatch is fatal. A
minor mismatch is acceptable only when all named required capabilities are
present and message semantics are compatible. Product version/commit is
diagnostic and must not substitute for the protocol version.

The Slice-1 required capability names above are frozen. Adding optional
capabilities is backward compatible; renaming/removing a required capability or
changing its semantics requires a protocol-major change or an explicit
compatibility design.

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

Server state is `starting`, `stopped`, `running`, `terminating`, or
`terminated`. `getState`, `reset`, `stepInstruction`, and any stop result return
one atomic instruction-boundary snapshot:

```json
{
  "state":"stopped",
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

Canonical stop reasons are `entry`, `breakpoint`, `step`, `pause`,
`exception`, and `halt`; exceptions additionally carry a stable code and
message. A request invalid for the current state fails and leaves state
unchanged.

### CODE reads and disassembly support

`readMemory` accepts `space: "code"`, a uint16 address, and a positive byte
count within negotiated limits. It returns the actual start address, base64
bytes, and unreadable count. Reads are side-effect-free and never call device
callbacks. A request crossing `0xFFFF` fails rather than wrapping in Slice 1.

The required `decodeCode` command accepts a uint16 reference CODE address,
signed byte offset, signed instruction offset, and positive instruction count
within a negotiated limit. It owns variable-length boundary traversal in both
directions and returns exactly that many ordered records with uint16 address,
positive byte size, and authoritative instruction text. It returns a structured
range error rather than wrapping when the window crosses `0x0000` or `0xFFFF`.
The adapter must not duplicate private opcode tables. The current C `decode()`
function is feasibility evidence but is not a cross-process contract.

### CODE breakpoints

`replaceCodeBreakpoints` accepts the complete desired set of unique uint16 CODE
addresses. It atomically replaces all prior debugger breakpoints and returns
accepted and rejected addresses with stable reasons. Empty input clears the
set. `hello.limits.maxBreakpoints` is at least one. Breakpoints stop before the
instruction at that PC executes and return reason `breakpoint` and the same PC.

This replacement contract matches DAP `setInstructionBreakpoints`, which
replaces the global set. It must not share a TUI global or require adapter
access to emulator storage.

### Continue and pause

`run` executes no more than its requested/negotiated instruction chunk and
returns either:

- `yield` with progress counters and an atomic instruction-boundary snapshot
  when the chunk ends without an architectural stop; or
- one stopped snapshot for breakpoint, pause, exception, or halt.

The adapter schedules repeated chunks for DAP continue and keeps its DAP state
running across `yield` boundaries. A DAP pause is an adapter-local intent: the
adapter awaits the current synchronous chunk, sends no next chunk, and maps the
yield snapshot to a pause stop. The child protocol has no Slice-1 `pause`
command and requires no concurrent request multiplexing. The negotiated maximum
chunk supplies the deterministic service bound. Physical elapsed time is not
part of the execution result.

### Single instruction

`stepInstruction` is valid only while stopped. It completes exactly one
architectural instruction, including required machine cycles, and returns at
the next instruction boundary with reason `step`, unless a higher-priority
exception/halt outcome is explicitly returned. This is the server primitive for
DAP `stepIn` in Slice 1. It does not imply call-aware `next` or `stepOut`.

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
| `EMU-BLK-006` | Side-effect-free CODE read plus required `decodeCode` command/capability with authoritative address/size/text records |
| `EMU-BLK-007` | Atomic replacement CODE-breakpoint table with at least one entry and pre-execution stop semantics |
| `EMU-BLK-008` | Bounded run primitive and bounded/responsive pause behavior |
| `EMU-BLK-009` | Exactly-one-instruction step primitive and stable stop reasons |
| `EMU-BLK-010` | Clean terminate/EOF/crash behavior and Linux/Windows process tests |

Candidate PR #1 may partially satisfy the core underneath `EMU-BLK-004`,
`EMU-BLK-007`, `EMU-BLK-008`, and `EMU-BLK-009`, but it is unmerged, offers one
breakpoint, and has no headless protocol. Those blockers remain open.

## Needed for later slices

- side-effect-free IRAM, SFR, and XDATA read operations and variant ranges;
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
- side-effect-free CODE read and decode boundary tests;
- breakpoint replacement/clear/limit and pre-execution stop tests;
- bounded run/pause and exact-step tests;
- exception/crash/EOF/terminate cleanup tests;
- Linux and Windows stdio process tests proving stdout contains NDJSON only;
- a safety test proving headless debug performs no physical host I/O.

The accepted emulator release/version and commit must be captured in the DAP
integration test evidence. Until then this file is a target cross-repository
requirements contract, not proof of availability.
