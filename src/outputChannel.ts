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
      const cfg = readConfig();
      if (!cfg.debug.verbose) return;
    }
    getOutputChannel().appendLine(`[${new Date().toISOString()}] ${line}`);
  } catch {
    /* silent per D-28: no toasts, never let logging crash */
  }
}

/** Test-only helper: reset the singleton so tests don't bleed state. */
export function __resetForTest(): void {
  channel = undefined;
}
