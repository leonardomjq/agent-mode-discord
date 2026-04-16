import * as vscode from "vscode";
import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Event } from "../state/types";

/**
 * Phase 5 Plan 01 — tier-1 companion lockfile detector.
 *
 * Watches `~/.claude/agent-mode-discord.lock` via fs.watchFile stat polling.
 * When the lockfile appears, dispatches agent-started with agent="claude".
 * When the lockfile disappears or its mtime is older than 5 minutes (T-05-01
 * orphan detection), dispatches agent-ended with agent="claude".
 *
 * This is the highest-fidelity signal: written by the Claude Code companion
 * plugin on SessionStart, removed on SessionEnd. Tier-1 suppresses tiers
 * 2/3/4 via the orchestrator linear-scan break-on-first-active.
 *
 * D-18: all dispatch + fs calls wrapped in try/catch (silent).
 */

const DEFAULT_LOCKFILE = path.join(
  os.homedir(),
  ".claude",
  "agent-mode-discord.lock",
);
const DEFAULT_POLL_MS = 1000;
const DEFAULT_STALENESS_MS = 5 * 60 * 1000; // 5 minutes (T-05-01)

/** Minimal fs surface required — enables injection for unit tests. */
export interface CompanionFsSurface {
  watchFile: (
    path: string,
    options: { persistent: boolean; interval: number },
    listener: (curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void,
  ) => void;
  unwatchFile: (
    path: string,
    listener: (curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void,
  ) => void;
}

export interface CompanionDetectorOptions {
  /** Override lockfile path for tests. Defaults to ~/.claude/agent-mode-discord.lock (D-02). */
  lockfilePath?: string;
  /** Override poll interval for tests. Defaults to 1000ms (D-04). */
  pollIntervalMs?: number;
  /** Override staleness threshold for tests. Defaults to 5 minutes (T-05-01). */
  stalenessMs?: number;
  /** Clock injection for tests. Defaults to Date.now. */
  now?: () => number;
  /** fs surface injection for tests. Defaults to node:fs. */
  fs?: CompanionFsSurface;
}

export interface CompanionDetector {
  readonly tier: 1;
  start(dispatch: (event: Event) => void): vscode.Disposable;
}

export function createCompanionDetector(
  opts: CompanionDetectorOptions = {},
): CompanionDetector {
  const lockfilePath = opts.lockfilePath ?? DEFAULT_LOCKFILE;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
  const stalenessMs = opts.stalenessMs ?? DEFAULT_STALENESS_MS;
  const now = opts.now ?? Date.now;
  const fs: CompanionFsSurface = opts.fs ?? {
    watchFile: nodeFs.watchFile,
    unwatchFile: nodeFs.unwatchFile,
  };

  return {
    tier: 1,
    start(dispatch: (event: Event) => void): vscode.Disposable {
      let active = false;

      const listener = (
        curr: { mtimeMs: number },
        _prev: { mtimeMs: number },
      ): void => {
        try {
          // fs.watchFile invariant: when the watched path does not exist, the stat
          // callback delivers an all-zero Stats object. mtimeMs === 0 is therefore a
          // reliable "file missing" proxy without a separate fs.existsSync round-trip.
          // Ref: Node.js docs — https://nodejs.org/api/fs.html#fswatchfilefilename-options-listener
          const fileExists = curr.mtimeMs > 0;
          const isStale =
            fileExists && now() - curr.mtimeMs > stalenessMs;

          if (fileExists && !isStale && !active) {
            active = true;
            dispatch({ type: "agent-started", agent: "claude" }); // D-05
          } else if ((!fileExists || isStale) && active) {
            active = false;
            dispatch({ type: "agent-ended", agent: "claude" });
          }
        } catch {
          /* silent per D-18 */
        }
      };

      try {
        fs.watchFile(
          lockfilePath,
          { persistent: false, interval: pollIntervalMs },
          listener,
        );
      } catch {
        /* silent per D-18 */
      }

      return new vscode.Disposable(() => {
        try {
          fs.unwatchFile(lockfilePath, listener);
        } catch {
          /* silent per D-18 */
        }
      });
    },
  };
}
