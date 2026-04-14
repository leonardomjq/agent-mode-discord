/**
 * Phase 3 Wave 1 — polling detector tests (tier 4, DET-06).
 *
 * Wave 0 seeded this file with it.todo stubs; Wave 1 flipped each into a
 * real vitest case using fake timers + injected getTerminals + injected
 * setInterval/clearInterval spies to drive the 5s loop deterministically.
 *
 * DET-06 zero-false-positive: tests 1 and 2 prove empty-default does NOT
 * register a setInterval and NEVER dispatches — this is the load-bearing
 * behavioral contract for users running the default config.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The detector imports `* as vscode` for the Terminal type at runtime (via
// the injected getTerminals default). Tests inject getTerminals so vscode
// is never actually invoked, but module resolution still needs a shim.
vi.mock("vscode", () => ({}));

import type { Event } from "../src/state/types";
import { createPollingDetector } from "../src/detectors/polling";

type FakeTerminal = { name: string };

function makeFakeTerminal(name: string): FakeTerminal {
  return { name };
}

describe("polling detector (tier 4, DET-06)", () => {
  let terminals: FakeTerminal[];
  let events: Event[];
  let setIntervalSpy: ReturnType<typeof vi.fn>;
  let clearIntervalSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    terminals = [];
    events = [];
    // Spy wrappers that still forward to the real fake-timer implementations
    // so vi.advanceTimersByTime drives the interval callbacks.
    setIntervalSpy = vi.fn((fn: () => void, ms: number) =>
      globalThis.setInterval(fn, ms),
    ) as unknown as ReturnType<typeof vi.fn>;
    clearIntervalSpy = vi.fn(
      (handle: ReturnType<typeof globalThis.setInterval>) =>
        globalThis.clearInterval(handle),
    ) as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function startDetector(patterns: string[] | undefined): {
    dispose: () => void;
  } {
    const detector = createPollingDetector({
      patterns,
      setInterval: setIntervalSpy as unknown as typeof globalThis.setInterval,
      clearInterval:
        clearIntervalSpy as unknown as typeof globalThis.clearInterval,
      getTerminals: () => terminals as unknown as readonly import("vscode").Terminal[],
    });
    expect(detector.tier).toBe(4);
    return detector.start((event) => {
      events.push(event);
    });
  }

  it("does not poll when patterns empty (DET-06 zero-false-positive default)", () => {
    const disposable = startDetector([]);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(events).toEqual([]);
    disposable.dispose();
  });

  it("does not poll when patterns omitted (undefined → empty default)", () => {
    const disposable = startDetector(undefined);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(events).toEqual([]);
    disposable.dispose();
  });

  it("polls every 5s when patterns non-empty", () => {
    startDetector(["Claude.*"]);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy.mock.calls[0]?.[1]).toBe(5000);
  });

  it("dispatches agent-started for a matching terminal", () => {
    startDetector(["Claude.*"]);
    terminals.push(makeFakeTerminal("Claude Session 1"));
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
  });

  it("does not double-dispatch on subsequent polls while terminal persists", () => {
    startDetector(["Claude.*"]);
    terminals.push(makeFakeTerminal("Claude Session 1"));
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
  });

  it("dispatches agent-ended when the matched terminal disappears", () => {
    startDetector(["Claude.*"]);
    const t = makeFakeTerminal("Claude Session 1");
    terminals.push(t);
    vi.advanceTimersByTime(5000);
    // Remove from the list (terminal closed).
    terminals = terminals.filter((x) => x !== t);
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([
      { type: "agent-started", agent: "claude" },
      { type: "agent-ended", agent: "claude" },
    ]);
  });

  it("silently drops invalid regex patterns (D-18)", () => {
    expect(() => startDetector(["[invalid("]) /* compile error */ ).not.toThrow();
    terminals.push(makeFakeTerminal("Claude Session"));
    vi.advanceTimersByTime(10_000);
    // All patterns invalid → zero compiled → nothing matches → no dispatch.
    expect(events).toEqual([]);
  });

  it("disposes setInterval cleanly", () => {
    const disposable = startDetector(["Claude.*"]);
    const timerHandle = setIntervalSpy.mock.results[0]?.value;
    disposable.dispose();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy.mock.calls[0]?.[0]).toBe(timerHandle);
  });

  it("multiple matching terminals only fire agent-started once (aggregate 0→N)", () => {
    startDetector(["Claude.*"]);
    terminals.push(makeFakeTerminal("Claude Session 1"));
    terminals.push(makeFakeTerminal("Claude Session 2"));
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
  });

  it("agent-ended fires only when the last matching terminal is removed", () => {
    startDetector(["Claude.*"]);
    const t1 = makeFakeTerminal("Claude Session 1");
    const t2 = makeFakeTerminal("Claude Session 2");
    terminals.push(t1, t2);
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    // Remove one — one still matching, no agent-ended.
    terminals = terminals.filter((x) => x !== t1);
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    // Remove the second — now agent-ended fires.
    terminals = terminals.filter((x) => x !== t2);
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([
      { type: "agent-started", agent: "claude" },
      { type: "agent-ended", agent: "claude" },
    ]);
  });
});
