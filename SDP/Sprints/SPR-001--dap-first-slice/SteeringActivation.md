# Steering activation — IT-001-002 / SL-001-002-001

Status: **AUTHORIZED TO START WITH GATED REAL-EMULATOR INTEGRATION**

Steering accepts the Issue #1 SDP baseline and activates the first implementation slice under a separate implementation issue.

Implementation may proceed against a contract-faithful fake `emu-debug` 1.0 server while emulator-side headless protocol prerequisites are incomplete. This is an explicit Steering re-baseline of the earlier all-blockers-before-code rule to permit parallel development without weakening acceptance.

The slice must not be declared complete until:

1. the accepted real `emuSA80535-N` headless runtime satisfies every minimum `emu-debug` 1.0 prerequisite needed by the slice;
2. the adapter passes the same contract suite against that real runtime; and
3. VS Code end-to-end acceptance passes against the real runtime.

No fake-only behavior may become a private alternative protocol.
