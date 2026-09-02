# DAP-STEERING-REBASELINE-002 — Post-Slice-1 debugger model rebaseline

**Traceability:** `RVW-002-000-000` provides Steering design direction for
`SPR-002`; it is not the independent Phase-A review.
**Disposition:** ACCEPTED AS STEERING DESIGN DIRECTION; implementation remains dependency-gated.

## Reason

After DAP Slice 1 was accepted and merged, `emuSA80535-N` developed a substantially richer generic debugger design: CODE breakpoints, stopping watchpoints, non-stopping tracepoints, canonical event sequencing, multi-trace routing, before/after gates, interrupt inclusion policies, bounded trace retention and safe-boundary stop semantics.

The original DAP SDP correctly deferred data watchpoints because those emulator semantics did not exist at the time. Leaving that historical phase classification as the current roadmap would now encourage duplicated adapter-side functionality.

## Steering decision

The DAP architecture is rebaselined around a single semantic debugger owner:

- `emuSA80535-N` owns event generation, matching, conditions, counters, routing, gates, retention/loss and stop timing;
- the CLI debugger and DAP adapter are frontends over that same model;
- standard DAP surfaces are used where they fit exactly;
- richer trace controls use VS Code extension/custom-request surfaces rather than being flattened into fake DAP capabilities;
- the verified `emu-debug` 1.0 base remains backward compatible.

## Native versus extension mapping

Accepted direction:

- CODE breakpoint -> existing DAP instruction breakpoint;
- stopping memory/SFR/XDATA watchpoint -> DAP data breakpoint;
- tracepoint -> non-stopping emulator trace point, presented through output and extension-specific controls;
- trace sessions/routes/gates/interrupt policy -> emulator-specific controls transported through a future negotiated debug-protocol extension;
- future logical call/IRQ stack -> consume canonical control-flow/interrupt events rather than disassembly-only inference.

## Dependency boundary

No DAP product code may guess the unfinished emulator wire interface.

Before Slice 2 implementation is activated:

1. emulator Issue #14 must accept the SLC-015..017 runtime/facade and freeze versioning/paging; and
2. a separate emulator wire-integration slice must expose the accepted runtime, CPU producers and safe-boundary stop path through a reviewed versioned optional `emu-debug` extension.

Planning/fake design may proceed, but real product acceptance requires exact fake/real equivalence.

## Documents added

- `SDP/02--Study/DAP-STU-002.md`
- `SDP/03--Requirements/DAP-REQ-002.md`
- `SDP/04--Architecture/DAP-ARCH-002.md`
- `SDP/05--Design/DAP-DES-002.md`
- `protocol/EMU_DEBUG_POINTS_EXTENSION_REQUIREMENTS.md`
- `SDP/Sprints/SPR-002--debug-points-trace-integration/sprint.md`

These extend rather than rewrite the accepted Slice-1 authority.

## Issue cleanup

DAP Issues #1 and #3 are completed historical authorities and require no reopening. There is no active old DAP implementation issue whose scope should be continued. Future DAP work must use a new explicit Slice-2 issue based on this rebaseline.
