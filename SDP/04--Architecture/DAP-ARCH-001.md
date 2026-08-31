# DAP-ARCH-001 — Target architecture

**Traceability:** `A-001`–`A-008` realize `R-001`–`R-030`.  
**State:** Target only; diagrams do not claim implementation.

## System boundary (`A-001`)

```mermaid
flowchart LR
    U[Developer] --> V[VS Code desktop]
    V -->|DAP Content-Length frames<br/>stdin/stdout| A[Node.js/TypeScript<br/>DAP adapter process]
    A -->|versioned NDJSON<br/>private child pipes| E[headless emuSA80535-N]
    E --> C[offline SAB80535 state]
    A --> M[generic symbol/source map]
    A --> L[structured diagnostic sink]
    X[serial / GPIO / machinery]:::forbidden
    E -. no connection .-> X
    classDef forbidden fill:#fee,stroke:#c00,stroke-dasharray: 4 4
```

VS Code owns the adapter process. The adapter owns a launch-mode emulator child.
Only the adapter's DAP stream is connected to VS Code. Emulator protocol stdout
must never be forwarded to DAP stdout; logs from both processes are routed to
stderr/diagnostic output after redaction.

## Component ownership

| Component | Repository/owner | Responsibility |
|---|---|---|
| Extension contribution/configuration | this repo, `extension/` | Manifest, debugger type/schema, settings, external adapter descriptor, VSIX contents |
| DAP implementation | this repo, `adapter/` | DAP sequencing, capabilities, handles, errors, requests/events |
| Emulator-control client | this repo, adapter boundary | Spawn, NDJSON correlation, handshake, timeout, lifecycle |
| Headless control server | `emuSA80535-N` | Stable versioned commands over stdio; deterministic CPU control |
| Symbol/source parser | this repo, adapter boundary | Validate generic schema and resolve CODE locations |
| Stack model | this repo using emulator events | Current frame in Slice 1; later observed logical frames |
| Logging/diagnostics | both, with adapter aggregation | Structured stderr records; correlation and redaction |
| Test fakes | this repo, test-only | Scriptable fake emulator and DAP integration harness |

## Launch lifecycle (`A-002`)

```mermaid
sequenceDiagram
    participant V as VS Code
    participant A as DAP adapter
    participant E as Emulator child
    V->>A: initialize (first and once)
    A-->>V: capabilities (only true if implemented)
    V->>A: launch
    A->>A: resolve executable and validate config
    A->>E: spawn --headless-debug (no shell)
    A->>E: hello(protocol 1.0, required capabilities)
    E-->>A: hello result or incompatible error
    A->>E: load raw 64-KiB image
    A->>E: reset(seed, entry)
    E-->>A: stopped snapshot at entry
    A-->>V: initialized
    V->>A: setInstructionBreakpoints
    A->>E: replaceCodeBreakpoints
    E-->>A: verified breakpoint set
    V->>A: configurationDone
    A-->>V: launch response
    A-->>V: stopped(reason="entry", threadId=1)
```

The adapter accepts exactly one DAP `initialize` per session. False/unsupported
capability flags are omitted or false. The launch response is not completed
until the child is compatible, configured, and stopped. `initialized` signals
that configuration requests are accepted; `configurationDone` closes that
phase.

On launch failure the adapter returns a failed DAP response and cleans up any
child. For a launch-owned session, `disconnect` terminates the child, closes
pipes, invalidates handles, replies, and emits `terminated`. An unexpected child
exit emits diagnostic output and `terminated` once.

## Breakpoint/continue/stop flow (`A-003`)

```mermaid
sequenceDiagram
    participant V as VS Code
    participant A as Adapter
    participant E as Emulator
    V->>A: setInstructionBreakpoints([code:0010])
    A->>E: breakpoints.replace([0x0010])
    E-->>A: accepted([0x0010])
    A-->>V: Breakpoint(verified=true)
    V->>A: continue(threadId=1)
    A->>A: invalidate stopped-state handles
    A->>E: run
    loop bounded instruction chunks
        E->>E: execute <= negotiated chunk
        E-->>A: running or stop result
        A->>A: service pause/termination
    end
    E-->>A: stopped(reason=breakpoint, pc=0x0010)
    A->>A: create new stopped-state epoch
    A-->>V: stopped(reason="breakpoint", threadId=1)
```

`setInstructionBreakpoints` is a global replacement, not an incremental update.
The emulator server returns the accepted set; the adapter preserves DAP order
and reports rejections. The negotiated maximum is at least one, and Slice-1
acceptance exercises exactly one; larger limits are compatible but not required.

Stop reason mapping is exact: entry→`entry`, code breakpoint→`breakpoint`,
step completion→`step`, user pause→`pause`, emulator exception→`exception`.
Halt/end or fatal transport terminates unless a reviewed future mapping applies.
Each transition to running expires all frame, scope, and variable handles.
Each new stop creates a new handle epoch.

## Current frame and future stack data flow (`A-004`)

```mermaid
flowchart TD
    S[atomic stopped snapshot] --> T[one thread id 1]
    S --> F[current frame<br/>PC + code:HHHH]
    F --> R[Registers scope]
    R --> V[PC A B PSW SP DPTR R0-R7]
    O[future observed events<br/>call return IRQ RETI] --> LM[logical stack model]
    LM --> FF[future observed/inferred frames]
    FF --> F
```

Slice 1's `StackFrame` has a stable frame id for the stop epoch, a name such as
`0x0010`, `line: 0`, `column: 0`, and `instructionPointerReference:
"code:0010"`. It does not claim source or callers. Registers are read from the
same atomic snapshot as PC. Later logical frames are derived only from explicit
emulator events and carry observed/inferred/degraded metadata in presentation.

## Source and symbol mapping (`A-005`)

```mermaid
flowchart LR
    P[assembler/listing/linker producer] -->|export| J[generic symbol-map JSON]
    B[raw 64-KiB CODE image] --> H[SHA-256]
    J --> Q{schema + architecture<br/>+ image hash valid?}
    H --> Q
    Q -->|yes| I[address/symbol/source indexes]
    Q -->|no| ER[actionable launch error]
    I --> D[disassembly labels]
    I --> SB[future source breakpoints]
    I --> ST[future source-attributed frames]
```

The parser belongs to the adapter and has no firmware-specific built-ins. In
Slice 1 no map is required; minimal disassembly is address-only. Near-term
source features require exact image identity and validated paths.

## Version and capability negotiation (`A-006`)

```mermaid
stateDiagram-v2
    [*] --> Spawned
    Spawned --> Handshaking: hello 1.0 + required capabilities
    Handshaking --> Compatible: same major + all required
    Handshaking --> Failed: major mismatch / missing capability / timeout
    Compatible --> Configured: load + reset + snapshot
    Configured --> [*]
    Failed --> CleanedUp
    CleanedUp --> [*]
```

Compatibility is two-dimensional: protocol version and named capabilities.
Major mismatch is fatal. A newer minor is acceptable only when all required
Slice-1 capabilities and compatible message fields are present; unknown fields
are ignored. Emulator product version/commit is recorded for diagnostics but
does not replace protocol negotiation.

The adapter dependencies `@vscode/debugadapter` and
`@vscode/debugprotocol` were observed at 1.68.0 while the published DAP
specification is 1.71.0. Slice 1 must pin package versions and recheck the
required schema surfaces before coding rather than assuming those version
numbers move together.

## Packaging components (`A-007`)

```mermaid
flowchart TD
    TS[extension + adapter TypeScript] --> B[compile/bundle]
    PM[extension-root package.json<br/>debuggers + config schema] --> V[VSIX staging]
    B --> V
    LC[LICENSE README metadata] --> V
    V --> P[npx @vscode/vsce package]
    P --> X[versioned .vsix]
    X --> Q[inspect contents]
    X --> I[install and VS Code smoke test]
    E[emuSA80535-N executable<br/>separate installation] -. resolved at launch .-> I
```

The extension-root manifest will declare the debugger contribution, engine
floor, semantic version, entry points, and a prepublish build that bundles the
adapter into the VSIX. The executable emulator is excluded. CI must inspect the
archive and install/smoke-test it on Linux and Windows. Marketplace publisher
identity and publishing credentials remain Steering/release decisions.

## Runtime state and failure isolation (`A-008`)

The adapter has one session and one emulator child. It serializes state-changing
commands and correlates every emulator request/response. Each synchronous
emulator `run` request is bounded. If VS Code requests pause while a chunk is
outstanding, the adapter records a local pause intent, acknowledges the DAP
request, awaits that chunk, sends no next chunk, and reports the resulting pause
stop. No concurrent child request multiplexing is required. Timeouts are
command-specific and end in a known stopped or terminated state—never an
assumed state.

DAP request errors are failed DAP responses with structured details; output
events are diagnostics, not substitutes for failed responses. Malformed
emulator stdout is a protocol violation. Raw protocol payloads and environment
secrets are not logged.

## Architectural invariants

- The DAP stream and emulator-control stream never share a pipe.
- Debugger state is read only while stopped and from one snapshot.
- The one MCU instruction stream remains one DAP thread.
- No P1000 semantic enters adapter, protocol, schema, or fixtures.
- No emulator default-branch capability is claimed from unmerged PR #1.
- No host hardware endpoint is opened by this architecture.
