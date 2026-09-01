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

## Worker B protocol-client/fake review — `RVW-001-002-002`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent reviewer; not the Worker B author

**Reviewed product commit:**
`33a83a5a62b3be827fac6ea052517cb588d899e2`

**Reviewed parent:**
`f9bc1a64784bdd90c118f60aab9bb302242aead0`

**Authority:** GitHub Issue #3, the accepted PR #2 SDP baseline, the active
`IT-001-002 / SL-001-002-001` contract, and the complete frozen
`emu-debug` 1.0 contract in `protocol/EMU_DEBUG_API_REQUIREMENTS.md`

**Disposition:** **changes-required**

### Scope and independence

This pass reviewed the exact Worker B product commit in a detached worktree.
The later Master handoff commit
`ae3704e5dbbadf242c8c1abfe78b6d67aec5ea2e` changes only SDP and traceability
surfaces and is not part of the reviewed product diff. The reviewer changed no
product, test, fixture, sprint, traceability, or verification file; this section
is the only durable review change.

The reviewed 15-path diff adds the emulator process/client boundary, entry-stop
launch integration, contract fake, synthetic firmware fixture and tests. It
does not add Worker C register, disassembly-DAP, breakpoint-DAP, continue,
pause, step, or handle-epoch handlers/capability claims. The reviewer did not
treat the 41 committed tests or the 23-test contract subset as sufficient
evidence and drove separately authored hostile servers and raw fake-server
requests against the exact compiled commit.

### Findings

#### `CR-012` — Blocking/high: known command-response semantics are accepted as unknown-field compatibility

**Evidence:** the generic snapshot validator at `adapter/src/emulatorClient.ts`
lines 360–415 validates architectural widths and basic shape but does not bind
the snapshot variant to the variants negotiated by `hello`. The `run` method at
lines 739–749 applies that generic validator without enforcing the frozen `run`
result set. The decode validator at lines 418–465 checks count and field types
but not ordered/contiguous addresses, range consistency, or the mandatory exact
`<invalid>` text. The replacement-breakpoint validator at lines 468–493 is not
given either the requested address set or the negotiated limit, so it cannot
prove that accepted/rejected entries are unique, complete, disjoint, requested,
or within the negotiated result contract.

An independent server advertised only variant `sab80535` and otherwise returned
a valid exact hello. The exact client then accepted all of these responses:

- `decodeCode(0, 0, 0, 2)` returned addresses `[2, 1]`, with the second record
  marked `unknown-predecessor` but text `not-<invalid>`;
- `run(1)` returned `resultKind: "architectural-stop"` and reason `entry`, even
  though a run may return only a yield or breakpoint/exception/halt stop;
- `reset(0, 0)` returned snapshot variant `not-advertised`, despite the hello
  variant set containing only `sab80535`.

These are not ignorable future fields. They change required major-1 semantics,
would be handed to Worker C as trusted typed values, and can produce false
disassembly, state and stop behavior instead of the required fatal protocol
disposition. In particular, accepting the hostile decode response contradicts
the exact-count ordered-window and stable-placeholder rules needed by `R-017`,
`D-003`, `D-005`, and `AC-003`.

**Required correction:** make every typed command validate its complete known
major-1 response invariant before returning it. At minimum bind snapshot
variants to the negotiated variant set; restrict run results to yield or
breakpoint/exception/halt; enforce decode ordering/continuity, uint16 window,
record size, and exact invalid-placeholder semantics; and validate the
replace-all response against both the requested unique set and negotiated
limit. A violation must remain a fatal `EMU_TRANSPORT_SCHEMA`-family failure,
invalidate the boundary, and reap the child. Add hostile-response tests for
each case, while continuing to ignore genuinely unknown fields.

#### `CR-013` — Blocking/high: the fake is not yet an exact bounded emu-debug 1.0 server

**Evidence:** the fake hello path at
`test-fixtures/fake-emulator/server.ts` lines 239–295 checks only that
`requiredCapabilities` is an array of strings; it does not fail an unknown
required capability. Request validation at lines 204–226 does not retain
session IDs and therefore does not enforce their required uniqueness. The
single write path at lines 614–635 has no negotiated output-record bound.

Independent raw requests reproduced all three defects:

- hello with the seven frozen capabilities plus
  `unknown-required-capability` returned `success: true`;
- after a successful hello using ID 1, a load reusing ID 1 also returned
  `success: true` and the fixture digest;
- a syntactically valid 65,489-byte first request (inside the advertised
  65,536-byte input limit) caused the fake to emit a 65,610-byte error response,
  beyond its own `maxRecordBytes` limit.

Fault selection through environment/CLI options remains correctly outside the
product protocol; that mechanism is not the finding. The finding is that the
normal fake protocol surface accepts or emits records the frozen real server
must reject or bound. Since Issue #3 permits parallel Worker C development only
against a contract-faithful fake, these false-positive behaviors block that
handoff.

**Required correction:** reject required capabilities the server does not
advertise, enforce positive session-unique request IDs, and bound every output
record (or cleanly terminate when a bounded structured error cannot fit).
Retain unknown optional-field tolerance within major 1. Add raw-server contract
tests for unknown required capability, repeated ID, near-limit valid input,
bounded error output, exact-limit input, oversize input, and clean post-error
state.

#### `CR-014` — Medium: Windows PATH resolution selects shell scripts that the no-shell launcher cannot execute

**Evidence:** on Windows, `resolveEmulatorExecutable` uses `F_OK` and expands
every `PATHEXT` entry, defaulting at lines 1172–1185 to
`.EXE;.CMD;.BAT;.COM`. The actual spawn at lines 553–564 deliberately and
correctly uses `shell: false`. An independent Windows probe placed only
`emu-debug.CMD` on a synthetic PATH. Resolution returned that file, and the
same no-shell child spawn failed `EINVAL: spawn EINVAL`. Explicit configured
paths use the same file-only Windows check and can produce the same false
resolution.

This does not execute a shell or create a security expansion; it fails closed
and actionably. It nevertheless breaks the Worker B executable-resolution
contract for a path shape the resolver itself declares usable, and Windows is
a mandatory Issue #3 lane.

**Required correction:** on Windows, accept only file types directly launchable
under the fixed `shell: false` policy (including for explicit paths), and do not
select `.CMD`/`.BAT` merely because `PATHEXT` lists them. Add Windows tests that
prove a native `emu-debug` executable resolves/spawns and a shell-script
lookalike is skipped or rejected without weakening the no-shell invariant.

### Accepted areas and traceability/scope assessment

- The client emits the exact hello as command/ID 1 with the seven frozen
  required capabilities. Normal launch is ordered `hello -> load -> reset`,
  uses an absolute image path, exact format and SHA-256, and verifies the
  returned digest and entry PC/reason.
- The UTF-8 decoder is fatal, newline framing is byte-counted, malformed/empty,
  unsolicited, mismatched-ID/command and oversized records are fatal, commands
  after the established handshake are serialized, and request payloads are not
  written to human logs. Child stdout remains protocol-only and stderr is
  separately bounded for diagnostic delivery.
- Hello major mismatch and missing frozen capabilities are fatal. A higher
  minor with all known semantics and unknown optional fields is accepted. Large
  advertised numeric limits are clamped to local hard caps of 1,024
  breakpoints, 1,000,000 run instructions, 4,096 decode records and 65,536
  record bytes. The fake advertises the Slice-1 minimum of one breakpoint.
- Raw image inspection rejects both 65,535- and 65,537-byte files before spawn.
  The checked-in generic fixture is exactly 65,536 bytes, has SHA-256
  `1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88`,
  and contains only the documented MOV/INC/SJMP loop plus neutral NOP fill.
- The typed `getState`, `decodeCode`, `replaceCodeBreakpoints`, `run`, and
  `stepInstruction` surfaces exist and validate numeric input bounds. The fake's
  normal path demonstrates forward decode, known predecessors, one-byte unknown
  predecessors, underflow rejection, replacement/clear shape, pre-execution
  breakpoint stop, bounded run and one-instruction step. `CR-012` and `CR-013`
  qualify this acceptance; they do not erase the correctly implemented parts.
- Timeout and crash probes after a complete hello/load/reset returned
  `EMU_TRANSPORT_TIMEOUT` and `EMU_TRANSPORT_EOF`, respectively, and both child
  PIDs were reaped. The committed suite additionally passes spawn failure,
  malformed response, hello EOF/crash, disconnect during pending handshake and
  hung-terminate forced cleanup. No test suppressed a live PID as success.
- Product/default/fixture/package inspection found no private emulator struct,
  P1000 semantic, physical endpoint, fake-only product command, bundled or
  downloaded emulator, source map, attach/TCP, memory access, write/evaluate,
  source breakpoint, watchpoint, or Worker C DAP behavior/capability claim.
- The VSIX contains only manifest/readme/license, compiled extension/adapter and
  the two runtime `@vscode` dependencies. It excludes the fake, firmware,
  emulator executable, tests, scripts, SDP/protocol sources, TypeScript,
  declarations, maps and build dependencies.

The diff is otherwise aligned with `R-001`, `R-003`, `R-005`, `R-007`,
`R-008`, `R-022`, `R-026`, `R-029`–`R-031`, `A-001`, `A-002`, `A-006`–`A-008`,
and `D-002`–`D-004`, `D-010`. No `AC-001`–`AC-011`, real-emulator gate, or
Slice-1 READY result is accepted by this responsibility review.

### Independent executable evidence

All exact-product commands below ran in a clean detached worktree at
`33a83a5…` unless explicitly described as remote/non-exact evidence:

- `git merge-base f9bc1a6… 33a83a5…`: exact reviewed parent;
- `git diff --check f9bc1a6… 33a83a5…`: pass; 15 intended paths, 2,835
  insertions and 32 deletions;
- reviewer host: Windows x64, Node `v24.11.0`, npm `11.6.1`, VS Code
  `1.134.0`;
- `npm ci`: pass, 376 packages, 0 reported vulnerabilities; two transitive
  deprecation warnings are non-blocking;
- `npm run lint`, `npm run build`: pass;
- `npm test`: pass, 41/41;
- `npm run test:contract`: pass, 23/23;
- `npm run fixture:check`: pass with the exact size/hash above;
- independent hostile client/fake, post-launch timeout/crash/reap, limit-clamp
  and Windows resolver probes: positive cleanup/bounds evidence plus failures
  recorded as `CR-012`–`CR-014`;
- `npm run package` and `npm run package:contents`: pass; 43-file, 111.38-KB
  package;
- reviewer-built VSIX SHA-256:
  `1E0401700ECEDBE74452D665F11F1FE9A4389214F82A165084924754156B89FB`;
- archive allowlist and case-insensitive safety/deferred-feature scan: pass;
- isolated VSIX install: pass; VS Code lists
  `undefined_publisher.emusa80535-dap@0.1.0`.

At review time the remote implementation PR head remained exact parent
`f9bc1a64784bdd90c118f60aab9bb302242aead0`. Linux push and PR runs
`33453396751` and `33453400082` passed on that parent, but they contain no
Worker B product diff and are not relabeled as Worker B Linux evidence. No
exact-`33a83a5…` remote Linux run existed. This is an evidence gap in addition
to, not a cause of, the changes-required disposition; final Linux/Windows and
real-emulator lanes remain the verifier's gates.

### Result and re-review gate

`RVW-001-002-002` does not accept Worker B. `CR-012`–`CR-014` require a narrow
corrective Worker B commit and fresh independent re-review before Worker C uses
the fake or typed client. The correction must not add Worker C DAP handlers,
capabilities, emulator bundling, or any deferred Slice-1 feature. Re-review must
rerun the hostile response, raw fake-server, Windows no-shell resolver, cleanup,
fixture, package and safety cases in addition to the normal full suite.

Master owns finding/traceability integration and any rework handoff outside
this review-only commit. The real-emulator `EMU-BLK` gate remains untested and
Slice 1 remains **NOT_READY**.

## Worker B corrective re-review — `RVW-001-002-005`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent corrective reviewer; not the Worker B
author and not the original Worker B reviewer

**Reviewed corrective product commit:**
`6000ec8235ee8f568db80c4d6fe02f84d1982045`

**Reviewed parent:**
`aefbc04594b23bc5b02e8ca04c89d2d65f7343bc`

**Original Worker B comparison commit:**
`33a83a5a62b3be827fac6ea052517cb588d899e2`

**Authority:** GitHub Issue #3, the accepted PR #2 SDP baseline, active
`IT-001-002 / SL-001-002-001`, the complete frozen
`protocol/EMU_DEBUG_API_REQUIREMENTS.md` contract, and `CR-012`–`CR-014` above

**Disposition:** **changes-required; `CR-013` and `CR-014` resolved;
`CR-012` partially resolved; new `CR-015` and `CR-016`**

### Scope and independence

This pass reviewed the exact three-path corrective product commit in a clean
detached worktree. It changes `adapter/src/emulatorClient.ts`,
`test-fixtures/fake-emulator/server.ts`, and `test/emulatorClient.test.ts`, with
773 insertions and 81 deletions. The later Master handoff commit
`6b9c60c8043e2ab9195234554db57d9432556aa3` is SDP-only and was not treated as
part of the product diff. A second detached worktree at exact original Worker B
commit `33a83a5…` supplied contrast evidence.

The reviewer changed no product, test, fixture, sprint, traceability, or
verification file. Separately authored hostile-server, raw-fake, and Windows
resolver probes were transient, were removed before the final build/package,
and are not part of either reviewed tree. The final corrective worktree was
clean. This addendum is the only durable reviewer change; Master retains
finding and traceability integration.

### Finding-by-finding disposition

#### `CR-012` — partially resolved; correction remains blocked by `CR-015` and `CR-016`

The correction now binds snapshot variants to the hello-advertised set and
gives reset, getState, run, and stepInstruction command-specific result sets.
It enforces lowercase exact load digest identity; exact decode placeholder
text, size and reason; ordered contiguous decode records; record CODE range;
and a requested/unique/complete/disjoint breakpoint result partition. Every
tested response-schema violation was fatal and reaped the child.

An independently authored hostile server first proved the original defects on
exact `33a83a5…`. The original client accepted all of the following:

- a decode result ordered `[2, 1]` whose invalid predecessor text was
  `not-<invalid>`;
- a run architectural stop with reason `entry`;
- a reset snapshot with variant `not-advertised` after hello advertised only
  `sab80535`;
- a replacement response containing duplicate accepted address `2`, an
  unrequested rejected address `65535`, and a result limit inconsistent with
  hello.

Against exact `6000ec8…`, the same four independent probes failed
`EMU_TRANSPORT_SCHEMA`, invoked the fatal disposition once, closed the
transport, and left each child PID reaped. Additional independent probes
confirmed fatal cleanup for an uppercase load digest, reset returning yield,
an out-of-width getState register, stepInstruction returning yield, and a false
terminate acknowledgment. Static inspection and the committed tests cover the
remaining hello/envelope/schema surfaces and unknown-field tolerance.

The correction nevertheless does not validate the complete known decode
window invariant when the magnitude of a negative instruction offset is larger
than the requested record count, and it conflates the server-advertised
breakpoint limit with a client-local allocation/request clamp. Those residuals
are recorded separately as `CR-015` and `CR-016`; therefore the complete
required correction for `CR-012` is not accepted.

#### `CR-013` — resolved

The fake now rejects unknown required capabilities, stores and rejects reused
positive request IDs session-wide, and routes every response through a byte
bound. If the intended record cannot fit, it emits a bounded
`RESPONSE_TOO_LARGE` response when the correlation fields allow that response
to fit; otherwise it closes cleanly without emitting an oversized record.

Independent raw-NDJSON probes, separate from the committed tests, established:

- hello with the frozen seven capabilities plus one unknown required
  capability failed `UNSUPPORTED_CAPABILITY`; a subsequent fresh-ID getState
  failed `INVALID_STATE`, and EOF then produced clean exit 0;
- reuse of successful hello ID 1 by load failed `INVALID_REQUEST`; a fresh-ID
  getState still failed `INVALID_STATE`, proving no state corruption, and EOF
  exited 0;
- valid hello records of exactly 65,535 and 65,536 bytes were accepted and
  each emitted a 481-byte response, below `maxRecordBytes`;
- a deliberately oversized generated hello response was replaced by a
  170-byte bounded structured error;
- a 65,537-byte input and a within-input-limit command whose echoed structured
  error could not fit both terminated with exit 65 and emitted no stdout
  record.

Unknown optional request fields within major 1 remain tolerated. Fault
selection remains CLI/environment-only test infrastructure and did not enter
the product protocol or VSIX. The contract-faithful fake part of the Worker B
gate is accepted by this re-review.

#### `CR-014` — resolved

On Windows, candidate files now pass only when their extensions are `.EXE` or
`.COM`, they are regular accessible files, and PATH suffix expansion filters
PATHEXT to those directly launchable forms. Explicit `.CMD` and `.BAT` paths
are rejected under the same rule. The actual child spawn remains
`shell: false`.

An independent contrast probe placed `.CMD` and `.BAT` wrappers in an earlier
PATH directory and a copied directly spawnable `emu-debug.EXE` in a later
directory, with `PATHEXT=.CMD;.BAT;.EXE;.COM`. Exact original `33a83a5…`
selected the `.CMD` wrapper. Exact correction `6000ec8…` skipped both wrappers,
returned the later `.EXE`, and that result exited 0 when spawned with
`shell:false`. Wrapper-only PATH, explicit CMD, explicit BAT, and empty-PATH
cases all failed `CONFIG_EMULATOR_NOT_FOUND`. No shell fallback was introduced.

### New findings

#### `CR-015` — Blocking/high: negative decode windows can still reach or cross the base too early

**Evidence:** `validateDecodeCode` at
`adapter/src/emulatorClient.ts` lines 542–568 computes
`anchorIndex = -instructionOffset`. It requires a record at the base only when
`anchorIndex < instructions.length`, and requires the final record to end at
the base only when the values are equal. When
`anchorIndex > instructions.length`, it performs no corresponding end-of-window
check.

An independent server received
`decodeCode(reference=100, byteOffset=0, instructionOffset=-5,
instructionCount=2)` and returned two contiguous, in-range, otherwise valid
records: `{address:90,size:10}` followed by `{address:100,size:1}`. Exact
`6000ec8…` accepted and returned this result. It then closed only because the
review probe explicitly cleaned it up; no fatal protocol disposition occurred.

This cannot be the requested window. Starting five predecessor instructions
before base 100 and returning only the first two means at least three
positive-size predecessor records must remain before the base. The two-record
window therefore cannot already reach address 100, much less include its
instruction. Accepting it lets a major-1 server misstate the exact window while
preserving superficial ordering/continuity, and Worker C could present false
disassembly. This violates the frozen negative-predecessor semantics,
`R-017`, `D-003`, `D-005`, and the complete-known-invariant requirement of
`CR-012`.

**Required correction:** complete the negative-window anchor validation for
all relationships between offset magnitude and returned count. In particular,
when `-instructionOffset > instructionCount`, the returned window must remain
far enough before the base to leave at least the remaining positive-size
predecessor slots; it must not reach or cross the base. Preserve the existing
exact anchor checks for equal/smaller magnitudes and placeholder-prefix rules.
Add hostile coverage for the reproduced crossing case plus valid known and
unknown-placeholder windows where the negative offset magnitude exceeds the
returned count. Every violation must remain fatal and reap the child.

#### `CR-016` — Medium: breakpoint response validation compares a server result with an undisclosed client clamp

**Evidence:** handshake at `adapter/src/emulatorClient.ts` lines 734–753
replaces the server's advertised limits with client-local clamps, including
`maxBreakpoints = min(serverLimit, 1024)`. The raw server breakpoint limit is
not retained. `validateReplaceBreakpoints` at lines 597–603 then requires the
response `limit` to equal that clamped value.

An independent compatible server advertised `hello.limits.maxBreakpoints =
5000`. The client correctly limited its own request to one address. The server
returned the complete valid result
`{accepted:[2], rejected:[], limit:5000}`, matching its advertised protocol
limit. Exact `6000ec8…` rejected the response as fatal
`EMU_TRANSPORT_SCHEMA` and reaped the server, because it expected 1024. The
server has no handshake field that tells it the client's private clamp and
therefore cannot truthfully be required to echo 1024. This makes a larger
compatible server fail despite the architecture explicitly allowing larger
limits.

**Required correction:** retain the server-advertised breakpoint limit for
wire-response validation and keep the client-effective clamp as separate local
request/allocation policy. Validate the returned `limit` against the former
and accepted/request counts against the safe effective bound. Add a test with a
server limit above 1024, a within-client-bound request, and a response that
echoes the server-advertised limit. Do not expand the local hard cap.

### Accepted scope, safety, and regression areas

- The correction adds no Worker C DAP request handler or capability. The
  initialize response still advertises only configurationDone, and no register,
  scope/variable, disassemble-DAP, instruction-breakpoint-DAP, continue, pause,
  step, or stopped-state handle implementation enters this diff.
- Product paths contain no fake scenario/fault command. The fake and synthetic
  fixture remain test-only and are absent from the VSIX.
- Product, defaults, fixture, and package inspection found no private emulator
  struct dependency, P1000 semantic, physical endpoint, serial/GPIO/field-bus
  integration, source mapping, read/write memory, attach/TCP, watchpoint,
  emulator bundling, or download behavior.
- The UTF-8/newline/correlation/serialization, timeout/EOF/crash, stderr
  separation, exact image size/hash, hello/load/reset order, and terminate/
  kill/reap mechanisms remain intact. The independently driven fatal schema
  cases and the full suite left no fake or hostile-server process alive.
- The final package contains only manifest/readme/license, compiled extension
  and adapter JavaScript, and the two runtime `@vscode` dependencies. It
  contains no emulator executable, fake, firmware, test/reviewer file,
  owned TypeScript source, source map, SDP/protocol source, or build toolchain.

No fake-only protocol or Worker C scope expansion was found. `CR-015` and
`CR-016` are narrow Worker B contract issues; they do not invalidate the
accepted `CR-013` fake or `CR-014` resolver corrections.

### Independent executable evidence

All corrective evidence below ran on exact detached commit `6000ec8…` unless
identified as original-commit contrast evidence:

- reviewer host: Windows x64, Node `v24.11.0`, npm `11.6.1`, VS Code
  `1.134.0`;
- `git merge-base aefbc04… 6000ec8…` returned exact parent `aefbc04…`;
- `git diff --check aefbc04… 6000ec8…`: pass; three intended Worker B paths,
  773 insertions and 81 deletions;
- full corrective diff and relevant client/fake/test source inspection;
- clean `npm ci`: pass, 376 packages, 0 reported vulnerabilities; two
  transitive deprecation warnings were non-blocking;
- `npm run lint`, `npm run build`: pass;
- `npm test`: pass, 60/60;
- `npm run test:contract`: pass, 42/42;
- `npm run fixture:check`: pass; 65,536 bytes and SHA-256
  `1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88`;
- independently authored original/corrective hostile response contrast,
  all-command schema/cleanup, raw fake bound/state, and Windows PATH/direct
  spawn probes: concrete passes and residual failures recorded above;
- `npm run package` and `npm run package:contents`: pass; 43-file, 112.45-KB
  VSIX;
- reviewer-built clean VSIX SHA-256:
  `FC8448A26E1CBEA6DF21D0AEA9E3730518107D3523096EAD0126B923EBE3078F`;
- archive listing, owned-path safety/deferred-feature/fake-only scan, process
  cleanup inspection, and final detached-worktree cleanliness: pass.

This local Windows responsibility review does not claim an exact-commit remote
Linux run or any real-emulator integration evidence. Those remain final
verification gates and do not change this code-review disposition.

### Result and next gate

`RVW-001-002-005` accepts the `CR-013` and `CR-014` corrections and the
specific original reproductions repaired under `CR-012`, but does not accept
Worker B as a whole. `CR-015` and `CR-016` require another narrow Worker B
corrective product commit and fresh independent re-review before Worker C uses
the typed client. The next pass must rerun both new residual probes in addition
to the complete `CR-012`–`CR-014`, fake-bound, resolver, cleanup, fixture,
package, and safety evidence.

Master owns persistent finding/traceability/rework integration outside this
review-only commit. This review accepts no `AC-001`–`AC-011`, real-emulator
commit, or Slice-1 READY result. The real-emulator `EMU-BLK` gate remains
untested and Slice 1 remains **NOT_READY**.

## Worker B second corrective re-review — `RVW-001-002-006`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent second corrective reviewer; not the Worker
B author and not either earlier Worker B reviewer

**Reviewed corrective product commit:**
`cd98df7a06e8f93386ac2a9c990d0e00c1f34fb4`

**Reviewed parent:**
`e0760bd52d991cbc0f2890caeaf806dcee3a54a7`

**Earlier corrective comparison commit:**
`6000ec8235ee8f568db80c4d6fe02f84d1982045`

**Authority:** GitHub Issue #3, accepted PR #2 SDP baseline, active
`IT-001-002 / SL-001-002-001`, the complete frozen
`protocol/EMU_DEBUG_API_REQUIREMENTS.md` contract, and the `CR-012`, `CR-015`,
and `CR-016` records above

**Disposition:** **accepted; `CR-012`, `CR-015`, and `CR-016` resolved;
`CR-013` and `CR-014` remain resolved; no new finding**

### Scope and independence

This pass reviewed the exact three-path corrective product commit. Its parent
is exactly `e0760bd…`; the diff changes only
`adapter/src/emulatorClient.ts`, `test-fixtures/fake-emulator/server.ts`, and
`test/emulatorClient.test.ts`, with 198 insertions and 21 deletions. The later
Master handoff commit `59428b33a4e942e449ed606601b6c560e7ba6d35` is SDP-only;
the reviewed product paths at the working HEAD were byte-identical to exact
`cd98df7…`.

The reviewer did not use the three new committed tests as sole evidence. A
separately authored hostile NDJSON server/client harness exercised 31 valid,
hostile, raw-fake, and Windows resolver cases. It was transient, was removed
before the final lint/build/package passes, and left no tracked or untracked
artifact. The reviewer changed no product, test, fixture, sprint,
traceability, or verification file. This addendum is the only durable review
change; Master retains finding and traceability integration.

### Finding-by-finding disposition

#### `CR-012` — resolved

The complete known command-response validation correction is now accepted.
The earlier exact-digest, snapshot-variant/result-kind, register-width,
decode-order/placeholder, breakpoint-partition, run-reason, step-result, and
terminate-acknowledgment cases all reran in the 45-test contract suite and
remained fatal with child cleanup. Independent breakpoint probes additionally
proved that an echoed wire limit must match the raw hello advertisement and
that accepted/rejected results remain a unique, requested, complete, disjoint
partition. The negative decode residual is resolved by the `CR-015` evidence
below.

Every independently injected response-schema violation raised
`EMU_TRANSPORT_SCHEMA`, invoked the fatal callback exactly once, closed the
transport, and left its child PID reaped. Compatible exact responses remained
accepted. This preserves major-1 unknown-field tolerance while enforcing the
known fields and semantics consumed by Worker C.

#### `CR-013` — remains resolved; no regression

Direct raw-NDJSON probes against the corrected fake reconfirmed the accepted
fake-server boundary:

- the frozen seven required capabilities plus an unknown required capability
  failed `UNSUPPORTED_CAPABILITY`; a fresh-ID `getState` then failed
  `INVALID_STATE`, and EOF exited 0;
- reusing successful hello ID 1 failed `INVALID_REQUEST`; a fresh ID left the
  session in the expected clean pre-load state and EOF exited 0;
- exact 65,535-byte and 65,536-byte hello records were accepted and each
  produced a 481-byte response;
- the generated oversized hello response became a 170-byte bounded
  `RESPONSE_TOO_LARGE` error;
- a 65,537-byte input and a within-input-bound command whose echoed error could
  not fit each exited 65 and emitted no stdout record.

All observed output records stayed at or below 65,536 bytes. Fault/scenario
selection remains test-infrastructure CLI/environment state and does not enter
the product protocol or package.

#### `CR-014` — remains resolved; no regression

An independent Windows probe placed `emu-debug.CMD` and `emu-debug.BAT` in
earlier PATH directories and a copied `emu-debug.EXE` later, using
`PATHEXT=.CMD;.BAT;.EXE;.COM`. Resolution skipped both wrappers, returned the
later EXE, and the selected executable exited 0 under `shell:false`. Explicit
CMD, explicit BAT, wrapper-only PATH, and empty-PATH cases all failed
`CONFIG_EMULATOR_NOT_FOUND`. No shell fallback was introduced.

#### `CR-015` — resolved

The client now validates the full negative-window geometry for every
relationship between negative instruction-offset magnitude `k` and returned
record count `n`. For each returned predecessor it reserves at least one byte
for every remaining predecessor slot; the `k`th record must end exactly at the
byte base, and any record after those `k` predecessors must begin exactly at
the base. Placeholder records remain an exact one-byte
`unknown-predecessor`/`<invalid>` prefix and cannot occupy the base or follow a
valid record.

Independent acceptance probes used base 100 and established:

- `k > n`: `k=5,n=2` accepted a known prefix at addresses 90/93 with sizes
  3/2, and separately accepted unknown one-byte placeholders at 95/96;
- `k = n`: `k=2,n=2` accepted known records 95+2 and 97+3 ending exactly at
  base 100, and separately accepted placeholders at 98/99;
- `k < n`: `k=2,n=4` accepted known predecessors 95+2 and 97+3 followed by
  the exact base record at 100 and a forward record at 102; `k=3,n=4`
  separately accepted a placeholder prefix followed by known predecessors and
  the exact base record.

A positive byte offset (`reference=95, byteOffset=5`) produced the same exact
base-100 geometry, and the valid final CODE byte at 65,535 was accepted.
Hostile early-base, crossing-base, too-late-start, equal-count-shortfall,
non-contiguous, reverse-order, placeholder-after-valid,
placeholder-at-anchor, invalid placeholder-size, success-on-byte-underflow,
record-range-crossing, and non-negative-placeholder responses were all
rejected fatally and reaped. The original `k=5,n=2` record sequence
90+10/100+1 that reproduced `CR-015` is among the rejected cases.

This covers known and unknown predecessor chains without guessing opcode
boundaries, preserves byte-offset-first behavior, rejects wrap/partial/range
successes, and accepts valid exact windows rather than over-restricting them.

#### `CR-016` — resolved

The raw hello breakpoint limit is retained separately from the effective
client work cap. An independent server advertised
`hello.limits.maxBreakpoints=5000`; the public client result remained safely
clamped to 1024. A small request `[2]` succeeded with the truthful raw response
`{accepted:[2],rejected:[],limit:5000}`. A 1,025-unique-address request failed
locally with `EMU_BREAKPOINT_LIMIT`; the still-live client then successfully
sent `[3]`. A server-side counter reported exactly two replacement requests,
proving the rejected large request was never written.

Two hostile response probes remained fatal and reaped: echoing the undisclosed
client clamp 1024 instead of raw limit 5000, and returning a duplicate/
unrequested breakpoint partition. Thus wire truthfulness, local allocation/
work safety, and the previously accepted response semantics coexist.

### Scope, package, process, and safety disposition

- The three-path correction adds no Worker C DAP handler or capability. The
  initialize response still advertises only configurationDone; no register,
  scope/variable, disassemble-DAP, instruction-breakpoint-DAP, continue,
  pause, step, or stopped-handle behavior enters the product diff.
- No fake scenario, fault switch, fake-only command, or hostile-response
  behavior appears in product adapter/extension source. The fake, synthetic
  firmware, tests, and SDP/protocol material are absent from the VSIX.
- Product/default/fixture/package inspection found no private emulator struct
  dependency, P1000 semantic, physical endpoint, serial/GPIO/field-bus
  integration, source mapping, memory mutation/browser, attach/TCP,
  watchpoint, emulator bundling, or download behavior.
- UTF-8/framing/correlation/serialization, timeout/EOF/crash, stderr
  separation, exact image/hash, hello/load/reset order, and terminate/kill/
  reap behavior remain intact. The independent hostile and raw-fake passes
  and the final process scan left no review, hostile, or fake server alive.
- The 43-file, 112.58-KB VSIX contains only manifest/readme/license, compiled
  extension and adapter JavaScript, and the two pinned runtime `@vscode`
  dependencies. It contains no emulator executable, fake, firmware,
  test/reviewer source, TypeScript, source map, protocol/SDP source, or build
  toolchain.

No Worker C capability, fake-only product protocol, deferred feature, or new
review finding was found.

### Independent executable evidence

All product checks exercised product paths byte-identical to exact
`cd98df7…`:

- reviewer host: Windows x64, Node `v24.11.0`, npm `11.6.1`, VS Code
  `1.134.0`;
- `git rev-parse cd98df7…^` and
  `git merge-base e0760bd… cd98df7…` both returned exact parent `e0760bd…`;
- `git diff --check e0760bd… cd98df7…`: pass; exactly three intended Worker B
  paths, 198 insertions and 21 deletions;
- complete corrective diff and relevant client/fake/test source inspection;
- clean `npm ci`: pass, 376 packages, zero reported vulnerabilities; two
  transitive deprecation warnings were non-blocking;
- clean final `npm run lint` and `npm run build`: pass;
- `npm test`: pass, 63/63;
- `npm run test:contract`: pass, 45/45;
- independently authored 31-case negative-window, breakpoint-limit,
  raw-fake-bound/ID/capability, cleanup, and Windows resolver probe: pass;
- `npm run fixture:check`: pass; 65,536 bytes and SHA-256
  `1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88`;
- `npm run package` and `npm run package:contents`: pass; 43-file, 112.58-KB
  VSIX;
- reviewer-built clean VSIX SHA-256:
  `8FF564EA757D7D2FEC0EF7EE51BF421F6AE4369C2D09B9D9F9C36E2ABE3F119E`;
- archive/owned-path safety, private-struct, deferred-feature, fake-only,
  Worker-C-capability, process-cleanup, and final worktree scans: pass.

This Windows responsibility review does not claim an exact-commit remote Linux
run, supported-floor VS Code installation, or real-emulator integration. Those
remain later Worker C/final-verification gates and do not weaken this accepted
Worker B disposition.

### Result and next gate

`RVW-001-002-006` accepts exact corrective product commit `cd98df7…` and
resolves the remaining Worker B findings `CR-012`, `CR-015`, and `CR-016`.
The already accepted `CR-013` fake-boundary and `CR-014` executable-resolution
corrections remain resolved. Worker B's strict emulator protocol client and
contract-faithful fake responsibility is accepted, and Worker C may now use
the typed client under a fresh implementation/review pass.

Master owns persistent finding, traceability, sprint, and handoff integration
outside this review-only commit. This review accepts no Worker C behavior,
`AC-001`–`AC-011`, real-emulator commit, final verification, or Slice-1 READY
result. The mandatory real-emulator `EMU-BLK` gate remains untested and Slice 1
remains **NOT_READY**.

## Worker C debug-behavior review — `RVW-001-002-003`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent Worker C reviewer; not the Worker C author
or either Worker B reviewer

**Reviewed product commit:**
`574dd8d0b44c2970656fe7e9c0c41dc5164896cb`

**Reviewed parent:**
`0d1ce33d91758254efa65658e4af9b9b72a04360`

**Authority:** GitHub Issue #3, accepted PR #2 SDP baseline, active
`IT-001-002 / SL-001-002-001`, and the frozen `emu-debug` 1.0 contract

**Disposition:** **changes-required; `CR-017`, `CR-018`, and `CR-019` open**

### Scope and independence

The reviewed commit has the exact stated parent. Its diff changes ten intended
Worker C paths with 2,276 insertions and 75 deletions: the DAP session, stop
state, CODE-reference, disassembly, breakpoint, fake-support, behavior-test,
foundation-test, and README surfaces. The later Master handoff commit
`5c329cc28e421e9a388e4bcf756851416d6902d6` is SDP-only; every product, test,
fixture, package, and CI path at the working HEAD was byte-identical to exact
`574dd8d...`.

The review did not rely on the new tests alone. Source inspection challenged
every request handler and transition, and transient independently authored DAP
drivers exercised launch ordering, duplicate initialize, stopped-only reads,
handle epochs, active-chunk pause, address conversion, breakpoint replacement,
structured step rejection, malformed raw pagination, and the fake's branch
predecessor behavior. The probes created no tracked artifact and changed no
product or test file. This addendum is the only durable reviewer change; Master
owns finding, sprint, traceability, and rework integration.

### Findings

#### `CR-017` — Blocking/high: a rejected step silently creates a new stop epoch

**Evidence:** `stepInstruction` in `adapter/src/session.ts` lines 777-797 saves
only the prior snapshot, calls `resumeFromStop()` (which invalidates the active
handles), and on a non-transport command rejection restores logical stopped
state with `this.stops.activate(priorSnapshot)`. `activate` increments the stop
epoch and allocates fresh handles. No corresponding `stopped` event is emitted.

An independent in-memory DAP backend returned the frozen structured command
error `EMU_STEP_REJECTED` without changing its idle child boundary. Exact
`574dd8d...` produced all of the following in one session:

- `stepIn` failed with `EMU_STEP_REJECTED` as expected;
- the previously valid frame and register-variable handles both immediately
  failed `EMU_HANDLE_STALE`;
- a new `stackTrace` silently returned frame handle 3 instead of handle 1;
- no new `stopped` event explained that new epoch to the DAP client.

The protocol states that a failed child request leaves state unchanged, and
`D-004` freezes the adapter rule that request failures do not mutate state
unless cleanup is the documented result. This behavior instead gives VS Code
a failed action, an apparently still-stopped session, and an unexplained
replacement identity for the same old snapshot. It also violates the stop-
epoch contract used to justify `R-003`, `R-007`, `R-008`, and `R-013`.

**Required correction:** suspend the old stop epoch while the step command is
active so reads remain unavailable, but restore that exact epoch and its exact
frame/scope/variable handles when a structured non-fatal rejection proves the
child stayed at the old boundary. Do not call `activate` and do not emit a new
stop for that failure. A successful step must continue to create one fresh
epoch; transport/schema/timeout/EOF failure must still terminate and must never
restore or promote a boundary. Add DAP coverage for the failed step response,
unchanged handles/snapshot, no child follow-up, no stopped event, and a later
successful step that does create fresh handles.

#### `CR-018` — Blocking/high: the contract fake records taken branches as CODE predecessors

**Evidence:** `executeOne` in `test-fixtures/fake-emulator/server.ts` lines
692-703 computes the architectural next PC, changes the synthetic `SJMP` at
`0x0003` to target `0x0002`, and then unconditionally executes
`knownPredecessor.set(next, from)`. It therefore records `0x0003` as the CODE
predecessor of `0x0002`, even though the decoded instruction occupies bytes
`0x0003`-`0x0004` and is a taken branch, not a completed sequential
instruction. This code predates Worker C, but Issue #3 explicitly requires this
integrated review to challenge fake-versus-frozen-contract equivalence.

The frozen negative-disassembly rule permits execution evidence only for an
observed completed **sequential** instruction. An independently driven exact-
commit session launched at `0x0002`, continued one negotiated four-instruction
chunk through the `0x0003 -> 0x0002` loop, paused at the yielded `0x0002`
boundary, and requested two instructions at offset -1. The fake returned its
corrupt `0x0003` predecessor followed by `0x0002`. The correctly strict client
rejected the resulting reverse/overlapping records as
`EMU_TRANSPORT_SCHEMA: decodeCode records must be ordered and contiguous`, so
a valid DAP continue/pause/disassemble sequence became a fatal transport
failure instead of returning an unknown one-byte predecessor placeholder.

This violates `R-017`, `D-005`, `D-010`, `AC-003`, and Issue #3's requirement
that the fake implement the exact public contract rather than a convenience
model. It does not invalidate the framing/bounds/ID evidence that resolved
`CR-013`, but Worker B's fake responsibility cannot remain fully accepted
until this newly exposed semantic hole is corrected.

**Required correction:** add execution-derived predecessor knowledge only when
the completed instruction falls through sequentially to
`from + decoded.size` without wrap. A taken branch must neither create nor
overwrite a contiguous predecessor entry for its target. Add an integrated
test that starts at `0x0002`, executes the loop, pauses at `0x0002`, and proves
negative disassembly returns the exact-count invalid predecessor placeholder
plus the valid base record without a fatal event. Retain separate known-
sequential coverage and the strict hostile-window client checks.

#### `CR-019` — Medium: raw `stackTrace` pagination types/ranges are accepted as success

**Evidence:** `stackTraceRequest` in `adapter/src/session.ts` lines 305-307
uses `args.startFrame` and `args.levels` directly in JavaScript comparisons
without runtime integer/range checks. The public TypeScript types do not
validate raw DAP JSON at runtime.

An independent raw-framed probe sent string values
`{startFrame:"0",levels:"1"}` and then `{startFrame:-1,levels:1}`. Both
requests succeeded with an empty stack while reporting `totalFrames: 1`.
Neither changed child state, but accepting malformed pagination as a truthful
response is inconsistent with the strict raw-argument handling elsewhere and
can make a one-frame stopped session appear to have no frame.

**Required correction:** when present, require `startFrame` and `levels` to be
safe integers with `startFrame >= 0` and `levels >= 0`; reject malformed values
with a stable failed DAP response and no child command/state/handle change.
Preserve omitted/zero-level behavior and valid one-frame pagination. Add raw
JSON tests for strings, fractions, negative values, and valid 0/1/beyond-end
requests.

### Accepted behavior and adversarial assessment

Outside the findings above, the exact diff materially implements the frozen
Worker C responsibilities:

- initialize is accepted once; capability claims are limited to completed
  configurationDone, instruction-breakpoint, disassemble, and stepping-
  granularity surfaces;
- launch waits for hello/load/reset, sends `initialized`, accepts configuration
  breakpoints, and orders configurationDone response, launch response, then
  entry stop;
- reads require a stopped snapshot; one thread, one required-field current
  frame, and PC/A/B/PSW/SP/DPTR/R0-R7 use one width-validated atomic snapshot;
- valid resume paths invalidate old frame/register handles, and each real new
  stop creates fresh handles;
- opaque CODE references require exact `code:HHHH`; instruction breakpoints
  additionally accept one-to-four-digit `0x`/`0X` or unsigned decimal forms;
  whitespace, signs, other spaces, width/range errors, and fractional offsets
  fail; byte offsets are applied once;
- disassembly delegates to strict `decodeCode`, preserves exact count and
  ordered numeric `0xHHHH` addresses, maps exact decoder text, marks unknown
  predecessors invalid, and rejects whole-range/partial/wrap violations;
- instruction breakpoints are a global replacement, de-duplicate only the
  child request, retain DAP-order results, enforce the local/negotiated unique
  limit, clear on an empty request, and report verified/rejected canonical
  targets; the fake checks a breakpoint before execution and the adapter maps
  it to exact DAP reason `instruction breakpoint`;
- continue responds before scheduling, emits no unsolicited `continued`,
  repeatedly yields through the event loop, and keeps child commands
  serialized; pause responds before exactly one stop, handles active and idle
  yield boundaries, schedules no run after intent, rejects repeated pause, and
  never promotes a timeout/disconnect boundary;
- omitted/statement/instruction `stepIn` completes exactly one successful child
  step; line/target/unknown granularity, `next`, and `stepOut` fail without a
  child command or state change;
- missing executable, incompatible hello/capability, malformed protocol,
  timeout, crash/EOF, launch cancellation, active-run disconnect, and repeated
  disconnect use bounded cleanup and exactly-one termination guards. No review
  probe left a fake, hostile, or adapter process alive.

The source/package diff contains no source breakpoints/maps, raw memory browser,
evaluate, mutation, watchpoint, attach/TCP, emulator bundling/download,
interrupt/logical-stack feature, private emulator struct dependency, P1000
semantic/default/fixture, or physical serial/GPIO/field-bus endpoint. The fake
fault/scenario controls remain test-only and absent from product code and the
VSIX.

### AC and scope disposition

| Criterion | Review disposition at `574dd8d...` |
|---|---|
| `AC-001` | Fake-backed implementation evidence passes hello/load/reset ordering, capability truthfulness, initialized/configuration/launch ordering, and entry stop. No real-runtime or real-VS-Code acceptance is claimed. |
| `AC-002` | Passes for the exact atomic snapshot, one thread/frame, required frame fields, register names, widths, and bank-selected `r[8]` contract. |
| `AC-003` | **Changes required:** forward, known/unknown, range, exact-count, and numeric mapping paths pass, but `CR-018` makes a valid branch/pause predecessor case fatal. Real UI evidence also remains final verification work. |
| `AC-004` | Fake-backed DAP path passes numeric round trip, non-zero offset once, under/overflow rejection, global replacement/dedupe/order/limit/clear, pre-execution hit, and exact stop reason. Real UI/runtime evidence remains open. |
| `AC-005` | Required successful omitted/statement/instruction and unsupported line/next/stepOut paths pass. Worker C remains changes-required because `CR-017` violates the adjacent failed-step state invariant. |
| `AC-006` | Passes active/idle pause ordering, repeated bounded yields, no continued event, no post-intent chunk, repeated pause, timeout, and disconnect probes. |
| `AC-007` | Required resume/new-stop stale/fresh-handle path passes; `CR-017` separately blocks stop-epoch coherence for a failed step that did not resume successfully. |
| `AC-008` | Fake-backed missing executable, version/capability mismatch, malformed, timeout, crash/EOF, diagnostic, terminal cleanup, and no-orphan cases pass. |
| `AC-009` | Active-run and repeated disconnect probes pass response/cleanup ordering and exactly-one terminated behavior. |
| `AC-010` | Not accepted here: the local Windows build/package/install passed, but no exact-commit Linux run, supported-floor install, real-runtime F5 smoke, or dual-platform final lane was available. |
| `AC-011` | Local source/fixture/archive/process inspection passes firmware neutrality and no-hardware scope. Final cross-platform verification remains open. |

No deferred Slice-1 scope was accepted. `CR-017`-`CR-019` require correction
and fresh independent re-review before final verification may treat
`AC-001`-`AC-009` as an accepted set.

### Independent executable evidence

All executable product checks ran in a clean detached worktree at exact
`574dd8d0b44c2970656fe7e9c0c41dc5164896cb`:

- reviewer host: Windows x64, Node `v24.11.0`, npm `11.6.1`, VS Code
  `1.134.0` commit `110a328ea54b42367b803ec53ee0bf52ef26b419`;
- `git rev-parse 574dd8d...^` and
  `git merge-base 0d1ce33... 574dd8d...` both returned exact parent
  `0d1ce33d91758254efa65658e4af9b9b72a04360`;
- `git diff --check 0d1ce33... 574dd8d...`: pass; ten intended paths,
  2,276 insertions and 75 deletions;
- complete diff plus the integrated session/client/fake/state/address/package
  sources inspected rather than trusting test names;
- clean `npm ci`: pass, 376 packages, zero reported vulnerabilities; two
  transitive deprecation warnings were non-blocking;
- `npm run lint` and `npm run build`: pass;
- full compiled suite: 86/86 pass;
- contract-only suite: 45/45 pass;
- Worker C focused behavior/unit suite: 23/23 pass;
- `npm run fixture:check`: pass; 65,536 bytes and SHA-256
  `1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88`;
- independent DAP lifecycle/pause probe: duplicate initialize failed, order was
  initialized/configurationDone/launch/entry, running reads failed, pause
  response preceded one pause stop, old handles were stale after that real
  resume, repeated pause failed, exactly one chunk ran, and no continued event
  appeared;
- independent DAP address/breakpoint probe: decode arguments were exact
  `[16,2,-1,2]`; returned addresses were `0x0011`/`0x0012`; `0x0010 + 2` and
  decimal 18 de-duplicated to child address 18 while retaining two verified
  DAP entries; overflow and limit entries were rejected; empty input cleared;
- independent structured-step, raw-pagination, and branch-predecessor probes
  reproduced `CR-017`-`CR-019` exactly as recorded above;
- `npm run package` and `npm run package:contents`: pass; 47-file, 119.15-KB
  VSIX; reviewer-built SHA-256
  `8B7F585953EAC69F09CCD2E6F142CFD67F1A3EA34872849A4058E12B260EFDFA`;
- `code --install-extension ... --force`: pass as local identifier
  `undefined_publisher.emusa80535-dap@0.1.0`; no Marketplace credential was
  required;
- archive allowlist/safety/deferred-feature/private-struct/fake-only scans and
  final Windows process scan: pass; the archive contains no emulator, fake,
  firmware, test, SDP/protocol source, owned TypeScript/source-map, or build
  toolchain.

No GitHub Actions run existed for exact `574dd8d...` at review time, and the
implementation PR still pointed remotely to earlier `0d1ce33...`. Therefore
this review makes no exact-commit Linux claim. It also makes no supported-floor
VS Code, real disassembly UI, real `emuSA80535-N`, or `EMU-BLK-001`-`010`
acceptance claim.

### Result and next gate

`RVW-001-002-003` returns **changes-required**. A corrective worker must repair
`CR-017`-`CR-019`, add the exact adversarial regressions above, and preserve all
accepted behavior. A fresh reviewer must then rerun the full build/test/
contract/fixture/package/install/process/safety matrix plus the three original
reproductions.

Master owns durable finding/traceability/rework integration outside this
review-only commit. Final verification, Linux/Windows dual-lane acceptance,
supported-floor and real-VS-Code UI smoke, and the exact accepted real emulator
commit remain later gates. Slice 1 remains **NOT_READY**.

## Worker C corrective re-review — `RVW-001-002-007`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent corrective reviewer; not the Worker C
author or the author of `RVW-001-002-003`

**Reviewed corrective product commit:**
`8728a965cd04bc43816cd8401638869b2615f861`

**Reviewed parent:**
`a5b7f3ada338b2f62185154500100fec5b0f3048`

**Defect-contrast product commit:**
`574dd8d0b44c2970656fe7e9c0c41dc5164896cb`

**Authority:** GitHub Issue #3, accepted PR #2 SDP baseline, active
`IT-001-002 / SL-001-002-001`, the frozen `emu-debug` 1.0 contract, and
`RVW-001-002-003 / CR-017`–`CR-019`

**Disposition:** **accepted; `CR-017`, `CR-018`, and `CR-019` resolved; no new
finding**

### Scope and independence

The corrective commit has the exact stated parent and merge base. Its diff is
limited to `adapter/src/session.ts`, `test-fixtures/fake-emulator/server.ts`,
and `test/dapBehavior.test.ts`: 272 insertions and seven deletions. Source
inspection covered the complete corrective diff plus the integrated session,
stop-state, strict client, fake execution/decode, launch, lifecycle, package,
and test paths. No product claim was accepted merely from the three new tests.

All executable correction evidence ran in a clean detached worktree at exact
`8728a965...`. A second clean detached worktree at exact `574dd8d...` supplied
the old-behavior contrast. The independently authored probe was transient,
left no tracked artifact, and used raw DAP framing plus both a controlled
backend and the actual contract fake. This addendum is the only durable
reviewer change; Master retains sprint, handoff, verification, and
traceability integration ownership.

### Finding-by-finding disposition

#### `CR-017` — resolved

`stepInstruction` now keeps the active `StopEpochStore` entry intact while it
temporarily marks the logical session running and the child command active.
On a structured non-transport rejection it restores the child to
`idle-at-boundary` and the logical session to `stopped` without calling
`activate`, incrementing `runGeneration`, invalidating a handle, or emitting an
event. A successful later step still calls the normal stopped-snapshot
activation path and therefore creates a fresh epoch and handles. A transport
failure does not execute the restore path and instead performs the existing
fatal cleanup and termination.

The contrast probe made a backend reject exactly one step with the structured
`EMU_STEP_REJECTED` error. Exact `574dd8d...` failed the DAP request but silently
changed the frame handle and made the old scope handle stale without a stopped
event. Exact `8728a965...` produced exactly one failed step response, exactly
one child step call, no queued stopped/output/other event, and byte-for-byte
identical stack, scope, variable, register, snapshot-derived data, frame ID,
and variables reference. Reads during the command remain unavailable because
the logical state is running. A second successful step produced one `step`
stop, advanced PC, made both old handles stale, and returned a fresh frame
handle. A separate `EMU_TRANSPORT_TIMEOUT` step probe produced the failed
response, diagnostic, exactly-one terminated event, backend cleanup, and no
restored/promoted stopped snapshot.

#### `CR-018` — resolved

The fake now records execution-derived predecessor knowledge only when the
architectural next PC equals `from + decoded.size` and that sum stays within
`0x0000`–`0xFFFF`. A taken `SJMP` neither creates nor overwrites a sequential
predecessor for its target, while a real completed fall-through still records
the boundary. Wrap from `0xFFFF` to `0x0000` is explicitly excluded.

The old-commit probe launched at `0x0002`, continued exactly one negotiated
four-instruction chunk through the taken `0x0003 -> 0x0002` branch, paused at
the yielded `0x0002` boundary, and reproduced fatal
`EMU_TRANSPORT_SCHEMA` negative disassembly. The same exact sequence on
`8728a965...` returned the required exact-count pair: invalid one-byte
placeholder `0x0001` followed by valid decoder output `INC A` at `0x0002`,
with no output or terminal event. A separate step from `0x0000` to `0x0002`
then returned the known valid `MOV A,#0x01` predecessor, proving that truthful
sequential evidence remains enabled. A step from `0xFFFF` to `0x0000` did not
create wrapped predecessor knowledge; negative disassembly failed with the
structured range error and did not become a fatal guessed window.

#### `CR-019` — resolved

When present, both `startFrame` and `levels` now must be nonnegative JavaScript
safe integers. The stable `EMU_STACKTRACE_INVALID` response is sent before any
child command and does not mutate the stop snapshot, logical/child state,
epoch, frame handle, scope handle, or register data.

Exact `574dd8d...` reproduced the original raw string pagination success with
an empty stack and `totalFrames: 1`. Exact `8728a965...` rejected strings,
fractions, negative values, unsafe integers, nulls, booleans, arrays, and
objects for each field with the same stable code. Null, array, string, numeric,
and boolean whole-arguments shapes failed the existing stable thread error.
Omitted pagination, `0/0`, `0/1`, `0/2`, beyond-end, zero-level beyond-end,
and maximum-safe start pagination all returned the correct one-frame or empty
page with `totalFrames: 1`. The original frame/scope/variable bodies and
handles remained exactly usable afterward and no child request occurred.

### New-finding and regression disposition

No new finding was raised. The correction adds one stable error identifier and
test-only fake scenario but advertises no new DAP capability, emulator
capability, launch field, product command, setting, or private alternative
protocol. The four initialized capabilities remain exactly the accepted
configuration-done, instruction-breakpoint, disassemble, and stepping-
granularity claims.

The full fake-backed paths retain initialize-once and launch/configuration
ordering; one atomic thread/frame/register snapshot; strict CODE reference and
numeric-address conversion; exact-count disassembly and whole-range failure;
replacement breakpoint limit, order, de-duplication, offset-once and
pre-execution hit behavior; bounded repeated continue yields; active/idle pause
ordering and timeout safety; supported/unsupported step behavior; missing,
malformed, timeout, crash, EOF, and schema failure handling; and launch-owned
exactly-once cleanup. No source breakpoint, mapping, memory browser/mutation,
evaluate, watchpoint, attach/TCP, logical stack, interrupt, emulator bundling,
download, private emulator struct, P1000 semantic, or physical endpoint was
introduced.

### AC and scope disposition

| Criterion | Corrective review disposition at `8728a965...` |
|---|---|
| `AC-001` | Fake-backed pass: truthful capabilities, hello/load/reset order, configuration response/launch response/entry-stop order, and deterministic entry snapshot remain green. Real-runtime F5 is a final gate. |
| `AC-002` | Pass: one thread, one required-field current-PC frame, one Registers scope, and exact PC/A/B/PSW/SP/DPTR/R0-R7 values remain one atomic stopped snapshot. |
| `AC-003` | **Correction accepted:** exact forward/negative counts, numeric addresses, decoder text, unknown placeholders, known sequential predecessor, taken-branch exclusion, no wrap, and whole-range failures pass. Real VS Code disassembly UI remains final verification. |
| `AC-004` | Pass: numeric reference round trip, nonzero offset once, canonicalization, under/overflow rejection, global replacement/de-duplication/order/limit/clear, pre-execution hit, and `instruction breakpoint` stop remain green. |
| `AC-005` | **Correction accepted:** omitted/statement/instruction step exactly once; line/target/unknown/next/stepOut do not resume; structured rejection preserves the exact old stop; later success creates one fresh `step` stop. |
| `AC-006` | Pass: pause response precedes one pause stop, active and repeated-yield paths schedule no post-intent chunk, and timeout/disconnect never promote an unproven boundary. |
| `AC-007` | **Correction accepted:** real resume/new stop invalidates old handles and allocates fresh ones, while a rejected step that did not resume preserves the exact epoch and all existing handles. |
| `AC-008` | Pass against the fake-backed responsibility: missing executable, version/capability mismatch, malformed/schema error, timeout, crash, and EOF remain actionable, fatal where required, reaped, and orphan-free. The corrected transport-step probe also passed. |
| `AC-009` | Pass: active-run/repeated disconnect retains bounded child termination, pipe/process cleanup, and exactly one terminated event. |
| `AC-010` | Not accepted by this Windows corrective review: local build/package/install passes, but no exact-commit remote Linux run, supported-floor dual-platform install, or real-runtime F5 smoke exists yet. |
| `AC-011` | Local source, fixture, archive, dependency, and process scans pass no-hardware/P1000 neutrality. Final cross-platform verification remains open. |

Thus the fake-backed Worker C responsibility and the `AC-001`–`AC-009` path
set are accepted for final verification. This does not convert `AC-010` or
`AC-011` to final verified status and does not satisfy the real-emulator gate.

### Independent executable evidence

- reviewer host: Windows 11 Pro x64 `10.0.26200`, Node `v24.11.0`, npm
  `11.6.1`, and VS Code `1.134.0` commit
  `110a328ea54b42367b803ec53ee0bf52ef26b419`;
- exact corrective HEAD, parent, and merge base: `8728a965...`, `a5b7f3a...`,
  and `a5b7f3a...`; `git diff --check`: pass; three intended paths, 272
  insertions and seven deletions;
- clean `npm ci`: pass, 376 packages, zero reported vulnerabilities; two
  transitive deprecation warnings were non-blocking;
- clean `npm run lint` and `npm run build`: pass;
- `npm test`: 89/89 pass;
- `npm run test:contract`: 45/45 pass;
- focused `dapBehavior` plus `debugBehaviorUnit`: 26/26 pass;
- independent old-versus-corrected structured-step, transport-step,
  pagination, taken-branch, sequential-predecessor, and wrap probe: pass with
  every old defect reproduced and every corrected invariant accepted;
- `npm run fixture:check`: pass; 65,536 bytes and SHA-256
  `1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88`;
- `npm run package` and `npm run package:contents`: pass; 47-file, 119.31-KB
  VSIX; reviewer-built SHA-256
  `085EE64BBD74E75F0FA272EB1B3C2458E3A3CF192092AF9E0E2F5B522F561017`;
- isolated `code --install-extension ... --force`: pass as
  `undefined_publisher.emusa80535-dap@0.1.0`; no Marketplace credential was
  required;
- runtime dependency tree contains only exact `@vscode/debugadapter@1.68.0`
  and `@vscode/debugprotocol@1.68.0`; 47-entry archive allowlist, deferred-
  handler, fake-only product, P1000/physical-endpoint, private-struct, and final
  process scans: pass;
- the archive contains no emulator, fake, firmware, tests, SDP/protocol source,
  owned TypeScript/source map, or build toolchain; no review fake or adapter
  child remained; and all non-SDP paths at branch handoff HEAD were byte-
  identical to exact `8728a965...`.

At review time implementation PR #4 still remotely referenced `0d1ce33...`,
and no GitHub Actions run existed for exact `8728a965...`. This review therefore
makes no exact-commit Linux claim. It also makes no supported-floor VS Code,
real disassembly UI, accepted real `emuSA80535-N`, `EMU-BLK-001`–`010`, or
final `READY` claim.

### Result and next gate

`RVW-001-002-007` **accepts** exact corrective product commit `8728a965...`,
resolves `CR-017`–`CR-019`, and raises no new finding. Worker C's complete
fake-backed debug-behavior responsibility is accepted and may proceed to the
separate final verification pass.

Master must integrate this review disposition into sprint documents and the
traceability index, relations, and append-only ledger. Final verification must
still prove the exact accepted branch on Linux and Windows, supported-floor
VS Code package/install and real UI behavior, map every `EMU-BLK-001`–`010` to
an exact accepted emulator commit, and pass the real-runtime contract plus F5
smoke. Until those independent gates pass, Slice 1 remains **NOT_READY**.

## AC-010 cross-platform correction review - RVW-001-002-008

**Review date:** 2026-09-01

**Reviewer role:** fresh independent corrective reviewer; not the author of
the verification report, corrective product/CI commit, or Master handoff

**Reviewed corrective commit:**
2ecbec37e711c80c13b5e622ebe5f65d1f5eebc5

**Reviewed parent:**
6527065e74706f370197670608c5ff96f857f479

**Authority:** GitHub Issue #3, accepted PR #2 SDP baseline, active
IT-001-002 / SL-001-002-001, AC-010, CR-020, and DAP-SLICE1-VER-001

**Disposition:** **accepted for exact-HEAD remote verification; no new
finding; CR-020 implementation correction accepted but remains open until
both GitHub Actions jobs pass**

### Scope and independence

This pass reviewed the exact 21-path CR-020 correction against its exact parent
and did not rely on the worker's report. The commit adds the dual-platform
workflow, pinned test dependencies, exact VSIX policy, packaged extension-host
smoke driver, test-only Linux and Windows fake launchers, and focused support
tests. It changes no adapter or extension product source. The only
contract-fake change adds optional test evidence sinks for the request log and
process ID; no fake-only command or alternate product protocol is added.

The branch contained later Master-owned SDP handoff commits during execution.
The non-SDP diff from exact 2ecbec37... to the working HEAD was empty, proving
that every tested product, CI, script, fixture, package, and test path was
byte-identical to the exact corrective commit. This reviewer changed only this
review section.

### Workflow and toolchain assessment

- .github/workflows/ci.yml defines separate ubuntu-latest and windows-latest
  jobs, each bounded to 25 minutes. Both select exact Node 22.20.0 and run npm
  ci, lint, the full suite, the focused protocol contract suite, fixture
  verification, package creation, package contents, exact archive policy, and
  the floor-version packaged smoke.
- The Linux lane runs the smoke under xvfb-run -a; the Windows lane invokes the
  same Node entry point directly. The shared script downloads declared VS Code
  floor 1.95.0, uses isolated extension and user-data directories, installs
  the newly built VSIX, and verifies editor version, installed extension
  ID/version, manifest floor/entry point, and unique installed filesystem root
  before launching a debug session.
- Root runtime and development dependencies are exact versions in both
  manifest and npm v3 lockfile. The production dependency tree remains only
  @vscode/debugadapter@1.68.0 and @vscode/debugprotocol@1.68.0, with the latter
  de-duplicated.
- Linux portability was reviewed statically, not represented as executed
  evidence. The non-Windows wrapper is a mode-0755 /bin/sh file whose only
  action is the safely quoted exec of EMU_SMOKE_NODE, EMU_SMOKE_SERVER, and
  every forwarded argument. Node-side process discovery uses /proc, timeout
  cleanup kills the detached process group, and no PowerShell or Windows path
  assumption is reachable on that branch.

No workflow or toolchain finding was found. At review time this commit had not
been pushed, so this review deliberately makes no GitHub Actions execution or
exact-commit Linux claim. Only an exact pushed Actions run can prove the
hosted Ubuntu image, Xvfb, download, install, and extension-host execution
together.

### Packaged-product smoke assessment

The development extension passed to @vscode/test-electron is only a test
harness and contains no debugger contribution or adapter implementation.
Inside the VS Code extension host, the harness obtains the installed product
by exact ID, checks version and canonical extension path against the isolated
VSIX installation, and explicitly activates that installed extension. It then
calls vscode.debug.startDebugging. The installed product contributes the debug
type and resolves its external adapter from the installed
out/adapter/src/main.js. Thus the smoke neither substitutes the harness for
the product nor executes the repository's development adapter.

The contract fake, firmware, POSIX wrapper, C# wrapper, harness, and smoke
scripts all stay outside the VSIX. The adapter continues to spawn the supplied
emulator executable directly with shell false and only the frozen
--headless-debug argument. The Windows launcher invokes Node through
CreateProcess, duplicates stdin/stdout/stderr independently with
STARTF_USESTDHANDLES, quotes every argument without cmd.exe, waits for the fake
child, and forwards its exit code. The focused Windows pipe test independently
completed a protocol 1.0 hello and terminate through this launcher. The Linux
wrapper quotes both executable paths and all forwarded arguments and replaces
itself with the fake process.

The successful floor smoke proved all of the following in one isolated VS Code
1.95.0 extension-host run:

- installed identity undefined_publisher.emusa80535-dap@0.1.0 and canonical
  target root under the temporary extensions directory;
- packaged adapter presence under that installed root;
- DAP initialize, launch, configurationDone, entry stop, disconnect, and
  exactly one observed terminated event;
- exact product-protocol fake command order hello, load, reset, empty
  replaceCodeBreakpoints, then terminate; and
- successful launch response, entry reason/thread validation, clean fake exit,
  zero matching adapter/fake/wrapper processes, and removal of the complete
  isolated temporary root.

The upstream test utility/Electron emitted a Node DEP0190 warning and transient
mutex/utility-process diagnostics while still returning exit code zero. These
did not involve the adapter's emulator spawn path, which remains no-shell, and
the independently written harness evidence, exact fake request log, child PID
exit check, and final process scan all passed. No product or CI finding is
raised from those non-fatal host diagnostics.

### Package boundary, safety, and claim assessment

The rebuilt archive contains exactly 47 allowlisted entries. Besides VSIX
metadata it contains only the manifest/readme/license, eight compiled adapter
JavaScript files, three compiled extension JavaScript files, and the two pinned
@vscode runtime packages. The exact allowlist rejects every additional path,
including emulator/fake/fixture/test/harness/script/SDP/protocol material,
owned TypeScript, source maps, C# source, firmware, and executables. Vendor
runtime declaration files are explicit allowlist members; no owned source is
present.

The correction adds no P1000 semantic, physical-I/O endpoint, private emulator
layout, deferred DAP feature, emulator bundling, or download behavior. README
claims are bounded correctly: the workflow is described as fake-backed package
smoke, while real-emulator F5 and disassembly-UI acceptance, independent
verification, and READY remain explicitly unclaimed.

### Independent executable evidence

- reviewer host: Windows 11 Pro x64 10.0.26200, Node v24.11.0, npm 11.6.1,
  and installed VS Code 1.134.0 commit
  110a328ea54b42367b803ec53ee0bf52ef26b419;
- exact parent/merge-base and reviewed commit:
  6527065e74706f370197670608c5ff96f857f479 and
  2ecbec37e711c80c13b5e622ebe5f65d1f5eebc5; git diff --check passed;
- clean npm ci: pass, 405 packages installed, zero reported vulnerabilities;
  two transitive deprecation notices only;
- npm run lint: pass;
- npm test: 99/99 pass, including archive/process/evidence policy and the
  Windows stdio-forwarding launcher test;
- npm run test:contract: 45/45 pass;
- npm run fixture:check: pass, 65,536 bytes, SHA-256
  1550101BC337EBA836F6FC6A3012B80677B9DFE6A0C658FCF615194BE54E5B88;
- npm run package, npm run package:contents, and npm run package:policy: pass;
  47 entries, 122,481 bytes, exact policy;
- reviewer-built VSIX SHA-256:
  44E1FA3C2174427FE4D7574752EACC4D71E1C92126AD88461AA187B5D06B6153;
- package.json SHA-256:
  573D09C779DACF5E194DD5F0DA211CB3B972C3154AE5B7CCD659AA603CCCEB82;
- package-lock.json SHA-256:
  C8FAA1219F927B8D37C9B16ECF5F75109D9BBE1FB22C76DFC8AE6E5A8666B9C5;
- actual downloaded floor runtime: VS Code 1.95.0, commit
  912bb683695358a54ae0c670461738984cbb5b95, x64;
- npm run smoke:vsix: pass as
  undefined_publisher.emusa80535-dap@0.1.0; fake PID 13324; exact command order
  and DAP entry/disconnect evidence above; zero orphan processes;
- independent post-smoke Windows process scan: no target adapter, fake server,
  or wrapper; temporary-directory scan: no emusa80535-packaged-smoke-*
  directory remained; and
- final tracked worktree and git diff --check: clean before this review edit.

### Result and remaining gates

RVW-001-002-008 **accepts** exact corrective commit 2ecbec37... for Master push
and separate exact-HEAD verification. No new finding is raised. The
implementation part of CR-020 is accepted, but the finding must remain open
until both Ubuntu and Windows Actions jobs complete successfully on the exact
pushed review-integrated HEAD; this local Windows review cannot close a
cross-platform CI finding by itself.

Even after successful fake-backed dual-platform Actions, this review does not
satisfy the accepted-real-emulator contract tests, real-runtime F5 launch, or
actual VS Code disassembly-UI gate required by Issue #3. Master and a fresh
verifier must preserve the prior strict dispositions for AC-001, AC-003,
AC-004, AC-011, and the remaining EMU-BLK dependencies. Until exact Actions
evidence and every mandatory real-emulator gate pass, Slice 1 remains
**NOT_READY**.

## AC-006 remote determinism correction review — `RVW-001-002-009`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent corrective reviewer; not the author of
the CR-021 finding, corrective test commit, or Master handoff

**Reviewed corrective commit:**
`1e104a18a365b5ad7666e86faad4b8fa00f14715`

**Reviewed parent:**
`341df7d6b5b3574076b76e9bc1eea81f30ca539d`

**Remote failure HEAD:**
`3b0e48270a1fae70030cbb84fa4f4709c062f33e`

**Authority:** GitHub Issue #3, accepted PR #2 SDP baseline, active
`IT-001-002 / SL-001-002-001`, `AC-006`, `CR-021`, and the accepted
`RVW-001-002-007` / `RVW-001-002-008` review chain

**Disposition:** **accepted for exact-HEAD remote re-verification; no new
finding; CR-021 implementation correction accepted but CR-021 remains open
until all four Ubuntu/Windows push/PR jobs pass**

### Scope and independence

The corrective commit has the exact stated parent and merge base. Its diff is
limited to `test/dapBehavior.test.ts`: 134 insertions and 16 deletions. No
adapter, extension, emulator-client, contract-fake, fixture, workflow, package,
or product-default path changed. The correction adds a test-backend injection
seam to the existing DAP harness and replaces one platform-speed-dependent
AC-006 timeout scenario with a controlled in-memory backend.

Review execution occurred on the branch after Master added SDP-only handoff
commit `e43454503125a4e93239dddf696a445ede78bba4`. A path-excluded comparison
proved the complete non-SDP tree at that HEAD byte-identical to exact
`1e104a18...`; therefore the executable evidence below applies to the exact
corrective test and unchanged product tree. This reviewer changed only this
review section and did not repair or alter test/product behavior.

### Remote-failure reproduction and correction assessment

The reviewer independently inspected the two prior exact-HEAD Actions runs.
Push run `33466541832` passed both Ubuntu and Windows on exact `3b0e482...`.
Pull-request run `33466544680` passed Ubuntu but failed Windows job
`99727478517` in `npm test`. Its log shows the affected test returning a DAP
`response` where `launchToConfiguration` expected the `initialized` event.
The failure occurred before continue/pause, after the old test had applied its
50 ms command timeout to the entire real client while intending to time out
only a 200 ms delayed `run`. The same remote HEAD passing in the duplicate
Windows push job confirms the recorded timing race and does not constitute an
accepted rerun.

The correction removes both the delayed fake-server run and the 50 ms global
client timeout from this target. `DeferredRunFailureBackend.launch` completes
normally with a contract-shaped protocol 1.0 hello, negotiated limits, image
record, and architectural entry snapshot. The test still drives the normal DAP
initialize, launch, configurationDone, entry stop, and continue sequence, and
asserts exactly one backend launch.

The controlled `run` then:

- asserts the adapter used the negotiated maximum chunk size;
- increments the run count exactly once and exposes an explicit started
  barrier;
- remains pending while the test sends pause and receives a successful pause
  response; and
- rejects only after that response, when the test explicitly injects
  `EMU_TRANSPORT_TIMEOUT`.

This ordering is independent of host scheduling speed and retains the actual
AC-006 failure semantics. The test observes the timeout diagnostic first and
one `terminated` event second, waits another event-loop turn, proves no
`stopped` promotion, proves no second queued termination, and asserts one run
and one runtime cleanup. The controlled backend coalesces every disconnect on
one cached promise; the session's fatal path performs the asserted cleanup and
the harness's final close safely reuses it. The unchanged AC-009 test also
performs a second real DAP disconnect after active-run cleanup and proves no
additional event or child command. Thus the correction neither substitutes a
pause stop for an unproven boundary nor weakens exactly-once/idempotent cleanup.

### Real-client and regression disposition

No product implementation was replaced or weakened. The target intentionally
isolates the DAP state-machine reaction to a transport timeout, while the
unchanged contract suite continues to exercise the concrete
`EmulatorClient`/`EmulatorLaunchBackend` process behavior:

- `hello timeout kills and reaps without proving a boundary` drives the real
  client timer and verifies `EMU_TRANSPORT_TIMEOUT` plus process reap;
- `hung terminate is forcibly cleaned up and reaped` covers bounded terminate,
  kill, and reap through the launch backend;
- `disconnect during a pending handshake cancels and reaps the launch-owned
  child` covers cancellation during a live real-client command; and
- AC-009 drives disconnect during an active delayed fake-server run, verifies
  `run -> terminate`, child reap, exactly one `terminated`, and repeated
  disconnect idempotence.

All of these tests remain present, unchanged by the corrective diff, and
passed in the clean full/contract reruns. The complete 99-test suite also
retains compatible/malformed/crash/EOF/schema families and the other AC-006
active, idle, repeated-yield, response-before-stop, and no-post-intent-chunk
paths. No new protocol, fake-only product command, capability, launch field,
deferred DAP feature, hardware endpoint, P1000 semantic, or package content is
introduced.

No new finding was raised. `CR-021` is corrected at implementation/test level,
but a local Windows review cannot close a finding that originated from the
four-job hosted matrix.

### Independent executable evidence

- reviewer host: Windows 11 x64 `10.0.26200`, Node `v24.11.0`, npm `11.6.1`;
- exact parent, merge base, and correction:
  `341df7d6b5b3574076b76e9bc1eea81f30ca539d`, the same parent, and
  `1e104a18a365b5ad7666e86faad4b8fa00f14715`;
- exact diff inspection and `git diff --check`: pass; only
  `test/dapBehavior.test.ts` changed, with no product or workflow path;
- independent target stress: **100/100** sequential invocations passed, each
  invocation launching a separate Windows Node process with Node's test-name
  filter; zero failed iterations, 10.237 seconds total;
- clean `npm ci`: pass, 405 packages installed, zero reported
  vulnerabilities; two transitive deprecation notices only;
- `npm run lint` and `npm run build`: pass;
- `npm test`: 99/99 pass, including the corrected target and unchanged AC-009
  repeated-disconnect process test;
- `npm run test:contract`: 45/45 pass, including concrete client timeout,
  terminate/kill/reap, and pending-handshake cleanup tests;
- `npm run fixture:check`: pass; 65,536 bytes, SHA-256
  `1550101BC337EBA836F6FC6A3012B80677B9DFE6A0C658FCF615194BE54E5B88`;
- `npm run package`, `npm run package:contents`, and
  `npm run package:policy`: pass; exact 47-entry allowlist, 119.61-KB VSIX;
- reviewer-built VSIX SHA-256:
  `CD1FE7C4EDA53521C3CD80C762FF1E4DCFE68B9F55AC0280B511AB56452015E1`;
- `npm run smoke:vsix`: pass against an isolated installed VS Code `1.95.0`,
  commit `912bb683695358a54ae0c670461738984cbb5b95`, as
  `undefined_publisher.emusa80535-dap@0.1.0`; exact fake command order was
  `hello`, `load`, `reset`, empty `replaceCodeBreakpoints`, `terminate`, with
  entry stop, disconnect, exactly one DAP termination, and zero reported
  orphan processes;
- independent package/product safety scans: zero P1000/physical-endpoint or
  emulator-private-structure matches; exact archive policy excludes the fake,
  fixture, harness, emulator, executable, tests, SDP/protocol sources, owned
  TypeScript/source maps, and build tools;
- final Windows process and temporary-root scans: zero matching adapter,
  fake-server, wrapper, or packaged-smoke processes and zero
  `emusa80535-packaged-smoke-*` residue; and
- tracked worktree clean before this review edit; current non-SDP tree exactly
  matches the corrective commit and final diff whitespace checks passed.

The VS Code smoke returned exit code zero and complete structured pass evidence.
As in `RVW-001-002-008`, the test utility/Electron emitted non-fatal DEP0190,
mutex, utility-process, and N-API diagnostics; the exact fake log, DAP evidence,
child exit check, process scan, and temporary-root cleanup all passed, so no
new product or correction finding is raised from those host diagnostics.

### Result and remote rerun requirement

`RVW-001-002-009` **accepts** exact corrective commit `1e104a18...` for Master
integration, push, and exact-HEAD remote re-verification. The deterministic
test preserves AC-006's pause-response ordering, timeout diagnostic, no
unproven stopped promotion, single run, exactly-one termination, and cleanup
requirements while the concrete timeout/kill/reap coverage remains green.

Master must push the review-integrated HEAD and require all four jobs — Ubuntu
push, Windows push, Ubuntu pull request, and Windows pull request — to complete
successfully on the exact pushed product-equivalent tree. A rerun of only the
previously failed job or a lucky run on old `3b0e482...` is not closure.
`CR-021` and `CR-020` remain open until that evidence is recorded; only then
may fresh `VER-001-002-002` reassess AC-010.

This review does not satisfy the accepted-real-emulator contract tests,
real-runtime F5 launch, actual VS Code disassembly-UI gate, or remaining
`EMU-BLK` dependencies. It makes no `READY` claim. Until those independent
gates pass, Slice 1 remains **NOT_READY**.

## Repeated-yield pause determinism correction review — `RVW-001-002-010`

**Review date:** 2026-09-01

**Reviewer role:** fresh independent corrective reviewer; not the author of
the CR-022 finding, corrective test commit, or Master handoff

**Reviewed corrective commit:**
`b4a48ddd52f4b2083c5f3bf6ecc19a16ae95ce1e`

**Reviewed parent:**
`e6171d37f8b270898f566ab055085f08c51d70fe`

**Remote failure checkpoint HEAD:**
`15822ef188111995d39c1584a844669b389aed78`

**Authority:** GitHub Issue #3, accepted PR #2 SDP baseline, active
`IT-001-002 / SL-001-002-001`, `AC-006`, `CR-022`, and the accepted
`RVW-001-002-007` through `RVW-001-002-009` review chain

**Disposition:** **accepted for exact-HEAD remote re-verification; no new
finding; CR-022 implementation correction accepted but CR-022 remains open
until all four Ubuntu/Windows push/PR jobs pass**

### Scope and independence

The corrective commit has the exact stated parent and merge base. Its diff is
limited to `test/dapBehavior.test.ts`: 160 insertions and 6 deletions. No
adapter, extension, emulator client, contract fake, fixture, workflow,
manifest, lockfile, package script, or product-default path changed. The test
harness records received DAP messages, adds one controlled in-memory run
backend and deterministic yield-snapshot helper, and replaces only the
wall-clock/real-child repeated-yield target.

Review execution used a detached clean worktree at exact `b4a48dd...`, not the
later Master SDP-only handoff commit on the branch. This reviewer changed only
this review section and did not repair or alter test/product behavior.

### Deterministic scheduler assessment

The replacement target no longer launches the fake server, sleeps for an
assumed number of milliseconds, or depends on process response timing. Its
injected backend asserts every `run` uses the negotiated maximum chunk size and
exposes each call through a distinct deferred promise with a monotonic ordinal.
The test then proves the repeated scheduler and pause boundary explicitly:

- it observes run #1 before resolving yield #1 at `code:0010`;
- it observes run #2, thereby proving that yield #1 scheduled another bounded
  chunk, then resolves yield #2 at `code:0020`;
- it observes run #3, proving the second repeated scheduling transition, and
  leaves exactly that one run unresolved;
- it sends pause while run #3 is pending, receives the successful pause
  response, and proves no stopped event is queued before a boundary exists;
- it resolves the unique run #3 promise with yield #3 at `code:0030`, then
  observes the pause stopped event;
- it proves exactly one pause stop across the complete received-message
  history, no `continued` event, exactly three run calls, no queued or
  unresolved backend run, and the exact final snapshot as the last resolved
  boundary;
- a stopped `stackTrace` succeeds and reports `code:0030`, while a second pause
  fails with `EMU_STATE_NOT_RUNNING`; and
- disconnect completes, the harness consumes termination, and the idempotent
  backend cleanup count is exactly one.

There is no path for run #4 to be hidden behind host timing: the exact run-call
counter remains three after the final stop, and both the queued and unresolved
run sets are empty. The target retains only Node's 10-second test-runner safety
bound; no elapsed-time value controls its ordering or expected outcome. The
backend uses deferred promises and microtasks only. The changed diff adds no
`setTimeout`, delay, command-timeout override, process spawn, clock read, or
filesystem request log.

### Unchanged real-client and regression coverage

The correction does not replace concrete transport or fake-server evidence.
The unchanged full and contract suites still cover:

- the real `EmulatorClient` bounded-run command and exact contract fake;
- active-chunk pause response-before-stop and no post-intent chunk;
- a deterministic run timeout after pause intent with no unproven stopped
  promotion;
- concrete hello timeout, process kill, and reap;
- hung terminate with bounded forced cleanup and reap;
- disconnect during a pending real-client handshake;
- disconnect during an active delayed fake-server run, exact run/terminate
  ordering, repeated disconnect idempotence, one termination, and child reap;
- malformed, oversized, crash/EOF, response-schema, protocol-isolation, and
  fake record-bound families.

An exact path comparison proved all product, contract-client, fake, fixture,
workflow, and packaging paths byte-identical to the parent. The complete
99-test suite and 45-test contract suite passed, so the isolated state-machine
target is additive evidence rather than a substitute for the real-client and
process tests.

No new finding was raised. CR-022 is corrected at implementation/test level,
but a local Windows review cannot close a defect that originated in the hosted
Ubuntu/Windows push/pull-request matrix.

### Independent executable evidence

- reviewer host: Windows 11 x64 `10.0.26200`, Node `v24.11.0`, npm `11.6.1`;
- exact reviewed parent/merge base and correction:
  `e6171d37f8b270898f566ab055085f08c51d70fe`, the same parent, and
  `b4a48ddd52f4b2083c5f3bf6ecc19a16ae95ce1e`;
- exact diff inspection and `git diff --check`: pass; only
  `test/dapBehavior.test.ts` changed, with no product or workflow path;
- independent target stress: **120/120** sequential invocations passed, each
  invocation launching a separate Windows Node process with Node's exact
  test-name filter; zero failures, 12.645 seconds total;
- clean exact-tree `npm ci`: pass, 405 packages installed, zero reported
  vulnerabilities; two transitive deprecation notices only;
- `npm run lint` and `npm run build`: pass;
- `npm test`: 99/99 pass, including all AC-006/AC-009 and process-policy
  targets;
- `npm run test:contract`: 45/45 pass, including the concrete client
  timeout/kill/reap and pending-handshake cleanup tests;
- `npm run fixture:check`: pass; 65,536 bytes, SHA-256
  `1550101BC337EBA836F6FC6A3012B80677B9DFE6A0C658FCF615194BE54E5B88`;
- `npm run package`, `npm run package:contents`, and
  `npm run package:policy`: pass; exact 47-entry allowlist, 119.65-KB VSIX;
- reviewer-built VSIX SHA-256:
  `AFAC22C8B8B883FFD9F83B62F433FD80CB061333B586370A6FDBEBAABFFAD5BB`;
- `npm run smoke:vsix`: pass against an isolated installed VS Code `1.95.0`,
  commit `912bb683695358a54ae0c670461738984cbb5b95`, as
  `undefined_publisher.emusa80535-dap@0.1.0`; exact fake command order was
  `hello`, `load`, `reset`, empty `replaceCodeBreakpoints`, `terminate`, with
  entry stop, clean disconnect, exactly one DAP termination, and zero reported
  orphan processes;
- post-smoke Windows process scan: zero matching adapter, fake-server, or
  packaged-smoke processes; temporary-root scan: zero
  `emusa80535-packaged-smoke-*` residue;
- package/product/test safety scan: zero P1000, physical-endpoint,
  emulator-private-structure, bundling, or auto-download matches; and
- detached exact worktree remained tracked-clean after execution; both the
  corrective diff and final worktree diff whitespace checks passed.

The installed-floor smoke returned exit code zero and complete structured
evidence. As in the earlier corrective reviews, the test utility/Electron
emitted non-fatal DEP0190, mutex, and N-API diagnostics. The exact fake log,
DAP evidence, child exit check, process scan, and temporary-root cleanup all
passed, so no product or correction finding is raised from those host
diagnostics.

### Result and remote rerun requirement

`RVW-001-002-010` **accepts** exact corrective commit `b4a48dd...` for Master
integration, push, and exact-HEAD remote re-verification. The deterministic
test now proves repeated scheduling through two yielded boundaries, pause
response ordering while the third run is pending, unique final-boundary
promotion, one pause stop, final PC, no `continued`, no fourth run, valid
stopped reads, and exactly-once cleanup without relying on wall-clock or child
process timing.

Master must push the review-integrated HEAD and require all four jobs — Ubuntu
push, Windows push, Ubuntu pull request, and Windows pull request — to complete
successfully on the exact pushed product-equivalent tree. A rerun of only the
previously failed Windows-push job, or a lucky green run on old checkpoint
`15822ef...`, is not closure. Only after the new four-job evidence is recorded
may CR-022 be resolved and final verification return to the external gate.

This review does not satisfy the accepted-real-emulator contract tests,
real-runtime F5 launch, actual VS Code disassembly-UI gate, or remaining
`EMU-BLK` dependencies. It makes no `READY` claim. Until those independent
gates pass, Slice 1 remains **NOT_READY**.
