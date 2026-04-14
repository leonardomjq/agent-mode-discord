import * as vscode from "vscode";
import type { Event } from "../state/types";
import { buildMatcher, normalizeCommandLine } from "./regex";

/**
 * Phase 3 tier-2 shellIntegration detector.
 *
 * THE detector that delivers DET-01's 500ms flip target. Adapts VS Code's
 * Shell Integration API (1.93+) into the Detector contract. Owns:
 *   - per-terminal session map (DET-04)
 *   - ANSI+prompt strip via pure helper in ./regex.ts (DET-09)
 *   - 2000ms async-activation holdoff (DET-08)
 *   - 30s flicker-guard grace period (Pitfall 2)
 *   - onDidCloseTerminal cleanup with no grace (Pitfall 3)
 *
 * Subscriptions registered for the full extension lifetime (DET-08). The
 * onDidChangeTerminalShellIntegration subscription is global — without it
 * we miss the first command of a fresh terminal where integration activates
 * asynchronously.
 *
 * D-18: every vscode call + every dispatch wrapped in try/catch; silent
 * failure.
 */

/** Per-terminal session tracking (CONTEXT D-04). */
export interface TerminalSession {
  agent: string;
  signalTier: 2;
  lastActivityAt: number;
  /** ms-since-epoch at which grace expires; null when actively running. */
  graceExpiresAt: number | null;
}

export interface ShellIntegrationDetectorOptions {
  /** Override for tests. Defaults to ms-since-epoch via Date.now. */
  now?: () => number;
  /** Override for tests. Defaults to 2000. */
  holdoffMs?: number;
  /** Override for tests. Defaults to 30000. */
  graceMs?: number;
  /** Override for tests — Phase 4 will pipe in detect.customPatterns. Default: built-ins only. */
  customPatterns?: Record<string, string[]>;
  /** Override for tests — defaults to global setTimeout/clearTimeout. */
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}

export interface ShellIntegrationDetector {
  readonly tier: 2;
  start(dispatch: (event: Event) => void): vscode.Disposable;
}

const DEFAULT_HOLDOFF_MS = 2000;
const DEFAULT_GRACE_MS = 30_000;

export function createShellIntegrationDetector(
  opts: ShellIntegrationDetectorOptions = {},
): ShellIntegrationDetector {
  const now = opts.now ?? Date.now;
  const holdoffMs = opts.holdoffMs ?? DEFAULT_HOLDOFF_MS;
  const graceMs = opts.graceMs ?? DEFAULT_GRACE_MS;
  const setTimeoutFn = opts.setTimeout ?? globalThis.setTimeout;
  const clearTimeoutFn = opts.clearTimeout ?? globalThis.clearTimeout;
  const matcher = buildMatcher(opts.customPatterns);

  return {
    tier: 2,
    start(dispatch: (event: Event) => void): vscode.Disposable {
      const sessions = new Map<vscode.Terminal, TerminalSession>();
      const holdoffTimers = new Map<vscode.Terminal, ReturnType<typeof setTimeout>>();
      const graceTimers = new Map<vscode.Terminal, ReturnType<typeof setTimeout>>();
      let aggregateActive = false;
      let lastDispatchedAgent: string | undefined;

      const safeDispatch = (event: Event): void => {
        try { dispatch(event); } catch { /* silent D-18 */ }
      };

      const clearHoldoff = (terminal: vscode.Terminal): void => {
        const t = holdoffTimers.get(terminal);
        if (t !== undefined) {
          try { clearTimeoutFn(t); } catch { /* silent */ }
          holdoffTimers.delete(terminal);
        }
      };

      const clearGrace = (terminal: vscode.Terminal): void => {
        const t = graceTimers.get(terminal);
        if (t !== undefined) {
          try { clearTimeoutFn(t); } catch { /* silent */ }
          graceTimers.delete(terminal);
        }
      };

      const recomputeAggregate = (): void => {
        try {
          const now_ = now();
          let active = false;
          let topAgent: string | undefined;
          let topActivity = -1;
          for (const session of sessions.values()) {
            const isActive =
              session.graceExpiresAt === null || now_ < session.graceExpiresAt;
            if (!isActive) continue;
            active = true;
            if (session.lastActivityAt > topActivity) {
              topActivity = session.lastActivityAt;
              topAgent = session.agent;
            }
          }
          const wasActive = aggregateActive;
          aggregateActive = active;
          if (!wasActive && active && topAgent) {
            safeDispatch({ type: "agent-started", agent: topAgent });
            lastDispatchedAgent = topAgent;
          } else if (wasActive && !active && lastDispatchedAgent) {
            safeDispatch({ type: "agent-ended", agent: lastDispatchedAgent });
            lastDispatchedAgent = undefined;
          } else if (active && topAgent && topAgent !== lastDispatchedAgent) {
            // Agent label changed — dispatch new agent-started for the new label.
            safeDispatch({ type: "agent-started", agent: topAgent });
            lastDispatchedAgent = topAgent;
          }
        } catch { /* silent D-18 */ }
      };

      const setupHoldoff = (terminal: vscode.Terminal): void => {
        try {
          if (holdoffTimers.has(terminal)) return;
          const handle = setTimeoutFn(() => {
            holdoffTimers.delete(terminal);
          }, holdoffMs);
          holdoffTimers.set(terminal, handle);
        } catch { /* silent D-18 */ }
      };

      const onShellExecutionStart = (e: {
        terminal: vscode.Terminal;
        execution: { commandLine: { value: string; confidence: number } };
      }): void => {
        try {
          const normalized = normalizeCommandLine(e.execution.commandLine);
          const match = matcher(normalized);
          if (!match) return;
          // Pitfall 2: cancel any pending grace timer for this terminal before
          // re-arming the session. Without this, a dangling grace timer can
          // fire later and dispatch a stale agent-ended even though the
          // terminal is now actively running.
          clearGrace(e.terminal);
          sessions.set(e.terminal, {
            agent: match.agent,
            signalTier: 2,
            lastActivityAt: now(),
            graceExpiresAt: null,
          });
          recomputeAggregate();
        } catch { /* silent D-18 */ }
      };

      const onShellExecutionEnd = (e: {
        terminal: vscode.Terminal;
        execution: { commandLine: { value: string; confidence: number } };
      }): void => {
        try {
          const existing = sessions.get(e.terminal);
          if (!existing) return;
          // Pitfall 6: re-normalize the end commandLine — it may be more
          // accurate than the start value. If it doesn't match an agent,
          // do NOT end the session (probably a different command ran in
          // the same terminal after the agent; we'll wait for the real
          // agent command to emit end).
          const normalized = normalizeCommandLine(e.execution.commandLine);
          const match = matcher(normalized);
          if (!match || match.agent !== existing.agent) return;

          const expiresAt = now() + graceMs;
          const prev = graceTimers.get(e.terminal);
          if (prev !== undefined) {
            try { clearTimeoutFn(prev); } catch { /* silent */ }
          }
          const handle = setTimeoutFn(() => {
            graceTimers.delete(e.terminal);
            sessions.delete(e.terminal);
            recomputeAggregate();
          }, graceMs);
          graceTimers.set(e.terminal, handle);
          existing.graceExpiresAt = expiresAt;
          // Do NOT dispatch agent-ended yet — grace period IS the flicker guard.
        } catch { /* silent D-18 */ }
      };

      const onShellIntegrationChanged = (e: {
        terminal: vscode.Terminal;
        shellIntegration?: vscode.TerminalShellIntegration;
      }): void => {
        try {
          // Integration activated for this terminal — cancel its holdoff timer.
          clearHoldoff(e.terminal);
        } catch { /* silent D-18 */ }
      };

      const onTerminalClose = (terminal: vscode.Terminal): void => {
        try {
          // Pitfall 3: close supersedes grace. Delete immediately, no grace.
          clearHoldoff(terminal);
          clearGrace(terminal);
          if (sessions.has(terminal)) {
            sessions.delete(terminal);
            recomputeAggregate();
          }
        } catch { /* silent D-18 */ }
      };

      // --- Seed existing terminals (Pitfall 1) ---
      try {
        for (const terminal of vscode.window.terminals) {
          if (!terminal.shellIntegration) {
            setupHoldoff(terminal);
          }
        }
      } catch { /* silent D-18 */ }

      // --- Subscriptions (DET-08: full extension lifetime) ---
      const subscriptions: vscode.Disposable[] = [];
      try {
        subscriptions.push(
          vscode.window.onDidChangeTerminalShellIntegration(onShellIntegrationChanged),
        );
      } catch { /* silent */ }
      try {
        subscriptions.push(
          vscode.window.onDidStartTerminalShellExecution(onShellExecutionStart),
        );
      } catch { /* silent */ }
      try {
        subscriptions.push(
          vscode.window.onDidEndTerminalShellExecution(onShellExecutionEnd),
        );
      } catch { /* silent */ }
      try {
        subscriptions.push(
          vscode.window.onDidCloseTerminal(onTerminalClose),
        );
      } catch { /* silent */ }

      return new vscode.Disposable(() => {
        for (const sub of subscriptions) {
          try { sub.dispose(); } catch { /* silent */ }
        }
        for (const [, t] of holdoffTimers) {
          try { clearTimeoutFn(t); } catch { /* silent */ }
        }
        holdoffTimers.clear();
        for (const [, t] of graceTimers) {
          try { clearTimeoutFn(t); } catch { /* silent */ }
        }
        graceTimers.clear();
        sessions.clear();
      });
    },
  };
}
