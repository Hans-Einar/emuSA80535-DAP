# DAP-SLICE1-VER-001 — Independent Slice-1 verification

**Verification ID:** `VER-001-002-001`

**Verified integrated HEAD:**
`fdb1ccd231e18bdb864fb43936538f54f1f1dfaa`

**Reviewed product culmination:**
`8728a965cd04bc43816cd8401638869b2615f861`

**Branch:** `codex/dap-first-slice`

**Pull request:**
[#4](https://github.com/Hans-Einar/emuSA80535-DAP/pull/4)

**Verification time:** 2026-09-01T02:55:36Z

**Review disposition:** **ACCEPTED** — the independent Worker A/B/C review
chain is closed, `CR-009` through `CR-019` are resolved, and no new product
defect was found by this pass.

**Verification disposition:** **CHANGES REQUIRED AND EXTERNALLY BLOCKED**

**Final disposition:** **NOT_READY**

## Scope and independence

This is the fresh final verification pass required by GitHub Issue #3 and the
active `IT-001-002 / SL-001-002-001` contract. It verifies exact integrated
HEAD `fdb1ccd...`, whose non-SDP product, test, package, fixture, and CI paths
are byte-identical to accepted product culmination `8728a965...`.

The verifier read Issue #3 in full, the accepted PR #2 baseline and its cited
mandate, study, requirements, architecture, design, frozen protocol, sprint,
Steering review, activation, review chain, handoff, implementation notes, and
traceability state. The verifier did not author or repair product, test,
fixture, package, CI, sprint, review, or traceability files. This report is the
only verifier-authored path.

Issue #3 permits implementation against the contract fake but does not permit
a READY result without a compatible accepted real emulator, the same real
contract/integration tests, and real VS Code end-to-end acceptance. Those real
gates are unavailable at the current emulator default. AC-010 also has a
separate correctable repository gap: the only workflow job is Linux and it
does not install the VSIX or smoke F5.

## Exact environment and package identity

| Evidence | Exact value |
|---|---|
| Local OS | Windows 11 Pro x64, `10.0.26200` (PowerShell also reports legacy `WindowsVersion 2009`) |
| Local Node | `v24.11.0` |
| Local npm | `11.6.1` |
| Installed VS Code | `1.134.0`, commit `110a328ea54b42367b803ec53ee0bf52ef26b419`, x64 |
| Declared VS Code floor independently installed | `1.95.0`, commit `912bb683695358a54ae0c670461738984cbb5b95`, x64 |
| Declared Node floor | `>=22.13.0` |
| Exact GitHub Actions Node | `22.20.0` |
| Extension package | `emuSA80535-dap@0.1.0` |
| VS Code engine | `^1.95.0` |
| Lockfile | npm lockfile version `3`, root `emuSA80535-dap@0.1.0` |
| Runtime dependencies | `@vscode/debugadapter@1.68.0`; `@vscode/debugprotocol@1.68.0` |
| `package.json` SHA-256 | `EFE6A8D4EE15C4D83E67F33C0717F1CF5805F114ED49B5640362B21EBC02D5F8` |
| `package-lock.json` SHA-256 | `C68BA655C92D93463C02E13E7C0C5C3D194A2CF84183457CB3FE4DD0281E6B1D` |
| Synthetic fixture | 65,536 bytes; SHA-256 `1550101BC337EBA836F6FC6A3012B80677B9DFE6A0C658FCF615194BE54E5B88` |
| Rebuilt VSIX | 122,134 bytes; 47 entries; SHA-256 `B81ADF75B894D1482FA21E7EB129849FB4C7036329802611FCDA9E6C23B46AF6` |

The root package and lockfile pin the same exact direct and development
dependency versions. `npm ls --omit=dev --all` reports only the two expected
`@vscode` runtime packages, with `debugprotocol` de-duplicated.

## Exact-HEAD local verification

The tracked worktree was clean before `npm ci` and remained clean after all
build, test, package, install, scan, and process checks.

| Command/evidence | Result |
|---|---|
| `git rev-parse HEAD` | PASS — exact `fdb1ccd231e18bdb864fb43936538f54f1f1dfaa`. |
| `npm ci` | PASS — 376 packages installed, zero reported vulnerabilities; two transitive deprecation warnings only. |
| `npm run lint` | PASS. |
| `npm run build` | PASS. |
| `npm test` | PASS — 89/89. |
| `npm run test:contract` | PASS — 45/45. |
| `node --test out/test/dapBehavior.test.js out/test/debugBehaviorUnit.test.js` | PASS — 26/26 focused behavior/unit tests. |
| `npm run fixture:check` | PASS — exact size and digest shown above. |
| `npm run package` | PASS — 47-file VSIX. |
| `npm run package:contents` | PASS — expected extension files and two runtime dependency trees only. |
| Independent archive allowlist | PASS — zero unexpected entries. |
| Archive emulator check | PASS — zero emulator/headless executable entries. |
| Archive owned-source check | PASS — zero owned TypeScript or source-map entries; vendor runtime declarations are allowed. |
| Isolated VSIX install, VS Code 1.134.0 | PASS — listed as `undefined_publisher.emusa80535-dap@0.1.0`. |
| Isolated VSIX install, VS Code floor 1.95.0 | PASS — listed as `undefined_publisher.emusa80535-dap@0.1.0`. |
| Marketplace credential | Not needed for either local install, as permitted by Issue #3. |
| Contract-fake/DAP launch smoke | PASS — the full/focused suites drive the real launch backend against the contract fake, prove `hello -> load -> reset`, DAP initialization/configuration/entry-stop order, registers, disassembly mapping, breakpoints, run/pause/step, failure families, and cleanup. |
| Compiled external adapter framing smoke | PASS — the suite launches `out/adapter/src/main.js` as a separate process and exchanges DAP `Content-Length` frames over stdio. |
| Final child-process scan | PASS — zero live Node processes matching the adapter main or fake server. |

The fake-backed smoke is legitimate adapter verification but is not relabeled
as a real-emulator or VS Code F5 smoke. The test fake is launched with
test-only arguments through an injected backend; it is not a standalone
accepted `emuSA80535-N` executable and no fake-only product command enters the
VSIX.

## Focused behavioral evidence

The independent rerun covered the required positive and hostile families:

- compatible and incompatible protocol major/minor/capabilities;
- UTF-8, malformed, oversized, mismatched, reused-ID, bounded-output, timeout,
  crash, EOF, and false-response-schema paths;
- exact image size, SHA-256, absolute path, hello/load/reset ordering, and
  deterministic entry snapshot;
- one atomic thread/frame/register snapshot including bank-selected R0-R7;
- strict `code:HHHH`, numeric `0xHHHH`, decimal, signed offset-once, width,
  underflow, overflow, de-duplication, replacement, clear, and negotiated-limit
  behavior;
- forward disassembly, known predecessors, explicit unknown one-byte
  placeholders, taken-branch exclusion, exact count/order, and whole-range
  failure;
- pre-execution breakpoint hit and exact DAP reason `instruction breakpoint`;
- omitted/statement/instruction step, rejected line/next/stepOut, structured
  rejected-step epoch preservation, and transport-failure termination;
- repeated bounded continue yields, active/idle pause, response-before-event,
  no post-intent chunk, and no promotion after timeout/disconnect;
- old-handle invalidation after a real resume, fresh handles at a real new
  stop, and exact preservation after a non-resuming rejected step;
- launch cancellation, missing executable, failure diagnostics, bounded
  terminate/kill/reap, active-run and repeated disconnect, and exactly-one
  `terminated` event.

## Packaging and CI evidence

### Local Windows package/install

The rebuilt archive has an exact allowlist of:

- VSIX metadata;
- extension manifest, README, and license;
- eight compiled adapter JavaScript files;
- three compiled extension JavaScript files; and
- the pinned `@vscode/debugadapter` and `@vscode/debugprotocol` runtime trees.

It contains no emulator binary, fake, firmware fixture, test, script, SDP or
protocol source, owned TypeScript, source map, or build toolchain. The manifest
inside the archive is coherent: `emuSA80535-dap@0.1.0`, activation
`onDebug:emuSA80535`, main `out/extension/src/extension.js`, Node floor
`>=22.13.0`, and VS Code floor `^1.95.0`.

Both the currently installed VS Code and an independently downloaded portable
VS Code 1.95.0 accepted the rebuilt package in isolated extension/user-data
directories. The VS Code 1.95.0 archive used for the floor check had SHA-256
`0AD888C558147BC2CD22AFD85BE536B25FBE8CFCA062980978BBB2B0BD7434DB`.

### Exact-HEAD GitHub Actions

Two exact-HEAD runs are complete and successful:

| Run | Trigger | Exact SHA | Job/result |
|---|---|---|---|
| [33463777487](https://github.com/Hans-Einar/emuSA80535-DAP/actions/runs/33463777487) | push | `fdb1ccd231e18bdb864fb43936538f54f1f1dfaa` | `linux` PASS |
| [33463779315](https://github.com/Hans-Einar/emuSA80535-DAP/actions/runs/33463779315) | pull request | `fdb1ccd231e18bdb864fb43936538f54f1f1dfaa` | `linux` PASS |

Each Ubuntu job checks out the exact SHA, selects Node 22.20.0, and passes
`npm ci`, lint, the 89-test full suite, package, package contents, and an
archive name scan for a bundled emulator.

The workflow has no Windows job. The Linux job also has no VS Code download,
VSIX install, extension-host/F5 launch, or disassembly-UI smoke step. Therefore
the successful Linux checks prove Linux build/test/package/content behavior
only. They do not prove Linux installation or F5 smoke, and local Windows
evidence cannot be substituted for the missing required Windows lane. This is
a direct AC-010 failure, not merely an unavailable external dependency.

## Safety, scope, and archive scans

Product/default/fixture/package scans found:

- no P1000 address, name, signal, protocol, fixture, or machine semantic;
- no serial-port, GPIO, CAN, field-bus, USB, COM-device, `/dev/tty`, hydraulic,
  or machine-control endpoint;
- no `struct em8051`, `mPC`, `mSFR`, `mIRAM`, C header, FFI, or private
  emulator-layout dependency;
- no source breakpoint/map, `readMemory`, `writeMemory`, evaluate, data
  breakpoint/watchpoint, exceptionInfo, attach, TCP/socket, mutation,
  interrupt-frame, logical-call-stack, bundling, download, or Marketplace
  expansion; and
- no unsupported DAP capability claim. The four advertised capabilities remain
  configuration-done, instruction breakpoints, disassemble, and stepping
  granularity. Required `next` and `stepOut` handlers only reject.

The only P1000/physical-I/O text found is the frozen protocol's explicit
prohibition. The Windows full suite and both exact Linux jobs require no
hardware. This passes the adapter/fake side of AC-011. It cannot prove the
real headless emulator's no-physical-I/O behavior because that process does
not exist at the accepted emulator commit, so final AC-011 remains blocked.

## Sprint and traceability checks

- `git diff --check` passed for the verification HEAD and the complete Slice-1
  implementation range.
- The only paths from product culmination `8728a965...` to integrated
  verification input `fdb1ccd...` are SDP/review/sprint/traceability paths;
  `git diff --quiet ... -- ':!SDP/**'` returned success.
- The implementation range from accepted activation baseline `ede8226...` to
  `fdb1ccd...` changes the expected product, tests, fixture, package/CI, review,
  sprint, and traceability surfaces only; no emulator repository content is
  bundled or modified.
- `CurrentIndex.yaml` parses with 93 unique items.
- `Relations.yaml` parses with 216 relations, and every `from`/`to` endpoint
  resolves to a current-index item.
- `Ledger.ndjson` parses as 57 independent JSON objects with exact sequential
  event IDs `LE-000001` through `LE-000057`.
- `IT-001-002` is active, `SL-001-002-001` is implemented/current,
  `VER-001-002-001` is in progress/target, all seven implementation review IDs
  are closed/current, and `CR-009` through `CR-019` are resolved/current. This
  is the correct pre-verification state.

Per the verifier-only contract, this pass does not update the index, relations,
ledger, sprint, implementation notes, or handoff. Master must integrate this
report's failed/blocked disposition into those surfaces after the verification
commit.

## Live real-emulator revalidation

### Exact accepted-default evidence

All live/default checks agree on:

`Hans-Einar/emuSA80535-N@c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`

Evidence:

- GitHub reports `master` as the default branch at exact `c0cd6f26...`;
- `git ls-remote ... refs/heads/master` returns exact `c0cd6f26...`;
- the existing local repository's fetched `origin/master` returns exact
  `c0cd6f26...`; and
- a clean detached clone was checked out at exact `c0cd6f26...` before source,
  build, and test inspection.

The complete tracked inventory contains the curses frontend, core sources,
public header, raw loader, Stage-0/IRQ/timer tests, and SDP records. It contains
no `emu-debug`/headless/server executable source or build target. Product-tree
search found none of the frozen server surfaces: NDJSON framing, JSON command
server, `hello`, protocol version/capability/limit handshake, `decodeCode`,
`replaceCodeBreakpoints`, or atomic debug snapshot API.

`make core-test` passed on Windows with GNU Make 4.4 and GCC 12.2.0:

- Stage-0 tests passed;
- Stage-1 IRQ tests passed; and
- SLC-006 timer tests passed.

The root Makefile has only `BIN := emu`, uses all root C sources, and links
`-lcurses`. A normal local `make CC=gcc` reached the curses frontend and failed
because this verifier host lacks `curses.h`; this is not claimed as a server
failure or as accepted binary evidence. The material gate fact is that the
tree defines no no-curses headless target at all. The independently buildable
core tests do pass.

There is no GitHub release. The only current open emulator PR is #5, a
deterministic mode-3 UART slice; its file list contains no headless/debug-server
implementation. No compatible accepted real `emu-debug` 1.0 executable was
found. Consequently the verifier did not run the adapter contract suite or VS
Code F5/disassembly smoke against a fake relabeled as real.

### `EMU-BLK-001` through `EMU-BLK-010`

| Blocker | Status at exact `c0cd6f26...` | Exact evidence / remaining gap |
|---|---|---|
| `EMU-BLK-001` | **MISSING** | Root Makefile builds only curses-linked `emu`; no documented/buildable no-curses `emu-debug` target or source exists. |
| `EMU-BLK-002` | **MISSING** | No NDJSON request/response server, stdout protocol-isolation boundary, correlation/record bounds, or structured server errors exist. |
| `EMU-BLK-003` | **MISSING** | No protocol 1.0 `hello`, version, capability, product/commit, variant, or limit handshake exists. |
| `EMU-BLK-004` | **SATISFIED_CORE_ONLY** | `em8051_init_variant`, seeded deterministic reset, and `em8051_load_binary` exact 65,536-byte CODE loading are present and the core suite passes. Wire `load`/`reset` orchestration is absent under blockers 001-003/005. |
| `EMU-BLK-005` | **MISSING** | `em8051_run_result` contains counters/PC only. Registers remain fields of public `struct em8051`; there is no atomic PC/A/B/PSW/SP/DPTR/bank-selected-R0-R7 boundary snapshot accessor independent of layout. |
| `EMU-BLK-006` | **PARTIAL** | Public `decode()` returns one decoder string/length and core tests exercise it. No exact-count `decodeCode` command, range contract, predecessor knowledge, or deterministic invalid placeholders exist. |
| `EMU-BLK-007` | **PARTIAL** | `em8051_set_breakpoint` controls one `mBreakpoint`, and core tests prove a pre-execution stop. No atomic replace-all table, empty clear result, negotiated limit, or accepted/rejected wire response exists. |
| `EMU-BLK-008` | **PARTIAL** | `em8051_run`/`run_until_pc` and typed bounded results exist and core tests pass. No wire `run`, negotiated chunk, atomic yield snapshot, repeated child scheduler contract, or real adapter-pause integration exists. |
| `EMU-BLK-009` | **PARTIAL** | `em8051_step_instruction` delegates to a one-instruction bounded run and core tests pass. No versioned `stepInstruction` command or stable wire stop/error mapping exists. |
| `EMU-BLK-010` | **MISSING** | With no server process, there is no terminate/EOF/crash implementation and no Linux/Windows stdio lifecycle, stdout-isolation, no-orphan, or no-physical-I/O process suite. |

Remaining real-integration blockers are `EMU-BLK-001`–`003`, `005`–`010`.
`EMU-BLK-004` is satisfied only at the lower-level core seam and cannot by
itself make the real process contract runnable.

## AC-001 through AC-011

Statuses below are strict final-criterion dispositions. A PASS does not waive
the separate mandatory real-emulator gate; a BLOCKED row records the exact
part that could not be exercised without inventing a real runtime or UI result.

| AC | Status | Evidence and disposition |
|---|---|---|
| `AC-001` | **BLOCKED** | Fake-backed DAP evidence passes truthful capabilities, `hello -> load -> reset`, configuration/launch response order, and entry stop. The packaged VS Code F5 path against an accepted real executable was not runnable because `EMU-BLK-001`–`003` and `EMU-BLK-005` remain. |
| `AC-002` | **PASS** | The contract fake/DAP suite returns one thread, one required-field current-PC frame, one read-only scope, and the exact atomic PC/A/B/PSW/SP/DPTR/R0-R7 snapshot. The real-snapshot integration gate remains separately blocked by `EMU-BLK-005`. |
| `AC-003` | **BLOCKED** | Exact-count/ordered numeric disassembly, known/unknown predecessors, taken-branch exclusion, and range failure pass in DAP tests. Actual chosen-VS-Code disassembly display and real `decodeCode` could not run because `EMU-BLK-001`–`003`/`006` remain. |
| `AC-004` | **BLOCKED** | Numeric round trip, non-zero offset once, canonicalization, under/overflow, global replacement, clear/limit, pre-execution hit, and stop reason pass in DAP tests. The real VS Code disassembly-UI-originated request and real replacement server path could not run because `EMU-BLK-001`–`003`/`007` remain. |
| `AC-005` | **PASS** | Omitted/statement/instruction step advances exactly one fake architectural instruction; line/next/stepOut and malformed granularity reject without resume; structured rejection preserves the old epoch. The mandatory real suite remains blocked by `EMU-BLK-009`. |
| `AC-006` | **PASS** | Active/idle/repeated-yield pause evidence proves response before event, no next chunk after intent, no unproven timeout promotion, and cleanup on fatal timeout. The mandatory real suite remains blocked by `EMU-BLK-008`. |
| `AC-007` | **PASS** | A real adapter resume/new fake stop invalidates old frame/scope/variable handles and creates fresh handles; a non-resuming rejected step preserves the exact epoch. |
| `AC-008` | **PASS** | Missing executable, version/capability mismatch, malformed record/schema, timeout, and crash/EOF produce stable failed responses/terminal events, actionable diagnostics, bounded cleanup, and no remaining fake/adapter process on Windows and exact Linux test jobs. |
| `AC-009` | **PASS** | Active-run/repeated disconnect tests terminate and reap the launch-owned contract child, close the session, and emit `terminated` exactly once on Windows and exact Linux test jobs. |
| `AC-010` | **FAIL** | Windows local build/package/content/install passes, including VS Code floor 1.95.0. Exact Linux CI proves build/test/package/content only. There is no Windows lane, no VSIX install or F5 smoke on Linux, no Windows CI package/install/smoke, and no real-runtime F5 path. This requires CI/acceptance work in addition to the external emulator dependency. |
| `AC-011` | **BLOCKED** | Adapter/fake source, dependency, fixture, archive, Windows execution, and exact Linux execution pass no-hardware/P1000/private-struct scans. The required real headless no-physical-I/O process safety proof cannot run while `EMU-BLK-001`, `002`, and `010` remain. |

## Review and verification disposition

The accepted review chain remains sound:

- `RVW-001-002-004` resolves Worker A `CR-009`–`CR-011`;
- `RVW-001-002-006` completes Worker B acceptance and resolves
  `CR-012`–`CR-016`; and
- `RVW-001-002-007` accepts product culmination `8728a965...` and resolves
  `CR-017`–`CR-019`.

No new adapter product defect was found by this pass. The review disposition is
therefore accepted. Verification nevertheless cannot accept the complete
slice:

1. AC-010 fails the explicit Linux-and-Windows build/test/package/content/
   install/smoke lane contract.
2. AC-001, AC-003, and AC-004 lack their actual real/F5/disassembly UI paths.
3. AC-011 lacks the real headless process safety proof.
4. The accepted real-emulator contract and end-to-end gate cannot begin while
   nine `EMU-BLK` items remain missing or partial.

The correct next disposition is not to weaken the fake, protocol, or ACs. Keep
PR #4 intact and unmerged, add the missing dual-platform package/install/smoke
acceptance lane in a separately reviewed correction, and resume final
verification only after an accepted emulator commit/release supplies the
frozen real process contract.

## Pull-request and final gate

At verification time PR #4 is:

- open;
- draft;
- based on `main`;
- exact remote head `fdb1ccd231e18bdb864fb43936538f54f1f1dfaa`;
- merge-state `CLEAN`; and
- unmerged.

This report does not merge, undraft, push, or otherwise mutate the PR.

Because AC-010 fails, AC-001/003/004/011 are blocked, no accepted real
`emu-debug` 1.0 executable exists, and the real contract/F5 gates were not run,
`VER-001-002-001` concludes:

**NOT_READY**

## `VER-001-002-002` addendum — exact-HEAD corrective re-verification

**Verification time:** 2026-09-01T03:55:58Z

**Verified pushed integrated HEAD:**
`3bb4264e2dd9166e38c1140216501b6e1eae5238`

**Branch:** `codex/dap-first-slice`

**Pull request:**
[#4](https://github.com/Hans-Einar/emuSA80535-DAP/pull/4)

**Review disposition:** **ACCEPTED** — `RVW-001-002-008` and
`RVW-001-002-009` independently accepted the corrective implementations, and
this pass found no new repository-local product, test, workflow, package, or
process finding.

**Verification disposition:** **CORRECTIONS VERIFIED; EXTERNALLY BLOCKED**

**Final disposition:** **NOT_READY**

### Scope and independence

This is the fresh `VER-001-002-002` pass required after `CR-020` and `CR-021`.
The verifier read Issue #3 and the prior report/review chain, inspected the four
specified GitHub Actions jobs and their actual logs, reran exact-HEAD local
package and traceability spot checks, and revalidated the live
`Hans-Einar/emuSA80535-N` default. The verifier did not author or repair
product, test, workflow, package, sprint, review, or traceability content. This
addendum is the only verifier-authored path.

Issue #3 permits fake-backed adapter development but forbids using that fake as
real-runtime acceptance. Accordingly, successful fake-backed Actions close
the repository-local findings but do not satisfy the accepted-real-emulator,
real F5, or actual disassembly-UI gates.

### Exact four-job GitHub Actions evidence

Both workflow runs report exact branch head `3bb4264e...`. The push jobs
checked out that commit directly. The pull-request jobs checked out generated
merge commit `81a0f9dcdd969f1efe38c5c0a5e4ec44efcb1997`, whose parents are base
`31ac8facdb1310fc858f3545ece052c671db42c6` and exact head `3bb4264e...`.
GitHub's commit API reports the same tree
`14900a8dc0d7f40bd1e963a033f5100046fac6f7` for the merge commit and exact
head, so the PR jobs exercised the exact requested repository content rather
than a divergent merge tree.

| Event / run | Exact job | Hosted platform | Actual result |
|---|---|---|---|
| pull request `33467616744` | Linux `99730638857` | Ubuntu 24.04.4, Node 22.20.0 | **PASS** — clean install, lint, full, contract, fixture, package, contents, exact policy, and floor smoke |
| pull request `33467616744` | Windows `99730638636` | Windows Server 2025 `10.0.26100`, Node 22.20.0 | **PASS** — clean install, lint, full, contract, fixture, package, contents, exact policy, and floor smoke |
| push `33467614290` | Linux `99730630653` | Ubuntu 24.04.4, Node 22.20.0 | **PASS** — clean install, lint, full, contract, fixture, package, contents, exact policy, and floor smoke |
| push `33467614290` | Windows `99730630555` | Windows Server 2025 `10.0.26100`, Node 22.20.0 | **PASS** — clean install, lint, full, contract, fixture, package, contents, exact policy, and floor smoke |

The jobs are not superficial green passes:

- every log shows `npm ci` actually adding 397 packages and auditing 398 with
  zero reported vulnerabilities, followed by a real `eslint .` execution;
- both Windows jobs execute all 99 full tests and all 45 focused contract
  tests with zero failures/skips; both Linux jobs execute the same 99/45
  enumerated tests with zero failures, with only the two full-suite and one
  contract-suite Windows-specific launcher/PATHEXT cases explicitly skipped;
- the corrected AC-006 target, `run timeout after pause intent terminates and
  never promotes an unproven boundary`, passes in every full-suite log;
- every fixture step verifies exactly 65,536 bytes and SHA-256
  `1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88`;
- every package step creates the VSIX, every contents step runs `vsce ls` and
  prints the product/runtime contents, and every independent policy step
  reports exactly 47 allowlisted archive entries;
- every smoke step installs and activates
  `undefined_publisher.emusa80535-dap@0.1.0` from the just-built VSIX in an
  isolated extension root under actual VS Code 1.95.0 commit
  `912bb683695358a54ae0c670461738984cbb5b95`;
- the installed product, not the development harness, contributes the debug
  type and packaged adapter entry. The extension-host harness checks entry
  reason/thread, sends disconnect, and requires exactly one `terminated`
  event;
- all four structured `PACKAGED_SMOKE_PASS` records show the exact fake command
  sequence `hello`, `load`, `reset`, `replaceCodeBreakpoints`, `terminate`, DAP
  events `initialized`, `stopped`, `terminated`, and `orphanProcesses: 0`; and
- each extension-host runner exits zero after the structured evidence is
  written. Non-fatal Electron D-Bus/GPU diagnostics on hosted Linux do not
  replace or invalidate the independently checked DAP, fake PID, process-scan,
  and cleanup evidence.

The four job-local VSIX hashes are respectively
`89b6ec1ee82706eb1b0b735f0d3f5f25002d93390c1c8317e830e7eef3d577c9`,
`b94b6d082b1e298bbffc4d841971b7b8c51eb72f642aab6ef7b1ae0f418585ee`,
`dda761fa9dd36cef0bcb974b1986bc5855c68ba13a05362801478479f1d95e46`,
and `01936649a8e54907fabe5b8cdcd5ef040a000e0f182d125733931780a7dd5397`.
Platform/run-specific ZIP metadata accounts for different archive hashes; the
same exact 47-entry policy and installed identity pass in every job.

### Exact-HEAD local spot checks

The local branch and remote branch both resolved to exact `3bb4264e...` before
this report edit. A fresh local Windows `npm ci` installed 405 packages and
reported zero vulnerabilities. `npm run lint`, the 99/99 full suite, the 45/45
contract suite, fixture verification, package creation, `package:contents`,
and the 47-entry exact package policy all passed. The local VSIX SHA-256 was
`CD1FE7C4EDA53521C3CD80C762FF1E4DCFE68B9F55AC0280B511AB56452015E1`.

Exact manifest hashes remain:

- `package.json`:
  `573D09C779DACF5E194DD5F0DA211CB3B972C3154AE5B7CCD659AA603CCCEB82`;
- `package-lock.json`:
  `C8FAA1219F927B8D37C9B16ECF5F75109D9BBE1FB22C76DFC8AE6E5A8666B9C5`.

All 67 existing `Ledger.ndjson` records parsed independently as JSON and
`git diff --check` passed. `CurrentIndex.yaml` intentionally still records
`CR-020`/`CR-021` open and `VER-001-002-002` in progress at this verifier
boundary; updating that Master-owned traceability state is outside this
report-only pass.

### `CR-020` and `CR-021` disposition

| Finding | Corrective review | Exact rerun evidence | Disposition |
|---|---|---|---|
| `CR-020` — missing cross-platform install/launch smoke | `RVW-001-002-008` accepts `2ecbec37e711c80c13b5e622ebe5f65d1f5eebc5` | all four exact-tree Ubuntu/Windows push/PR jobs execute package contents/policy and installed floor extension-host launch/entry/disconnect/no-orphan smoke | **RESOLVED** |
| `CR-021` — platform-speed-dependent AC-006 timeout test | `RVW-001-002-009` accepts `1e104a18a365b5ad7666e86faad4b8fa00f14715` | corrected deterministic target and unchanged concrete transport timeout/kill/reap suite pass in all four exact-tree jobs; Windows full/contract jobs are 99/99 and 45/45 | **RESOLVED** |

No rerun of the previously failing old job is used as closure. The evidence is
four fresh jobs on the post-correction integrated tree. Closing `CR-020` removes
the repository-local CI defect; it does not convert the still-unrunnable real
F5 requirement into a pass.

### Live real-emulator revalidation

GitHub and `git ls-remote` still resolve the default `master` of
`Hans-Einar/emuSA80535-N` to exact commit:

`c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`

The local repository contains that exact object, although its working branch is
the unrelated UART branch and was not treated as default-runtime evidence.
Direct inspection of the exact master tree confirms the previous source map:
the root Makefile still defines only curses-linked `emu`; the tree contains no
headless server source/target and no `emu-debug`, NDJSON, protocol `hello`,
`decodeCode`, `replaceCodeBreakpoints`, or `stepInstruction` wire command.
Core `init/load/reset`, one-record `decode`, one breakpoint, bounded run, and
one-instruction step seams remain present.

There are no releases and no tags. The only open emulator PR is #5 at
`6df64847a11b173eef77c55a6a56a839e6aa5fb3`, for deterministic mode-3 UART;
its file list contains UART core/test/SDP work and no debug-server process.
There is therefore still no accepted real executable that can be substituted
into the adapter contract or VS Code suite. This pass did not relabel the fake
as real.

| Blocker | Status at exact `c0cd6f26...` | Exact remaining gap |
|---|---|---|
| `EMU-BLK-001` | **MISSING** | No no-curses `emu-debug` build target or executable source exists. |
| `EMU-BLK-002` | **MISSING** | No bounded/correlated NDJSON server or stdout protocol-isolation/error boundary exists. |
| `EMU-BLK-003` | **MISSING** | No protocol 1.0 hello/version/capability/product/variant/limit handshake exists. |
| `EMU-BLK-004` | **SATISFIED_CORE_ONLY** | Deterministic init/reset and exact 64-KiB load core seams exist; wire orchestration is unavailable. |
| `EMU-BLK-005` | **MISSING** | No layout-independent atomic architectural register snapshot accessor/wire result exists. |
| `EMU-BLK-006` | **PARTIAL** | One-record core `decode()` exists; exact-count/range/predecessor/placeholder `decodeCode` wire contract does not. |
| `EMU-BLK-007` | **PARTIAL** | One core breakpoint with pre-execution stop exists; atomic replace-all table/clear/limit/wire result does not. |
| `EMU-BLK-008` | **PARTIAL** | Bounded core run/results exist; negotiated wire run/yield snapshot/repeated adapter scheduler integration does not. |
| `EMU-BLK-009` | **PARTIAL** | One-instruction core step exists; versioned command and stable wire stop/error mapping do not. |
| `EMU-BLK-010` | **MISSING** | No server terminate/EOF/crash, Linux/Windows stdio lifecycle, no-orphan, stdout-isolation, or no-physical-I/O process suite exists. |

Remaining real-integration blockers are `EMU-BLK-001`–`003` and
`EMU-BLK-005`–`010`. `EMU-BLK-004` remains only a lower-level core seam.

### Strict `AC-001` through `AC-011` disposition

These are final-criterion statuses, not just fake-suite statuses. In
particular, AC-010 is not marked PASS merely because its corrected fake-backed
dual-platform lane passes: Issue #3 also requires the F5 launch path with the
accepted real runtime before Slice-1 completion.

| AC | Status | Fake-backed / available evidence and mandatory remaining gate |
|---|---|---|
| `AC-001` | **BLOCKED** | Fake-backed launch, truthful capabilities, load/reset, configuration ordering, and entry stop pass, including all four packaged smokes. Accepted-real-emulator F5 entry remains blocked by `EMU-BLK-001`–`003`/`005`. |
| `AC-002` | **PASS** | One thread, truthful current-PC frame, read-only scope, and exact register snapshot pass. The separate real-integration gate remains blocked by `EMU-BLK-005`. |
| `AC-003` | **BLOCKED** | Exact-count mapping, numeric addresses, predecessor behavior, and range failures pass against the fake. Actual VS Code disassembly UI and real `decodeCode` remain blocked by `EMU-BLK-001`–`003`/`006`. |
| `AC-004` | **BLOCKED** | Canonical references, offset-once, under/overflow, replace-all/clear/limit, and pre-execution hit pass against the fake. UI-originated request plus real replacement server remain blocked by `EMU-BLK-001`–`003`/`007`. |
| `AC-005` | **PASS** | Exact fake-backed `stepIn` and non-resuming rejection of unsupported/malformed stepping pass. The separate real suite remains blocked by `EMU-BLK-009`. |
| `AC-006` | **PASS** | Active/idle/repeated-yield pause, response-before-stop, no-next-run, deterministic timeout/no-unproven-boundary, termination, and concrete transport cleanup all pass locally and in the four jobs. The separate real suite remains blocked by `EMU-BLK-008`. |
| `AC-007` | **PASS** | Resume/new stop invalidates old frame/scope/variable handles; rejected non-resuming step preserves the epoch. |
| `AC-008` | **PASS** | Required fake/client executable, handshake, schema, timeout, crash/EOF diagnostics and bounded cleanup pass on Linux and Windows. |
| `AC-009` | **PASS** | Active and repeated disconnect paths reap the launch-owned fake child and emit exactly one termination; all packaged smokes report zero orphans. |
| `AC-010` | **BLOCKED** | **Fake-backed portion passes:** both Linux and Windows build/test/package/list/exact-policy/install and VS Code-floor launch/entry/disconnect/no-orphan smokes pass, with no emulator in the 47-entry archive. **Mandatory remaining portion:** accepted-real-runtime F5 on Linux and Windows is unavailable under `EMU-BLK-001`–`003`/`010`. |
| `AC-011` | **BLOCKED** | Adapter/fake/package scans and dual-platform fake process evidence remain safe and in scope. Real headless no-physical-I/O/process-isolation evidence is unavailable under `EMU-BLK-001`/`002`/`010`. |

The resulting count is six PASS (`AC-002`, `AC-005`–`AC-009`) and five
BLOCKED (`AC-001`, `AC-003`, `AC-004`, `AC-010`, `AC-011`). There is no
remaining repository-local FAIL from `CR-020` or `CR-021`.

### Pull request, review, verification, and final gate

After all checks and before this report-only commit, PR #4 remained open,
draft, unmerged, based on `main`, exact remote head `3bb4264e...`, and merge
state `CLEAN`. This verifier did not push, merge, undraft, or otherwise mutate
the PR.

The complete Worker A/B/C and corrective review chain is accepted. The
repository-local fake-backed adapter, package, cross-platform, and corrective
verification passes. Final Slice-1 verification is nevertheless externally
blocked because there is no accepted real `emu-debug` 1.0 runtime, the same
contract/end-to-end suites have not run against a real executable, real F5 has
not run on Linux/Windows, and the actual disassembly-UI gate has not passed.

`VER-001-002-002` therefore concludes:

**NOT_READY**

## `VER-001-002-002` final addendum — `CR-022` closure

**Verification time:** 2026-09-01T04:26:31Z

**Verified pushed integrated HEAD:**
`e1411df03026557c216f680406ea9ebc2a1601d0`

**Corrective implementation:**
`b4a48ddd52f4b2083c5f3bf6ecc19a16ae95ce1e`

**Independent corrective review:**
`3b97f814ad988244af0e032f771ee4d317ed48a4`

**Branch:** `codex/dap-first-slice`

**Pull request:**
[#4](https://github.com/Hans-Einar/emuSA80535-DAP/pull/4)

**Review disposition:** **ACCEPTED** — `RVW-001-002-010` accepted the narrow
test-only correction, and this closure pass found no new product, test,
workflow, package, or process finding.

**Verification disposition:** **ALL REPOSITORY-LOCAL CORRECTIONS VERIFIED;
EXTERNALLY BLOCKED**

**Final disposition:** **NOT_READY**

### Scope and exact content identity

This is the narrow final closure pass for `CR-022` under existing verification
`VER-001-002-002`. The verifier inspected the corrective diff and review,
read the actual logs for all four fresh requested jobs, independently stressed
the corrected target, checked the live PR, and revalidated the accepted
emulator default. This report addendum is the only verifier-authored path; no
product, test, workflow, sprint, review, handoff, implementation-note, or
traceability file was changed by this pass.

Both the correction and its review are ancestors of exact pushed HEAD
`e1411df...`. Commit `b4a48dd...` changes only
`test/dapBehavior.test.ts`; commit `3b97f81...` changes only
`SDP/CodeReview/DAP-SLICE1-REV-001.md`. The pushed integration commit changes
only Master-owned sprint/handoff/traceability content after the accepted
review.

Both Actions runs report exact `headSha` `e1411df...`. The push jobs exercised
that commit directly. The pull-request jobs checked out generated merge commit
`7041230e31a7bfc9d5351a75c408641c42c4873e`, whose parents are base
`31ac8facdb1310fc858f3545ece052c671db42c6` and exact head `e1411df...`.
GitHub reports the identical tree
`bfe25278fa5e92dbb349724320fdac7724da1dd0` for the merge commit and exact
head, so the PR jobs exercised the exact requested content.

### Four fresh exact-tree jobs

| Event / run | Exact job | Hosted platform | Actual log result |
|---|---|---|---|
| pull request [33469530399](https://github.com/Hans-Einar/emuSA80535-DAP/actions/runs/33469530399) | Linux `99736266837` | Ubuntu, Node `22.20.0` | **PASS** — 397-package clean install, lint, full/contract suites, fixture, package/list/policy, and installed VS Code-floor fake smoke |
| pull request [33469530399](https://github.com/Hans-Einar/emuSA80535-DAP/actions/runs/33469530399) | Windows `99736267045` | Windows, Node `22.20.0` | **PASS** — 397-package clean install, lint, full/contract suites, fixture, package/list/policy, and installed VS Code-floor fake smoke |
| push [33469527082](https://github.com/Hans-Einar/emuSA80535-DAP/actions/runs/33469527082) | Linux `99736257099` | Ubuntu, Node `22.20.0` | **PASS** — 397-package clean install, lint, full/contract suites, fixture, package/list/policy, and installed VS Code-floor fake smoke |
| push [33469527082](https://github.com/Hans-Einar/emuSA80535-DAP/actions/runs/33469527082) | Windows `99736257308` | Windows, Node `22.20.0` | **PASS** — 397-package clean install, lint, full/contract suites, fixture, package/list/policy, and installed VS Code-floor fake smoke |

The log inspection confirms real execution rather than superficial successful
step labels:

- both Windows jobs pass 99/99 full tests and 45/45 contract tests with zero
  failures or skips; both Linux jobs pass 97/99 full tests and 44/45 contract
  tests, with only the expected Windows-specific cases skipped and zero
  failures;
- `bounded continue remains logically running across repeated yields until
  pause` passes in every full-suite log;
- every fixture check reports exactly 65,536 bytes and SHA-256
  `1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88`;
- every package log creates a 47-file VSIX, lists its contents, and reports
  `VSIX policy PASS: 47 exact allowlisted entries`;
- every smoke downloads/uses real VS Code `1.95.0` at commit
  `912bb683695358a54ae0c670461738984cbb5b95`, runs the extension-host test
  runner to exit code zero, and identifies the installed extension as
  `undefined_publisher.emusa80535-dap@0.1.0`; and
- all four `PACKAGED_SMOKE_PASS` records prove the fake command sequence
  `hello`, `load`, `reset`, `replaceCodeBreakpoints`, `terminate`, the DAP
  events `initialized`, `stopped`, `terminated`, and `orphanProcesses: 0`.

The four job-local VSIX SHA-256 values are respectively
`1db8b2dbbb80af42046aca5ccaed41a3ceca7f847c4a2c60d87b07446abbb`,
`0abd2711a0f1f58047de2d6a38e21497817ef1178bee5305a354789b9e2acd0d`,
`f1f14f54e014a538d21a1f91eefd419e560913e08cd293c6e50e3525cb10d2a4`,
and `c775fb416a0ddd0c2ec19e217be7508b8c832cdc2fa07d67cd4c41ea9247a0ff`.
Platform/run ZIP metadata accounts for hash differences; exact 47-entry policy
and installed identity pass in every job.

### `CR-022` disposition

The correction removes the former wall-clock and real-child scheduling race
from only the repeated-yield target. Its controlled backend exposes each run
promise explicitly. The test resolves yields one and two, leaves run three
pending, receives the pause response before any stop, resolves the final
boundary at `code:0030`, proves exactly one pause stop, proves no fourth run,
proves the stopped snapshot and invalid idle pause behavior, and proves one
cleanup. Product code and the separate concrete transport timeout/kill/reap
coverage are unchanged.

In addition to the four successful hosted executions, this verifier rebuilt
exact HEAD and ran that exact named target in 100 fresh Windows processes:

`REPEATED_YIELD_STRESS runs=100 failures=0`

The correction is deterministic at the intended boundary and no failure was
observed. With accepted review `RVW-001-002-010` and four fresh exact-tree
Ubuntu/Windows push/PR passes, `CR-022` is **RESOLVED**. This is the verifier's
closure disposition; `CurrentIndex.yaml`, relations, ledger, sprint, and
handoff remain Master-owned and intentionally unchanged by this report-only
commit.

There is now no remaining repository-local corrective failure from `CR-020`,
`CR-021`, or `CR-022`.

### Unchanged real-emulator blocker

GitHub and `git ls-remote` still resolve the default `master` of
`Hans-Einar/emuSA80535-N` to exact commit:

`c0cd6f26bd8984c9fed10eb81716619cb1bb96e6`

There are still no releases. The only open emulator PR remains unrelated UART
PR #5 at `6df64847a11b173eef77c55a6a56a839e6aa5fb3`; it does not provide the
debug-server process. Because the accepted default commit is unchanged, its
verified source/runtime gaps are unchanged: `EMU-BLK-001`–`003` and
`EMU-BLK-005`–`010` remain the real-integration blockers.
`EMU-BLK-004` remains **SATISFIED_CORE_ONLY**. There is still no accepted real
`emu-debug` 1.0 executable for the adapter contract suite, real Linux/Windows
F5, actual disassembly-UI, lifecycle, or no-physical-I/O gates. This pass did
not relabel the fake as real.

### Unchanged `AC-001` through `AC-011` disposition

Closing `CR-022` changes no acceptance-criterion status from the preceding
`VER-001-002-002` addendum:

| AC | Status | Unchanged disposition |
|---|---|---|
| `AC-001` | **BLOCKED** | Fake-backed launch and packaged entry smokes pass; accepted-real-emulator F5 entry remains blocked by `EMU-BLK-001`–`003`/`005`. |
| `AC-002` | **PASS** | One thread, current-PC frame, read-only scope, and exact register snapshot pass; the separate real gate remains blocked by `EMU-BLK-005`. |
| `AC-003` | **BLOCKED** | Fake exact-count/numeric/predecessor/range behavior passes; actual VS Code disassembly UI and real `decodeCode` remain blocked by `EMU-BLK-001`–`003`/`006`. |
| `AC-004` | **BLOCKED** | Fake canonical/offset/replacement/clear/limit/pre-execution behavior passes; UI-originated and real replacement paths remain blocked by `EMU-BLK-001`–`003`/`007`. |
| `AC-005` | **PASS** | Exact fake-backed step and non-resuming rejection behavior pass; the separate real suite remains blocked by `EMU-BLK-009`. |
| `AC-006` | **PASS** | Active/idle/repeated-yield pause, response ordering, no post-intent run, timeout/no-unproven-boundary, termination, and cleanup pass; the separate real suite remains blocked by `EMU-BLK-008`. |
| `AC-007` | **PASS** | Stop-epoch handle invalidation and preservation behavior pass. |
| `AC-008` | **PASS** | Required fake/client failure diagnostics and bounded cleanup pass on Linux and Windows. |
| `AC-009` | **PASS** | Active/repeated disconnect reaps the child, emits one termination, and packaged smokes report zero orphans. |
| `AC-010` | **BLOCKED** | Fake-backed Linux/Windows build/test/package/list/policy/install/floor-smoke portion passes; accepted-real-runtime F5 remains unavailable under `EMU-BLK-001`–`003`/`010`. |
| `AC-011` | **BLOCKED** | Adapter/fake/package/process evidence remains safe and in scope; real headless no-physical-I/O/process-isolation evidence remains blocked by `EMU-BLK-001`/`002`/`010`. |

The status remains six PASS (`AC-002`, `AC-005`–`AC-009`) and five BLOCKED
(`AC-001`, `AC-003`, `AC-004`, `AC-010`, `AC-011`), with no repository-local
FAIL.

### Pull request and final gate

At this closure boundary PR #4 remains open, draft, unmerged, based on `main`,
exact remote head `e1411df03026557c216f680406ea9ebc2a1601d0`, and merge state `CLEAN`.
This verifier did not push, merge, undraft, or otherwise mutate the PR.

Review and all repository-local corrective verification are accepted. Slice 1
cannot be declared READY until an accepted real `emu-debug` 1.0 runtime exists
and Issue #3's same-contract, real VS Code F5, actual disassembly-UI, lifecycle,
and safety gates pass on Linux and Windows.

`VER-001-002-002` therefore remains:

**NOT_READY**
