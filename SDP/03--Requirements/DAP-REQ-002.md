# DAP-REQ-002 — Breakpoint/watchpoint/tracepoint integration requirements

**State:** planned post-Slice-1 requirements.  
**Extends:** `DAP-REQ-001`; verified Slice-1 requirements remain accepted.  
**Depends on:** accepted `emuSA80535-N` debugger runtime and versioned wire extension.

## Requirement levels

- **Slice 2:** candidate next DAP implementation slice.
- **Near-term:** designed dependency or immediately following slice.
- **Deferred:** explicitly not required for Slice 2.

| ID | Level | Requirement |
|---|---|---|
| `R-032` | Slice 2 | The emulator shall remain the sole semantic owner of debug-point matching, canonical event ordering, trace gating/routing, stop aggregation and safe-boundary watchpoint stop timing; the adapter shall not duplicate these algorithms. |
| `R-033` | Slice 2 | The adapter shall preserve the accepted `emu-debug` 1.0 Slice-1 behavior and negotiate any debug-point functionality as additive named capabilities/versioned commands. Absence of the optional extension shall leave Slice-1 debugging functional. |
| `R-034` | Slice 2 | The adapter shall advertise DAP `supportsDataBreakpoints` only when the complete real/fake watchpoint path is implemented and negotiated. |
| `R-035` | Slice 2 | DAP `dataBreakpointInfo` shall return an opaque adapter/session-owned `dataId` and supported access types without exposing emulator pointers or private C layout. |
| `R-036` | Slice 2 | DAP `setDataBreakpoints` shall map stopping watchpoints to the accepted emulator runtime, atomically replacing the adapter-owned DAP watchpoint set and returning verified/rejected results with actionable reasons. |
| `R-037` | Slice 2 | A watchpoint match shall complete the responsible architectural operation and stop only at the emulator-defined safe boundary. The adapter shall map the resulting stop to DAP `stopped.reason = "data breakpoint"` and preserve trigger identity/details. |
| `R-038` | Slice 2 | RMW access semantics shall be inherited from the emulator event model and shall not be synthesized as separate read/write matches by the adapter. |
| `R-039` | Slice 2 | Any DAP condition or hit-condition support shall compile to a documented bounded deterministic emulator condition representation. Unsupported syntax shall fail explicitly and shall not be evaluated against live emulator state in TypeScript. |
| `R-040` | Slice 2 | Tracepoints shall be non-stopping. A tracepoint match shall never produce a DAP stopped event or alter adapter running/stopped state. |
| `R-041` | Slice 2 | High-rate canonical trace events shall remain retained/routed in emulator-owned bounded storage. The adapter shall not require every raw trace event to be synchronously streamed over DAP. |
| `R-042` | Slice 2 | The extension shall expose emulator-specific tracepoint/session/gate controls through versioned custom debug requests or equivalent stable extension API, while preserving the emulator's trace IDs, configuration revisions and atomic replacement semantics. |
| `R-043` | Slice 2 | Console-action trace output may be rendered using standard DAP `output` events, but rendering shall not change canonical trace sequence/generation or become the authoritative trace store. |
| `R-044` | Slice 2 | Trace-ring retrieval shall use bounded cursor/after-sequence paging as frozen by the accepted emulator facade/wire contract; paging shall be non-destructive and shall report loss/overwrite metadata honestly. |
| `R-045` | Slice 2 | Low-volume custom DAP/extension events may notify trace availability, loss, suppression or sink-status changes; such events shall not carry an unbounded firehose or imply execution stops. |
| `R-046` | Slice 2 | Multi-trace sessions, routes, interrupt inclusion policies and before/after gates shall remain emulator-owned and be transported without semantic reinterpretation by the adapter. |
| `R-047` | Slice 2 | Existing DAP instruction breakpoints shall remain backward-compatible with Slice 1. If the emulator internally converges CODE breakpoints onto the common debug-point runtime, the adapter shall still consume the negotiated public contract rather than depend on that internal representation. |
| `R-048` | Slice 2 | Adapter/fake tests shall prove fake-vs-real equivalence for watchpoint stop ordering, point conditions, trace non-stop behavior, routing/gates, paging and loss/status semantics. |
| `R-049` | Slice 2 | Linux and Windows acceptance shall prove that debug-point/trace integration does not orphan the emulator child, corrupt DAP framing or create host physical-I/O side effects. |
| `R-050` | Slice 2 | No P1000 address, signal, protocol, machine or hydraulic semantic shall be hard-coded into DAP watchpoint/tracepoint functionality. Firmware-specific point configurations may be supplied as user/workspace data only. |
| `R-051` | Near-term | SFR/IRAM/XDATA/CODE variables/memory views shall expose address-preserving identities suitable for native VS Code data-breakpoint creation and `dataBreakpointInfo`. |
| `R-052` | Near-term | Logical stack and step-over/step-out shall consume accepted emulator `control.call`, `control.return`, `interrupt.enter` and `interrupt.exit` events rather than reconstructing control flow solely from disassembly. |
| `R-053` | Near-term | Source logpoints may translate `SourceBreakpoint.logMessage` into emulator tracepoint behavior only after source mapping is available and the mapping preserves non-stopping semantics. |
| `R-054` | Deferred | Arbitrary debugger-side JavaScript expression evaluation over trace events is prohibited unless separately designed for determinism, safety and bounded cost. |
| `R-055` | Deferred | Trace export to files, remote trace streaming and attach/TCP transport are outside Slice 2 unless separately authorized. |

## Supersession note

`DAP-REQ-001` requirement `R-027` classified data/SFR/XDATA watchpoints as deferred because the emulator lacked a stable semantic runtime at the original Slice-1 design cut. This document supersedes that phase classification: stopping watchpoints and trace integration are now the candidate **Slice 2**, subject to the cross-repository gates below. The original historical requirement remains valid evidence of the earlier state.

## Cross-repository gate

Implementation requires both:

1. `emuSA80535-N` Issue #14 accepted with SLC-015..017 and stable facade/versioning/paging decisions; and
2. a reviewed emulator wire-protocol integration that exposes the required point/watch/trace capabilities plus safe-boundary stop application and event producers.

The DAP adapter must not invent provisional wire command names in product code. Documentation/fake planning may proceed, but real Slice-2 acceptance requires an exact emulator commit/release implementing the frozen extension.

## Acceptance interpretation

A standard DAP surface is preferred where its semantics match: instruction breakpoints remain native instruction breakpoints; stopping watchpoints use native data breakpoints. Rich trace sessions/gates/routes exceed standard DAP and therefore use extension-specific controls rather than being flattened or falsely advertised as native capabilities.
