import * as vscode from "vscode";
import type { Event } from "../state/types";

/**
 * Phase 3 Wave 1 — tier-4 polling detector (DET-06).
 *
 * Opt-in safety net for users whose shells/platforms don't surface Shell
 * Integration (tier 2) or JSONL fs-watch (tier 3) signals. Polls
 * `vscode.window.terminals` on a 5 s interval against a user-supplied list of
 * regex sources matching terminal names (e.g. `^Claude Code$`).
 *
 * **DET-06 zero-false-positive guarantee:** when `patterns` is empty or
 * omitted, `start()` does NOT register a setInterval, does NOT iterate
 * terminals, and NEVER dispatches. Default config = empty array = no
 * polling, no overhead, no risk. Pitfall 5 from 03-RESEARCH.
 *
 * **Aggregate dispatch rule:** this tier emits exactly one `agent-started`
 * when the set of matching terminals transitions 0→N and exactly one
 * `agent-ended` when it transitions N→0. Per-terminal aggregation is the
 * orchestrator's responsibility (plan 03-04).
 *
 * **D-18:** every side-effect surface (regex compile, iteration,
 * clearInterval) wrapped in try/catch with silent failure.
 */

export interface PollingDetectorOptions {
  /**
   * detect.polling.terminalNamePatterns — array of regex SOURCE STRINGS
   * supplied by user. Empty (default) → polling disabled entirely.
   * Each pattern is auto-anchored with ^ on the matcher; user writes
   * `Claude Code` to match terminal named "Claude Code".
   */
  patterns?: string[];

  /**
   * Defaults to "claude" — the agent label dispatched when a terminal name
   * matches. Phase 4 may extend with per-pattern labels; v0.1 fixed.
   */
  defaultAgent?: string;

  /** Override for tests. Defaults to 5000 ms. */
  intervalMs?: number;

  /** Override for tests — clock injection. Defaults to setInterval. */
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;

  /** Override for tests — terminals list source. Defaults to () => vscode.window.terminals. */
  getTerminals?: () => readonly vscode.Terminal[];
}

export interface PollingDetector {
  readonly tier: 4;
  start(dispatch: (event: Event) => void): vscode.Disposable;
}

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_AGENT = "claude";

export function createPollingDetector(
  opts: PollingDetectorOptions = {},
): PollingDetector {
  const patterns = opts.patterns ?? [];
  const defaultAgent = opts.defaultAgent ?? DEFAULT_AGENT;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const setIntervalFn = opts.setInterval ?? globalThis.setInterval;
  const clearIntervalFn = opts.clearInterval ?? globalThis.clearInterval;
  const getTerminals =
    opts.getTerminals ?? ((): readonly vscode.Terminal[] => vscode.window.terminals);

  return {
    tier: 4 as const,
    start(dispatch): vscode.Disposable {
      // DET-06 zero-false-positive short-circuit. MUST run before any
      // setInterval / regex construction (Pitfall 5).
      if (patterns.length === 0) {
        return { dispose: (): void => {} };
      }

      // Compile patterns with silent-drop on invalid regex (D-18).
      const compiled: RegExp[] = [];
      for (const p of patterns) {
        try {
          compiled.push(new RegExp("^" + p));
        } catch {
          /* silent: user typo, skip this pattern */
        }
      }

      const activeSet = new Set<vscode.Terminal>();

      const tick = (): void => {
        try {
          const current = getTerminals();
          const wasEmpty = activeSet.size === 0;

          // Add newly-matching terminals to active set.
          for (const t of current) {
            if (activeSet.has(t)) continue;
            const matches = compiled.some((re) => re.test(t.name));
            if (matches) activeSet.add(t);
          }

          // Remove terminals that have closed or no longer match.
          for (const t of [...activeSet]) {
            const stillPresent = current.includes(t);
            const stillMatches =
              stillPresent && compiled.some((re) => re.test(t.name));
            if (!stillMatches) activeSet.delete(t);
          }

          const isEmpty = activeSet.size === 0;
          if (wasEmpty && !isEmpty) {
            dispatch({ type: "agent-started", agent: defaultAgent });
          } else if (!wasEmpty && isEmpty) {
            dispatch({ type: "agent-ended", agent: defaultAgent });
          }
        } catch {
          /* silent per D-18 */
        }
      };

      const timer = setIntervalFn(tick, intervalMs);

      return {
        dispose: (): void => {
          try {
            clearIntervalFn(timer);
          } catch {
            /* silent */
          }
        },
      };
    },
  };
}
