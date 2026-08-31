# DAP-SLICE1-REV-001 — Slice-1 implementation reviews

## Worker A foundation review — `RVW-001-002-001`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent reviewer

**Reviewed commit:** `a30129bfcbd17c8fd0e57696700ff9f2440bb639`

**Reviewed parent:** `8a8e0f865ae94fe7f6626933406ff03bfca0e4a7`

**Branch observed:** `codex/dap-first-slice`

**Authority:** GitHub Issue #3, the accepted PR #2 SDP baseline, and the active
`IT-001-002 / SL-001-002-001` contract

**Disposition:** **changes-required**

### Scope and independence

This review challenges only Worker A's package/extension/DAP-foundation
product commit. The later Master handoff commit `1752c454bc1714af7cfbe988fa3e33f53ee465a7`
changes SDP and traceability records only; it is not part of the reviewed
product diff. The reviewer did not author or repair Worker A product code.

The exact reviewed diff adds the root manifest and lockfile, pinned
TypeScript/lint/test tooling, Linux workflow, VS Code debugger contribution and
launch schema, external adapter descriptor, DAP lifecycle skeleton, package
boundary, README, and six foundation tests. It contains no emulator-control
protocol client, fake server, firmware fixture, stop-state/register,
disassembly, breakpoint, or execution behavior assigned to Workers B and C.

### Findings

#### `CR-009` — Blocking/high: disconnect does not make an in-flight launch terminal

**Evidence:** `adapter/src/session.ts` lines 99–134 start asynchronous launch
work without a launch generation, cancellation/termination intent, or logical
session-state guard. Lines 157–169 independently complete disconnect and emit
`terminated`, while the still-running `beginLaunch` is free to resume at lines
120–123, set `configurationOpen`, and emit `initialized`. Lines 136–155 then
accept `configurationDone` and send a successful response for the old launch.
The `terminatedSent` boolean at lines 187–194 suppresses only a second
`terminated` event; it does not prevent post-terminal state changes, responses,
or events. Cleanup rejection is also swallowed without diagnostics at lines
171–176 before disconnect is reported successful.

An independent in-memory DAP sequence using an injected backend reproduced the
failure deterministically:

1. `initialize` succeeded;
2. `launch` entered a deliberately pending backend promise;
3. `disconnect` returned success and emitted `terminated`;
4. resolving the old launch emitted `initialized` after `terminated`;
5. a subsequent `configurationDone` succeeded and completed the pre-disconnect
   `launch` response successfully.

The observed outbound order was: initialize response, disconnect response,
`terminated`, `initialized`, configurationDone response, launch response. This
contradicts `R-003`, `R-022`, `R-031`, `A-002`, and `D-004`: terminal intent
must be monotonic, a terminated session cannot reopen configuration, and a
disconnect/timeout must not allow stale asynchronous work to publish success.
It will become reachable with the real asynchronous Worker B backend even
though the current unavailable backend normally rejects immediately.

**Required correction:** model explicit adapter lifecycle/launch ownership in
the foundation. Set termination intent before awaiting backend cleanup; make
every continuation of `beginLaunch` verify that the same launch generation is
still live; settle or fail the pending launch exactly once; clear configuration
state on disconnect; reject duplicate/post-terminal launch and
configurationDone requests without reopening the session; and give cleanup
failure an actionable, non-silent disposition while preserving exactly-one
termination. Add focused tests for disconnect during both successful and
failing pending launch, configurationDone after disconnect, duplicate launch,
and launch after termination. Worker B must not be layered onto the current
race-prone lifecycle.

#### `CR-010` — Medium: launch validation trusts TypeScript types at the DAP boundary

**Evidence:** `adapter/src/launchConfiguration.ts` lines 64–83 reject only the
literal boolean `false` for `stopOnEntry` and check only `.length === 0` for
`emulatorPath`. Runtime probes show that both
`{program:"f", stopOnEntry:"false"}` and `{program:"f", stopOnEntry:0}` are
accepted and silently normalized to entry-stop behavior, while
`{program:"f", emulatorPath:42}` is returned as a supposedly validated
configuration containing the number `42`. The VS Code contribution schema
normally filters these shapes, but DAP input is an external JSON boundary and
the adapter's validation contract cannot rely on TypeScript declarations or a
single client implementation.

**Required correction:** require `stopOnEntry`, when present, to be the boolean
`true`; require `emulatorPath`, when present, to be a non-empty string; retain
the existing strict validation for the other frozen fields; and add raw-DAP
tests proving wrong JSON types fail with stable `CONFIG_*` responses before a
backend call.

#### `CR-011` — Low: README states later worker behavior as already integrated

**Evidence:** `README.md` lines 6–8 correctly say Slice 1 is active and the
foundation exists, but then state that emulator protocol and debug behavior
“are integrated in separate reviewed passes.” At reviewed commit `a30129b…`,
Workers B and C have not begun and no such behavior exists. The sentence is a
present-tense product claim that conflicts with the repository and handoff
state.

**Required correction:** state that the protocol and debug behavior remain for
separate Worker B/C implementation and independent review. Do not imply that
the foundation VSIX can yet launch an emulator successfully.

### Accepted areas and scope assessment

- The extension uses a real external adapter descriptor. It starts the packaged
  adapter with the VS Code Electron executable in Node mode, one script
  argument, a fixed extension-root working directory, and no shell.
- The compiled adapter uses `@vscode/debugadapter` DAP `Content-Length` framing
  over its stdin/stdout. Independent process tests found no human text or child
  protocol data on DAP stdout.
- `initialize` advertises only `supportsConfigurationDoneRequest`; instruction
  breakpoints, disassembly, stepping granularity, terminate, memory, evaluate,
  source breakpoints, attach, and other deferred capabilities are not claimed.
- The current manifest contributes launch only. The explicit launch
  `emulatorPath` wins over a non-empty resource/workspace setting; omission
  remains available for Worker B's `PATH` resolution. No emulator lookup,
  private emulator API, fake-only command, or download behavior was added.
- Direct npm dependencies and dev dependencies are exact versions, the v3
  lockfile pins the complete install with integrity data, the manifest pins
  extension version `0.1.0`, Node floor `>=22.13.0`, and VS Code floor
  `^1.95.0`, and CI selects Node `22.20.0`.
- The generated VSIX contains only the manifest, license/README, compiled
  extension and adapter JavaScript, and the two production `@vscode`
  dependencies. It contains no emulator executable, test/fake/firmware
  fixture, SDP/protocol material, source, sourcemap, or build toolchain.
- A clean temporary extension directory accepted the VSIX in VS Code
  `1.134.0` on Windows as
  `undefined_publisher.emusa80535-dap@0.1.0`; the absent publisher is permitted
  for local acceptance by Issue #3.
- Product/default/test inspection found no P1000 semantics, physical endpoint,
  hardware access, private emulator structure, source-map feature, attach/TCP,
  `readMemory`, mutation, watchpoint, or bundled/downloaded emulator behavior.
- The Worker A diff is otherwise narrow. Worker B/C and final acceptance remain
  unimplemented; no `AC-001`–`AC-011` or real-emulator READY claim is made by
  this review.

`CR-009` and `CR-010` are material Worker A foundation defects. Therefore
`RVW-001-002-001` is not accepted, and Worker B should wait for a corrective
Worker A commit and fresh re-review. Master must create the persistent finding
records and integrate this disposition into sprint and traceability surfaces;
this reviewer was explicitly limited to the review record.

### Independent evidence

The reviewer ran the following against the reviewed product tree (the current
worktree contained only the later Master SDP handoff on top):

- `git diff --name-status` / `git diff --stat` / full source inspection for
  `8a8e0f8…a30129b`; 18 paths, 6,041 insertions and 5 deletions;
- `git merge-base 8a8e0f8… a30129b` returned the exact reviewed parent;
- `git diff --check 8a8e0f8… a30129b`: pass;
- reviewer host: Windows x64, Node `v24.11.0`, npm `11.6.1`, VS Code
  `1.134.0`;
- `npm ci`: pass, 376 packages installed, 0 reported vulnerabilities (two
  transitive deprecation warnings were non-blocking);
- `npm run lint`: pass;
- `npm run build`: pass;
- `npm test`: pass, 6/6 tests;
- `npm run package` and `npm run package:contents`: pass, 42-file, 102.04-KB
  VSIX;
- reviewer-built VSIX SHA-256:
  `E850E05D77A89FBA2075E7DFD709AFC95D23829F2A56E689E4C0DA7DC1E52246`;
- archive listing and case-insensitive product safety scan: no emulator binary,
  prohibited feature, P1000 semantic, or physical-I/O endpoint;
- isolated `code --extensions-dir ... --install-extension ... --force`: pass;
- independent adversarial DAP lifecycle probes: fail as `CR-009`;
- independent invalid launch-shape probes: fail as `CR-010`.

At Worker A handoff, Linux CI had correctly been recorded as authored but not
remotely executed. During this review, two later runs became available on
Master handoff HEAD `1752c454bc1714af7cfbe988fa3e33f53ee465a7`: push run
`33451522922` and pull-request run `33451523471`. Both Linux jobs passed
checkout, Node 22.20.0 setup, install, lint, test, package, contents, and archive
inspection. The only diff from `a30129b…` to that CI HEAD is Master-owned SDP
and traceability files, so these runs support Linux portability of the reviewed
product tree but are not mislabeled as exact-commit runs. There is no Windows
CI lane yet; Windows build/package/install evidence above is local. The
`actionlint` executable was not installed locally; successful GitHub execution
proves workflow parsing and execution, but this review does not claim a local
actionlint pass.

### Re-review gate

A fresh corrective Worker A pass must resolve `CR-009`–`CR-011` without adding
Worker B protocol behavior or Worker C debug behavior. Re-review must inspect
the exact corrective commit and rerun the lifecycle race and runtime-shape
cases in addition to the normal lint/build/test/package/install checks.
