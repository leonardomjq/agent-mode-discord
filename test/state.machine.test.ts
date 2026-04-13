import { describe, it, expect } from "vitest";
import { reduce, initialState } from "../src/state/machine";
import type { State, Event } from "../src/state/types";

describe("state machine reducer", () => {
  it("editor-changed from IDLE transitions to CODING and resets startTimestamp (STATE-01)", () => {
    const prev: State = { kind: "IDLE", startTimestamp: 100 };
    const next = reduce(prev, { type: "editor-changed", filename: "a.ts", language: "typescript" }, () => 200);
    expect(next.kind).toBe("CODING");
    if (next.kind !== "CODING") throw new Error("type narrowing");
    expect(next.filename).toBe("a.ts");
    expect(next.language).toBe("typescript");
    expect(next.startTimestamp).toBe(200);
  });

  it("editor-changed from CODING updates filename/language without resetting startTimestamp (STATE-05 invariant)", () => {
    const prev: State = { kind: "CODING", startTimestamp: 100, filename: "a.ts", language: "typescript" };
    const next = reduce(prev, { type: "editor-changed", filename: "b.ts", language: "javascript" }, () => 300);
    expect(next.kind).toBe("CODING");
    if (next.kind !== "CODING") throw new Error("type narrowing");
    expect(next.filename).toBe("b.ts");
    expect(next.language).toBe("javascript");
    expect(next.startTimestamp).toBe(100); // NOT 300 — STATE-05 invariant
  });

  it("idle-tick from CODING transitions to IDLE and resets startTimestamp (STATE-02)", () => {
    const prev: State = { kind: "CODING", startTimestamp: 100, filename: "a.ts", language: "typescript" };
    const next = reduce(prev, { type: "idle-tick" }, () => 999);
    expect(next.kind).toBe("IDLE");
    expect(next.startTimestamp).toBe(999);
    // IdleState does not carry filename — verify absent
    expect("filename" in next).toBe(false);
  });

  it("idle-tick from IDLE is a no-op", () => {
    const prev: State = { kind: "IDLE", startTimestamp: 100 };
    const next = reduce(prev, { type: "idle-tick" }, () => 999);
    expect(next).toBe(prev); // reference equality
  });

  it("agent-started transitions to AGENT_ACTIVE regardless of prior kind (STATE-03 priority)", () => {
    const nowFn = () => 500;
    const fromIdle = reduce({ kind: "IDLE", startTimestamp: 100 }, { type: "agent-started", agent: "claude" }, nowFn);
    expect(fromIdle.kind).toBe("AGENT_ACTIVE");
    if (fromIdle.kind !== "AGENT_ACTIVE") throw new Error("type narrowing");
    expect(fromIdle.agent).toBe("claude");
    expect(fromIdle.startTimestamp).toBe(500);

    const fromCoding = reduce({ kind: "CODING", startTimestamp: 100, filename: "a.ts", language: "typescript" }, { type: "agent-started", agent: "claude" }, nowFn);
    expect(fromCoding.kind).toBe("AGENT_ACTIVE");
    if (fromCoding.kind !== "AGENT_ACTIVE") throw new Error("type narrowing");
    expect(fromCoding.startTimestamp).toBe(500);

    const already: State = { kind: "AGENT_ACTIVE", agent: "claude", startTimestamp: 100 };
    const sameAgent = reduce(already, { type: "agent-started", agent: "claude" }, nowFn);
    expect(sameAgent).toBe(already); // reference equality — no change for same agent
  });

  it("agent-ended from AGENT_ACTIVE transitions to IDLE (STATE-04)", () => {
    const prev: State = { kind: "AGENT_ACTIVE", agent: "claude", startTimestamp: 100 };
    const next = reduce(prev, { type: "agent-ended", agent: "claude" }, () => 500);
    expect(next.kind).toBe("IDLE");
    expect(next.startTimestamp).toBe(500);

    const fromIdle: State = { kind: "IDLE", startTimestamp: 100 };
    expect(reduce(fromIdle, { type: "agent-ended", agent: "claude" }, () => 500)).toBe(fromIdle);
  });

  it("branch-changed preserves kind and startTimestamp (STATE-05 invariant across branch churn)", () => {
    const codingPrev: State = { kind: "CODING", startTimestamp: 100, filename: "a.ts", language: "typescript", branch: "main" };
    const codingNext = reduce(codingPrev, { type: "branch-changed", branch: "feature/x" }, () => 999);
    expect(codingNext.kind).toBe("CODING");
    if (codingNext.kind !== "CODING") throw new Error("type narrowing");
    expect(codingNext.branch).toBe("feature/x");
    expect(codingNext.startTimestamp).toBe(100); // invariant

    const idlePrev: State = { kind: "IDLE", startTimestamp: 100, branch: "main" };
    const idleNext = reduce(idlePrev, { type: "branch-changed", branch: undefined }, () => 999);
    expect(idleNext.kind).toBe("IDLE");
    expect(idleNext.branch).toBeUndefined();
    expect(idleNext.startTimestamp).toBe(100);
  });

  it("unknown event returns state unchanged (future-proof)", () => {
    const prev: State = { kind: "CODING", startTimestamp: 100, filename: "a.ts", language: "typescript" };
    const unknown = { type: "future-event" } as unknown as Event;
    expect(reduce(prev, unknown, () => 999)).toBe(prev);
  });

  // Flipped to passing by plan 02-02
  it.todo("buildContext returns immutable snapshot covering all State fields (D-06)");
});
