# DAP-DES-002 — DAP design for emulator-owned debug points

**Traceability:** `D-011` refines `A-009` for planned Slice 2A and Slice 2B.
**State:** implementation-planning design.
**Extends:** `DAP-DES-001`.
**Important:** this document freezes no emulator wire capability, command,
event, or schema name. Those names must come from the accepted emulator
wire-extension authority.

## Source layout extension

Recommended additive modules by planned product slice:

```text
adapter/src/
  dataBreakpoints.ts       # Slice 2A: native DAP data breakpoints
  pointCondition.ts        # Slice 2A only for an exact accepted subset
  debugPointClient.ts      # Slice 2A: optional negotiated integration
  traceControl.ts          # Slice 2B: rich trace controls
  tracePaging.ts           # Slice 2B: bounded page/cursor retrieval
  tracePresentation.ts     # Slice 2B: output/custom-event mapping
extension/src/
  traceCommands.ts         # Slice 2B only
  traceView.ts             # Slice 2B only, optional bounded view
```

Do not move matching, hit counters, skip logic, change-only behavior, gate state, trace routing, interrupt policy or loss accounting into these modules.

## DAP initialization

When the real negotiated emulator extension is available and the adapter implements it completely:

```ts
capabilities.supportsDataBreakpoints = true;
```

Do not advertise this solely because the emulator event bus exists internally.

Slice 2A advertises no rich trace control. No standard DAP capability is
invented for Slice 2B trace sessions; those future controls are
extension-specific and layered on top of the active debug session.

## Data breakpoint identity

```ts
type WatchableTarget = {
  space: "sfr";
  from: number;
  to: number;
  allowedAccess: Array<"read" | "write" | "readWrite">;
  widthBits: 8;
};

type DataIdEntry = {
  id: string;             // opaque discovery token
  sessionNonce: string;   // adapter-private; never exposed or persisted
  targetGeneration: number;
  target: WatchableTarget;
};
```

The entry is bounded and scoped to one active debug session plus an explicit
target/configuration generation. It is not keyed by the stop epoch, is
never a serialized address/C pointer/emulator identity, is never reused across
sessions, and yields `canPersist: false`.

### Slice-2A native origin contract

The only supported request origin is:

```ts
type Slice2ADataBreakpointInfoArguments = {
  variablesReference?: number; // nonzero only for the current Registers scope
  name: string;
  frameId?: number;
};
```

The adapter validates that the session is stopped and
`variablesReference`, when nonzero, is exactly the current Registers handle.
Missing/non-string names, invalid argument types, stale or foreign nonzero
handles, and aggregate/non-Registers nonzero handles fail the DAP request with
a bounded actionable message. The exact, case-sensitive supported children
resolve as follows:

| Child | Target | Width | Returned access types |
|---|---|---|---|
| `A` | SFR `0xe0..0xe0` | 1 byte | `read`, `write`, `readWrite` |
| `B` | SFR `0xf0..0xf0` | 1 byte | `read`, `write`, `readWrite` |
| `PSW` | SFR `0xd0..0xd0` | 1 byte | `read`, `write`, `readWrite` |
| `SP` | SFR `0x81..0x81` | 1 byte | `read`, `write`, `readWrite` |

A well-formed request against the current Registers handle for `PC`, `DPTR`,
`R0`–`R7`, an unknown child, or another child without one exact stable SFR
identity returns success with `dataId: null` and an explanatory description.
`PC` is not a data target, `DPTR` is a two-SFR aggregate, and `R0`–`R7` are
bank-selected. A well-formed request using the DAP `frameId`/expression origin
or address/range form also succeeds with `dataId: null`. Slice 2A leaves
`supportsDataBreakpointBytes` false/omitted.

The real native UI acceptance path is VS Code's Variables view data-breakpoint
action on `A`, `B`, `PSW`, or `SP`. A product test must observe the resulting
`dataBreakpointInfo` and `setDataBreakpoints` requests; a custom extension Add
Watchpoint command is not a substitute.

The source Registers handle expires under the accepted Slice-1 stop-epoch
rules. Once resolved, the opaque token is tied to the session and target
generation. Resume/new-stop alone leaves that generation unchanged. Restart,
process replacement, debuggee variant/configuration change, load, reset,
disconnect, and a new session invalidate tokens conservatively. The accepted
emulator lifecycle may later narrow only load/reset invalidation. Expiring a
token never silently mutates an installed data breakpoint.

## DAP DataBreakpoint -> emulator watch

The adapter resolves each DAP input to a conceptual request containing the
exact SFR target, requested access kind, stopping action, an adapter-generated
public correlation identity, and only an exact accepted bounded condition.
This list is not an emulator wire schema. Exact structures, values, and command
names must come from the accepted wire extension.

The DAP-side input shape is:

```ts
type DapWatchRequest = {
  dataId: string;
  accessType?: "read" | "write" | "readWrite";
  condition?: string;
  hitCondition?: string;
};
```

The adapter sends the full desired DAP-owned watch set atomically. Emulator-specific trace/watch points created through the richer trace UI are separate configuration identities and must not be accidentally deleted by a DAP `setDataBreakpoints` replacement. The wire contract therefore needs either namespaces/owners or separate replacement collections.

This ownership distinction is a mandatory review point for the emulator wire-extension slice.

### Prevalidation, result ordering, and identity domains

`setDataBreakpoints` resolves and validates the complete input list before any
emulator mutation. Validation covers token/session/generation, supported
target/access, condition/hit-condition syntax, duplicate/conflicting entries,
and accepted limits. A stale token returns an unverified result with a bounded
message directing the client to rediscover the target. If any entry fails,
the adapter does not send a partial proposal and leaves the prior installed
set, public-correlation map, DAP ids, and configuration revision unchanged.

The response always contains one DAP `Breakpoint` per input in the same order.
On atomic failure, the directly invalid entries explain their rejection and
otherwise valid peers explain that the transaction was not applied. On
success, every installed entry has a positive integer DAP `Breakpoint.id`.
That id is distinct from the source string `dataId`, the emulator public
correlation id, and the exact emulator configuration revision.

Across successful replacements, an unchanged normalized watch
(target/access/condition/hit condition) retains its DAP id. Removed or changed
watches retire their ids; retired ids are not reused during that debug session.
The adapter advances/replaces its accepted revision only from a successful
atomic emulator result and retains a lossless representation if the revision
can exceed JavaScript's exact integer range.

## Access mapping

Initial mapping:

```text
DAP read       -> emulator read
DAP write      -> emulator write plus architectural RMW when the accepted contract defines write-watch semantics that way
DAP readWrite  -> union of read and write/RMW
DAP omitted    -> write
```

The final RMW rule must be copied verbatim from the accepted emulator contract. The adapter never decomposes one canonical RMW event into synthetic reads/writes.

## Condition compiler

The adapter condition parser, if enabled for Slice 2A at all, is deliberately
small and bounded. It may accept and compile only the exact fields, operators,
grammar, limits, and representation frozen by the accepted emulator wire
contract. This document does not propose a provisional subset. Before that
freeze, all non-empty `condition` and `hitCondition` values are rejected
clearly and atomically. No function call, property walk, allocation-dependent
evaluation, or JavaScript execution is permitted. Invalid/unsupported
conditions preserve the previous accepted watch set.

## Watchpoint stop mapping

The exact child stop schema is emulator-owned and is not named or frozen here.
It must carry a public correlation identity sufficient to map each reported
trigger back to the installed DAP breakpoint, plus the accepted safe-boundary
snapshot and bounded details required by `DP-CAP-002`.

Adapter behavior:

1. accept the atomic stopped snapshot returned at safe boundary;
2. create a new normal stop epoch;
3. correlate every public emulator trigger identity to its installed DAP breakpoint id;
4. emit `stopped(reason="data breakpoint", threadId=1)`;
5. set `hitBreakpointIds` to the corresponding positive integer DAP ids when
   sufficient correlation is available, and retain bounded trigger details for
   diagnostics/later UI.

No extra instruction is executed after the emulator reports the stop boundary.

## Slice-2B trace control API

Rich tracing is not part of Slice 2A. Separately planned Slice 2B uses VS Code extension commands calling `DebugSession.customRequest()`.

Planned DAP-extension custom-request suggestions for Slice 2B:

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

## Slice-2B trace page model

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

## Slice-2B trace output presentation

Console-action tracepoints can render a concise line such as:

```text
[seq 184337] PC=0x1232 XDATA[0x1000] write 0x04 -> 0x05
```

The standard DAP `output` event is appropriate for this explicitly selected presentation action. It is not used as the only storage for canonical trace records.

The adapter may group trace output when the client supports standard output grouping. Output failures do not stop the emulator.

## Slice-2B custom trace notifications

Recommended custom events are low-volume and coalescible:

```text
emuTraceAvailable
emuTraceStatusChanged
emuTraceLoss
```

A notification carries session/configuration identity and enough cursor/status data for the extension to refresh. It does not carry an unbounded array of trace records.

VS Code extension code receives these through the standard debug extension custom-event API.

## Slice-2B trace configuration UI

First implementation should prefer normal VS Code commands/QuickPick/InputBox and a bounded tree/status view over a complex webview.

Useful commands:

```text
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

Slice 2A fake and real acceptance must cover at least:

- native VS Code Variables-view discovery from each of `A`, `B`, `PSW`, and
  `SP`, plus `dataId: null` for `PC`, `DPTR`, and `R0`–`R7`;
- malformed/stale origin and stale-generation token behavior;
- read/write/readWrite mapping including the exact accepted RMW behavior;
- one ordered response per input, stable/retired DAP-id rules, atomic watch
  replacement, and rejected-condition rollback;
- safe-boundary watchpoint stop with public trigger correlation,
  `reason="data breakpoint"`, and `hitBreakpointIds`;
- reset/load/restart/process/variant/session lifecycle separation between
  discovery tokens and installed configuration;
- optional capability absence preserving every Slice-1 behavior;
- Linux/Windows fake-real, packaged VS Code, framing, cleanup, and no physical
  I/O evidence.

Separately planned Slice 2B acceptance covers trace non-stop behavior,
before/after gates, interrupt policies, routes, bounded repeatable paging,
loss/suppression/status, exact wide counters, console output, notifications,
and its own Linux/Windows fake-real/package evidence.
