# Emulator debug-point protocol extension requirements

**Traceability:** `DP-CAP-001`–`DP-CAP-006` support `R-032`–`R-050`.
**Status:** DAP consumer requirements pending emulator contract freeze.  
**Base protocol:** accepted `emu-debug` 1.0 remains unchanged.  
**Primary emulator authority:** `emuSA80535-N` Issue #14 and its accepted successor wire-integration slice.

## Compatibility rule

This document does not assign a new `emu-debug` protocol major/minor or freeze emulator command names. It defines the semantic capabilities the DAP repository will require from the future additive extension.

The emulator owns the final wire schema. Once accepted there, this file must be reconciled to exact capability/command/event names before DAP product implementation is declared READY.

Absence of this optional extension must not break existing Slice-1 `emu-debug` 1.0 launch, registers, disassembly, instruction breakpoints, run/pause/step or termination.

## Required semantic capability groups

### DP-CAP-001 — stopping watchpoints

The wire extension shall support bounded atomic configuration of stopping watchpoints using the accepted emulator point/watch model.

It must represent at minimum:

- stable point/watch identity;
- enabled state;
- canonical event/address-space selector;
- inclusive address/range where supported;
- access kind including architectural RMW semantics;
- bounded deterministic condition form;
- stop action;
- accepted/rejected results and configuration revision.

Replacement/ownership rules must distinguish DAP-owned data breakpoints from richer trace/watch configurations so one frontend update cannot silently delete another configuration domain.

### DP-CAP-002 — safe-boundary stop result

When a stopping watch matches, the emulator shall apply the stop request at the accepted next safe execution boundary and return an atomic stopped snapshot plus bounded trigger metadata.

Trigger metadata should include, when known:

- watch/point id;
- canonical source event sequence;
- executing PC responsible for the access;
- address space/address/access;
- old/new known/value fields;
- generation/session identity needed for correlation.

The adapter maps this to DAP `data breakpoint`; the emulator does not emit DAP vocabulary.

### DP-CAP-003 — trace configuration

The wire extension shall expose bounded atomic configuration for the accepted emulator concepts required by DAP extension controls:

- tracepoints;
- trace sessions;
- destinations/rings as applicable to the accepted facade;
- routes;
- before/after gates;
- trace enable/disable;
- interrupt inclusion policy;
- configuration revision/status.

The wire layer must preserve emulator ordering and semantics and must not require the DAP adapter to recompute matches or route sets.

### DP-CAP-004 — bounded trace retrieval

The wire extension shall provide non-destructive bounded trace retrieval using the final cursor/after-sequence semantics frozen by the accepted emulator facade.

Responses shall preserve canonical event identity and report overwrite/loss/suppression status honestly.

Values wider than JavaScript's exact integer range must have a wire representation that can be consumed losslessly by TypeScript, such as fixed-width or decimal strings as frozen by the emulator schema.

Clearing trace state is an explicit mutation separate from reading.

### DP-CAP-005 — low-volume notifications

The wire extension may provide bounded/coalescible notifications for trace availability and status/loss/suppression changes.

The DAP consumer must not require a synchronous event notification for every canonical trace record. Retained storage/page retrieval remains authoritative.

### DP-CAP-006 — condition limits

The handshake/status surface shall expose the relevant fixed limits and supported condition operations/fields so the adapter can validate/compile the DAP-supported condition subset before mutation.

Unsupported conditions must be rejected atomically without changing the prior configuration.

## Event semantic authority

Canonical event kinds, sequence/generation behavior, before/source/derived/after ordering, watch-ID ordering, gate semantics, trace routing, interrupt inclusion, loss/suppression behavior and stop priority are emulator-owned.

The DAP adapter consumes these semantics as data. It shall not infer missing canonical events from debugger output text or private memory inspection.

## Required lifecycle behavior

Reset/load/clear semantics must follow the accepted debugger runtime contract, including configuration preservation/invalidation, generation/sequence behavior and CODE-selector invalidation.

The extension must define which debug-point identities remain valid after reset/load and how configuration revisions change. The DAP adapter must invalidate stale `dataId`/point mappings when required by that contract.

## Base breakpoint compatibility

Existing `replaceCodeBreakpoints` remains supported by the accepted 1.0 base. The emulator may internally implement it using the common debug-point engine, but the wire extension shall not require a DAP-side migration of existing instruction-breakpoint configuration.

## Required process verification

The accepted emulator implementation must include Linux and Windows process-level tests for:

- optional capability negotiation;
- atomic point/trace mutation;
- stopping watchpoint safe-boundary result;
- trace non-stop execution;
- bounded page retrieval and loss reporting;
- malformed/oversized configuration rejection;
- lifecycle reset/load/clear behavior;
- coexistence with existing CODE breakpoint configuration;
- stdout protocol isolation and cleanup/no orphan process;
- no physical host-I/O side effect.

## DAP acceptance dependency

The DAP Slice 2 cannot be final-accepted until this file is reconciled to an exact accepted emulator commit/release and the fake/real contract suites pass without adapter-only semantic exceptions.
