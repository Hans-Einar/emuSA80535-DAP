# Scrum iterations — SPR-002

## IT-002-000 — Phase A independent SDP review

**State:** Closed / verified by `VER-002-000-002`

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
`IT-002-000`, `SL-002-000-001`, `RVW-002-000-001`,
`IT-002-001`, `SL-002-001-001`, `IT-002-002`, `SL-002-002-001`, and
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

## IT-002-001 — Candidate stopping-watchpoint product implementation

**State:** Planned / dependency-gated / not activated

**Slice:** `SL-002-001-001` — thin native stopping-watchpoint vertical

Implementation requires accepted Gates A and B, exact wire names reconciled
into the DAP authority, fake/real contract parity, and a separate Steering
activation. Phase A authorizes no product code.

Bounded scope: optional negotiation; existing Registers-origin `A/B/PSW/SP`
identity; native `dataBreakpointInfo`/`setDataBreakpoints`; session/generation
token and installed-breakpoint lifecycle; exact access/RMW semantics;
safe-boundary stop and public trigger correlation; atomic rollback; exact
accepted bounded condition subset or rejection of unsupported/nonempty forms;
optional-absence/Slice-1 regression; and Linux/Windows fake-real/package/native
VS Code evidence. It contains no trace controls, paging, output, notification,
or UI product work.

## IT-002-002 — Planned rich non-stopping trace product implementation

**State:** Planned / dependency-gated / not activated

**Slice:** `SL-002-002-001` — tracepoints/sessions/routes/gates/paging/output/UI

This later iteration preserves the emulator-owned rich trace model and may be
split further before activation. It requires accepted Gates A and B, exact
wire reconciliation, and separate Steering activation. It does not form part
of the thin stopping-watchpoint Slice 2A contract.

### Independent review `RVW-002-000-001`

**Reviewed HEAD:** `4659c7be9b3218880dea205f0f8fcb7284324e92`

**Review commit:** `9bf20caea217259b73ed9addf71f2feb1642ae0f`

**Disposition:** **CHANGES_REQUIRED**

The fresh reviewer accepted the central emulator-ownership, safe-stop, RMW
non-synthesis, bounded-condition, non-stopping trace, paging/backpressure,
custom-surface, ownership-domain, uint64, optional-absence, neutrality, and
non-wire-name direction. Five documentation findings remain:

- `CR-023` HIGH — no concrete native `dataBreakpointInfo` origin exists while
  address-preserving watchable identities remain only near-term `R-051`.
- `CR-024` HIGH — `dataId`, `canPersist`, stale identity, installed breakpoint
  identity, and stop correlation are not normatively separated per DAP 1.71.
- `CR-025` HIGH — candidate product Slice 2 is too broad; the stopping-watch
  vertical must be separated from rich trace/session/route/gate/paging/UI work.
- `CR-026` MEDIUM — machine traceability points R-027 phase supersession to the
  study rather than replacement requirements authority.
- `CR-027` LOW — ten trailing-whitespace diff-check failures.

A fresh corrective documentation worker addresses only these findings. Fresh
`RVW-002-000-002` must accept the correction before Phase-A verification.
Both product iterations remain planned and dependency-gated.

### Corrective re-review `RVW-002-000-002`

**Reviewed correction:** `1e83b25bc3c6b6964d1915bc1b7626524f04d31f`

**Review commit:** `c8a387df6a99279816d5856f1c2c9170128fe672`

**Disposition:** **ACCEPTED; no blocking Phase-A finding remains**

The fresh reviewer independently confirmed the A/B/PSW/SP native SFR origin,
opaque `canPersist:false` data discovery token, separate installed breakpoint /
emulator correlation / revision identities, atomic stale-token behavior,
watch-only Slice 2A, separately planned rich-trace Slice 2B, R-027 supersession
to R-036/R-040, and clean diff. `CR-023`–`CR-027` are resolved with no new
finding.

DAP 1.71's current-suspended-state wording remains the portable client
guarantee. Any bounded internal token acceptance beyond a resume is explicitly
an adapter implementation guarantee within the same session/target generation,
not persistence advertised to the client; `canPersist:false` and lifecycle
invalidation prevent cross-session or structurally stale reuse.

Phase-A verification may proceed. Product Slice 2A/2B remain unactivated and
dependency-gated.

### Phase-A verification `VER-002-000-001`

**Verified HEAD:** `f20e10f348a5923f3731383f30055839279400da`

**Verification commit:** `92b7d3843b592644500c4041d8b808c180241de2`

**Disposition:** **PHASE_A_FAIL**

All fourteen semantic checks, DAP 1.71 mapping, JSON/YAML/NDJSON/traceability,
99/99 Slice-1 regression, docs-only scope, product/authority blob preservation,
and live dependency classification passed. One handoff inconsistency remains:
lines 12–16 still say `RVW-002-000-002` is pending and `CR-023`–`CR-027` are
open despite the accepted review and resolved registry state.

`CR-028` requires a one-file Handoff correction, fresh
`RVW-002-000-003`, and fresh `VER-002-000-002`. Gates A and B remain blocked;
product slices remain planned/unactivated.

### Handoff corrective re-review `RVW-002-000-003`

**Reviewed correction:** `56eb23c3690b27fe9046cf1915ea6edfd04bde35`

**Review commit:** `0d294f19efcb1950239dd7b117dd01d39a23f1a7`

**Disposition:** **ACCEPTED**

The fresh reviewer confirmed the one-file correction removes stale
`RVW-002-000-002` / `CR-023`–`CR-027` status, accurately records the first
verification and `CR-028`, preserves Gate A/B and product gating, and changes
no semantic contract or traceability. `CR-028` is resolved for review with no
new finding. Fresh `VER-002-000-002` may run.

### Phase-A re-verification `VER-002-000-002`

**Verified HEAD:** `530c8788bc4a423d651859e145bf31f4ea70bf14`

**Verification commit:** `a7df71152d660e39b09744e67234cff1dbe815b1`

**Disposition:** **PHASE_A_PASS / WAITING_FOR_EMULATOR_CONTRACT**

Fresh verification reproduced CR-028 closure and passed all fourteen Issue #6
semantic points, official DAP 1.71 assertions, JSON/YAML/NDJSON/traceability,
five diff-check ranges, internal references, docs-only scope, 64/64 Slice-1
authority/product blob preservation, and 99/99 tests. `CR-023`–`CR-028` are
verified resolved.

Gate A remains not satisfied: emulator master is `bc86d263…`, Issue #14 is
open, and PR #16 is open/unmerged at `1e588d28…`. Gate B remains not satisfied:
PR #16 explicitly excludes CPU producers, safe-boundary CPU stop application,
and wire exposure, and no accepted successor wire contract exists.

`IT-002-000 / SL-002-000-001` close verified. `SPR-002`, stopping-watch Slice
2A, and rich-trace Slice 2B remain planned/dependency-gated and unactivated.
