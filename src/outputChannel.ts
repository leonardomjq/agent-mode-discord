/**
 * Shared "Agent Mode (Discord)" output channel with debug-verbose-gated logging.
 *
 * Requirements: CONF-05 (verbose-gated debug log), D-28 (no toasts, never crash).
 *
 * Singleton — first call to `getOutputChannel()` materializes the channel;
 * subsequent calls return the same instance. `log()` wraps `appendLine` in
 * try/catch so a disposed channel mid-log stays silent.
 */
import * as vscode from "vscode";
import { readConfig } from "./config";

let channel: vscode.OutputChannel | undefined;

/**
 * ME-03: cache `debug.verbose` here so hot-path `log()` calls avoid a
 * `vscode.workspace.getConfiguration` read per line. `undefined` means
 * "not yet primed" and falls back to `readConfig()` (preserves the
 * pre-cache behavior for early-boot callers and existing tests that
 * don't prime the cache). `extension.ts` primes via `setVerboseCache()`
 * at activate time and on every `onDidChangeConfiguration` event.
 */
let cachedVerbose: boolean | undefined;

export function setVerboseCache(verbose: boolean): void {
  cachedVerbose = verbose;
}

/** Test-only: clear the cached verbose flag so the next log() re-reads config. */
export function __resetVerboseCacheForTest(): void {
  cachedVerbose = undefined;
}

export function getOutputChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("Agent Mode (Discord)");
  }
  return channel;
}

export function log(line: string, opts?: { verboseOnly?: boolean }): void {
  const verboseOnly = opts?.verboseOnly !== false; // default: gated by debug.verbose
  try {
    if (verboseOnly) {
      // Fast path: use cached value when primed.
      let verbose: boolean;
      if (cachedVerbose !== undefined) {
        verbose = cachedVerbose;
      } else {
        // Cold path (pre-activate or tests that don't prime): fall back to
        // a live config read to preserve the original contract.
        verbose = readConfig().debug.verbose;
      }
      if (!verbose) return;
    }
    getOutputChannel().appendLine(`[${new Date().toISOString()}] ${line}`);
  } catch {
    /* silent per D-28: no toasts, never let logging crash */
  }
}

/** Test-only helper: reset the singleton so tests don't bleed state. */
export function __resetForTest(): void {
  channel = undefined;
  cachedVerbose = undefined;
}
