# emuSA80535-DAP

Debug Adapter Protocol and Visual Studio Code integration project for
`Hans-Einar/emuSA80535-N`.

Status: Slice 1 is **READY** under Issue #3 after independent real-runtime
verification against current `emuSA80535-N/master`
`d9f80eba172dd9d7281aaa9e5cfef461b6b9709b` (runtime implementation merge
`1a6aa397993d3f24cef8d41248ae2928d352966a`). The repository
contains the extension/package foundation and the strict `emu-debug` 1.0
launch client. The adapter can complete `hello`/raw-image `load`/`reset` and
publish the entry stop, one current frame and register scope, minimal
disassembly, replacement instruction breakpoints, bounded continue/pause, and
one-instruction `stepIn` against a compatible separately installed runtime.
The CI acceptance workflow has separate Ubuntu and Windows lanes. Each lane
uses pinned Node.js, builds and inspects the VSIX, installs it into an isolated
VS Code 1.95.0 profile, and drives the installed extension plus its external
adapter process to an entry stop and clean disconnect against the exact
contract fake. The same packaged adapter and frozen `emu-debug` 1.0 contract
also passed real-emulator F5, disassembly, register, instruction-breakpoint,
step, continue/pause, disconnect, safety, and no-orphan gates on Windows and
Linux. PR #4 remains unmerged.

Development is governed through [`SDP/`](SDP/) documentation and
[GitHub Issue #3](https://github.com/Hans-Einar/emuSA80535-DAP/issues/3).

## Development

Use Node.js 22.13 or newer:

```text
npm ci
npm run lint
npm test
npm run test:contract
npm run fixture:check
npm run package
npm run package:contents
npm run package:policy
npm run smoke:vsix
```

The resulting `.vsix` contains the VS Code extension and its external Node.js
adapter. It never bundles or downloads the emulator executable, contract fake,
or firmware fixture. `smoke:vsix` downloads the declared VS Code floor through
the pinned official test utility; its portable fake launcher and all isolated
profiles are test-only temporary artifacts outside the VSIX.
