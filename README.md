# emuSA80535-DAP

Debug Adapter Protocol and Visual Studio Code integration project for
`Hans-Einar/emuSA80535-N`.

Status: Slice 1 implementation is active under Issue #3. The repository now
contains the extension/package and external DAP-process foundation; emulator
protocol and debug behavior remain for separate Worker B/C implementation and
independent review. The foundation VSIX cannot yet launch an emulator.

Development is governed through [`SDP/`](SDP/) documentation and
[GitHub Issue #3](https://github.com/Hans-Einar/emuSA80535-DAP/issues/3).

## Development

Use Node.js 22.13 or newer:

```text
npm ci
npm run lint
npm test
npm run package
```

The resulting `.vsix` contains the VS Code extension and its external Node.js
adapter. It never bundles or downloads the emulator executable.
