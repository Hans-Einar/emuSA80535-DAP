# SPR-002 — DAP debug-point and trace integration

## Status

**PLANNED / dependency-gated. Implementation not started.**

This sprint consumes the emulator-owned breakpoint/watchpoint/tracepoint runtime after its stable facade and wire extension are independently accepted.

## Goal

Expose the common emulator debugger model through VS Code without creating a second TypeScript debugger engine.

The candidate vertical slice shall provide:

1. optional debug-point capability negotiation on top of the verified `emu-debug` 1.0 base;
2. native DAP stopping data breakpoints backed by emulator watchpoints;
3. safe-boundary `data breakpoint` stops with trigger details;
4. extension-specific tracepoint/session/gate controls;
5. bounded non-destructive trace-page retrieval;
6. console-action trace output and low-volume trace status/availability notifications;
7. fake-vs-real Linux/Windows acceptance.

## Hard dependency gates

### Gate A — emulator runtime acceptance

`Hans-Einar/emuSA80535-N` Issue #14 must be READY and SLC-015..017 accepted, including stable facade/versioning/paging decisions.

### Gate B — emulator wire integration

A separately authorized emulator slice must expose the accepted runtime through a versioned additive `emu-debug` extension, including CPU producer hookup and safe-boundary watchpoint stop application where required.

The exact emulator commit/release and wire schema become frozen dependencies for this sprint.

### Gate C — Steering activation

Steering/Master must explicitly activate implementation after Gates A and B. Merely having this sprint document does not authorize product changes.

## In scope

- adapter optional-capability negotiation;
- `supportsDataBreakpoints` only when fully supported;
- `dataBreakpointInfo` and `setDataBreakpoints`;
- bounded condition compiler for the explicitly accepted subset;
- exact RMW/access mapping from emulator authority;
- watchpoint trigger correlation and DAP `data breakpoint` stop;
- custom trace configuration requests exposed through VS Code extension commands;
- trace sessions/routes/gates/enable-disable as transport/presentation only;
- trace-page retrieval and status/loss presentation;
- console-action trace output;
- custom low-volume trace notifications;
- fake emulator updated to the exact accepted optional extension;
- real-emulator equivalence tests;
- package/VSIX regression tests on Linux and Windows.

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

## Candidate acceptance criteria

| AC | Acceptance |
|---|---|
| `AC2-001` | Emulator without the optional extension still passes the complete accepted Slice-1 launch/debug path and the adapter does not advertise data breakpoints/trace controls. |
| `AC2-002` | With the accepted extension, `initialize` advertises data breakpoints and `dataBreakpointInfo` returns valid opaque identities only for exactly watchable targets. |
| `AC2-003` | `setDataBreakpoints` atomically configures the DAP-owned stopping-watch set; invalid conditions/access/ranges reject without corrupting the prior set or rich trace configuration. |
| `AC2-004` | read/write/readWrite and RMW mappings match the exact emulator authority and are proven against the real runtime. |
| `AC2-005` | A matched watchpoint completes the responsible architectural operation, stops at the accepted safe boundary, returns exact trigger correlation, and produces one DAP `data breakpoint` stop. |
| `AC2-006` | A tracepoint produces retained/routed canonical trace and optional presentation output without producing a DAP stopped event or changing execution state. |
| `AC2-007` | Before/after gates, multi-trace routes and interrupt inclusion produce the same canonical sequence/result in fake and real emulator tests; the adapter contains no alternate matching/gating implementation. |
| `AC2-008` | Trace page reads are bounded and non-destructive, continue correctly by the accepted cursor/after-sequence semantics, and report loss/suppression/status without JavaScript integer precision loss. |
| `AC2-009` | Console trace actions use bounded DAP output; high-rate canonical trace does not require one DAP event per record. |
| `AC2-010` | Reset/load/clear correctly invalidate or preserve DAP dataIds/trace configuration exactly as specified by the accepted emulator lifecycle contract. |
| `AC2-011` | Linux and Windows build/test/package/real-emulator lanes pass with no orphan process, DAP framing corruption, P1000 coupling or physical host I/O. |

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

After this slice, the preferred following work is:

1. address-preserving SFR/IRAM/XDATA/CODE memory views and evaluate/watch expressions; then
2. logical call/return/IRQ stack plus call-aware step-over/out using canonical emulator control-flow events.
