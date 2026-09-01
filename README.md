# emuSA80535-DAP

Debug Adapter Protocol and Visual Studio Code integration project for
`Hans-Einar/emuSA80535-N`.

Status: Slice 1 implementation is active under Issue #3. The repository now
contains the extension/package foundation and the strict `emu-debug` 1.0
launch client. The adapter can complete `hello`/raw-image `load`/`reset` and
publish the entry stop against a compatible separately installed runtime.
Registers, disassembly, breakpoints, continue/pause, and stepping remain the
separate Worker C implementation and independent review responsibility.

Development is governed through [`SDP/`](SDP/) documentation and
[GitHub Issue #3](https://github.com/Hans-Einar/emuSA80535-DAP/issues/3).

## Development

Use Node.js 22.13 or newer:

```text
npm ci
npm run lint
npm test
npm run fixture:check
npm run package
```

The resulting `.vsix` contains the VS Code extension and its external Node.js
adapter. It never bundles or downloads the emulator executable.
