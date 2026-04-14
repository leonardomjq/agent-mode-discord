/**
 * Phase 3 Wave 1 — shellIntegration detector tests (tier 2).
 *
 * Covers DET-01 (claude → AGENT_ACTIVE <500ms synchronous dispatch),
 * DET-04 (parallel sessions across terminals),
 * DET-08 (onDidChangeTerminalShellIntegration + 2000ms holdoff),
 * DET-09 (ANSI+prompt strip on Low confidence via regex.ts pure helper),
 * Pitfalls 1/2/3 (seed existing terminals, grace cancellation, close-supersedes-grace).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ----- vscode mock (hoisted by vitest) ---------------------------------------

type Cb<T> = (e: T) => void;

interface ShellExecutionEvent {
  terminal: unknown;
  execution: { commandLine: { value: string; confidence: number } };
}
interface ShellIntegrationChangedEvent {
  terminal: unknown;
  shellIntegration?: unknown;
}

const vscodeState = {
  terminals: [] as unknown[],
  startCb: null as Cb<ShellExecutionEvent> | null,
  endCb: null as Cb<ShellExecutionEvent> | null,
  changeCb: null as Cb<ShellIntegrationChangedEvent> | null,
  closeCb: null as Cb<unknown> | null,
  startDispose: vi.fn(),
  endDispose: vi.fn(),
  changeDispose: vi.fn(),
  closeDispose: vi.fn(),
  onDidChangeSubscribeCount: 0,
  onDidStartSubscribeCount: 0,
  onDidEndSubscribeCount: 0,
  onDidCloseSubscribeCount: 0,
};

vi.mock("vscode", () => ({
  window: {
    get terminals() {
      return vscodeState.terminals;
    },
    onDidStartTerminalShellExecution: (cb: Cb<ShellExecutionEvent>) => {
      vscodeState.startCb = cb;
      vscodeState.onDidStartSubscribeCount++;
      return { dispose: vscodeState.startDispose };
    },
    onDidEndTerminalShellExecution: (cb: Cb<ShellExecutionEvent>) => {
      vscodeState.endCb = cb;
      vscodeState.onDidEndSubscribeCount++;
      return { dispose: vscodeState.endDispose };
    },
    onDidChangeTerminalShellIntegration: (cb: Cb<ShellIntegrationChangedEvent>) => {
      vscodeState.changeCb = cb;
      vscodeState.onDidChangeSubscribeCount++;
      return { dispose: vscodeState.changeDispose };
    },
    onDidCloseTerminal: (cb: Cb<unknown>) => {
      vscodeState.closeCb = cb;
      vscodeState.onDidCloseSubscribeCount++;
      return { dispose: vscodeState.closeDispose };
    },
  },
  Disposable: class {
    constructor(private readonly fn: () => void) {}
    dispose(): void {
      this.fn();
    }
  },
  TerminalShellExecutionCommandLineConfidence: { Low: 0, Medium: 1, High: 2 },
}));

import type { Event } from "../src/state/types";
import { createShellIntegrationDetector } from "../src/detectors/shellIntegration";
import { LOW_CONFIDENCE_FIXTURES } from "./detectors/__helpers__/ansiFixtures";

// ----- test helpers ----------------------------------------------------------

function makeTerminal(name = "t"): unknown & {
  name: string;
  shellIntegration?: unknown;
} {
  return { name } as { name: string; shellIntegration?: unknown };
}

function makeDispatch() {
  const events: Event[] = [];
  const dispatch = (ev: Event): void => {
    events.push(ev);
  };
  return { dispatch, events };
}

function fireStart(
  terminal: unknown,
  value: string,
  confidence = 2, // High by default
): void {
  vscodeState.startCb?.({
    terminal,
    execution: { commandLine: { value, confidence } },
  });
}

function fireEnd(
  terminal: unknown,
  value: string,
  confidence = 2,
): void {
  vscodeState.endCb?.({
    terminal,
    execution: { commandLine: { value, confidence } },
  });
}

function resetMocks(): void {
  vscodeState.terminals = [];
  vscodeState.startCb = null;
  vscodeState.endCb = null;
  vscodeState.changeCb = null;
  vscodeState.closeCb = null;
  vscodeState.startDispose.mockClear();
  vscodeState.endDispose.mockClear();
  vscodeState.changeDispose.mockClear();
  vscodeState.closeDispose.mockClear();
  vscodeState.onDidChangeSubscribeCount = 0;
  vscodeState.onDidStartSubscribeCount = 0;
  vscodeState.onDidEndSubscribeCount = 0;
  vscodeState.onDidCloseSubscribeCount = 0;
}

// ----- tests -----------------------------------------------------------------

describe("shellIntegration detector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches agent-started within 500ms when claude command starts (DET-01)", () => {
    const { dispatch, events } = makeDispatch();
    const t = makeTerminal();
    const disposable = createShellIntegrationDetector().start(dispatch);

    const t0 = Date.now();
    fireStart(t, "claude", 2);
    const elapsed = Date.now() - t0;

    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
    expect(elapsed).toBeLessThan(500);
    disposable.dispose();
  });

  it("normalizes Low-confidence commandLine via ANSI strip (DET-09)", () => {
    const { dispatch, events } = makeDispatch();
    const t = makeTerminal();
    const disposable = createShellIntegrationDetector().start(dispatch);
    fireStart(t, "\x1b[1;32m❯\x1b[0m claude --print hi", 0);
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ type: "agent-started", agent: "claude" });
    disposable.dispose();
  });

  it.each(LOW_CONFIDENCE_FIXTURES)(
    "LOW_CONFIDENCE_FIXTURES: $shell — $notes",
    (fixture) => {
      const { dispatch, events } = makeDispatch();
      const t = makeTerminal();
      const disposable = createShellIntegrationDetector().start(dispatch);

      fireStart(t, fixture.raw, 0);

      // Determine whether this fixture should resolve to an agent match.
      // Negative cases have NEGATIVE in their notes.
      const isNegative = (fixture.notes ?? "").startsWith("NEGATIVE");
      if (isNegative) {
        expect(events).toEqual([]);
      } else {
        expect(events.length).toBeGreaterThanOrEqual(1);
        expect(events[0].type).toBe("agent-started");
      }
      disposable.dispose();
    },
  );

  it("subscribes onDidChangeTerminalShellIntegration globally (DET-08)", () => {
    const { dispatch } = makeDispatch();
    expect(vscodeState.onDidChangeSubscribeCount).toBe(0);
    const disposable = createShellIntegrationDetector().start(dispatch);
    expect(vscodeState.onDidChangeSubscribeCount).toBe(1);
    // All 4 global subscriptions registered exactly once.
    expect(vscodeState.onDidStartSubscribeCount).toBe(1);
    expect(vscodeState.onDidEndSubscribeCount).toBe(1);
    expect(vscodeState.onDidCloseSubscribeCount).toBe(1);
    disposable.dispose();
  });

  it("seeds existing terminals with active shell integration (Pitfall 1)", () => {
    const t1 = makeTerminal("t1");
    (t1 as { shellIntegration?: unknown }).shellIntegration = {};
    vscodeState.terminals = [t1];

    const { dispatch, events } = makeDispatch();
    const disposable = createShellIntegrationDetector().start(dispatch);

    fireStart(t1, "claude", 2);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
    disposable.dispose();
  });

  it("starts 2000ms holdoff for terminals without shell integration", () => {
    const t1 = makeTerminal("t1"); // no shellIntegration
    vscodeState.terminals = [t1];

    const setTimeoutSpy = vi.fn(globalThis.setTimeout);
    const clearTimeoutSpy = vi.fn(globalThis.clearTimeout);
    const { dispatch } = makeDispatch();

    const disposable = createShellIntegrationDetector({
      setTimeout: setTimeoutSpy as unknown as typeof globalThis.setTimeout,
      clearTimeout: clearTimeoutSpy as unknown as typeof globalThis.clearTimeout,
    }).start(dispatch);

    // Expect exactly one 2000ms setTimeout call for the holdoff.
    const holdoffCall = setTimeoutSpy.mock.calls.find((c) => c[1] === 2000);
    expect(holdoffCall).toBeDefined();
    disposable.dispose();
  });

  it("cancels holdoff timer when shell integration activates within window (DET-08)", () => {
    const t1 = makeTerminal("t1"); // no shellIntegration
    vscodeState.terminals = [t1];

    const setTimeoutSpy = vi.fn(globalThis.setTimeout);
    const clearTimeoutSpy = vi.fn(globalThis.clearTimeout);
    const { dispatch } = makeDispatch();

    const disposable = createShellIntegrationDetector({
      setTimeout: setTimeoutSpy as unknown as typeof globalThis.setTimeout,
      clearTimeout: clearTimeoutSpy as unknown as typeof globalThis.clearTimeout,
    }).start(dispatch);

    // Advance 1000ms within holdoff window.
    vi.advanceTimersByTime(1000);
    // Fire onDidChangeTerminalShellIntegration — integration active.
    vscodeState.changeCb?.({ terminal: t1, shellIntegration: {} });
    // clearTimeout must have been called (the holdoff timer handle).
    expect(clearTimeoutSpy).toHaveBeenCalled();
    disposable.dispose();
  });

  it("starts 30s grace on agent-end; dispatches agent-ended only after grace expires", () => {
    const { dispatch, events } = makeDispatch();
    const t = makeTerminal();
    const disposable = createShellIntegrationDetector().start(dispatch);

    fireStart(t, "claude", 2);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
    events.length = 0;

    fireEnd(t, "claude", 2);
    // No agent-ended yet — grace holding.
    expect(events).toEqual([]);

    vi.advanceTimersByTime(29_999);
    expect(events).toEqual([]);

    vi.advanceTimersByTime(2);
    expect(events).toEqual([{ type: "agent-ended", agent: "claude" }]);

    disposable.dispose();
  });

  it("cancels pending grace timer when same-terminal agent-started fires inside grace (Pitfall 2)", () => {
    const { dispatch, events } = makeDispatch();
    const t = makeTerminal();
    const disposable = createShellIntegrationDetector().start(dispatch);

    fireStart(t, "claude", 2);
    fireEnd(t, "claude", 2);
    vi.advanceTimersByTime(10_000); // inside grace
    fireStart(t, "claude", 2); // restart cancels grace
    vi.advanceTimersByTime(25_000); // would have fired at 30s from first end

    // Only ONE agent-started, zero agent-ended.
    const starts = events.filter((e) => e.type === "agent-started");
    const ends = events.filter((e) => e.type === "agent-ended");
    expect(starts.length).toBe(1);
    expect(ends.length).toBe(0);

    disposable.dispose();
  });

  it("two parallel claude sessions in two terminals tracked independently (DET-04)", () => {
    const { dispatch, events } = makeDispatch();
    const t1 = makeTerminal("t1");
    const t2 = makeTerminal("t2");
    const disposable = createShellIntegrationDetector().start(dispatch);

    fireStart(t1, "claude", 2);
    fireStart(t2, "claude", 2);

    // Aggregate 0→N transition fires a single agent-started.
    // (Second start does not re-dispatch because same agent label and active already.)
    const starts = events.filter((e) => e.type === "agent-started");
    expect(starts.length).toBe(1);

    fireEnd(t1, "claude", 2);
    vi.advanceTimersByTime(31_000); // t1 grace fully elapsed

    // t2 still active → NO agent-ended yet.
    expect(events.filter((e) => e.type === "agent-ended")).toEqual([]);

    fireEnd(t2, "claude", 2);
    vi.advanceTimersByTime(31_000);

    // Now all sessions elapsed — agent-ended fires.
    expect(events.filter((e) => e.type === "agent-ended")).toEqual([
      { type: "agent-ended", agent: "claude" },
    ]);

    disposable.dispose();
  });

  it("onDidCloseTerminal deletes session immediately, no grace (Pitfall 3)", () => {
    const { dispatch, events } = makeDispatch();
    const t = makeTerminal();
    const disposable = createShellIntegrationDetector().start(dispatch);

    fireStart(t, "claude", 2);
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
    events.length = 0;

    vscodeState.closeCb?.(t);
    // No time advance — agent-ended must have fired synchronously.
    expect(events).toEqual([{ type: "agent-ended", agent: "claude" }]);

    disposable.dispose();
  });

  it("dispose disposes all 4 subscriptions and clears all timers", () => {
    const t1 = makeTerminal("t1"); // no integration → holdoff timer
    vscodeState.terminals = [t1];

    const clearTimeoutSpy = vi.fn(globalThis.clearTimeout);
    const { dispatch } = makeDispatch();

    const disposable = createShellIntegrationDetector({
      clearTimeout: clearTimeoutSpy as unknown as typeof globalThis.clearTimeout,
    }).start(dispatch);

    // Create a grace timer too.
    const t2 = makeTerminal("t2");
    fireStart(t2, "claude", 2);
    fireEnd(t2, "claude", 2);

    clearTimeoutSpy.mockClear();
    disposable.dispose();

    // All 4 subscriptions disposed.
    expect(vscodeState.startDispose).toHaveBeenCalledTimes(1);
    expect(vscodeState.endDispose).toHaveBeenCalledTimes(1);
    expect(vscodeState.changeDispose).toHaveBeenCalledTimes(1);
    expect(vscodeState.closeDispose).toHaveBeenCalledTimes(1);

    // Timers cleared (holdoff + grace = at least 2).
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("agent label tracks session by highest lastActivityAt (aggregate label change)", () => {
    let fakeNow = 1_000_000;
    const { dispatch, events } = makeDispatch();
    const t1 = makeTerminal("t1");
    const t2 = makeTerminal("t2");
    const disposable = createShellIntegrationDetector({
      now: () => fakeNow,
    }).start(dispatch);

    fireStart(t1, "claude", 2);
    fakeNow += 1;
    fireStart(t2, "aider", 2);

    // First dispatch: claude. Second: aider (label change because newer activity).
    const starts = events.filter((e) => e.type === "agent-started");
    expect(starts).toEqual([
      { type: "agent-started", agent: "claude" },
      { type: "agent-started", agent: "aider" },
    ]);

    disposable.dispose();
  });
});
