# DAP-STU-002 — Emulator-owned breakpoints, watchpoints and tracepoints

**State:** Steering rebaseline after accepted DAP Slice 1.  
**Extends:** `DAP-STU-001`; it does not invalidate the verified Slice-1 design.  
**Emulator authorities:** `emuSA80535-N` PR #11, PR #12, preserved SLC-017 WIP `356836637d5ff432d91fc508fd55b2f17b45cdb3`, and takeover Issue #14.  
**DAP baseline:** Slice 1 merged through PR #4.

## Executive decision

The emulator owns the semantic debugger model. The DAP adapter and the legacy CLI are frontends over the same breakpoint/watchpoint/tracepoint runtime; they must not implement independent matching, sequencing, gate, routing or safe-stop semantics.

The accepted Slice-1 `emu-debug` 1.0 process contract remains backward compatible and unchanged. New debugger-point functionality is negotiated as an additive optional protocol extension only after `emuSA80535-N` Issue #14 freezes the stable facade/versioning/paging seam and a separately reviewed emulator wire-protocol slice exposes it.

## Emulator model consumed by DAP

The current emulator design distinguishes:

| Emulator point | Match/effect | DAP direction |
|---|---|---|
| CODE breakpoint | Match instruction-boundary PC, stop before instruction | Existing `setInstructionBreakpoints` remains the native mapping. |
| Watchpoint | Match an observed access/event and request stop at the next safe architectural boundary | Native DAP `dataBreakpointInfo` / `setDataBreakpoints`; stop maps to `data breakpoint`. |
| Tracepoint | Match a canonical event, retain/route it, never stop execution | Emulator-specific control surface plus DAP `output`/custom events; native DAP has no general address-level tracepoint request. |
| Trace session | Independently enabled filtered/routed trace | Emulator-specific configuration; adapter does not clone event semantics. |
| Trace gate | Predicate-driven trace on/off before/after an event | Emulator-specific configuration. |

The canonical emulator event taxonomy includes instruction begin/end, code fetch, memory read/write/RMW, call/return, interrupt request/enter/exit, timer/UART events, exception/halt/reset/load/debug mutation and trace/watch-derived records. The DAP adapter consumes these facts; it does not reconstruct them from private emulator state.

## Current DAP capability fit

The current official DAP remains version 1.71.0. Native data breakpoints are a standard surface (`supportsDataBreakpoints`, `dataBreakpointInfo`, `setDataBreakpoints`). DAP logpoints are represented by `SourceBreakpoint.logMessage`, which is source-breakpoint oriented and does not provide a general instruction/event tracepoint request. VS Code's extension API exposes `DebugSession.customRequest(...)` and custom debug-session events, so the extension can provide richer emulator-specific trace controls without forking DAP.

Sources:

- https://microsoft.github.io/debug-adapter-protocol/
- https://microsoft.github.io/debug-adapter-protocol/changelog.html
- https://code.visualstudio.com/api/references/vscode-api

## Native data-breakpoint mapping

DAP data breakpoints are the preferred standard frontend for stopping watchpoints.

The adapter shall treat `dataId` as opaque session-owned identity. It must not expose emulator pointers or depend on retained C structure layout. A data breakpoint maps to one emulator watchpoint configuration with a stable adapter-side correlation id.

DAP `accessType` maps to the emulator access model where valid:

- `read` -> read;
- `write` -> write/RMW as explicitly frozen by the emulator contract;
- `readWrite` -> read plus write/RMW.

The exact treatment of RMW must follow the accepted emulator design: RMW is one architectural access kind, not two synthetic events.

A matched stopping watchpoint completes the responsible instruction/machine cycles once and stops at the emulator-defined next safe boundary. The adapter emits `stopped(reason="data breakpoint")`, preserves the triggering watch identity/details, and reads registers/frames from that resulting stopped snapshot. It must never stop halfway through an opcode merely to mimic desktop hardware-watchpoint timing.

### Conditions and hit conditions

DAP condition strings are not authority to add arbitrary expression evaluation inside the emulator. The emulator design intentionally uses a bounded deterministic condition language.

The adapter may compile a reviewed subset of DAP condition text into the emulator's bounded condition bytecode. Unsupported syntax must be rejected clearly rather than evaluated in JavaScript against live emulator state.

Initial recommended subset:

- scalar equality/inequality and ordered comparisons;
- bit-mask any/all operations;
- boolean `and`, `or`, `not`;
- canonical fields such as old/new value and known flags.

DAP `hitCondition` should initially support only explicitly documented deterministic forms. Advanced `changeOnly`, `bitMask`, skip/hit-limit and multi-event selectors remain available through the richer emulator-specific point configuration.

## Tracepoint mapping

A tracepoint is not a disguised breakpoint. It never produces a DAP stopped event.

Three presentation paths are useful:

1. **Console action:** the emulator routes a matched event to a console action; the adapter renders a bounded human-readable line as DAP `output` without changing execution state.
2. **Trace storage:** canonical events remain in emulator-owned bounded rings/destinations. The extension pages them through custom requests after-sequence/cursor semantics rather than streaming every raw event through DAP.
3. **Custom event notification:** the adapter emits a low-volume custom event such as trace-available/status-change so an extension view can refresh. The custom event is a notification, not the trace store itself.

This separation is important for high-rate UART/timer/memory traces. Flooding DAP with every canonical event would create backpressure and could accidentally make debugger transport performance part of emulated timing. Trace retention/loss/suppression remains emulator-owned and deterministic.

## Trace sessions, routes and gates

DAP has no native equivalent for multi-trace routing, interrupt inclusion policies, before/after trace gates or bounded trace destinations. These must remain emulator-specific concepts.

The VS Code extension may expose them using normal extension commands/views and `DebugSession.customRequest()`. The adapter translates those requests to the versioned emulator control extension after capability negotiation.

The adapter must preserve:

- trace IDs and configuration revisions;
- before/source/derived/after ordering;
- ascending point/watch ordering;
- generation/sequence identity;
- interrupt inclusion policy;
- explicit loss/suppression/status records;
- atomic replacement semantics.

It must never reproduce those algorithms in TypeScript.

## Breakpoint convergence

The verified `replaceCodeBreakpoints` command remains valid for `emu-debug` 1.0 compatibility. A future emulator may internally represent CODE breakpoints using the common debug-point runtime, but that is an emulator implementation detail.

The DAP adapter continues to use the stable instruction-breakpoint command until a newer negotiated protocol explicitly replaces it. There must not be two simultaneously active semantic breakpoint engines.

## Event-driven future stack

The same canonical event bus improves the previously planned logical call/IRQ stack. Future stack modeling should consume accepted `control.call`, `control.return`, `interrupt.enter` and `interrupt.exit` events rather than infer calls from disassembly alone. This makes the event runtime a shared prerequisite for later step-over/step-out and logical stack slices.

That work remains outside the immediate debug-point integration slice.

## Required cross-repository gates

DAP product implementation of the new model must not start against a guessed wire contract.

Gate A — emulator internal runtime:

- `emuSA80535-N` Issue #14 accepts SLC-015..017 and freezes stable facade/versioning/paging decisions.

Gate B — emulator wire extension:

- a separate emulator issue/slice exposes the accepted debugger runtime through a versioned additive `emu-debug` capability/command set;
- safe-boundary watchpoint stop application and required CPU producer hooks are reviewed and verified;
- Linux/Windows process tests prove protocol and lifecycle behavior.

Gate C — DAP integration:

- the DAP adapter implements the negotiated extension without changing the frozen 1.0 base behavior;
- fake and real emulator suites agree on point/watch/trace semantics.

## Recommended next DAP slice

The next DAP slice should focus on **debug points and trace integration**, not full memory browsing.

Minimum useful vertical scope:

- negotiate the new emulator debug-point capability;
- native DAP data-breakpoint support for stopping watchpoints;
- watchpoint stop details and safe-boundary semantics;
- extension custom requests for tracepoint/session/gate configuration;
- bounded trace-ring paging and console output;
- low-volume custom trace status/availability events;
- fake-vs-real equivalence tests on Linux/Windows.

Full SFR/IRAM/XDATA memory views, arbitrary evaluate expressions, source maps and logical call/IRQ stack remain later slices unless a narrow dependency is demonstrated.
