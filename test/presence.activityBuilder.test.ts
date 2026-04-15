/**
 * Phase-4 Wave-0 test stubs for the activity builder (ignore + idle behavior gate).
 *
 * Requirements covered: PRIV-05, CONF-04
 * Decisions covered:   D-14 (clear-once), D-19 (idleBehavior default show), D-20 (clear on first IDLE tick)
 *
 * Wave 1+ plans flip these it.todo entries and wire in `src/presence/activityBuilder`.
 */
import { describe, it } from "vitest";

describe("activityBuilder", () => {
  it.todo("ignore-rule match fires clearActivity(pid) exactly once; subsequent ticks no-op (PRIV-05 / D-14)");
  it.todo("first tick after ignore-rule match clears: resumes pipeline with fresh setActivity");
  it.todo("idleBehavior=clear on IDLE state fires clearActivity(pid) on first IDLE tick, not setActivity (CONF-04 / D-20)");
  it.todo("idleBehavior=show on IDLE state renders IDLE pool message via setActivity (CONF-04 / D-19)");
  it.todo("idleBehavior=clear never disconnects RPC — mgr.stop() NOT called, client stays live (CONF-04 anti-pattern)");
  it.todo("startTimestamp passed through unchanged from state-machine ctx (STATE-05 carry-through)");
  it.todo("pid always equals process.pid in clearActivity calls (RPC-01 carry-through)");
});
