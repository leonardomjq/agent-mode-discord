import * as vscode from "vscode";
import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Event } from "../state/types";

/**
 * Phase 3 Tier-3 detector: fs.watch on `~/.claude/projects/*.jsonl`.
 *
 * Covers DET-05 (PRD §FR-1.8): when Shell Integration is unavailable
 * (e.g. Cursor on Windows, terminals without shell-integration script),
 * the JSONL files Claude writes per session are the durable filesystem
 * signal that the session is alive.
 *
 * Signal rule: `fs.statSync(file).mtimeMs` only — NEVER read JSONL
 * content. The undocumented Anthropic format must not be parsed.
 *
 * Platform branching (RESEARCH Pitfall 4):
 *  - macOS / Windows: `fs.watch(projectsDir, { recursive: true })`.
 *  - Linux: recursive watch unsupported → 5 s polling-stat loop.
 *
 * Debounce: 100 ms clear-and-reset absorbs macOS fs.watch double-fire.
 *
 * Silent-on-missing: users without Claude installed won't have
 * `~/.claude/projects/`. Start polls existence every 5 s; when the
 * directory appears, transitions into watch mode.
 *
 * Aggregation: dispatches a single `agent-started`/`agent-ended` pair
 * for the whole fleet — DET-04 per-terminal distinction happens in the
 * orchestrator (03-04). Here "at least one active JSONL" → agent-started.
 */

export interface SessionFilesDetectorOptions {
  /** Override for tests. Defaults to ~/.claude/projects/. */
  projectsDir?: string;
  /** Override for tests. Defaults to 60. Bounded 10..300 (per CONTEXT decision). */
  stalenessSeconds?: number;
  /** Override for tests — clock injection. Defaults to Date.now. */
  now?: () => number;
  /** Override for tests — platform branch. Defaults to process.platform. */
  platform?: NodeJS.Platform;
  /** Override for tests — fs surface (allows in-memory fakes). */
  fs?: {
    watch: typeof nodeFs.watch;
    statSync: typeof nodeFs.statSync;
    readdirSync: typeof nodeFs.readdirSync;
    existsSync: typeof nodeFs.existsSync;
  };
}

export interface SessionFilesDetector {
  readonly tier: 3;
  start(dispatch: (event: Event) => void): vscode.Disposable;
}

const DEFAULT_STALENESS_SECONDS = 60;
const MIN_STALENESS_SECONDS = 10;
const MAX_STALENESS_SECONDS = 300;
const DEBOUNCE_MS = 100;
const POLL_INTERVAL_MS = 5000;
const DIR_POLL_INTERVAL_MS = 5000;

function clampStaleness(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_STALENESS_SECONDS;
  if (n < MIN_STALENESS_SECONDS) return MIN_STALENESS_SECONDS;
  if (n > MAX_STALENESS_SECONDS) return MAX_STALENESS_SECONDS;
  return n;
}

export function createSessionFilesDetector(
  opts: SessionFilesDetectorOptions = {},
): SessionFilesDetector {
  const projectsDir =
    opts.projectsDir ?? path.join(os.homedir(), ".claude", "projects");
  const stalenessSeconds = clampStaleness(
    opts.stalenessSeconds ?? DEFAULT_STALENESS_SECONDS,
  );
  const now = opts.now ?? Date.now;
  const platform = opts.platform ?? process.platform;
  const fs = opts.fs ?? {
    watch: nodeFs.watch,
    statSync: nodeFs.statSync,
    readdirSync: nodeFs.readdirSync,
    existsSync: nodeFs.existsSync,
  };

  return {
    tier: 3,
    start(dispatch: (event: Event) => void): vscode.Disposable {
      let aggregateActive = false;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let dirPollTimer: ReturnType<typeof setInterval> | null = null;
      let watcher: ReturnType<typeof nodeFs.watch> | null = null;
      let disposed = false;

      const listJsonlFiles = (): string[] => {
        const out: string[] = [];
        let entries: string[];
        try {
          entries = fs.readdirSync(projectsDir) as unknown as string[];
        } catch {
          return out;
        }
        for (const entry of entries) {
          const subdir = path.join(projectsDir, entry);
          let subEntries: string[];
          try {
            subEntries = fs.readdirSync(subdir) as unknown as string[];
          } catch {
            continue;
          }
          for (const name of subEntries) {
            if (typeof name === "string" && name.endsWith(".jsonl")) {
              out.push(path.join(subdir, name));
            }
          }
        }
        return out;
      };

      const rescan = (): void => {
        if (disposed) return;
        try {
          const files = listJsonlFiles();
          const nowMs = now();
          const thresholdMs = stalenessSeconds * 1000;
          let anyActive = false;
          for (const file of files) {
            try {
              const { mtimeMs } = fs.statSync(file);
              // Clamp future mtimes (clock skew, NFS/Samba, restored backup,
              // `touch -t` in the future) so they do NOT latch active forever.
              // Accept <=1s of skew as "fresh"; reject anything further in the
              // future as stale. Only 0 <= age < thresholdMs (with a small
              // negative tolerance) counts as fresh.
              const age = nowMs - mtimeMs;
              if (age >= -1000 && age < thresholdMs) {
                anyActive = true;
                break;
              }
            } catch {
              // stat race (file deleted between readdir + stat) — skip
              continue;
            }
          }
          if (anyActive && !aggregateActive) {
            aggregateActive = true;
            try {
              dispatch({ type: "agent-started", agent: "claude" });
            } catch {
              /* silent per D-18 */
            }
          } else if (!anyActive && aggregateActive) {
            aggregateActive = false;
            try {
              dispatch({ type: "agent-ended", agent: "claude" });
            } catch {
              /* silent per D-18 */
            }
          }
        } catch {
          /* silent per D-18 */
        }
      };

      const onWatchEvent = (): void => {
        if (disposed) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          rescan();
        }, DEBOUNCE_MS);
      };

      const beginWatching = (): void => {
        if (disposed) return;
        if (platform === "linux") {
          // Linux: recursive watch unsupported (Pitfall 4) — polling stat loop.
          pollTimer = setInterval(rescan, POLL_INTERVAL_MS);
        } else {
          try {
            watcher = fs.watch(projectsDir, { recursive: true }, onWatchEvent);
          } catch {
            /* silent per D-18 — fall back to polling if watch throws */
            pollTimer = setInterval(rescan, POLL_INTERVAL_MS);
          }
        }
        // Seed: kick an immediate rescan so an already-active JSONL triggers
        // agent-started without waiting for a filesystem event.
        rescan();
      };

      const checkAndStart = (): void => {
        let exists = false;
        try {
          exists = fs.existsSync(projectsDir);
        } catch {
          exists = false;
        }
        if (!exists) return;
        if (dirPollTimer) {
          clearInterval(dirPollTimer);
          dirPollTimer = null;
        }
        beginWatching();
      };

      // Startup: if the directory doesn't exist, poll for its appearance.
      let initialExists = false;
      try {
        initialExists = fs.existsSync(projectsDir);
      } catch {
        initialExists = false;
      }
      if (initialExists) {
        beginWatching();
      } else {
        dirPollTimer = setInterval(checkAndStart, DIR_POLL_INTERVAL_MS);
      }

      return new vscode.Disposable(() => {
        disposed = true;
        // Clear all timers BEFORE closing the watcher so no post-dispose
        // rescan dispatches into a stale callback.
        if (debounceTimer) {
          try {
            clearTimeout(debounceTimer);
          } catch {
            /* silent */
          }
          debounceTimer = null;
        }
        if (pollTimer) {
          try {
            clearInterval(pollTimer);
          } catch {
            /* silent */
          }
          pollTimer = null;
        }
        if (dirPollTimer) {
          try {
            clearInterval(dirPollTimer);
          } catch {
            /* silent */
          }
          dirPollTimer = null;
        }
        if (watcher) {
          try {
            watcher.close();
          } catch {
            /* silent */
          }
          watcher = null;
        }
      });
    },
  };
}
