# DAP-REQ-002 — Breakpoint/watchpoint/tracepoint integration requirements

**State:** planned post-Slice-1 requirements.
**Extends:** `DAP-REQ-001`; verified Slice-1 requirements remain accepted.
**Depends on:** accepted `emuSA80535-N` debugger runtime and versioned wire extension.

## Requirement levels

- **Sprint invariant:** applies across the planned `SPR-002` product slices.
- **Slice 2A:** first thin stopping-watchpoint vertical.
- **Slice 2B:** later rich non-stopping trace vertical; not activated.
- **Near-term:** designed dependency or immediately following slice.
- **Deferred:** explicitly not required for Slice 2.

| ID | Level | Requirement |
|---|---|---|
| `R-032` | Sprint invariant | The emulator shall remain the sole semantic owner of debug-point matching, canonical event ordering, trace gating/routing, stop aggregation and safe-boundary watchpoint stop timing; the adapter shall not duplicate these algorithms. |
| `R-033` | Sprint invariant | The adapter shall preserve the accepted `emu-debug` 1.0 Slice-1 behavior and negotiate any debug-point functionality as an additive versioned extension. Absence of the optional extension shall leave Slice-1 debugging functional. |
| `R-034` | Slice 2A | The adapter shall advertise DAP `supportsDataBreakpoints` only when the complete real/fake stopping-watch path is implemented and negotiated; `supportsDataBreakpointBytes` shall remain false/omitted in Slice 2A. |
| `R-035` | Slice 2A | While stopped, DAP `dataBreakpointInfo` shall resolve the current Slice-1 Registers `variablesReference` plus exact child name `A`, `B`, `PSW`, or `SP` to stable byte-wide SFR addresses `0xe0`, `0xf0`, `0xd0`, or `0x81`, and return an opaque adapter discovery `dataId`, `canPersist: false`, and supported access types without exposing emulator/private identity. A well-formed current Registers request for `PC`, composite `DPTR`, bank-selected `R0`–`R7`, or another non-exact child, and every well-formed frame/expression or address/byte-range origin, shall succeed with `dataId: null`; malformed arguments and stale/foreign nonzero variable handles shall fail with a clear bounded message. The token is valid only in its debug session and target/configuration generation, not keyed to a stop epoch. |
| `R-036` | Slice 2A | DAP `setDataBreakpoints` shall prevalidate the entire requested set and map stopping watches to the accepted emulator runtime as one atomic replacement of the DAP-owned set. A stale token, unsupported access/condition, invalid target, or emulator rejection shall preserve the prior installed set and revision. The response shall contain one DAP `Breakpoint` per input in order with actionable verification/rejection detail. Installed positive integer DAP `Breakpoint.id`, source `dataId`, emulator public correlation identity, and exact configuration revision are separate domains; discovery-token expiry alone shall not mutate an installed watch. |
| `R-037` | Slice 2A | A watchpoint match shall complete the responsible architectural operation and stop only at the emulator-defined safe boundary. The adapter shall map the resulting stop to DAP `stopped.reason = "data breakpoint"` and, when the accepted emulator result supplies sufficient public correlation, map all triggers to the installed DAP `Breakpoint.id` values in `hitBreakpointIds`. |
| `R-038` | Slice 2A | RMW access semantics shall be inherited from the emulator event model and shall not be synthesized as separate read/write matches by the adapter. |
| `R-039` | Slice 2A | Any DAP condition or hit-condition support shall compile only to the exact accepted bounded deterministic emulator subset. Until that subset is frozen, or for every unsupported/nonempty form, configuration shall reject atomically. No condition shall be evaluated against live emulator state in TypeScript or JavaScript. |
| `R-040` | Slice 2B | Tracepoints shall be non-stopping. A tracepoint match shall never produce a DAP stopped event or alter adapter running/stopped state. |
| `R-041` | Slice 2B | High-rate canonical trace events shall remain retained/routed in emulator-owned bounded storage. The adapter shall not require every raw trace event to be synchronously streamed over DAP. |
| `R-042` | Slice 2B | The extension shall expose emulator-specific tracepoint/session/gate controls through versioned custom debug requests or equivalent stable extension API, while preserving the emulator's trace IDs, configuration revisions and atomic replacement semantics. |
| `R-043` | Slice 2B | Console-action trace output may be rendered using standard DAP `output` events, but rendering shall not change canonical trace sequence/generation or become the authoritative trace store. |
| `R-044` | Slice 2B | Trace-ring retrieval shall use bounded cursor/after-sequence paging as frozen by the accepted emulator facade/wire contract; paging shall be non-destructive and shall report loss/overwrite metadata honestly. |
| `R-045` | Slice 2B | Low-volume custom DAP/extension events may notify trace availability, loss, suppression or sink-status changes; such events shall not carry an unbounded firehose or imply execution stops. |
| `R-046` | Slice 2B | Multi-trace sessions, routes, interrupt inclusion policies and before/after gates shall remain emulator-owned and be transported without semantic reinterpretation by the adapter. |
| `R-047` | Sprint invariant | Existing DAP instruction breakpoints shall remain backward-compatible with Slice 1. If the emulator internally converges CODE breakpoints onto the common debug-point runtime, the adapter shall still consume the negotiated public contract rather than depend on that internal representation. |
| `R-048` | Sprint invariant | Each activated product slice shall prove fake-vs-real equivalence for its own accepted semantics: stopping-watch ordering/access/conditions for Slice 2A, and trace non-stop/routing/gates/paging/loss/status for Slice 2B. |
| `R-049` | Sprint invariant | Linux and Windows acceptance for each activated product slice shall prove that integration does not orphan the emulator child, corrupt DAP framing or create host physical-I/O side effects. |
| `R-050` | Sprint invariant | No P1000 address, signal, protocol, machine or hydraulic semantic shall be hard-coded into DAP watchpoint/tracepoint functionality. Firmware-specific point configurations may be supplied as user/workspace data only. |
| `R-051` | Slice 2A minimum; near-term expansion | Slice 2A shall expose the stable SFR identity of existing register children `A`, `B`, `PSW`, and `SP` for native VS Code data-breakpoint creation. Full address-preserving SFR/IRAM/XDATA/CODE variables and memory views remain near-term work. |
| `R-052` | Near-term | Logical stack and step-over/step-out shall consume accepted emulator `control.call`, `control.return`, `interrupt.enter` and `interrupt.exit` events rather than reconstructing control flow solely from disassembly. |
| `R-053` | Near-term | Source logpoints may translate `SourceBreakpoint.logMessage` into emulator tracepoint behavior only after source mapping is available and the mapping preserves non-stopping semantics. |
| `R-054` | Deferred | Arbitrary debugger-side JavaScript expression evaluation over trace events is prohibited unless separately designed for determinism, safety and bounded cost. |
| `R-055` | Deferred | Trace export to files, remote trace streaming and attach/TCP transport are outside Slice 2 unless separately authorized. |

## Supersession note

`DAP-REQ-001` requirement `R-027` classified data/SFR/XDATA watchpoints as deferred because the emulator lacked a stable semantic runtime at the original Slice-1 design cut. `R-036` now replaces that phase classification for the thin stopping-watch vertical, while `R-040` records the separately planned non-stopping trace vertical. The original historical requirement remains valid evidence of the earlier state; the study is context, not the machine-readable replacement requirement.

## Cross-repository gate

Implementation requires both:

1. `emuSA80535-N` Issue #14 accepted with SLC-015..017 and stable facade/versioning/paging decisions; and
2. a reviewed emulator wire-protocol integration that exposes the required point/watch/trace capabilities plus safe-boundary stop application and event producers.

The DAP adapter must not invent provisional wire command names in product code. Documentation/fake planning may proceed, but real Slice-2 acceptance requires an exact emulator commit/release implementing the frozen extension.

## Acceptance interpretation

A standard DAP surface is preferred where its semantics match: instruction breakpoints remain native instruction breakpoints; stopping watchpoints use native data breakpoints. Rich trace sessions/gates/routes exceed standard DAP and therefore use extension-specific controls rather than being flattened or falsely advertised as native capabilities.
