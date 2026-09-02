# Implementation notes — SPR-002

## Current product status

**Planned / dependency-gated / not started.** No Slice-2 adapter, extension,
fake, UI, or protocol product code is authorized by Issue #6 Phase A.

## Phase A

PR #5 supplies the initial Steering rebaseline at `6fc619845…`. Master has
opened documentation-only `IT-002-000 / SL-002-000-001` for fresh independent
review, correction, traceability reconciliation, and verification.

Gate A and Gate B are both unsatisfied at activation. The expected Phase-A
checkpoint is `WAITING_FOR_EMULATOR_CONTRACT`, not product readiness.

Fresh `RVW-002-000-001` returned CHANGES_REQUIRED with `CR-023`–`CR-027`:
native watchable origin, DAP data identity lifecycle/correlation, product-slice
width, R-027 supersession linkage, and whitespace. No product or wire work was
performed. A fresh correction worker and re-review are required.

### Corrective worker result

The fresh worker corrected only `CR-023`–`CR-027` in the documentation and
traceability surface:

- `CR-023`: Slice 2A now has a concrete native VS Code Variables-view origin
  over the existing stable byte-wide SFR-backed register children `A`, `B`,
  `PSW`, and `SP`; non-exact children return `dataId: null`.
- `CR-024`: discovery token, installed DAP `Breakpoint.id`, emulator public
  correlation identity, and configuration revision are separate domains with
  explicit session/generation lifecycle, stale behavior, ordered responses,
  atomic rollback, and stop correlation.
- `CR-025`: the first product iteration is a thin stopping-watchpoint Slice
  2A; rich non-stopping trace work moved to separately planned, unactivated
  `IT-002-002 / SL-002-002-001`.
- `CR-026`: the historical `R-027` phase supersession now targets replacement
  requirements `R-036` and `R-040`; `S-002` remains context.
- `CR-027`: the ten reported trailing spaces were removed.

No adapter, extension, fake, test, emulator, manifest, or package product file
was changed, and no emulator wire name was invented. `CR-023`–`CR-027` remain
open/in-progress pending fresh `RVW-002-000-002` and
`VER-002-000-001`. Gate A and Gate B remain unsatisfied, so product status is
still planned/dependency-gated and the expected external disposition remains
`WAITING_FOR_EMULATOR_CONTRACT`.

Fresh `RVW-002-000-002` accepted corrective commit `1e83b25…`, resolved
`CR-023`–`CR-027`, and raised no new finding. Phase-A verification is active;
both product slices remain planned/dependency-gated.
