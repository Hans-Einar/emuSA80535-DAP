# DAP-REQ-001 — Product and readiness requirements

**Traceability:** `R-001` through `R-031` derive from `M-001`, `S-001`, and
`UC-001`.  
**State:** Target requirements; implementation has not started.

## Use case

`UC-001`: A firmware developer installs the extension, launches a compatible
offline `emuSA80535-N` with a deterministic raw CODE image, observes the initial
PC/register state, disassembles instructions, sets a CODE instruction
breakpoint, continues/pauses, and steps one instruction without physical
hardware.

## Requirement levels

- **Slice 1:** mandatory for the first implementation slice.
- **Near-term:** designed now but not required to accept Slice 1.
- **Deferred:** explicitly excluded until a later reviewed slice.

| ID | Level | Requirement and acceptance intent |
|---|---|---|
| `R-001` | Slice 1 | The adapter shall handshake with the emulator using protocol major/minor versions and named capabilities before loading or executing firmware; an incompatible major shall fail before execution. |
| `R-002` | Slice 1 | A launch session shall spawn one headless emulator child without a shell, load one exactly 65,536-byte raw CODE image, reset with an explicit deterministic seed, and stop at the configured 16-bit entry address. |
| `R-003` | Slice 1 | Session state shall be one of starting, stopped, running, terminating, or terminated, and DAP requests/events shall not claim contradictory states. |
| `R-004` | Slice 1 | PC and every CODE instruction address shall be 16-bit (`0x0000`–`0xFFFF`) and represented through canonical `code:HHHH` instruction/memory references. |
| `R-005` | Slice 1 | The adapter shall implement `setInstructionBreakpoints` for at least one CODE address and report each breakpoint as verified or rejected with a reason. |
| `R-006` | Slice 1 | `continue` shall run bounded instruction chunks and stop on a configured instruction breakpoint, emulator exception/halt, pause, child failure, or explicit limit condition. |
| `R-007` | Slice 1 | `pause` shall be serviced after a bounded execution chunk and result in one DAP `stopped` event with reason `pause`; it shall not depend on physical-time timing. |
| `R-008` | Slice 1 | instruction-granularity `stepIn` shall execute exactly one completed instruction from a stopped state and report the resulting PC in a `step` stop. |
| `R-009` | Near-term | `next` shall implement a defensible step-over rule using decoded call behavior and logical events; until then it shall not be advertised. |
| `R-010` | Near-term | `stepOut` shall require an observed logical caller/interrupt frame; until then it shall not be advertised. |
| `R-011` | Slice 1 | DAP `threads` shall expose exactly one stable logical MCU thread. |
| `R-012` | Slice 1 | `stackTrace` shall expose at least one truthful current-PC frame with `instructionPointerReference`; it shall not reconstruct frames from arbitrary IRAM bytes. |
| `R-013` | Slice 1 | `scopes`/`variables` shall expose a read-only basic-register scope containing PC, A, B, PSW, SP, DPTR, and bank-selected R0–R7 from one atomic stopped-state snapshot. |
| `R-014` | Near-term | SFR shall be exposed as an address-preserving, side-effect-free read scope/memory space. |
| `R-015` | Near-term | IRAM shall be readable as a distinct memory space, including upper IRAM only when the negotiated CPU variant supports it. |
| `R-016` | Near-term | CODE and XDATA shall be readable as distinct spaces; identical numeric addresses shall never alias across spaces. |
| `R-017` | Slice 1 | Minimal `disassemble` shall decode CODE around a `code:` reference and return stable instruction addresses sufficient for the VS Code disassembly/instruction-breakpoint flow. |
| `R-018` | Near-term | Source-line `setBreakpoints`, `breakpointLocations`, richer disassembly, and source attribution shall use a validated generic symbol/source map. |
| `R-019` | Near-term | The generic symbol map shall map CODE address to optional symbol and optional file/line/column, identify architecture/image checksum/schema version, and contain no firmware-family semantics. |
| `R-020` | Near-term | Logical stack frames shall be based on observed call/return/IRQ/RETI events, label provenance/confidence, preserve nested interrupt order, and degrade honestly on mismatches or reset. |
| `R-021` | Near-term | Interrupt state shall remain on the one MCU thread and expose vector/priority/active state only when supplied by a stable emulator contract. |
| `R-022` | Slice 1 | Emulator, transport, launch, state, and DAP failures shall produce stable structured error codes, actionable user text, correlation data in logs, and no protocol bytes in logs. |
| `R-023` | Slice 1 | The extension shall be packageable as a `.vsix` with semantic version metadata; Marketplace publication itself is not a Slice-1 acceptance condition. |
| `R-024` | Slice 1 | Linux shall be a first-class build/test/package platform; Windows shall be supported when packaged child-process and path tests pass. |
| `R-025` | Slice 1 | Automated acceptance shall use a fake emulator and a tiny synthetic raw firmware fixture; no physical hardware, serial, GPIO, or machine connection may be required. |
| `R-026` | Slice 1 | Missing executable, malformed protocol, timeout, crash, and protocol/capability mismatch shall fail gracefully, clean up the child, and never silently fall back to direct struct access. |
| `R-027` | Deferred | Data/SFR/XDATA watchpoints shall use negotiated emulator access events and DAP data-breakpoint requests; trace callbacks alone do not imply support. |
| `R-028` | Deferred | `writeMemory`, register modification, and other state mutation shall be disabled unless separately implemented, explicitly enabled, range-validated, and safety-reviewed. |
| `R-029` | Slice 1 | No launch, debug, test, or packaging action shall open host serial/GPIO/bus endpoints or actuate physical machine I/O. |
| `R-030` | Slice 1 | Adapter code, protocol, fixtures, defaults, and symbol schema shall contain no P1000 address, signal, protocol, machine, or hydraulic hard-coding. |
| `R-031` | Slice 1 | For a launch-owned session, DAP `disconnect` (and `terminate` only when advertised) shall stop and reap the emulator child, close protocol pipes, invalidate handles, and emit exactly one `terminated` event without leaving an orphan process. |

## Cross-repository gate

`R-001`, `R-002`, `R-004`–`R-008`, `R-013`, `R-017`, `R-022`, `R-025`,
`R-026`, `R-029`, and `R-031` depend on the minimum emulator contract in
`protocol/EMU_DEBUG_API_REQUIREMENTS.md`. None of those server-side capabilities
exists as a merged, versioned headless protocol on the current emulator default
branch. Slice 1 must not start until Steering assigns and accepts that
cross-repository prerequisite or explicitly re-baselines this requirement set.

## Acceptance interpretation

A DAP capability flag is evidence only when its request/event behavior passes
tests. Deferred or near-term requests must be omitted or return a standards-
conformant unsupported response; they must not be advertised speculatively.
All reads used for debugger presentation must be from a stopped-state snapshot
and must not trigger emulated device side effects.
