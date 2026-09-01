# DAP-MND-001 — Mandate for emuSA80535-DAP

**Traceability:** `M-001`
**Authority:** [GitHub Issue #1](https://github.com/Hans-Einar/emuSA80535-DAP/issues/1)
**State:** Slice 1 implemented, reviewed, and verified READY on DAP product HEAD
`36639b48ddb2ffbafa14c00da794fe1734f7483b` with current emulator master
`d9f80eba172dd9d7281aaa9e5cfef461b6b9709b` (runtime merge `1a6aa397…`);
later-slice scope remains target

## Mission

`emuSA80535-DAP` will provide a Visual Studio Code debugging experience for
firmware running in the offline `Hans-Einar/emuSA80535-N` emulator. The product
boundary comprises a VS Code extension, a Debug Adapter Protocol (DAP) adapter,
an emulator-control client, and firmware-generic symbol/source-map ingestion.

The first target is `emuSA80535-N` and VS Code desktop. The design may preserve
clean seams for later reuse, but it is not a universal 8051 framework.

## Repository boundaries

This repository owns:

- VS Code debugger contributions, launch configuration, extension packaging,
  and adapter launch;
- DAP translation and session state;
- the client side of a versioned emulator-control protocol;
- generic symbol/source-map parsing and debugger presentation;
- adapter tests, protocol fakes, and synthetic firmware fixtures.

The `emuSA80535-N` repository owns:

- CPU and peripheral emulation;
- deterministic instruction execution;
- the headless emulator runtime;
- the server side of the stable debug-control protocol;
- architectural state, memory, breakpoint enforcement, and execution events.

Cross-repository behavior must use a public, versioned contract. The adapter
must not read emulator private structs. Merged lower-level C seams are not, by
themselves, proof that the cross-process debug contract exists.

## Safety boundary

The debugger controls only an offline emulator process. Debug actions must not
open serial ports, GPIO, field buses, or other physical-machine interfaces, and
must not actuate real machinery as a side effect. Such host I/O is outside this
repository and is disabled by contract.

## Initial distribution objective

The extension will be installable as a semantically versioned `.vsix`.
Marketplace publication is a later release operation, but the manifest,
licensing, platform support, and release process must remain Marketplace-ready.
The emulator executable is not bundled initially. The user installs a compatible
emulator separately.

## Non-goals

- P1000 addresses, process semantics, signal names, hydraulics, or firmware
  behavior;
- production DAP, extension, emulator-transport, or emulator implementation
  under Issue #1;
- physical hardware debugging or machine I/O;
- a universal compiler/debug-info format;
- source-level stepping, watchpoints, state mutation, attach, or historical
  call-stack reconstruction in the first implementation slice.

## Ready for Slice 1

`READY-FOR-SLICE-1` means all Issue #1 documents are substantive; the live
emulator default and explicitly dated historical evidence are accurately
distinguished; the DAP/runtime/transport choices and minimum emulator protocol
are frozen; every satisfied, partial, or missing emulator prerequisite is
explicit; requirements trace into architecture, design, and a narrow sprint
contract; an independent review and verification pass have accepted the
package; the documentation-only PR is open; and no production implementation
has begun.

Readiness authorizes a later Steering decision to begin Slice 1. It does not
itself start `SPR-001`.
