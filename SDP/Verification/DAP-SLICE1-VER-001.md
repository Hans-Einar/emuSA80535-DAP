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
