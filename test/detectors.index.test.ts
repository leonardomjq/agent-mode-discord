/**
 * Phase 3 Wave 0 stub — detectors orchestrator (src/detectors/index.ts).
 *
 * Covers DET-07 (deterministic precedence: companion > shell > sessionFiles >
 * polling; lower tiers log debug only when a higher tier already signals) and
 * DET-04 aggregation (AGENT_ACTIVE while ANY session has signalTier > 0 or is
 * in grace).
 *
 * Wave 1 (plan 03-04) flips each todo into a vitest case that instantiates
 * the orchestrator with fake child detectors, drives tier-labeled dispatch
 * events, and asserts correct aggregation + agent-label resolution.
 */
import { describe, it } from "vitest";

describe("detectors orchestrator", () => {
  it.todo("starts all detectors in tier order on start()");
  it.todo("higher tier signal suppresses lower tier signal for same terminal at debug-log only (DET-07)");
  it.todo("agent label = highest-tier active session (tie → most recent lastActivityAt)");
  it.todo("AGENT_ACTIVE while ANY session has signalTier > 0 OR is in grace (DET-04 aggregation)");
  it.todo("dispatches agent-started exactly once on first session, agent-ended exactly once on last session end");
  it.todo("dispatches agent-started with new agent label when highest-tier session changes agent");
  it.todo("disposes all child detectors on dispose");
});
