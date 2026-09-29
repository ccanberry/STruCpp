# STruC++ Fork — Robotek changes (provenance & upstream-merge guide)

This is a **fork** of [Autonomy-Logic/STruCpp](https://github.com/Autonomy-Logic/STruCpp)
maintained for the Robotek MCM20.1 / OpenPLC v4 online debugger (Strategy B —
codegen-instrumented breakpoints; see `openplc-runtime/docs/DEBUGGER_DESIGN.md`).

**Purpose of this file:** a complete, self-contained record of every divergence
from upstream, written so the changes can be re-applied (by a human or an LLM)
after pulling a new upstream release. Each entry lists the file, the exact
change, the rationale, and merge notes. Keep it updated with every fork commit.

## Git layout

- `upstream` remote → `https://github.com/Autonomy-Logic/STruCpp.git`
- Fork work lives on branch **`feature/debug-checkpoints`** (base: upstream
  `main` @ the clone commit — see `git log upstream/main -1`).
- When adding the Robotek fork remote: `git remote add origin <fork-url>`.

## Re-sync with upstream (LLM-assistable)

1. `git fetch upstream && git checkout -b sync/<date> upstream/main`
2. Cherry-pick / re-apply this branch's commits, OR hand this file + the commits
   to an LLM: "re-apply each change in FORK_CHANGES.md onto this upstream tree;
   the anchors may have moved — match by the described intent, not line number."
3. `npm run typecheck && npx vitest run tests/backend` must stay green.
4. The invariant test `codegen-debug-checkpoints.test.ts` → "production output
   is unchanged" must pass: it proves the fork is a pure opt-in and cannot have
   perturbed a normal compile.

## Feature: online-debugger statement checkpoints (`debugCheckpoints`)

Opt-in codegen that, before every generated statement, emits
`::strucpp::debug::checkpoint(id)` and records `id -> source position`. The
OpenPLC v4 runtime installs a hook (`strucpp_set_debug_hook`) that decides, per
id, whether to run on or halt the task thread (breakpoint / single-step). Off by
default; production output is byte-identical. Design:
`docs/DEBUG_CHECKPOINTS.md`.

### Changes (all on `feature/debug-checkpoints`)

| # | File | Change | Merge note |
|---|------|--------|-----------|
| 1 | `src/runtime/include/debug_hook.hpp` | **New file.** Declares `strucpp::debug::dbg_hook_t`, `extern g_dbg_hook`, inline `checkpoint(id)`, and `extern "C" strucpp_set_debug_hook`. | New file — no conflict. Ships to builds via the runtime-include copy (same mechanism as the other `iec_*.hpp`). |
| 2 | `src/backend/codegen.ts` — `CodeGenOptions` | Added optional `debugCheckpoints?: boolean`. | Add the field if the interface was refactored. |
| 3 | `src/backend/codegen.ts` — `CodeGenResult` + new `CheckpointMapEntry` | Added `checkpoints: CheckpointMapEntry[]` to the result; exported `CheckpointMapEntry` interface. | Keep the export — `types.ts` and the editor import it. |
| 4 | `src/backend/codegen.ts` — `CodeGenerator` fields | Added `private checkpoints` + `private checkpointCounter`; reset both at the top of `generate()` (next to `tempVarCounter = 0`). | Re-add next to the other per-run counter resets. |
| 5 | `src/backend/codegen.ts` — `generateStatement()` | At the top, **when `options.debugCheckpoints`**, push a `CheckpointMapEntry` from `stmt.sourceSpan` and `this.emit("...checkpoint(id);")` — BEFORE `emitLineDirective` and the `cppStartLine` capture so the existing ST→C++ line map is untouched. | The single injection site. `generateStatement` is the one switch every statement flows through; if upstream renames it, find the statement-dispatch switch and inject at its top. |
| 6 | `src/backend/codegen.ts` — `generateHeader()` | When `debugCheckpoints`, emit `#include "debug_hook.hpp"` right after the `iec_types.hpp` include. | Any header-preamble location works, as long as it precedes the namespace open. |
| 7 | `src/backend/codegen.ts` — `generate()` finalization | When `debugCheckpoints`, push an extra `debug_hook.cpp` output file that defines `g_dbg_hook = nullptr` and `strucpp_set_debug_hook` (exactly one external C-linkage definition, for dlsym). Also add `checkpoints: this.checkpoints` to the returned object. | Keep as a separate TU (external symbol for the runtime to resolve). |
| 8 | `src/types.ts` — `CompileOptions` | Added `debugCheckpoints?: boolean`. | Public option surfaced to `compile()`. |
| 9 | `src/types.ts` — `CompileResult` | Added `checkpoints?: CheckpointMapEntry[]` (via `import("./backend/codegen.js")`). | — |
| 10 | `src/index.ts` — `compile()` codegen wiring | Pass `debugCheckpoints: true` into the `CodeGenerator` options when `mergedOptions.debugCheckpoints` (mirrors the `emitChunkMarkers` spread); thread `codeResult.checkpoints` into the returned `CompileResult`. | Mirror whatever pattern upstream uses to forward optional codegen flags. |
| 12 | `src/backend/codegen.ts` `checkpointFingerprint()` + `debug_hook.cpp`; `src/types.ts` / `src/index.ts` `checkpointFingerprint` | The emitted hook TU also defines `strucpp_debug_checkpoint_count()` and `strucpp_debug_map_fingerprint()` (32-bit FNV-1a over the checkpoint layout); `compile()` returns the same value as `checkpointFingerprint`. Lets a debugger attach to a running debug build without redeploying, and refuse a mismatched map. | Additive; keep the hash definition byte-for-byte (the editor compares values across compiler builds). |
| 11 | `tests/backend/codegen-debug-checkpoints.test.ts` | **New file.** 5 tests (8 with the fingerprint cases): default emits nothing; enabled emits one checkpoint/statement; ids monotonic-from-0 and mapped to source lines; header include + single hook TU; production output byte-identical. | New file — the invariant test is the merge safety net. |

### ABI (consumed by the editor + openplc-runtime — keep stable)

- Generated call: `::strucpp::debug::checkpoint(uint32_t id)` before each statement.
- Runtime installs: `extern "C" void strucpp_set_debug_hook(void(*)(uint32_t))`.
- Runtime reads (optional): `extern "C" unsigned strucpp_debug_checkpoint_count(void)` and
  `strucpp_debug_map_fingerprint(void)`; `compile()` returns `checkpointFingerprint` to match.
- Compiler emits: `checkpoints: [{ id, file, startLine, startCol, endLine, endCol }]`.
  Serialize to `checkpoint-map.json`. `id` is project-global; `file` identifies
  the POU (each POU compiles from its own source file). Editor binds a
  source-line breakpoint to the checkpoint id(s) on that line; the runtime
  breakpoint table is keyed purely by id.
- Instance-scoped breakpoints (halt only one FB instance) are a later milestone;
  they will extend the hook signature with an instance token WITHOUT changing the
  `checkpoint-map.json` shape.
