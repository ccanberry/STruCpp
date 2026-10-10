// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * Shared utility functions for C++ code generation.
 */

import type { CompilationUnit } from "../frontend/ast.js";

/**
 * Convert an IEC 61131-3 based numeric string to a C++ literal string.
 * Handles 16#FF → 0xFF, 8#77 → 077, 2#1010 → 0b1010, and plain decimals.
 * Strips IEC underscore separators.
 */
export function iecBaseToCppLiteral(raw: string): string {
  const upper = raw.toUpperCase().replace(/_/g, "");
  if (upper.startsWith("16#")) return "0x" + upper.slice(3);
  if (upper.startsWith("8#")) return "0" + upper.slice(2);
  if (upper.startsWith("2#")) return "0b" + upper.slice(2);
  return raw.replace(/_/g, "");
}

/**
 * Format an array type string from element type and dimension bounds.
 *
 * - 1D → `Array1D<E, start, end>`
 * - 2D → `Array2D<E, s1, e1, s2, e2>`
 * - 3D → `Array3D<E, s1, e1, s2, e2, s3, e3>`
 * - 4+ → nested `Array1D<Array1D<..., s, e>, s, e>`
 */
export function formatArrayType(
  elemCpp: string,
  dimensions: Array<{ start: number; end: number }>,
): string {
  if (dimensions.length === 1) {
    const dim = dimensions[0]!;
    return `Array1D<${elemCpp}, ${dim.start}, ${dim.end}>`;
  }
  if (dimensions.length === 2) {
    const d1 = dimensions[0]!;
    const d2 = dimensions[1]!;
    return `Array2D<${elemCpp}, ${d1.start}, ${d1.end}, ${d2.start}, ${d2.end}>`;
  }
  if (dimensions.length === 3) {
    const d1 = dimensions[0]!;
    const d2 = dimensions[1]!;
    const d3 = dimensions[2]!;
    return `Array3D<${elemCpp}, ${d1.start}, ${d1.end}, ${d2.start}, ${d2.end}, ${d3.start}, ${d3.end}>`;
  }
  // 4+ dimensions: nested Array1D (outermost first)
  let result = elemCpp;
  for (let i = dimensions.length - 1; i >= 0; i--) {
    const dim = dimensions[i]!;
    result = `Array1D<${result}, ${dim.start}, ${dim.end}>`;
  }
  return result;
}

/**
 * PROGRAMs that a POU body calls (`X(...)`) or reads a member of (`X.var`), mapped to the
 * first POU found doing so. A name the POU declares as a variable is that variable, and a
 * program never counts as calling itself. Shared by the code generator (which gives each
 * one file-scope instance) and the debug table (which publishes it under its bare name).
 */
export function findCalledProgramCallers(
  ast: CompilationUnit,
): Map<string, string> {
  const programs = new Set(ast.programs.map((p) => p.name.toUpperCase()));
  const found = new Map<string, string>(); // program -> first caller
  const visit = (node: unknown, locals: Set<string>, caller: string): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, locals, caller);
      return;
    }
    const n = node as Record<string, unknown>;
    let name: string | undefined;
    if (
      n.kind === "FunctionCallExpression" &&
      typeof n.functionName === "string"
    ) {
      name = n.functionName.toUpperCase();
    } else if (
      n.kind === "VariableExpression" &&
      typeof n.name === "string" &&
      ((Array.isArray(n.fieldAccess) && n.fieldAccess.length > 0) ||
        (Array.isArray(n.accessChain) &&
          (n.accessChain as Array<{ kind: string }>).some(
            (st) => st.kind === "field",
          )))
    ) {
      name = n.name.toUpperCase();
    }
    if (name && programs.has(name) && !locals.has(name) && name !== caller) {
      if (!found.has(name)) found.set(name, caller);
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === "sourceSpan" || k === "resolvedType") continue;
      if (v && typeof v === "object") visit(v, locals, caller);
    }
  };
  const localsOf = (
    blocks: CompilationUnit["programs"][0]["varBlocks"],
  ): Set<string> => {
    const out = new Set<string>();
    for (const b of blocks)
      for (const d of b.declarations)
        for (const nm of d.names) out.add(nm.toUpperCase());
    return out;
  };
  for (const p of ast.programs)
    visit(p.body, localsOf(p.varBlocks), p.name.toUpperCase());
  for (const fb of ast.functionBlocks) {
    const locals = localsOf(fb.varBlocks);
    visit(fb.body, locals, fb.name.toUpperCase());
    for (const m of fb.methods ?? []) visit(m, locals, fb.name.toUpperCase());
  }
  return found;
}
