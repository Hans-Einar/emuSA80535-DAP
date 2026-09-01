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

## Worker A corrective re-review — `RVW-001-002-004`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent corrective reviewer; not the author of
the original review or either product commit

**Reviewed corrective commit:**
`a01c48c917186a98152d849565660081ff11746e`

**Reviewed parent:**
`513cf2b17e90e69b80128e58d2c135019eb13419`

**Original Worker A comparison commit:**
`a30129bfcbd17c8fd0e57696700ff9f2440bb639`

**Authority:** GitHub Issue #3, the accepted PR #2 SDP baseline, active
`IT-001-002 / SL-001-002-001`, and `CR-009`–`CR-011` above

**Disposition:** **accepted; `CR-009`–`CR-011` resolved; no new finding**

### Scope and independence

This pass reviewed the exact four-path corrective product commit in detached
worktrees, not the later Master SDP handoff commits on the branch. The
corrective commit changes `README.md`, `adapter/src/launchConfiguration.ts`,
and `adapter/src/session.ts`, and adds `test/lifecycle.test.ts`; it has 676
insertions and 27 deletions. The reviewer changed no product, sprint,
traceability, or verification file.

The review independently inspected the implementation and drove DAP
`Content-Length` frames through in-memory sessions with controlled launch and
cleanup promises. A separately authored transient probe was removed before
packaging, and the exact detached corrective worktree was clean when the final
package was built. Worker assertions were not treated as the sole evidence.

### Finding dispositions

#### `CR-009` — resolved

The correction makes terminal intent monotonic for the foundation lifecycle.
One active launch owns a generation and its response. `beginTermination`
closes configuration before awaiting cleanup, coalesces cleanup into one
generation, and disconnect settles the active launch immediately as
`EMU_LAUNCH_CANCELLED`. Every continuation after the asynchronous backend
launch checks that the same launch generation is still live before publishing
state or an event. Launch failure and configuration completion clear the
single owned response before sending it. `terminateOnce` remains the final
event guard.

The fresh reviewer first proved that its probe detects the original defect on
exact `a30129b…`:

- late resolve produced initialize success, disconnect success, `terminated`,
  then `initialized`, configurationDone success, and stale launch success;
- late reject produced initialize success, disconnect success, `terminated`,
  and only then the stale launch failure, while invoking backend disconnect a
  second time.

The same scenarios on exact `a01c48c…` passed the corrected invariants:

- for both late resolve and late reject, the pending launch received exactly
  one `EMU_LAUNCH_CANCELLED` response;
- disconnect completed cleanup and emitted exactly one `terminated`;
- the stale backend completion emitted no `initialized`, launch success,
  second launch response, diagnostic, or second termination;
- configurationDone after disconnect failed `DAP_SESSION_TERMINATED` and did
  not reopen configuration;
- launch after termination failed `DAP_SESSION_TERMINATED` without another
  backend launch;
- a second disconnect succeeded without another cleanup call or termination;
- a duplicate launch while the first was pending failed
  `EMU_LAUNCH_ALREADY_STARTED`, retained the original launch owner, and left
  backend launch count at one.

Cleanup rejection now has a deliberate, actionable disposition. When a DAP
disconnect owns the cleanup, the disconnect response fails
`EMU_CLEANUP_FAILED`, tells the user to verify that no child remains, and is
followed by exactly one `terminated`. When backend launch itself fails and its
automatic cleanup rejects, launch fails `EMU_INTEGRATION_PENDING`, one stderr
`output` diagnostic reports `EMU_CLEANUP_FAILED` with the same action, and one
`terminated` follows. Both paths call backend cleanup once. The concrete
terminate/kill/reap implementation and bounded timeout remain correctly
assigned to Worker B; this foundation review does not claim `AC-009`.

#### `CR-010` — resolved

`stopOnEntry`, when supplied, must now be the literal boolean `true`.
`emulatorPath`, when supplied, must now be a non-empty string. Independent raw
DAP probes covered `stopOnEntry: "false"`, `stopOnEntry: 0`,
`emulatorPath: 42`, and `emulatorPath: null`. Each launch failed with the
stable field-specific `CONFIG_STOP_ON_ENTRY` or `CONFIG_EMULATOR_PATH` prefix,
emitted one terminal event, and left both backend launch and disconnect counts
at zero. The committed suite additionally covers numeric `stopOnEntry`, empty
`emulatorPath`, and the normal valid configuration path.

#### `CR-011` — resolved

The README now says that emulator protocol and debug behavior remain for
separate Worker B/C implementation and independent review, and explicitly says
that the foundation VSIX cannot yet launch an emulator. This matches the
actual tree and makes no fake-backed, real-emulator, AC, or READY claim.

### Scope, safety, and regression assessment

- The correction adds no emulator client, fake command, protocol message,
  fixture, register/state model, disassembler, breakpoint implementation,
  continue/pause/step behavior, or capability claim assigned to Worker B/C.
- `initialize` still advertises only
  `supportsConfigurationDoneRequest`. Deferred `readMemory`, writes,
  evaluation, source breakpoints/maps, watchpoints, attach/TCP, richer frames,
  bundling/download, and Marketplace behavior remain absent.
- Owned product/test/config inspection found no P1000 semantic, physical-I/O
  endpoint, serial/GPIO/bus integration, private emulator structure, or
  hardware dependency. The correction introduces only DAP-framed diagnostic
  output; it does not mix child protocol bytes into DAP stdout or logs.
- The final VSIX contains the manifest, README/license, compiled extension and
  adapter JavaScript, and the two runtime `@vscode` dependencies. It contains
  no emulator executable, test/reviewer file, fixture, SDP/protocol file,
  source, sourcemap, or build toolchain.

No new corrective finding was found. The lifecycle code is intentionally only
the Worker A foundation; accepting it does not imply that the complete
starting/stopped/running state machine exists before Worker B/C implement their
contracted responsibilities.

### Independent evidence

All local executable evidence below ran on the exact detached corrective
commit `a01c48c…` unless explicitly identified as the original-commit contrast
probe:

- reviewer host: Windows x64, Node `v24.11.0`, npm `11.6.1`, VS Code
  `1.134.0`;
- `git merge-base 513cf2b… a01c48c` returned exact parent `513cf2b…`;
- `git diff --check 513cf2b… a01c48c`: pass;
- full corrective diff and source/test inspection: four intended paths only;
- `npm ci`: pass, 376 packages installed, 0 reported vulnerabilities; the two
  transitive deprecation warnings were non-blocking;
- `npm run lint`: pass;
- `npm run build`: pass;
- `npm test`: pass, 18/18 tests;
- independent corrected DAP probe: pass for late resolve, late reject,
  duplicate/post-terminal launch, post-terminal configurationDone, exactly-one
  launch settlement/termination, cleanup rejection, and runtime JSON types;
- independent original-commit contrast probe on exact `a30129b…`: reproduced
  both original post-terminal completion paths described above;
- `npm run package` and `npm run package:contents`: pass; final clean package
  contains 42 files and is 102.84 KB;
- reviewer-built clean VSIX SHA-256:
  `477179BAE1F0A6FB38D899F18E90497CEB6679E90FB7A0C60F6F2F126B3E3A84`;
- archive allowlist/name inspection and owned product/test safety scan: pass;
- isolated `code --extensions-dir ... --user-data-dir ...
  --install-extension ... --force`: pass; VS Code lists
  `undefined_publisher.emusa80535-dap@0.1.0`.

No exact-`a01c48c…` remote Linux run existed at review time because the remote
PR head was still `1752c454bc1714af7cfbe988fa3e33f53ee465a7`. The already
recorded push and PR Linux runs `33451522922` and `33451523471` passed on that
earlier foundation handoff, but they are not relabeled as corrective-commit
evidence. The correction did not change the workflow. Exact Linux and final
Windows lanes remain required verification gates for the complete slice.

### Result and forward gate

`RVW-001-002-004` accepts the Worker A corrective commit and resolves
`CR-009`, `CR-010`, and `CR-011`. Worker B may now build the strict emulator
protocol client and contract-faithful fake on this reviewed foundation.

This result does not accept Worker B/C work, any `AC-001`–`AC-011`, a real
emulator commit, or Slice-1 READY. Those remain subject to their separate
reviews and `VER-001-002-001`, including Linux/Windows, packaged VS Code, and
real-emulator integration gates. Master owns the corresponding sprint and
traceability state updates outside this reviewer-only commit.
