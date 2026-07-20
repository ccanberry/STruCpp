// SPDX-License-Identifier: GPL-3.0-or-later WITH STruCpp-runtime-exception
// Copyright (C) 2025 Autonomy / OpenPLC Project
// This file is part of the STruC++ Runtime Library and is covered by the
// STruC++ Runtime Library Exception. See COPYING.RUNTIME for details.
/**
 * STruC++ Runtime - Online-debugger statement checkpoints
 *
 * When a project is compiled with `debugCheckpoints: true` (CodeGenOptions),
 * the code generator emits a call to `::strucpp::debug::checkpoint(id)` before
 * every ST/IL statement it generates. `id` is a project-global, monotonically
 * increasing checkpoint id; the compiler also emits a checkpoint map
 * (`id -> { file, line, col }`) so the editor can bind a source-line
 * breakpoint to the id(s) at that line.
 *
 * The checkpoint is a single indirect call through `g_dbg_hook`. In a
 * production build the hook is never installed (stays nullptr) and the branch
 * is a predictable not-taken; in a debug/commissioning build the host runtime
 * installs a hook via `strucpp_set_debug_hook()` and decides, per id, whether
 * to run on (no breakpoint) or block the calling task thread (breakpoint hit /
 * single-step) — see openplc-runtime `plc_debug_control`. The hook itself is
 * defined ONCE, in the compiler-emitted `debug_hook.cpp` TU, so there is
 * exactly one external `strucpp_set_debug_hook` symbol for the runtime to
 * resolve via dlsym.
 *
 * Not gated by any macro: whether checkpoints exist at all is decided at
 * codegen time, so a non-debug build simply never references this header.
 */

#pragma once

#include <cstdint>

namespace strucpp {
namespace debug {

/** Installed by the host runtime; nullptr in a production build. Receives the
 *  project-global checkpoint id of the statement about to execute. */
using dbg_hook_t = void (*)(uint32_t checkpoint_id);

extern dbg_hook_t g_dbg_hook;

/** Emitted before every statement in a `debugCheckpoints` build. Kept trivially
 *  inlinable: one nullable-pointer test, no work when no debugger is attached. */
inline void checkpoint(uint32_t id) noexcept {
    if (g_dbg_hook) {
        g_dbg_hook(id);
    }
}

} // namespace debug
} // namespace strucpp

/**
 * Install (or clear, with nullptr) the debug hook. External C linkage so the
 * host runtime resolves it via dlsym alongside the other `strucpp_*` exports.
 * Defined in the compiler-emitted debug_hook.cpp.
 */
extern "C" void strucpp_set_debug_hook(::strucpp::debug::dbg_hook_t hook) noexcept;
