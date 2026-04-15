/**
 * Phase-4 Wave-0 test stubs for the rotation+frame animator.
 *
 * Requirements covered: PERS-02, PERS-03, PERS-04, PERS-05, CONF-03, PRIV-06
 * Decisions covered:   D-06..D-13, D-24
 *
 * Wave 1+ plans flip these it.todo entries into real tests and wire in
 * `src/presence/animator` + helpers from test/presence/__helpers__.
 */
import { describe, it } from "vitest";

describe("animator", () => {
  it.todo("emits render on construction (tick 0) with weighted pool pick (PERS-02)");
  it.todo("20s rotation timer fires next render with a new pool pick (PERS-02)");
  it.todo("2s frame clock cycles frame index 0→1→2→0 for array messages (PERS-04)");
  it.todo("singleton string messages ignore the frame clock (render stays static)");
  it.todo("animations.enabled=false freezes frame arrays on frame 0 but still rotates every 20s (PERS-05 / D-10)");
  it.todo("Fisher-Yates no-repeat: same pool never emits same message in two consecutive 20s ticks (PERS-03 / D-09)");
  it.todo("no-repeat memory is per-pool: pool switch from _primary to timeOfDay does not falsely match across pools (Pitfall 1)");
  it.todo("weighted pool pick: AGENT_ACTIVE uses 70/20/10 when all pools populated (D-07)");
  it.todo("missing per-agent sub-pool (aider) redistributes weight: 90% _primary / 10% timeOfDay (D-08)");
  it.todo("empty time-of-day pool redistributes weight: 87.5% _primary / 12.5% sub-pool for AGENT_ACTIVE (D-08)");
  it.todo("time-of-day bucket resolves from injected now(): 03:00 → lateNight, 09:00 → morning, 15:00 → afternoon, 21:00 → evening (D-11)");
  it.todo("config re-read every rotation tick: setting animations.enabled=false between ticks applies on next tick (CONF-03 / D-24)");
  it.todo("privacy.filename flip from show→hide applies on next rotation tick, no reload (PRIV-06)");
  it.todo("stop() cancels both timers and stops render dispatch");
  it.todo("per-pool lastPicked persists across AGENT_ACTIVE → IDLE → AGENT_ACTIVE transition (D-04 no-reset, R5 reviewer)");
  it.todo("pool-of-size-1 returns its only member on both consecutive picks without throwing (R5 reviewer edge case)");
  it.todo("adding a new message to a pool between rotations does not break no-repeat invariant (R5 reviewer mid-run mutation)");
});
