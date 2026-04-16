/**
 * Phase 5 Plan 01 — companion lockfile detector tests (tier 1).
 *
 * Covers T-05-01: orphan detection (mtime > 5min stale → agent-ended).
 * Covers D-05: agent="claude" dispatched on lockfile appearance.
 *
 * Uses fs.watchFile listener injection via opts.fs to simulate stat callbacks
 * without touching the real filesystem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vscode is only used for the Disposable type at runtime.
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
  createCompanionDetector,
  type CompanionDetectorOptions,
} from "../src/detectors/companion";

const LOCKFILE = "/fake/home/.claude/agent-mode-discord.lock";
const NOW_MS = 1_700_000_000_000;

// Helper to build a fake Stats-like object
function makeStats(mtimeMs: number): { mtimeMs: number } {
  return { mtimeMs };
}

interface FakeFs {
  watchFile: ReturnType<typeof vi.fn>;
  unwatchFile: ReturnType<typeof vi.fn>;
  capturedListener: ((curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void) | null;
  triggerListener: (curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void;
}

function makeFakeFs(): FakeFs {
  let capturedListener: ((curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void) | null = null;

  const fakeFs: FakeFs = {
    watchFile: vi.fn((_path: string, _opts: unknown, listener: (curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void) => {
      capturedListener = listener;
    }),
    unwatchFile: vi.fn(),
    get capturedListener() {
      return capturedListener;
    },
    triggerListener(curr: { mtimeMs: number }, prev: { mtimeMs: number }) {
      if (!capturedListener) throw new Error("Listener not registered yet");
      capturedListener(curr, prev);
    },
  };

  return fakeFs;
}

function makeOpts(fakeFs: FakeFs, nowMs = NOW_MS, overrides: Partial<CompanionDetectorOptions> = {}): CompanionDetectorOptions {
  return {
    lockfilePath: LOCKFILE,
    pollIntervalMs: 1000,
    stalenessMs: 5 * 60 * 1000,
    now: () => nowMs,
    fs: {
      watchFile: fakeFs.watchFile,
      unwatchFile: fakeFs.unwatchFile,
    },
    ...overrides,
  };
}

describe("createCompanionDetector", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let fakeFs: FakeFs;

  beforeEach(() => {
    dispatch = vi.fn();
    fakeFs = makeFakeFs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has tier property equal to 1", () => {
    const detector = createCompanionDetector(makeOpts(fakeFs));
    expect(detector.tier).toBe(1);
  });

  it("dispatches agent-started when lockfile appears (mtimeMs > 0, prev.mtimeMs === 0)", () => {
    const detector = createCompanionDetector(makeOpts(fakeFs));
    detector.start(dispatch);

    fakeFs.triggerListener(makeStats(NOW_MS - 1000), makeStats(0));

    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith<[Event]>({ type: "agent-started", agent: "claude" });
  });

  it("dispatches agent-ended when lockfile disappears (curr.mtimeMs === 0)", () => {
    const detector = createCompanionDetector(makeOpts(fakeFs));
    detector.start(dispatch);

    // First: file appears
    fakeFs.triggerListener(makeStats(NOW_MS - 1000), makeStats(0));
    expect(dispatch).toHaveBeenCalledTimes(1);

    // Then: file disappears
    fakeFs.triggerListener(makeStats(0), makeStats(NOW_MS - 1000));

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: "agent-ended", agent: "claude" });
  });

  it("treats stale lockfile (mtime > 5min) as orphaned and dispatches agent-ended", () => {
    const STALENESS_MS = 5 * 60 * 1000;
    const detector = createCompanionDetector(makeOpts(fakeFs, NOW_MS));
    detector.start(dispatch);

    // File appears (fresh)
    fakeFs.triggerListener(makeStats(NOW_MS - 1000), makeStats(0));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenLastCalledWith({ type: "agent-started", agent: "claude" });

    // Time advances — file mtime stays old, now() is later → stale
    const laterNow = NOW_MS + STALENESS_MS + 1;
    // Re-create with updated now to simulate stale detection
    const detector2 = createCompanionDetector(makeOpts(fakeFs, laterNow));
    const dispatch2 = vi.fn();
    detector2.start(dispatch2);

    // Trigger with a "previously active" lockfile (mtime in past by > 5min)
    fakeFs.triggerListener(makeStats(NOW_MS - 1000), makeStats(NOW_MS - 2000));

    // dispatch2 should get agent-ended since mtime > stalenessMs ago
    expect(dispatch2).toHaveBeenCalledOnce();
    expect(dispatch2).toHaveBeenCalledWith({ type: "agent-ended", agent: "claude" });
  });

  it("dispatches agent-started when lockfile already exists at start and is fresh on first poll", () => {
    const detector = createCompanionDetector(makeOpts(fakeFs));
    detector.start(dispatch);

    // Simulate first poll: file exists (both curr and prev have mtimeMs > 0 is not needed;
    // the detector only cares about curr.mtimeMs > 0 and !active)
    fakeFs.triggerListener(makeStats(NOW_MS - 500), makeStats(NOW_MS - 500));

    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "agent-started", agent: "claude" });
  });

  it("does not dispatch when lockfile does not exist at start (curr.mtimeMs === 0)", () => {
    const detector = createCompanionDetector(makeOpts(fakeFs));
    detector.start(dispatch);

    // File does not exist: mtimeMs = 0
    fakeFs.triggerListener(makeStats(0), makeStats(0));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not dispatch agent-started twice when lockfile is already active", () => {
    const detector = createCompanionDetector(makeOpts(fakeFs));
    detector.start(dispatch);

    fakeFs.triggerListener(makeStats(NOW_MS - 1000), makeStats(0));
    fakeFs.triggerListener(makeStats(NOW_MS - 2000), makeStats(NOW_MS - 1000));

    // Should only dispatch agent-started once (file was active and stays active)
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "agent-started", agent: "claude" });
  });

  it("calls fs.unwatchFile on dispose to clean up", () => {
    const detector = createCompanionDetector(makeOpts(fakeFs));
    const disposable = detector.start(dispatch);

    disposable.dispose();

    expect(fakeFs.unwatchFile).toHaveBeenCalledOnce();
    expect(fakeFs.unwatchFile).toHaveBeenCalledWith(LOCKFILE, expect.any(Function));
  });

  it("calls fs.watchFile with the correct lockfile path and options", () => {
    const detector = createCompanionDetector(makeOpts(fakeFs));
    detector.start(dispatch);

    expect(fakeFs.watchFile).toHaveBeenCalledOnce();
    expect(fakeFs.watchFile).toHaveBeenCalledWith(
      LOCKFILE,
      { persistent: false, interval: 1000 },
      expect.any(Function),
    );
  });
});
