/**
 * Phase 3 Wave 1 — detectors orchestrator tests (plan 03-04).
 *
 * Covers DET-07 (deterministic precedence: companion > shell > sessionFiles >
 * polling; lower tiers suppressed by higher-tier winners) and DET-04 aggregation
 * (AGENT_ACTIVE while ANY tier has signal).
 *
 * Uses opts.factories injection to replace the real child detectors with fakes
 * — no vi.mock needed for vscode or the child modules.
 */
import { describe, it, expect, vi } from "vitest";
import type { Disposable } from "vscode";
import { createDetectorsOrchestrator } from "../src/detectors";
import type { Event } from "../src/state/types";

vi.mock("vscode", () => ({}));

type TierNumber = 2 | 3 | 4;

interface FakeDetectorHandle {
  factory: (opts?: unknown) => {
    tier: TierNumber;
    start: (dispatch: (ev: Event) => void) => Disposable;
  };
  emit: (ev: Event) => void;
  disposeSpy: ReturnType<typeof vi.fn>;
  startSpy: ReturnType<typeof vi.fn>;
}

function makeFakeDetector(tier: TierNumber): FakeDetectorHandle {
  let captured: ((ev: Event) => void) | undefined;
  const disposeSpy = vi.fn();
  const startSpy = vi.fn((d: (ev: Event) => void) => {
    captured = d;
    return { dispose: disposeSpy };
  });
  const detector = {
    tier,
    start: startSpy,
  };
  return {
    factory: () => detector,
    emit: (ev: Event) => {
      if (!captured) throw new Error(`tier ${tier} detector not started yet`);
      captured(ev);
    },
    disposeSpy,
    startSpy,
  };
}

function setup() {
  const events: Event[] = [];
  const dispatch = vi.fn((ev: Event) => {
    events.push(ev);
  });
  const t2 = makeFakeDetector(2);
  const t3 = makeFakeDetector(3);
  const t4 = makeFakeDetector(4);
  const orchestrator = createDetectorsOrchestrator(dispatch, {
    factories: {
      // The orchestrator passes options to the factory; our fakes ignore them.
      shellIntegration: t2.factory as never,
      sessionFiles: t3.factory as never,
      polling: t4.factory as never,
    },
  });
  return { orchestrator, dispatch, events, t2, t3, t4 };
}

describe("detectors orchestrator", () => {
  it("starts all detectors in tier order on start()", () => {
    const { t2, t3, t4 } = setup();
    expect(t2.startSpy).toHaveBeenCalledTimes(1);
    expect(t3.startSpy).toHaveBeenCalledTimes(1);
    expect(t4.startSpy).toHaveBeenCalledTimes(1);
  });

  it("higher tier signal suppresses lower tier signal for same terminal at debug-log only (DET-07)", () => {
    const { events, t2, t3 } = setup();
    // tier3 emits agent-started claude → orchestrator dispatches agent-started claude
    t3.emit({ type: "agent-started", agent: "claude" });
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    // tier2 emits agent-started claude → orchestrator dispatches NOTHING (already active, label unchanged)
    t2.emit({ type: "agent-started", agent: "claude" });
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    // tier3 emits agent-ended → orchestrator dispatches NOTHING (tier2 still active)
    t3.emit({ type: "agent-ended", agent: "claude" });
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    // tier2 emits agent-ended → orchestrator dispatches agent-ended
    t2.emit({ type: "agent-ended", agent: "claude" });
    expect(events).toEqual([
      { type: "agent-started", agent: "claude" },
      { type: "agent-ended", agent: "claude" },
    ]);
  });

  it("agent label = highest-tier active session", () => {
    const { events, t2, t3 } = setup();
    // tier3 emits aider first
    t3.emit({ type: "agent-started", agent: "aider" });
    expect(events).toEqual([{ type: "agent-started", agent: "aider" }]);

    // tier2 emits claude — higher tier supersedes the label
    t2.emit({ type: "agent-started", agent: "claude" });
    expect(events).toEqual([
      { type: "agent-started", agent: "aider" },
      { type: "agent-started", agent: "claude" },
    ]);
  });

  it("AGENT_ACTIVE while ANY tier has signal (DET-04 cross-tier aggregation)", () => {
    const { events, t2, t3 } = setup();
    // tier2 starts
    t2.emit({ type: "agent-started", agent: "claude" });
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);

    // tier3 starts
    t3.emit({ type: "agent-started", agent: "claude" });
    expect(events).toHaveLength(1); // already active, no new dispatch

    // tier2 ends — tier3 still active, NO agent-ended
    t2.emit({ type: "agent-ended", agent: "claude" });
    expect(events).toHaveLength(1);

    // tier3 ends — now agent-ended fires
    t3.emit({ type: "agent-ended", agent: "claude" });
    expect(events).toEqual([
      { type: "agent-started", agent: "claude" },
      { type: "agent-ended", agent: "claude" },
    ]);
  });

  it("dispatches agent-started exactly once on first session (idempotent)", () => {
    const { events, t2 } = setup();
    t2.emit({ type: "agent-started", agent: "claude" });
    t2.emit({ type: "agent-started", agent: "claude" }); // same tier, same agent — no new dispatch
    expect(events).toEqual([{ type: "agent-started", agent: "claude" }]);
  });

  it("dispatches agent-ended exactly once when last session ends (idempotent)", () => {
    const { events, t2 } = setup();
    t2.emit({ type: "agent-started", agent: "claude" });
    t2.emit({ type: "agent-ended", agent: "claude" });
    t2.emit({ type: "agent-ended", agent: "claude" }); // already inactive, no re-dispatch
    expect(events).toEqual([
      { type: "agent-started", agent: "claude" },
      { type: "agent-ended", agent: "claude" },
    ]);
  });

  it("dispatches agent-started with new agent label when highest-tier session changes agent", () => {
    const { events, t2 } = setup();
    t2.emit({ type: "agent-started", agent: "claude" });
    t2.emit({ type: "agent-started", agent: "aider" }); // same tier, different agent
    expect(events).toEqual([
      { type: "agent-started", agent: "claude" },
      { type: "agent-started", agent: "aider" },
    ]);
  });

  it("disposes all child detectors on dispose", () => {
    const { orchestrator, t2, t3, t4 } = setup();
    orchestrator.dispose();
    expect(t2.disposeSpy).toHaveBeenCalledTimes(1);
    expect(t3.disposeSpy).toHaveBeenCalledTimes(1);
    expect(t4.disposeSpy).toHaveBeenCalledTimes(1);
  });
});
