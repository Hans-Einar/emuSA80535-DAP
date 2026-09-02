# SPR-002 — DAP debug-point and trace integration

**Traceability:** `SPR-002`; pre-implementation review iteration
`IT-002-000 / SL-002-000-001`; candidate stopping-watch iteration
`IT-002-001 / SL-002-001-001`; later trace iteration
`IT-002-002 / SL-002-002-001`.

## Status

**PLANNED / dependency-gated. Implementation not started.**

Phase A documentation review is **PASS / closed** under Issue #6. This does not
activate either planned product iteration or relax any dependency gate.

This sprint consumes the emulator-owned breakpoint/watchpoint/tracepoint runtime after its stable facade and wire extension are independently accepted.

## Goal

Expose the common emulator debugger model through VS Code without creating a second TypeScript debugger engine.

The planned sprint shall eventually provide:

1. optional debug-point capability negotiation on top of the verified `emu-debug` 1.0 base;
2. native DAP stopping data breakpoints backed by emulator watchpoints;
3. safe-boundary `data breakpoint` stops with trigger details;
4. in a separate later slice, extension-specific tracepoint/session/gate controls;
5. in that later slice, bounded non-destructive trace-page retrieval;
6. in that later slice, console-action trace output and low-volume trace status/availability notifications;
7. per-slice fake-vs-real Linux/Windows acceptance.

## Hard dependency gates

### Gate A — emulator runtime acceptance

`Hans-Einar/emuSA80535-N` Issue #14 must be READY and SLC-015..017 accepted, including stable facade/versioning/paging decisions.

Current status: **NOT SATISFIED** — Issue #14 and PR #16 are open/unmerged;
current emulator master is `bc86d2633b6057529e6fd1e666896c24d72822aa`.

### Gate B — emulator wire integration

A separately authorized emulator slice must expose the accepted runtime through a versioned additive `emu-debug` extension, including CPU producer hookup and safe-boundary watchpoint stop application where required.

The exact emulator commit/release and wire schema become frozen dependencies for this sprint.

Current status: **NOT SATISFIED** — no accepted successor wire issue, PR,
release, or commit exposes CPU producers and safe-boundary watch stops.

### Gate C — Steering activation

Steering/Master must explicitly activate implementation after Gates A and B. Merely having this sprint document does not authorize product changes.

## Slice 2A — stopping-watchpoint vertical

**Planned / dependency-gated / not activated:**
`IT-002-001 / SL-002-001-001`.

In scope:

- adapter optional-capability negotiation;
- `supportsDataBreakpoints` only when fully supported;
- native `dataBreakpointInfo` from the existing Slice-1 Registers scope for
  exact byte-wide SFR children `A`, `B`, `PSW`, and `SP`;
- explicit `dataId: null` for `PC`, composite `DPTR`, bank-selected `R0`–`R7`,
  and any aggregate/dynamic/unknown child without exact identity;
- native `setDataBreakpoints`, opaque session/generation discovery tokens,
  installed DAP breakpoint ids, and public emulator trigger correlation;
- exact accepted bounded condition subset, or atomic rejection of every
  unsupported/nonempty condition/hit condition; no JavaScript evaluation;
- exact RMW/access mapping from emulator authority;
- watchpoint trigger correlation and DAP `data breakpoint` stop;
- atomic rollback and lifecycle behavior across restart/process/variant/load/reset;
- optional-extension absence and complete Slice-1 regression;
- fake emulator updated only to the exact accepted optional extension;
- real-emulator and packaged native VS Code acceptance on Linux and Windows.

The native user proof starts from VS Code's Variables view data-breakpoint
action on one of the four supported register children. A custom Add Watchpoint
command does not satisfy this path.

## Slice 2B — rich non-stopping trace vertical

**Separately planned / dependency-gated / not activated:**
`IT-002-002 / SL-002-002-001`.

In scope only after separate Steering activation:

- custom trace configuration requests exposed through VS Code extension commands;
- trace sessions/routes/gates/enable-disable as transport/presentation only;
- trace-page retrieval and status/loss presentation;
- console-action trace output;
- custom low-volume trace notifications;
- trace fake-real and package/VSIX evidence on Linux and Windows.

Slice 2B may be decomposed again after the exact accepted emulator wire
contract makes the smallest usable trace vertical clear. Its requirements
remain planned; the split does not flatten or remove the richer emulator model.

## Explicit non-scope

- implementing matching/gates/routes/hit counters in TypeScript;
- full SFR/IRAM/XDATA memory browser;
- arbitrary evaluate/watch expressions;
- source maps/source breakpoints;
- source logpoints unless source mapping already exists as an independently accepted prerequisite;
- logical call/IRQ stack;
- call-aware `next`/`stepOut`;
- writeMemory/register mutation;
- attach/TCP/remote trace transport;
- file sinks implemented inside the DAP extension;
- P1000-specific presets or semantics;
- physical host I/O.

## Slice-2A candidate acceptance criteria

| AC | Acceptance |
|---|---|
| `AC2-001` | Emulator without the optional extension still passes the complete accepted Slice-1 launch/debug path; the adapter does not advertise data breakpoints, and no unimplemented trace control is advertised. |
| `AC2-002` | With the accepted extension, `initialize` advertises `supportsDataBreakpoints` but not `supportsDataBreakpointBytes`. From a real packaged VS Code stopped Variables view, the native data-breakpoint action on `A`, `B`, `PSW`, or `SP` issues current-Registers `dataBreakpointInfo` and yields an opaque session/generation token with `canPersist: false`, exact SFR target/access metadata, and no private identity. Well-formed `PC`, `DPTR`, `R0`–`R7`, aggregate/dynamic/unknown, expression/frame, and address/range cases return `dataId: null`; malformed or stale/foreign nonzero variable-reference requests fail clearly. The same native path proceeds through `setDataBreakpoints` and reaches a real safe-boundary hit without an extension-only Add Watchpoint command. |
| `AC2-003` | `setDataBreakpoints` prevalidates and atomically configures the DAP-owned stopping-watch set. Stale tokens and invalid targets/access/conditions reject without corrupting the prior set/revision or rich trace configuration. Each request input receives one ordered DAP `Breakpoint`; successful normalized watches have stable positive integer ids under the documented replacement rules. |
| `AC2-004` | read/write/readWrite and RMW mappings match the exact emulator authority and are proven against the real runtime. |
| `AC2-005` | A matched watchpoint completes the responsible architectural operation, stops at the accepted safe boundary, returns exact public trigger correlation, and produces one DAP `stopped.reason = "data breakpoint"` event whose `hitBreakpointIds` identify the installed DAP breakpoint(s). |
| `AC2-010` | Resume/new-stop preserves same-generation discovery tokens and installed watches; restart/process/variant/load/reset invalidates discovery tokens conservatively; disconnect/new session destroys session identities; trace clear does not affect them. Data-token expiry alone never silently mutates installed configuration, and all installed lifecycle change follows an explicit successful replacement or accepted emulator lifecycle result. |
| `AC2-011` | Linux and Windows fake-real build/test/package/native-VS-Code lanes pass with no orphan process, DAP framing corruption, Slice-1 regression, P1000 coupling, or physical host I/O. |

## Slice-2B planned acceptance criteria

These criteria remain planned and do not enlarge or activate Slice 2A.

| AC | Acceptance |
|---|---|
| `AC2-006` | A tracepoint produces retained/routed canonical trace and optional presentation output without producing a DAP stopped event or changing execution state. |
| `AC2-007` | Before/after gates, multi-trace routes and interrupt inclusion produce the same canonical sequence/result in fake and real emulator tests; the adapter contains no alternate matching/gating implementation. |
| `AC2-008` | Trace page reads are bounded and non-destructive, continue correctly by the accepted cursor/after-sequence semantics, and report loss/suppression/status without JavaScript integer precision loss. |
| `AC2-009` | Console trace actions use bounded DAP output; high-rate canonical trace does not require one DAP event per record. |
| `AC2-012` | Reset/load/clear preserves or invalidates trace configuration, generation, revision, cursor, and retained state exactly as specified by the accepted emulator lifecycle contract and without mutating Slice-2A watches. |
| `AC2-013` | Linux and Windows fake-real/package lanes pass for the trace surface with no orphan process, framing corruption, high-rate DAP firehose, P1000 coupling, or physical host I/O. |

## Review gate

Independent review must challenge:

- whether any emulator semantics leaked into TypeScript implementation;
- DAP data-breakpoint correctness and dataId lifetime;
- RMW/access mapping;
- condition parser boundedness/determinism;
- coexistence of DAP-owned watches and rich emulator point configuration;
- watch stop timing at safe boundary;
- trace backpressure/paging/loss behavior;
- JavaScript integer precision for sequence counters;
- compatibility when optional extension is absent;
- Linux/Windows real runtime behavior.

## Handoff

After the separately accepted product slices, the preferred following work is:

1. address-preserving SFR/IRAM/XDATA/CODE memory views and evaluate/watch expressions; then
2. logical call/return/IRQ stack plus call-aware step-over/out using canonical emulator control-flow events.
