# DAP-DES-002 — DAP design for emulator-owned debug points

**Traceability:** `D-011` refines `A-009` for candidate Slice 2.
**State:** implementation-planning design.  
**Extends:** `DAP-DES-001`.  
**Important:** provisional wire names in this document are examples only until the emulator wire-extension contract is accepted.

## Source layout extension

Recommended additive modules:

```text
adapter/src/
  dataBreakpoints.ts       # DAP dataBreakpointInfo/setDataBreakpoints
  pointCondition.ts        # bounded condition parser/compiler
  debugPointClient.ts      # optional negotiated emulator extension
  traceControl.ts          # tracepoint/session/route/gate operations
  tracePaging.ts           # bounded page/cursor retrieval
  tracePresentation.ts     # output/custom-event mapping
extension/src/
  traceCommands.ts         # user commands over DebugSession.customRequest
  traceView.ts             # optional bounded status/list view
```

Do not move matching, hit counters, skip logic, change-only behavior, gate state, trace routing, interrupt policy or loss accounting into these modules.

## DAP initialization

When the real negotiated emulator extension is available and the adapter implements it completely:

```ts
capabilities.supportsDataBreakpoints = true;
```

Do not advertise this solely because the emulator event bus exists internally.

No standard DAP capability is invented for rich trace sessions. Trace controls are extension-specific commands layered on top of the active debug session.

## Data breakpoint identity

```ts
type WatchableTarget = {
  space: "iram-lower" | "iram-upper" | "sfr" | "xdata";
  from: number;
  to: number;
  allowedAccess: Array<"read" | "write" | "readWrite">;
  widthBits?: number;
};

type DataIdEntry = {
  id: string;             // opaque DAP dataId
  target: WatchableTarget;
  stopEpochCreated?: number;
};
```

`dataId` lifetime follows DAP semantics and session configuration. It is never a serialized C address/pointer.

For variables backed by an address-preserving memory target, `dataBreakpointInfo` returns a stable opaque id, human description and supported access types. If the target cannot be mapped exactly, return `dataId: null` rather than guessing.

## DAP DataBreakpoint -> emulator watch

Conceptual translation:

```ts
type DapWatchRequest = {
  dataId: string;
  accessType?: "read" | "write" | "readWrite";
  condition?: string;
  hitCondition?: string;
};

type EmulatorWatchSpec = {
  pointType: "watchpoint";
  enabled: true;
  events: string[];
  address: { space: string; from: number; to: number };
  access: string[];
  conditionBytecode?: unknown;
  actions: ["stop"];
};
```

Exact emulator structures and command names must come from the accepted wire extension, not this TypeScript sketch.

The adapter sends the full desired DAP-owned watch set atomically. Emulator-specific trace/watch points created through the richer trace UI are separate configuration identities and must not be accidentally deleted by a DAP `setDataBreakpoints` replacement. The wire contract therefore needs either namespaces/owners or separate replacement collections.

This ownership distinction is a mandatory review point for the emulator wire-extension slice.

## Access mapping

Initial mapping:

```text
DAP read       -> emulator read
DAP write      -> emulator write plus architectural RMW when the accepted contract defines write-watch semantics that way
DAP readWrite  -> union of read and write/RMW
```

The final RMW rule must be copied verbatim from the accepted emulator contract. The adapter never decomposes one canonical RMW event into synthetic reads/writes.

## Condition compiler

The adapter condition parser is deliberately small and bounded.

Recommended grammar for the first integration:

```text
field comparator integer
(field comparator integer) && (...)
(field comparator integer) || (...)
!(...)
```

Allowed fields may include:

```text
oldValue
newValue
oldKnown
newKnown
address
executingPc
```

Allowed comparators map to the emulator's bounded operations: `==`, `!=`, `<`, `<=`, `>`, `>=`, plus reviewed mask helpers. No function calls, property walks outside the allowlist, division, allocation-dependent evaluation or JavaScript execution.

The compiler produces the emulator's accepted bounded postfix form. Invalid/unsupported conditions fail during breakpoint configuration and preserve the previous accepted watch set.

`hitCondition` initially supports only reviewed integer forms. More elaborate DAP hit-condition syntax remains unsupported until explicitly designed.

## Watchpoint stop mapping

Conceptual child stop extension:

```json
{
  "reason": "watchpoint",
  "pc": 4660,
  "watch": {
    "id": 12,
    "sourceEventSequence": 184337,
    "executingPc": 4658,
    "address": {"space":"xdata","value":4096},
    "access":"write",
    "oldValue":{"known":true,"value":4},
    "newValue":{"known":true,"value":5}
  }
}
```

Exact schema is emulator-owned and not frozen here.

Adapter behavior:

1. accept the atomic stopped snapshot returned at safe boundary;
2. create a new normal stop epoch;
3. correlate emulator watch id to DAP breakpoint id where applicable;
4. emit `stopped(reason="data breakpoint", threadId=1)`;
5. retain trigger details for optional debug-point/trace UI and diagnostics.

No extra instruction is executed after the emulator reports the stop boundary.

## Trace control API

Rich tracing uses VS Code extension commands calling `DebugSession.customRequest()`.

Provisional adapter custom-request names:

```text
emu.debugPoints.replace
emu.traces.replace
emu.traceRoutes.replace
emu.traceGates.replace
emu.traces.setEnabled
emu.trace.readPage
emu.trace.getStatus
emu.trace.clearSession
```

These names are DAP-extension API design suggestions, not emulator wire command names. A future implementation may refine naming in the implementation issue without changing semantics.

Every mutation returns a configuration revision and accepted/rejected identifiers. Replacement must be atomic.

## Trace page model

The adapter should expose the emulator's accepted final cursor/after-sequence page metadata essentially losslessly:

```ts
type TracePage = {
  records: CanonicalTraceRecord[];
  next?: string;
  firstSequence?: string;
  lastSequence?: string;
  remaining?: number;
  loss?: {
    firstLostSequence: string;
    lastLostSequence: string;
    lostCount: string;
    reason: string;
  };
};
```

The exact final fields are copied from the accepted emulator facade/wire contract after Issue #14. Sequence values that exceed JavaScript exact integer range remain strings; the adapter must not round them through `number`.

Reads are non-destructive. Clearing trace state is an explicit separate operation.

## Trace output presentation

Console-action tracepoints can render a concise line such as:

```text
[seq 184337] PC=0x1232 XDATA[0x1000] write 0x04 -> 0x05
```

The standard DAP `output` event is appropriate for this explicitly selected presentation action. It is not used as the only storage for canonical trace records.

The adapter may group trace output when the client supports standard output grouping. Output failures do not stop the emulator.

## Custom trace notifications

Recommended custom events are low-volume and coalescible:

```text
emuTraceAvailable
emuTraceStatusChanged
emuTraceLoss
```

A notification carries session/configuration identity and enough cursor/status data for the extension to refresh. It does not carry an unbounded array of trace records.

VS Code extension code receives these through the standard debug extension custom-event API.

## Trace configuration UI

First implementation should prefer normal VS Code commands/QuickPick/InputBox and a bounded tree/status view over a complex webview.

Useful commands:

```text
SAB80535: Add Watchpoint
SAB80535: Add Tracepoint
SAB80535: Enable Trace
SAB80535: Disable Trace
SAB80535: Show Trace Status
SAB80535: Clear Trace Session
```

Configuration can also be stored as workspace JSON files later. No P1000-specific templates belong in the extension core.

## Native logpoint interoperability

Standard DAP `SourceBreakpoint.logMessage` may map to a non-stopping emulator tracepoint only when generic source mapping is implemented and a source line resolves unambiguously to accepted CODE locations.

Address-only instruction breakpoints do not have a general DAP log-message field, so Slice 2 must not pretend that native instruction logpoints exist. Address/event tracepoints remain extension-specific.

## Revision and ownership

The adapter tracks three separate configuration domains:

1. existing Slice-1 CODE instruction breakpoints;
2. DAP-owned stopping data breakpoints;
3. rich emulator trace/watch/gate/session configuration created through extension controls.

The emulator wire extension must define ownership/replacement so that updating one domain cannot silently clear another.

## Compatibility behavior

If the optional debug-point extension is absent:

- `supportsDataBreakpoints` is false/omitted;
- trace commands return a clear unsupported-capability error;
- Slice-1 instruction debugging continues unchanged.

If the base `emu-debug` 1.0 contract is incompatible, existing fatal launch compatibility rules remain in force.

## Test design

Fake and real acceptance must cover at least:

- read/write/readWrite mapping including RMW behavior;
- dataId validity/staleness;
- atomic watch replacement and rejected condition rollback;
- safe-boundary watchpoint stop with exact triggering details;
- tracepoint produces records/output but never stop;
- before/after gates and interrupt policies preserve emulator ordering;
- multi-trace route behavior;
- page retrieval, repeat read, cursor/after-sequence continuation;
- overwrite/loss/suppression/status records;
- large sequence numbers without JavaScript precision loss;
- optional capability absence preserving Slice-1 behavior;
- Linux/Windows fake-vs-real equivalence and no orphan child.
