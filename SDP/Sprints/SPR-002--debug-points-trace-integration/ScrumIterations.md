# Scrum iterations — SPR-002

## IT-002-000 — Phase A independent SDP review

**State:** Active documentation-only review

**Slice:** `SL-002-000-001`

**Authority:** DAP Issue #6 and Steering rebaseline PR #5 at
`6fc619845f159f4ff0fb1b2caa608c9073b58de4`

### Slice contract

**Goal:** Independently review and, where necessary, correct the post-Slice-1
study, requirements, architecture, design, semantic protocol-extension
requirements, sprint, handoff, and Steering record so Slice 2 consumes one
emulator-owned debugger model.

**Files expected to change:** the eight PR #5 documents; this Phase-A iteration
and implementation notes; `SDP/CodeReview/DAP-SLICE2-REV-001.md`;
`SDP/Verification/DAP-SLICE2-VER-001.md`; and the three traceability files.

**Invariants:** Slice 1 remains verified/closed; `SPR-002` and its product
iteration remain planned/dependency-gated; the emulator owns matching,
conditions, sequence, gate/route/retention/loss semantics and safe-boundary
stops; DAP/CLI are frontends over that model; tracepoints do not stop; high-rate
trace uses emulator-owned bounded paging; no provisional emulator capability,
command, event, or schema name becomes frozen; absence of the optional extension
preserves Slice 1.

**Non-goals:** adapter/extension/fake product code, emulator code or wire
commands, CPU producers, UI implementation, source maps/logpoints, memory
browser, logical stack, writes, P1000 presets, physical I/O, PR merge, or product
Slice-2 activation.

**Traceability:** `M-001`, `S-002`, `R-027`, `R-032`–`R-055`, `A-009`,
`D-011`, `DP-CAP-001`–`DP-CAP-006`, `RVW-002-000-000`, `SPR-002`,
`IT-002-000`, `SL-002-000-001`, `RVW-002-000-001`, and
`VER-002-000-001`.

**Required review:** challenge all fourteen Issue #6 review points, exact DAP
data-breakpoint semantics, opacity/lifetime, RMW, conditions, trace non-stop,
paging/backpressure, custom surfaces, ownership coexistence, lifecycle,
uint64/JavaScript precision, optional absence, neutrality, and slice shape.

**Required verification:** prove documentation-only scope; parse YAML/NDJSON;
validate trace endpoints/statuses and internal references; confirm accepted
Slice-1 files/statuses remain closed; confirm no provisional wire names are
frozen; revalidate emulator Issue #14 and successor wire dependency state.

**Completion signal:** fresh review is accepted after any correction, Phase-A
verification passes, traceability is coherent, PR #5 remains unmerged, and the
Master reports `WAITING_FOR_EMULATOR_CONTRACT` unless Gates A and B are both
accepted.

### Dependency status at activation

- Gate A: **not satisfied** — emulator Issue #14 and takeover PR #16 are open;
  no Steering merge/acceptance is recorded.
- Gate B: **not satisfied** — no separately accepted additive `emu-debug`
  wire-extension slice exposes CPU producers and safe-boundary watch stops.
- Preserved WIP `356836637d5ff432d91fc508fd55b2f17b45cdb3` and PRs #11/#12
  are inputs, not accepted external contracts.

## IT-002-001 — Candidate Slice-2 product implementation

**State:** Planned / dependency-gated / not activated

**Slice:** `SL-002-001-001`

Implementation requires accepted Gates A and B, exact wire names reconciled
into the DAP authority, fake/real contract parity, and a separate Steering
activation. Phase A authorizes no product code.
