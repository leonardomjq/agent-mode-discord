import { describe, it } from "vitest";

describe("state machine reducer", () => {
  it.todo("editor-changed from IDLE transitions to CODING and resets startTimestamp (STATE-01)");
  it.todo("editor-changed from CODING updates filename/language without resetting startTimestamp (STATE-05 invariant)");
  it.todo("idle-tick from CODING transitions to IDLE and resets startTimestamp (STATE-02)");
  it.todo("idle-tick from IDLE is a no-op");
  it.todo("agent-started transitions to AGENT_ACTIVE regardless of prior kind (STATE-03 priority)");
  it.todo("agent-ended from AGENT_ACTIVE transitions to IDLE (STATE-04)");
  it.todo("branch-changed preserves kind and startTimestamp (STATE-05 invariant across branch churn)");
  it.todo("unknown event returns state unchanged (future-proof)");
  it.todo("buildContext returns immutable snapshot covering all State fields (D-06)");
});
