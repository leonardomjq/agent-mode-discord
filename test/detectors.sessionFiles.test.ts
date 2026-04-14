/**
 * Phase 3 Wave 1 — sessionFiles detector tests (tier 3).
 *
 * Covers DET-05: `~/.claude/projects/*.jsonl` fs.watch + 60s staleness +
 * platform branch (macOS/Windows recursive watch vs Linux polling-stat).
 *
 * PRD §FR-1.8: detector MUST NEVER read JSONL content — only
 * fs.statSync().mtimeMs. The fake fs helper below intentionally omits a
 * `readFileSync` method so any attempt to call it would throw at type and
 * at runtime. That structural guarantee is stronger than a spy assertion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vscode is only used for the Disposable type and constructor at runtime.
// Mock it before importing the detector module (hoisted by vitest).
vi.mock("vscode", () => ({
  Disposable: class {
    constructor(private readonly fn: () => void) {}
    dispose(): void {
      this.fn();
    }
  },
}));

import type { Event } from "../src/state/types";
import {
  createSessionFilesDetector,
  type SessionFilesDetectorOptions,
} from "../src/detectors/sessionFiles";

const PROJECTS_DIR = "/fake/home/.claude/projects";
const SUBDIR = `${PROJECTS_DIR}/encoded-cwd`;
const FILE_A = `${SUBDIR}/session-a.jsonl`;

type WatchOpts = { recursive?: boolean; persistent?: boolean };
type WatchCallback = (event: string, filename: string | null) => void;

interface FakeWatcher {
  close: ReturnType<typeof vi.fn>;
}

function makeFakeFs(initialDirs: string[] = [PROJECTS_DIR]) {
  // files: absolute path -> { mtimeMs, exists }
  const files = new Map<string, { mtimeMs: number }>();
  // dirs that exist (contents built from files + seeded dirs)
  const dirs = new Set<string>(initialDirs);

  let watchCb: WatchCallback | null = null;
  let lastWatchDir: string | null = null;
  let lastWatchOpts: WatchOpts | null = null;
  const watcher: FakeWatcher = { close: vi.fn() };

  const addFile = (p: string, mtimeMs: number): void => {
    files.set(p, { mtimeMs });
    // ensure parent directory exists
    const parent = p.substring(0, p.lastIndexOf("/"));
    dirs.add(parent);
  };
  const removeFile = (p: string): void => {
    files.delete(p);
  };
  const setDirExists = (p: string, exists: boolean): void => {
    if (exists) dirs.add(p);
    else dirs.delete(p);
  };

  type FakeFs = NonNullable<SessionFilesDetectorOptions["fs"]>;
  const fs = {
    watch: vi.fn((dir: string, optsOrCb: unknown, maybeCb?: unknown) => {
      lastWatchDir = dir;
      if (typeof optsOrCb === "function") {
        watchCb = optsOrCb as WatchCallback;
        lastWatchOpts = null;
      } else {
        lastWatchOpts = (optsOrCb as WatchOpts) ?? null;
        watchCb = (maybeCb as WatchCallback) ?? null;
      }
      return watcher as unknown as ReturnType<typeof import("node:fs").watch>;
    }),
    statSync: vi.fn((p: string) => {
      const f = files.get(p);
      if (!f) {
        const err = new Error(`ENOENT: ${p}`);
        (err as NodeJS.ErrnoException).code = "ENOENT";
        throw err;
      }
      return { mtimeMs: f.mtimeMs } as ReturnType<typeof import("node:fs").statSync>;
    }),
    readdirSync: vi.fn((dir: string) => {
      if (!dirs.has(dir)) {
        const err = new Error(`ENOENT: ${dir}`);
        (err as NodeJS.ErrnoException).code = "ENOENT";
        throw err;
      }
      // Entries under this dir: subdirs and files whose parent == dir
      const out = new Set<string>();
      for (const p of files.keys()) {
        const parent = p.substring(0, p.lastIndexOf("/"));
        if (parent === dir) {
          out.add(p.substring(dir.length + 1));
        } else if (parent.startsWith(`${dir}/`)) {
          // Subdirectory: first segment after dir
          const rel = parent.slice(dir.length + 1);
          const first = rel.split("/")[0];
          out.add(first);
        }
      }
      for (const d of dirs) {
        if (d === dir) continue;
        if (d.startsWith(`${dir}/`)) {
          const rel = d.slice(dir.length + 1);
          const first = rel.split("/")[0];
          out.add(first);
        }
      }
      return Array.from(out) as unknown as ReturnType<
        typeof import("node:fs").readdirSync
      >;
    }),
    existsSync: vi.fn((p: string) => dirs.has(p) || files.has(p)),
  } as unknown as FakeFs;

  return {
    fs,
    watcher,
    addFile,
    removeFile,
    setDirExists,
    triggerWatch: (filename = "session-a.jsonl"): void =>
      watchCb?.("change", filename),
    getLastWatchOpts: (): WatchOpts | null => lastWatchOpts,
    getLastWatchDir: (): string | null => lastWatchDir,
    getReaddirCallCount: (): number =>
      (fs.readdirSync as unknown as { mock: { calls: unknown[] } }).mock.calls
        .length,
  };
}

function makeDispatch() {
  const events: Event[] = [];
  const dispatch = (ev: Event): void => {
    events.push(ev);
  };
  return { dispatch, events };
}

describe("sessionFiles detector", () => {
  let fakeNow = 1_000_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeNow = 1_000_000_000_000;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches agent-started when ~/.claude/projects/<cwd>/<uuid>.jsonl mtime updates (DET-05)", () => {
    const fake = makeFakeFs();
    fake.addFile(FILE_A, fakeNow - 1_000); // 1s old, well under 60s window
    const { dispatch, events } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "darwin",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    // Initial rescan fires synchronously on start — agent-started already dispatched.
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    // A watch event within debounce window should not double-dispatch
    // (already aggregateActive=true).
    events.length = 0;
    fake.triggerWatch();
    vi.advanceTimersByTime(150);
    expect(events).toEqual([]);

    disposable.dispose();
  });

  it("ignores files older than stalenessSeconds (default 60s)", () => {
    const fake = makeFakeFs();
    fake.addFile(FILE_A, fakeNow - 70_000); // 70 s old — stale
    const { dispatch, events } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "darwin",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    fake.triggerWatch();
    vi.advanceTimersByTime(150);
    expect(events).toEqual([]);

    disposable.dispose();
  });

  it("debounces fs.watch double-fire within 100ms (Pitfall 4 macOS)", () => {
    const fake = makeFakeFs();
    fake.addFile(FILE_A, fakeNow - 1_000);
    const { dispatch } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "darwin",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    // Initial rescan on start causes 2 readdirSync calls (top-level + subdir).
    const baseline = fake.getReaddirCallCount();

    // Two rapid watch events within the 100ms debounce window.
    fake.triggerWatch();
    vi.advanceTimersByTime(40);
    fake.triggerWatch();
    vi.advanceTimersByTime(150);

    // Debounce should have produced exactly ONE rescan (2 readdirSync calls).
    expect(fake.getReaddirCallCount() - baseline).toBe(2);

    disposable.dispose();
  });

  it("falls back to 5s polling-stat loop on Linux (Pitfall 4 platform branch)", () => {
    const fake = makeFakeFs();
    fake.addFile(FILE_A, fakeNow - 1_000);
    const { dispatch, events } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "linux",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    // Linux path: fs.watch must NOT be called.
    expect(fake.fs.watch).not.toHaveBeenCalled();

    // Initial rescan already fired agent-started.
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    // Drop the file out of the window; after 5s poll, agent-ended should fire.
    events.length = 0;
    fakeNow += 70_000; // advance the injected clock past staleness
    vi.advanceTimersByTime(5_000);
    expect(events).toEqual([{ type: "agent-ended", agent: "claude" }]);

    disposable.dispose();
  });

  it("uses recursive: true on macOS and Windows (process.platform check)", () => {
    const fake = makeFakeFs();
    const { dispatch } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "darwin",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    expect(fake.fs.watch).toHaveBeenCalledTimes(1);
    expect(fake.getLastWatchDir()).toBe(PROJECTS_DIR);
    expect(fake.getLastWatchOpts()).toEqual({ recursive: true });

    disposable.dispose();

    // Windows branch
    const fake2 = makeFakeFs();
    const detector2 = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "win32",
      fs: fake2.fs,
    });
    const d2 = detector2.start(dispatch);
    expect(fake2.getLastWatchOpts()).toEqual({ recursive: true });
    d2.dispose();
  });

  it("never reads JSONL content — only fs.statSync().mtimeMs (PRD §FR-1.8)", () => {
    const fake = makeFakeFs();
    fake.addFile(FILE_A, fakeNow - 1_000);
    const { dispatch } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "darwin",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    fake.triggerWatch();
    vi.advanceTimersByTime(150);

    // Structural guarantee: the fake fs surface exposes only watch/statSync/
    // readdirSync/existsSync. A readFileSync attempt would be a TypeError.
    // This assertion documents the contract — if the detector is ever
    // modified to call readFileSync, the fake lacks it and the test fails.
    const fsKeys = Object.keys(fake.fs).sort();
    expect(fsKeys).toEqual(
      ["existsSync", "readdirSync", "statSync", "watch"].sort(),
    );
    expect(fsKeys).not.toContain("readFileSync");
    expect(fsKeys).not.toContain("readFile");

    disposable.dispose();
  });

  it("silent on missing ~/.claude/projects/ directory at startup (D-18)", () => {
    // Directory does not exist at startup.
    const fake = makeFakeFs([]);
    const { dispatch, events } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "darwin",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    // No throw, no dispatch, no watch call.
    expect(events).toEqual([]);
    expect(fake.fs.watch).not.toHaveBeenCalled();

    // Directory appears — the 5s dir-poll should transition to watch mode.
    fake.setDirExists(PROJECTS_DIR, true);
    fake.addFile(FILE_A, fakeNow - 1_000);
    vi.advanceTimersByTime(5_000);

    expect(fake.fs.watch).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    disposable.dispose();
  });

  it("stalenessSeconds clamped to [10, 300] (CONTEXT decision)", () => {
    // stalenessSeconds=5 → clamped to 10; an 11s-old file must still be stale.
    {
      const fake = makeFakeFs();
      fake.addFile(FILE_A, fakeNow - 11_000); // 11s old
      const { dispatch, events } = makeDispatch();
      const detector = createSessionFilesDetector({
        projectsDir: PROJECTS_DIR,
        now: () => fakeNow,
        platform: "darwin",
        fs: fake.fs,
        stalenessSeconds: 5, // requested 5 → clamped to 10
      });
      const disposable = detector.start(dispatch);
      // 11s > clamped 10s → stale, no dispatch.
      expect(events).toEqual([]);
      disposable.dispose();
    }

    // stalenessSeconds=500 → clamped to 300; a 299s-old file must be fresh.
    {
      const fake = makeFakeFs();
      fake.addFile(FILE_A, fakeNow - 299_000); // 299s old
      const { dispatch, events } = makeDispatch();
      const detector = createSessionFilesDetector({
        projectsDir: PROJECTS_DIR,
        now: () => fakeNow,
        platform: "darwin",
        fs: fake.fs,
        stalenessSeconds: 500, // requested 500 → clamped to 300
      });
      const disposable = detector.start(dispatch);
      // 299s < clamped 300s → fresh, agent-started dispatched.
      expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
      disposable.dispose();
    }

    // A 301s-old file with stalenessSeconds=500 (clamped to 300) must be stale.
    {
      const fake = makeFakeFs();
      fake.addFile(FILE_A, fakeNow - 301_000);
      const { dispatch, events } = makeDispatch();
      const detector = createSessionFilesDetector({
        projectsDir: PROJECTS_DIR,
        now: () => fakeNow,
        platform: "darwin",
        fs: fake.fs,
        stalenessSeconds: 500,
      });
      const disposable = detector.start(dispatch);
      expect(events).toEqual([]);
      disposable.dispose();
    }
  });

  it("dispatches agent-ended when last active file goes stale", () => {
    const fake = makeFakeFs();
    fake.addFile(FILE_A, fakeNow - 1_000);
    const { dispatch, events } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "darwin",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
    events.length = 0;

    // Advance the injected clock past staleness, trigger a watch rescan.
    fakeNow += 70_000;
    fake.triggerWatch();
    vi.advanceTimersByTime(150);

    expect(events).toEqual([{ type: "agent-ended", agent: "claude" }]);

    disposable.dispose();
  });

  it("dispose clears all timers and closes watcher (cleanup race)", () => {
    const fake = makeFakeFs();
    fake.addFile(FILE_A, fakeNow - 1_000);
    const { dispatch, events } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "darwin",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    // Schedule a debounced rescan, then dispose before it fires.
    fake.triggerWatch();
    disposable.dispose();

    expect(fake.watcher.close).toHaveBeenCalledTimes(1);

    // A dispatch that was in-flight via the pending debounce timer must NOT
    // fire after dispose — clear out seed events, advance past the window.
    events.length = 0;
    vi.advanceTimersByTime(500);
    expect(events).toEqual([]);
  });

  it("Linux polling dispose clears the interval (no post-dispose dispatches)", () => {
    const fake = makeFakeFs();
    fake.addFile(FILE_A, fakeNow - 1_000);
    const { dispatch, events } = makeDispatch();

    const detector = createSessionFilesDetector({
      projectsDir: PROJECTS_DIR,
      now: () => fakeNow,
      platform: "linux",
      fs: fake.fs,
    });
    const disposable = detector.start(dispatch);

    // Initial rescan fires.
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
    events.length = 0;

    disposable.dispose();

    // Advance way past the 5s polling interval — no further dispatches.
    fakeNow += 70_000;
    vi.advanceTimersByTime(60_000);
    expect(events).toEqual([]);
  });
});
