/**
 * Phase 2 state machine type contracts.
 *
 * PURE-CORE: no vscode import (runtime or type). Enforced by scripts/check-api-surface.mjs (D-16).
 *
 * Downstream consumers:
 * - src/state/machine.ts — reduce(state, event): State
 * - src/state/context.ts — buildContext(state, snapshots): PresenceContext (plan 02-02)
 * - src/detectors/editor.ts — produces editor-changed / editor-closed events (plan 02-06)
 * - src/detectors/git.ts — produces branch-changed events (plan 02-07)
 * - src/driver.ts or src/extension.ts — owns State ownership + dispatch (plan 02-07)
 *
 * Phase 3 will add: agent-started / agent-ended events (reducer already handles them).
 * Phase 4 will add: NO new types here — config + privacy + templating live in other modules.
 */

// --- State discriminated union (D-02) ---

/** AGENT_ACTIVE: a tracked agent session is running — highest priority (STATE-03). */
export type AgentActiveState = {
  kind: "AGENT_ACTIVE";
  agent: string; // required — identifies which agent is active (STATE-03)
  startTimestamp: number; // resets on AGENT_ACTIVE entry (STATE-05)
  filename?: string;
  language?: string;
  branch?: string;
  workspace?: string;
};

/** CODING: text editor focused, no agent active (STATE-01). */
export type CodingState = {
  kind: "CODING";
  startTimestamp: number; // resets on IDLE→CODING transition (STATE-01, STATE-05)
  filename?: string;
  language?: string;
  branch?: string;
  workspace?: string;
};

/** IDLE: no focused editor, no agent, or idle timeout elapsed (STATE-02). */
export type IdleState = {
  kind: "IDLE";
  startTimestamp: number; // resets on transition to IDLE (STATE-02, STATE-05)
  // No filename / language / agent — idle means no active context (D-02)
  branch?: string;
  workspace?: string;
};

/** State — discriminated union keyed by `kind` (D-02). */
export type State = AgentActiveState | CodingState | IdleState;

// --- Event discriminated union (D-03) ---

/** Event — exactly 6 variants covering all Phase 2 + Phase 3 transitions (D-03). */
export type Event =
  | { type: "editor-changed"; filename: string; language: string } // STATE-01
  | { type: "editor-closed" }                                       // no-op (idle-tick drives IDLE)
  | { type: "agent-started"; agent: string }                        // STATE-03
  | { type: "agent-ended"; agent: string }                          // STATE-04
  | { type: "branch-changed"; branch: string | undefined }          // STATE-05 field update
  | { type: "idle-tick" };                                          // STATE-02

// --- Snapshot types for plan 02-02 (D-06) ---

/** DetectorSnapshots — detector-provided fields not stored in State (for 02-02 context builder). */
export type DetectorSnapshots = {
  workspace?: string;
  branch?: string;
};

/** PresenceContext — immutable snapshot the activity builder consumes (plan 02-02, D-06). */
export type PresenceContext = {
  kind: State["kind"];
  agent?: string;
  filename?: string;
  language?: string;
  branch?: string;
  workspace?: string;
  startTimestamp: number;
};
