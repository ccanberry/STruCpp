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

## Future: instance-scoped breakpoints

To halt only one FB instance (CoDeSys "instance breakpoint"), the hook signature
gains an instance token (`checkpoint(id, this)`), and the runtime compares it
against the armed instance. This does not change `checkpoint-map.json`. Tracked
as a later debugger milestone.
