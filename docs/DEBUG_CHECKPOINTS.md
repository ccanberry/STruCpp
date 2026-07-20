# Online-debugger statement checkpoints

> Fork feature (Robotek). Not in upstream STruC++. See `../FORK_CHANGES.md`.
> System design: `openplc-runtime/docs/DEBUGGER_DESIGN.md` (Strategy B).

## What it is

With `debugCheckpoints: true`, STruC++ emits a call before **every** generated
statement:

```cpp
::strucpp::debug::checkpoint(7);   // <- id 7
Y = 2;                              // <- the statement
```

and returns a **checkpoint map** alongside the code:

```jsonc
// checkpoint-map.json (one entry per statement, emission order)
[ { "id": 0, "file": "Main.st", "startLine": 4, "startCol": 5, "endLine": 4, "endCol": 11 },
  { "id": 1, "file": "Main.st", "startLine": 5, "startCol": 5, "endLine": 5, "endCol": 22 },
  ... ]
```

That is the whole compiler surface. Everything else (breakpoints, stepping,
call stack, partial halt) lives in the runtime and editor.

## Why a call, not `#line` alone

STruC++ already emits `#line` directives (`lineDirectives`) — enough to map a
crash back to ST, but a source map cannot *stop* execution. A breakpoint has to
be able to halt the scan at a chosen statement, which requires a real call site
the runtime can intercept. The checkpoint is that site: one indirect call
through a nullable hook.

## Cost model

```cpp
inline void checkpoint(uint32_t id) noexcept { if (g_dbg_hook) g_dbg_hook(id); }
```

- **Production**: the hook is never installed (`g_dbg_hook == nullptr`), so each
  checkpoint is a load + predictable not-taken branch. Even so, the option is
  **off by default** and the editor only sets it for a dedicated "Debug" deploy —
  a normal deploy contains no checkpoints at all (invariant-tested).
- **Debug/commissioning**: the runtime installs a hook that consults the
  breakpoint table for `id`; a non-armed id returns immediately, an armed id (or
  an active single-step) blocks the calling task thread until the debugger says
  continue/step. Only that task's logic pauses — cyclic fieldbuses keep running
  (see DEBUGGER_DESIGN.md §5–6).

## Granularity

One checkpoint per **statement**, including the statements nested inside
`IF`/`CASE`/`FOR`/`WHILE`/`REPEAT` bodies (they all flow through
`generateStatement`). This gives line-level breakpoints and natural
step-over/into/out, matching CoDeSys. Expressions are not checkpointed.

## ABI (stable — editor + runtime depend on it)

| Symbol | Who defines | Who uses |
|--------|-------------|----------|
| `::strucpp::debug::checkpoint(uint32_t)` | `debug_hook.hpp` (inline) | generated POU bodies |
| `::strucpp::debug::g_dbg_hook` | emitted `debug_hook.cpp` | the inline checkpoint |
| `extern "C" strucpp_set_debug_hook(void(*)(uint32_t))` | emitted `debug_hook.cpp` | runtime, via dlsym at program load |
| `checkpoint-map.json` (`id → file/line/col`) | `compile()` result `.checkpoints` | editor: line → id breakpoint binding |

`id` is project-global and monotonic from 0 in statement-emission order. `file`
identifies the POU (each POU compiles from its own source file), so no separate
POU id is needed here; the editor resolves POU from `file`.

## How to enable

```ts
import { compile } from "strucpp";
const result = compile(source, { debugCheckpoints: true });
result.checkpoints; // CheckpointMapEntry[]
result.cppFiles;    // includes an extra debug_hook.cpp
```

## Editor integration (openplc-editor-4.2.8)

The editor's run-control UI (breakpoint gutter + pause/continue/step toolbar)
consumes `checkpoint-map.json` end to end:

```
build/<target>/src/checkpoint-map.json
  → DebuggerPort.readCheckpointMap (IPC util:read-checkpoint-map)
  → utils/checkpoint-map.ts parseCheckpointMap()  → DebugCheckpointEntry[]
  → workspace.debugCheckpointMap (store)
  → gutter lights breakpointable lines; useRunControlSync arms ids (FC 0x46)
```

### Schema the editor expects

The editor works in **POU-local, body-relative** coordinates (Monaco shows one
POU *body*, not the wrapped source file). `parseCheckpointMap` accepts two shapes:

1. **Editor-native (preferred)** — resolve each checkpoint to the POU and the
   line *within the POU body* before serialising:
   ```json
   [ { "id": 0, "pou": "main", "line": 10 }, { "id": 1, "pou": "main", "line": 11 } ]
   ```
   (`{ "checkpoints": [...] }` wrapper also accepted.)

2. **Raw compiler form (fallback)** — `{ "id", "file", "startLine", ... }` as
   `CompileResult.checkpoints` carries it today. The editor takes `file` (minus
   `.st`/`.il`) as the POU name and `startLine` as the line. **Caveat:** a per-POU
   source file carries the `PROGRAM …/VAR … END_VAR` header ahead of the body, so
   `startLine` is offset from the body line the gutter needs by the header height.
   Fine for a first bring-up, wrong by a few lines for a real project.

### Producer requirements (still open — infra, not code-in-this-repo)

For the editor gutter to land on the exact line, the **debug-build tooling** must:

1. **Serialise** `result.checkpoints` to `build/<target>/src/checkpoint-map.json`
   (the ARM9 debug build — `scratchpad/gen-instrumented.mjs` pattern — produces
   `.checkpoints` but does not yet write the file).
2. **Emit POU-local body-relative** `{id,pou,line}` (shape 1), i.e. subtract the
   per-POU header offset the editor's splitter already knows
   (`program-build-pipeline.ts` `split.pouOffsets`).
3. For **editor-driven** debug builds, the fork must be wired into the editor
   toolchain (`scripts/download-binaries.ts` / `setup:strucpp` repointed to this
   fork; editor currently bundles upstream `strucpp` 0.5.13 with no
   `debugCheckpoints`). This is the M1 long-pole in
   `openplc-runtime/docs/DEBUGGER_DESIGN.md`.

Until (1)–(3) land, the editor consumption path is inert (no `checkpoint-map.json`
→ run control stays hidden), exactly as on a normal deploy.

## Future: instance-scoped breakpoints

To halt only one FB instance (CoDeSys "instance breakpoint"), the hook signature
gains an instance token (`checkpoint(id, this)`), and the runtime compares it
against the armed instance. This does not change `checkpoint-map.json`. Tracked
as a later debugger milestone.
