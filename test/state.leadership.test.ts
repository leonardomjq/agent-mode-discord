/**
 * Phase 05.2 Plan 01 — leadership election unit tests (RED → GREEN).
 *
 * Covers:
 *   D-01 lockfile path
 *   D-02 atomic wx acquire
 *   D-03 heartbeat 30s, staleness 90s
 *   D-04 greedy stale-takeover
 *   D-07 release unlinks (silent on ENOENT)
 *   D-08 no PID check — mtime-only
 *   D-11 no vscode import
 *   D-13 optional log callback
 *
 * Uses injected fs surface (LeadershipFsSurface) and injected timers to
 * test deterministically with no real filesystem I/O.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLeadership,
  type LeadershipOptions,
  type LeadershipFsSurface,
} from "../src/state/leadership";

// ── Constants ─────────────────────────────────────────────────────────────────
const LOCKFILE = "/fake/home/.claude/agent-mode-discord.leader.lock";
const NOW_MS = 1_700_000_000_000;
const HEARTBEAT_MS = 30_000;
const STALENESS_MS = 90_000;

// ── Fake fs surface ───────────────────────────────────────────────────────────

interface FakeFileState {
  exists: boolean;
  mtimeMs: number;
}

interface FakeFs extends LeadershipFsSurface {
  _state: FakeFileState;
}

function makeFakeFs(initialExists = false, initialMtime = NOW_MS): FakeFs {
  const state: FakeFileState = { exists: initialExists, mtimeMs: initialMtime };

  return {
    _state: state,

    open: vi.fn(async (_path: string, flags: string) => {
      if (flags === "wx" && state.exists) {
        const err = Object.assign(new Error("EEXIST: file already exists"), {
          code: "EEXIST",
        });
        throw err;
      }
      // "Creates" the file
      state.exists = true;
      state.mtimeMs = NOW_MS;
      return { close: vi.fn().mockResolvedValue(undefined) };
    }),

    utimes: vi.fn(async (_path: string, _atime: number | Date, mtime: number | Date) => {
      state.mtimeMs = typeof mtime === "number" ? mtime : mtime.getTime();
    }),

    unlink: vi.fn(async (_path: string) => {
      if (!state.exists) {
        const err = Object.assign(new Error("ENOENT: no such file or directory"), {
          code: "ENOENT",
        });
        throw err;
      }
      state.exists = false;
    }),

    stat: vi.fn(async (_path: string) => {
      if (!state.exists) {
        const err = Object.assign(new Error("ENOENT: no such file or directory"), {
          code: "ENOENT",
        });
        throw err;
      }
      return { mtimeMs: state.mtimeMs };
    }),
  };
}

// ── Fake timers ───────────────────────────────────────────────────────────────

interface FakeTimers {
  setInterval: ReturnType<typeof vi.fn>;
  clearInterval: ReturnType<typeof vi.fn>;
  /** Synchronously trigger all registered intervals as if `ms` elapsed. */
  tick: (ms: number) => void;
}

function makeFakeTimers(): FakeTimers {
  const intervals: Array<{ fn: () => void; ms: number; handle: NodeJS.Timeout }> = [];
  let nextHandle = 1 as unknown as NodeJS.Timeout;

  return {
    setInterval: vi.fn((fn: () => void, ms: number) => {
      const handle = nextHandle;
      nextHandle = (nextHandle as unknown as number + 1) as unknown as NodeJS.Timeout;
      intervals.push({ fn, ms, handle });
      return handle;
    }),
    clearInterval: vi.fn((handle: NodeJS.Timeout) => {
      const idx = intervals.findIndex((i) => i.handle === handle);
      if (idx !== -1) intervals.splice(idx, 1);
    }),
    tick(ms: number) {
      for (const interval of intervals) {
        const times = Math.floor(ms / interval.ms);
        for (let i = 0; i < times; i++) {
          interval.fn();
        }
      }
    },
  };
}

// ── Options builder ───────────────────────────────────────────────────────────

function makeOpts(
  fakeFs: FakeFs,
  fakeTimers: FakeTimers,
  nowRef: { now: number },
  extras: Partial<LeadershipOptions> = {},
): LeadershipOptions {
  return {
    lockfilePath: LOCKFILE,
    heartbeatMs: HEARTBEAT_MS,
    stalenessMs: STALENESS_MS,
    now: () => nowRef.now,
    fs: fakeFs,
    setInterval: fakeTimers.setInterval,
    clearInterval: fakeTimers.clearInterval,
    ...extras,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createLeadership", () => {
  let fakeFs: FakeFs;
  let fakeTimers: FakeTimers;
  let nowRef: { now: number };

  beforeEach(() => {
    fakeFs = makeFakeFs();
    fakeTimers = makeFakeTimers();
    nowRef = { now: NOW_MS };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has isLeader false before acquire()", () => {
    const leadership = createLeadership(makeOpts(fakeFs, fakeTimers, nowRef));
    expect(leadership.isLeader()).toBe(false);
  });

  it("acquire() returns true and creates lockfile when path is free", async () => {
    const leadership = createLeadership(makeOpts(fakeFs, fakeTimers, nowRef));
    const result = await leadership.acquire();
    expect(result).toBe(true);
    expect(leadership.isLeader()).toBe(true);
    expect(fakeFs.open).toHaveBeenCalledWith(LOCKFILE, "wx");
  });

  it("acquire() returns false when lockfile exists and is fresh (mtime < 90s old)", async () => {
    const leadership = createLeadership(
      makeOpts(makeFakeFs(true, NOW_MS - 1000), fakeTimers, nowRef),
    );
    const result = await leadership.acquire();
    expect(result).toBe(false);
    expect(leadership.isLeader()).toBe(false);
  });

  it("acquire() returns true when lockfile exists but is stale (mtime > 90s old) — unlinks then re-opens", async () => {
    const staleMtime = NOW_MS - STALENESS_MS - 1000; // just past the staleness threshold
    const staleFs = makeFakeFs(true, staleMtime);
    const leadership = createLeadership(makeOpts(staleFs, fakeTimers, nowRef));

    const result = await leadership.acquire();
    expect(result).toBe(true);
    expect(leadership.isLeader()).toBe(true);
    expect(staleFs.unlink).toHaveBeenCalledWith(LOCKFILE);
    expect(staleFs.open).toHaveBeenLastCalledWith(LOCKFILE, "wx");
  });

  it("heartbeat calls fs.utimes every 30s while isLeader() is true", async () => {
    const leadership = createLeadership(makeOpts(fakeFs, fakeTimers, nowRef));
    await leadership.acquire();

    expect(fakeTimers.setInterval).toHaveBeenCalledOnce();

    // Advance clock and tick intervals 3 times
    nowRef.now = NOW_MS + HEARTBEAT_MS * 3;
    fakeTimers.tick(HEARTBEAT_MS * 3);

    expect(fakeFs.utimes).toHaveBeenCalledTimes(3);
    expect(fakeFs.utimes).toHaveBeenCalledWith(LOCKFILE, expect.anything(), expect.anything());
  });

  it("release() unlinks the lockfile and flips isLeader() to false", async () => {
    const leadership = createLeadership(makeOpts(fakeFs, fakeTimers, nowRef));
    await leadership.acquire();
    expect(leadership.isLeader()).toBe(true);

    await leadership.release();

    expect(leadership.isLeader()).toBe(false);
    expect(fakeFs.unlink).toHaveBeenCalledWith(LOCKFILE);
  });

  it("release() is silent when unlink throws (e.g. ENOENT race with takeover)", async () => {
    const leadership = createLeadership(makeOpts(fakeFs, fakeTimers, nowRef));
    await leadership.acquire();

    // Simulate the lockfile already being gone
    fakeFs._state.exists = false;

    // release() should not throw even though unlink will throw ENOENT
    await expect(leadership.release()).resolves.toBeUndefined();
    expect(leadership.isLeader()).toBe(false);
  });

  it("release() stops the heartbeat interval", async () => {
    const leadership = createLeadership(makeOpts(fakeFs, fakeTimers, nowRef));
    await leadership.acquire();
    expect(fakeTimers.setInterval).toHaveBeenCalledOnce();

    await leadership.release();

    expect(fakeTimers.clearInterval).toHaveBeenCalledOnce();
  });

  it("onTakeover callback fires after a successful stale-takeover acquire()", async () => {
    const staleMtime = NOW_MS - STALENESS_MS - 1000;
    const staleFs = makeFakeFs(true, staleMtime);
    const leadership = createLeadership(makeOpts(staleFs, fakeTimers, nowRef));

    const onTakeover = vi.fn();
    leadership.onTakeover(onTakeover);

    await leadership.acquire();

    expect(onTakeover).toHaveBeenCalledOnce();
  });

  it("onTakeover callback does NOT fire on first-ever acquire (no prior leader)", async () => {
    const leadership = createLeadership(makeOpts(fakeFs, fakeTimers, nowRef));

    const onTakeover = vi.fn();
    leadership.onTakeover(onTakeover);

    await leadership.acquire();

    expect(onTakeover).not.toHaveBeenCalled();
  });

  it("acquire() is silent on fs.open errors other than EEXIST (returns false)", async () => {
    const errorFs = makeFakeFs();
    (errorFs.open as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" }),
    );

    const leadership = createLeadership(makeOpts(errorFs, fakeTimers, nowRef));
    const result = await leadership.acquire();

    expect(result).toBe(false);
    expect(leadership.isLeader()).toBe(false);
  });
});
