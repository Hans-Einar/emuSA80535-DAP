# Scrum iterations — SPR-001

## IT-001-000 — SDP foundation and Slice-1 readiness

**State:** Active pre-implementation documentation iteration  
**Slice:** `SL-001-000-001`  
**Authority:** GitHub Issue #1

### Why now

The repository had only bootstrap folders. DAP semantics, process ownership,
actual emulator seams, cross-repository prerequisites, packaging, and the first
vertical acceptance path had to be frozen before implementation could safely
start.

### Worker assignment

Author only the documents and traceability named in the slice contract. Inspect
the current emulator and public primary sources. Make target/current labels
explicit. Do not create production/test code, manifests, build configuration,
Issues, PRs, review conclusions, or verification conclusions.

### Worker result

The documentation implementation pass produced the planned authored artifacts
and a frozen minimum `emu-debug` 1.0 requirement. It selected:

- external Node.js/TypeScript adapter on DAP stdio;
- separate launch-owned headless emulator child on NDJSON stdio;
- launch-first, separately installed emulator resolution;
- raw 64-KiB/address-level Slice 1 with one thread/current frame/registers,
  authoritative minimal disassembly, one accepted instruction breakpoint,
  bounded continue/adapter-local pause, and instruction `stepIn`.

It identified `EMU-BLK-001`–`EMU-BLK-010` as hard cross-repository
prerequisites. `SPR-001` remains planned/not started.

### Required next passes

1. Fresh reviewer performs `RVW-001-000-001` and records findings in
   `SDP/CodeReview/DAP-SDP-REV-001.md`.
2. If blocking findings exist, Master opens a corrective documentation
   iteration and assigns a fresh worker.
3. Fresh verifier performs `VER-001-000-001` only after accepted review and
   records repeatable evidence in `SDP/Verification/DAP-SDP-VER-001.md`.
4. Master reconciles sprint documents and traceability, opens the
   documentation-only PR, and decides whether the gate is
   `READY-FOR-SLICE-1`.

### Verification plan

- required-document and substantive-content checks;
- authoritative URL and emulator permalink checks;
- fenced JSON parsing, YAML parsing, and NDJSON per-line parsing;
- Mermaid block inventory/syntax review;
- requirement ID definition/reference and relation-chain checks;
- repository diff allowlist proving documentation-only changes;
- no production code/config/test/fixture creation and no P1000 semantic;
- review of DAP sequencing, breakpoint replacement, handle epochs, stopped
  reasons, disassemble count, pause bound, and launch-owned cleanup.

### Carry-forward

Open Steering decisions are documented in `Handoff.md`. No product
implementation task may be inferred or started from this iteration.

### Independent review `RVW-001-000-001`

**Reviewed commit:** `ab231769fb78bcb44a11ecdc5791d1f69b66ea3c`

**Disposition:** **changes-required**

**Next iteration:** corrective documentation; product Slice 1 remains not started

The fresh review confirmed the default-emulator/candidate-PR distinction,
process boundary, private-internal exclusion, firmware neutrality, logical
stack restraint, broad deferrals, and the credible Linux/Windows VSIX path. It
raised these blocking findings:

- `CR-001`: instruction-breakpoint hits use the wrong DAP stopped reason;
- `CR-002`: `code:HHHH` memory references are conflated with DAP numeric
  disassembly addresses;
- `CR-003`: `supportsSteppingGranularity` is advertised without complete
  request semantics;
- `CR-004`: authoritative backward decoding is not defensible for ambiguous
  variable-length raw CODE without a rule;
- `CR-005`: raw CODE `readMemory` is an unused accidental Slice-1 blocker;
- `CR-006`: child state across bounded `run` yields and adapter-local pause is
  undefined;
- `CR-007`: the two-record handshake fence is NDJSON, not one valid JSON value.

Full evidence and required corrections are in
`SDP/CodeReview/DAP-SDP-REV-001.md`. `VER-001-000-001` must not start until a
fresh corrective worker resolves these findings and a separate re-review
accepts the correction.
