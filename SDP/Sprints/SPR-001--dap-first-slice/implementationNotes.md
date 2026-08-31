# Implementation notes — SPR-001

## Product implementation status

**Planned; not started.** No extension, adapter, emulator client, package
manifest, build configuration, test code, or fixture implementation was added
under Issue #1.

## Documentation readiness worker pass

`SL-001-000-001` authored the target mandate, evidence study, requirements,
architecture, design, cross-repository protocol contract, and candidate sprint
contract. It distinguished emulator default `5dc6812` from unmerged
`62f4012`, selected the Node/TypeScript external adapter and headless child
transport, and made every minimum emulator prerequisite explicit.

This records documentation work only. Independent review
`RVW-001-000-001`, verification `VER-001-000-001`, Master integration, and the
documentation-only PR remain separate gates. Only verified outcomes from those
passes may change readiness state.

## Corrective documentation pass

`SL-001-001-001` corrected the seven blocking documentation findings from
`RVW-001-000-001`. The changed contracts now distinguish DAP and emulator stop
reasons, define address/reference round trips and stepping requests, specify
honest negative disassembly placeholders, remove raw CODE read from the minimum
emulator contract, and define adapter-versus-child execution state and snapshot
validity. The malformed two-record JSON example was split into two valid JSON
documents.

Worker mechanical checks cover JSON fences, YAML, every NDJSON ledger record,
relation endpoints/duplicates, status vocabulary, documentation-only paths, and
`git diff --check`. These are authoring checks, not independent acceptance.
`CR-001`–`CR-007` remain `in_progress` pending `RVW-001-001-001`, and
`SL-001-001-001` is `in_review`. Product `IT-001-002` /
`SL-001-002-001` remains planned and unstarted.

## Future implementation evidence

When Steering later starts the product slice, append verified build/test/VSIX,
fake-emulator, real-emulator-contract, Linux/Windows, and VS Code disassembly UI
evidence here. Do not infer completion from file presence or capability flags.
