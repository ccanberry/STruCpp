/**
 * A PROGRAM calling a PROGRAM (CODESYS semantics).
 *
 * Strict IEC 61131-3 runs a PROGRAM only from a task; CODESYS lets one PROGRAM call another
 * like an FB, and the POU is its own instance. Ports of CODESYS projects (Cubotonic: PLC_PRG
 * calls ALARMS, FACTORY_SETTINGS, ... conditionally) depend on it. Before, the call passed the
 * analyzer and was emitted as `ALARMS(true);` -- C++ that does not compile -- and `ALARMS.count`
 * was refused.
 */

import { describe, it, expect } from "vitest";
import { compile } from "../../src/index.js";

const CALLEE = `
PROGRAM ALARMS
  VAR_INPUT
    enable : BOOL;
  END_VAR
  VAR
    count : INT;
  END_VAR
  IF enable THEN count := count + 1; END_IF;
END_PROGRAM
`;

const config = (extra = "") => `
CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#10ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : PLC_PRG;${extra}
  END_RESOURCE
END_CONFIGURATION
`;

const caller = (body: string) => `
PROGRAM PLC_PRG
  VAR
    go : BOOL := TRUE;
    seen : INT;
  END_VAR
${body}
END_PROGRAM
`;

describe("PROGRAM calls PROGRAM", () => {
  it("calls through one file-scope instance with .run()", () => {
    const r = compile(CALLEE + caller("  ALARMS(enable := TRUE);") + config());
    expect(r.success).toBe(true);
    expect(r.headerCode).toContain("extern Program_ALARMS ALARMS;");
    expect(r.cppCode).toContain("Program_ALARMS ALARMS{};");
    expect(r.cppCode).toContain("ALARMS.ENABLE = true;");
    expect(r.cppCode).toContain("ALARMS.run();");
    expect(r.cppCode).not.toMatch(/\bALARMS\(true\)/);
  });

  it("keeps a conditional call conditional", () => {
    const r = compile(
      CALLEE + caller("  IF go THEN\n    ALARMS(enable := TRUE);\n  END_IF;") + config(),
    );
    expect(r.success).toBe(true);
    expect(r.cppCode).toMatch(/if \(GO\) \{[\s\S]*ALARMS\.run\(\);[\s\S]*\}/);
  });

  it("reads a member of the called program", () => {
    const r = compile(CALLEE + caller("  ALARMS();\n  seen := ALARMS.count;") + config());
    expect(r.success).toBe(true);
    expect(r.cppCode).toContain("SEEN = ALARMS.COUNT;");
  });

  it("publishes the called program in the debug map under its bare name", () => {
    const r = compile(CALLEE + caller("  ALARMS();") + config(), { debugCheckpoints: true });
    const paths = (r.debugMap?.leaves ?? []).map((l) => l.path);
    expect(paths).toContain("ALARMS.COUNT");
    expect(paths).toContain("ALARMS.ENABLE");
  });

  it("refuses a called program that also runs on a task", () => {
    const r = compile(
      CALLEE + caller("  ALARMS();") + config("\n    PROGRAM instance1 WITH task0 : ALARMS;"),
    );
    expect(r.success).toBe(false);
    expect(r.errors.map((e) => e.message).join(" ")).toMatch(/runs on task .* also called/);
  });

  it("refuses a called program with a located variable", () => {
    const located = CALLEE.replace("count : INT;", "count : INT;\n    lamp AT %QX100.0 : BOOL;");
    const r = compile(located + caller("  ALARMS();") + config());
    expect(r.success).toBe(false);
    expect(r.errors.map((e) => e.message).join(" ")).toMatch(/located variable/);
  });

  it("does not take a local variable of the same name for the program", () => {
    const src =
      CALLEE +
      `
PROGRAM PLC_PRG
  VAR
    alarms : INT;
  END_VAR
  alarms := 3;
END_PROGRAM
` +
      config();
    const r = compile(src);
    expect(r.success).toBe(true);
    expect(r.headerCode).not.toContain("Program_ALARMS ALARMS");
  });
});
