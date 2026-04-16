import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Phase 05.2 Plan 01 — single-leader lockfile election module.
 *
 * The first VS Code window to call acquire() wins leadership by atomically
 * creating a lockfile at ~/.claude/agent-mode-discord.leader.lock (D-01, D-02).
 * The leader heartbeats every 30s via fs.utimes (D-03). Followers check the
 * lockfile mtime; if stale (> 90s old), a greedy takeover is attempted via
 * unlink + re-open (D-04). Release unlinks the lockfile and silently ignores
 * all errors (D-07). No PID liveness check — mtime-only semantics (D-08).
 * All fs calls are wrapped in try/catch; no error ever surfaces to callers (D-18).
 * Optional log callback for debug output (D-13).
 *
 * Mirrors the DI shape of src/detectors/companion.ts (D-09).
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LOCKFILE = path.join(
  os.homedir(),
  ".claude",
  "agent-mode-discord.leader.lock",
);
const DEFAULT_HEARTBEAT_MS = 30_000; // D-03
const DEFAULT_STALENESS_MS = 90_000; // D-03 (3× heartbeat)

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Minimal fs surface required — enables injection for unit tests (D-09). */
export interface LeadershipFsSurface {
  open: (
    path: string,
    flags: string,
  ) => Promise<{ close: () => Promise<void> }>;
  utimes: (
    path: string,
    atime: number | Date,
    mtime: number | Date,
  ) => Promise<void>;
  unlink: (path: string) => Promise<void>;
  stat: (path: string) => Promise<{ mtimeMs: number }>;
}

export interface LeadershipOptions {
  /** Default: ~/.claude/agent-mode-discord.leader.lock (D-01). */
  lockfilePath?: string;
  /** Heartbeat interval in ms. Default: 30_000 (D-03). */
  heartbeatMs?: number;
  /** Staleness threshold in ms. Default: 90_000 (D-03). */
  stalenessMs?: number;
  /** fs surface injection for tests. Default: node:fs/promises wrappers. */
  fs?: LeadershipFsSurface;
  /** Clock injection for tests. Default: Date.now. */
  now?: () => number;
  /** Timer injection for tests. Default: globalThis.setInterval. */
  setInterval?: (fn: () => void, ms: number) => NodeJS.Timeout;
  /** Timer injection for tests. Default: globalThis.clearInterval. */
  clearInterval?: (handle: NodeJS.Timeout) => void;
  /** Optional verbose log sink (D-13). */
  log?: (msg: string) => void;
}

export interface Leadership {
  /** Attempt to acquire leadership. Returns true if this process is now the leader. */
  acquire(): Promise<boolean>;
  /** Release leadership — unlinks lockfile if isLeader; silent on failure (D-07). */
  release(): Promise<void>;
  /** Returns true if this instance currently holds leadership. */
  isLeader(): boolean;
  /** Register a callback that fires when a follower successfully steals a stale leader (D-04). */
  onTakeover(cb: () => void): void;
}

// ── Default fs surface ────────────────────────────────────────────────────────

const defaultFs: LeadershipFsSurface = {
  async open(p, flags) {
    const handle = await fs.open(p, flags);
    return { close: () => handle.close() };
  },
  utimes: (p, a, m) => fs.utimes(p, a, m),
  unlink: (p) => fs.unlink(p),
  async stat(p) {
    const s = await fs.stat(p);
    return { mtimeMs: s.mtimeMs };
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function createLeadership(opts: LeadershipOptions = {}): Leadership {
  const lockfilePath = opts.lockfilePath ?? DEFAULT_LOCKFILE;
  const heartbeatMs = opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const stalenessMs = opts.stalenessMs ?? DEFAULT_STALENESS_MS;
  const fsSurface = opts.fs ?? defaultFs;
  const now = opts.now ?? Date.now;
  const setIntervalFn = opts.setInterval ?? globalThis.setInterval.bind(globalThis);
  const clearIntervalFn = opts.clearInterval ?? globalThis.clearInterval.bind(globalThis);
  const log = opts.log;

  let leader = false;
  let heartbeatHandle: NodeJS.Timeout | undefined;
  const takeoverCallbacks: Array<() => void> = [];

  /** Start the heartbeat interval that keeps the lockfile mtime fresh (D-03). */
  function startHeartbeat(): void {
    heartbeatHandle = setIntervalFn(() => {
      if (!leader) return;
      const ts = now();
      fsSurface.utimes(lockfilePath, ts, ts).catch(() => {
        /* silent per D-18 */
      });
    }, heartbeatMs);
  }

  /** Stop the heartbeat interval. */
  function stopHeartbeat(): void {
    if (heartbeatHandle !== undefined) {
      clearIntervalFn(heartbeatHandle);
      heartbeatHandle = undefined;
    }
  }

  return {
    isLeader(): boolean {
      return leader;
    },

    onTakeover(cb: () => void): void {
      takeoverCallbacks.push(cb);
    },

    async acquire(): Promise<boolean> {
      // ── Attempt atomic create (D-02) ─────────────────────────────────────
      try {
        const handle = await fsSurface.open(lockfilePath, "wx");
        await handle.close();
        leader = true;
        startHeartbeat();
        log?.("leadership acquired");
        return true;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") {
          // Non-EEXIST error (e.g. EPERM) — stay follower, swallow silently (D-18)
          return false;
        }
        // File exists — check staleness for potential greedy takeover (D-04)
      }

      // ── Check staleness ───────────────────────────────────────────────────
      try {
        const { mtimeMs } = await fsSurface.stat(lockfilePath);
        if (now() - mtimeMs <= stalenessMs) {
          // Fresh leader holds it — stay follower
          return false;
        }
      } catch {
        // stat failed (e.g. file deleted between open and stat) — stay follower (D-18)
        return false;
      }

      // ── Greedy stale-takeover (D-04) ──────────────────────────────────────
      try {
        await fsSurface.unlink(lockfilePath);
        const handle = await fsSurface.open(lockfilePath, "wx");
        await handle.close();
        leader = true;
        startHeartbeat();
        log?.("leadership taken over from stale leader");
        // Fire takeover callbacks (D-04) — after becoming leader
        for (const cb of takeoverCallbacks) {
          cb();
        }
        return true;
      } catch {
        // Lost the race to another window — stay follower (D-18)
        return false;
      }
    },

    async release(): Promise<void> {
      if (!leader) return;
      stopHeartbeat();
      try {
        await fsSurface.unlink(lockfilePath);
      } catch {
        /* silent per D-07 / D-18 */
      }
      leader = false;
      log?.("leadership released");
    },
  };
}
