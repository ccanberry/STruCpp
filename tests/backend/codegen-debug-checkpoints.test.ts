/**
 * Online-debugger statement checkpoints (debugCheckpoints codegen option).
 *
 * FORK FEATURE (Robotek): not in upstream STruC++. See FORK_CHANGES.md and
 * docs/DEBUG_CHECKPOINTS.md. Backs the Strategy-B online debugger
 * (openplc-runtime/docs/DEBUGGER_DESIGN.md): a call to
 * `::strucpp::debug::checkpoint(id)` before every statement, a project-global
 * id -> source-position map, and a one-off `debug_hook.cpp` that defines the
 * runtime-installable hook.
 */

import { describe, it, expect } from "vitest";

import { compile } from "../../src/index.js";

const SRC = `
  PROGRAM Main
    VAR x : INT; y : INT; END_VAR
    x := 1;
    IF x > 0 THEN
      y := 2;
    ELSE
      y := 3;
    END_IF;
  END_PROGRAM
`;

describe("debugCheckpoints codegen option", () => {
  it("emits NO checkpoints, hook TU, or header include by default", () => {
    const r = compile(SRC);
    expect(r.success).toBe(true);
    expect(r.cppCode).not.toContain("strucpp::debug::checkpoint");
    expect(r.headerCode).not.toContain("debug_hook.hpp");
    expect(r.cppFiles.some((f) => f.name === "debug_hook.cpp")).toBe(false);
    expect(r.checkpoints).toBeUndefined();
  });

  it("emits a checkpoint call before every statement when enabled", () => {
    const r = compile(SRC, { debugCheckpoints: true });
    expect(r.success).toBe(true);
    // x:=1, IF, y:=2, y:=3  -> 4 statements -> 4 checkpoint calls / entries.
    const calls = r.cppCode.match(/::strucpp::debug::checkpoint\(\d+\);/g) ?? [];
    expect(calls.length).toBe(4);
    expect(r.checkpoints).toBeDefined();
    expect(r.checkpoints!.length).toBe(4);
  });

  it("assigns monotonic ids from 0 and maps each to its ST source line", () => {
    const r = compile(SRC, { debugCheckpoints: true });
    const ids = r.checkpoints!.map((c) => c.id);
    expect(ids).toEqual([0, 1, 2, 3]);
    // The ids in the emitted code match the map ids, in order.
    const emitted = [...r.cppCode.matchAll(/::strucpp::debug::checkpoint\((\d+)\);/g)].map(
      (m) => Number(m[1]),
    );
    expect(emitted).toEqual([0, 1, 2, 3]);
    // Statement source lines are recorded (1-indexed, monotonic non-decreasing).
    const lines = r.checkpoints!.map((c) => c.startLine);
    expect(lines.every((l) => l > 0)).toBe(true);
    for (let i = 1; i < lines.length; i++) expect(lines[i]).toBeGreaterThanOrEqual(lines[i - 1]);
  });

  it("adds the header include and a single hook-definition TU", () => {
    const r = compile(SRC, { debugCheckpoints: true });
    expect(r.headerCode).toContain('#include "debug_hook.hpp"');
    const hookTus = r.cppFiles.filter((f) => f.name === "debug_hook.cpp");
    expect(hookTus.length).toBe(1);
    expect(hookTus[0].content).toContain("dbg_hook_t g_dbg_hook = nullptr;");
    expect(hookTus[0].content).toContain(
      'extern "C" void strucpp_set_debug_hook(',
    );
  });

  it("production output is unchanged by the feature being present", () => {
    // The default compile must be byte-identical to a build that never knew
    // about checkpoints — the option is fully opt-in.
    const a = compile(SRC).cppCode;
    const b = compile(SRC, { debugCheckpoints: false }).cppCode;
    expect(a).toBe(b);
  });
});
