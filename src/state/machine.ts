/**
 * Phase 2 state reducer.
 *
 * PURE-CORE: no vscode import, no timers, no EventEmitter, no mutation of inputs.
 * reduce(state, event, now?): State is a total function.
 *
 * D-01 pure reducer · D-04 startTimestamp invariant · D-05 idle timer lives in driver.
 * STATE-01 / STATE-02 / STATE-03 / STATE-04 / STATE-05 covered by test/state.machine.test.ts.
 */

import type { State, Event } from "./types";

export function reduce(state: State, event: Event, now: () => number = Date.now): State {
  switch (event.type) {
    case "editor-changed": {
      if (state.kind === "AGENT_ACTIVE") {
        // Same kind: preserve startTimestamp (STATE-05)
        return { ...state, filename: event.filename, language: event.language };
      }
      if (state.kind === "CODING") {
        // Same kind: preserve startTimestamp (STATE-05)
        return { ...state, filename: event.filename, language: event.language };
      }
      // IDLE -> CODING transition (STATE-01): reset startTimestamp
      return {
        kind: "CODING",
        startTimestamp: now(),
        filename: event.filename,
        language: event.language,
        branch: state.branch,
        workspace: state.workspace,
      };
    }
    case "editor-closed":
      // editor-closed alone is a no-op on kind (only idle-tick drives IDLE, per CONTEXT Pitfall 1)
      return state;
    case "idle-tick":
      if (state.kind === "CODING") {
        // CODING -> IDLE transition (STATE-02): reset startTimestamp
        return {
          kind: "IDLE",
          startTimestamp: now(),
          branch: state.branch,
          workspace: state.workspace,
        };
      }
      return state;
    case "agent-started":
      if (state.kind === "AGENT_ACTIVE") {
        // Already active — preserve startTimestamp even if a new agent-started comes in
        // for the same agent, or update agent if different; CONTEXT says "regardless of prior kind"
        // so we only reset timestamp when transitioning INTO AGENT_ACTIVE, not within it.
        return state.agent === event.agent
          ? state
          : { ...state, agent: event.agent };
      }
      // Transition: any kind -> AGENT_ACTIVE (STATE-03 priority): reset startTimestamp
      return {
        kind: "AGENT_ACTIVE",
        agent: event.agent,
        startTimestamp: now(),
        filename: "filename" in state ? state.filename : undefined,
        language: "language" in state ? state.language : undefined,
        branch: state.branch,
        workspace: state.workspace,
      };
    case "agent-ended":
      // Only flip out of AGENT_ACTIVE; driver re-dispatches editor-changed on next tick
      // to restore CODING if an editor is focused (STATE-04).
      if (state.kind !== "AGENT_ACTIVE") return state;
      return {
        kind: "IDLE",
        startTimestamp: now(),
        branch: state.branch,
        workspace: state.workspace,
      };
    case "branch-changed":
      // Same-kind field update — NO startTimestamp reset (STATE-05)
      return { ...state, branch: event.branch };
    default:
      // Unknown event (future Phase 3/4 may add new events that older reducer doesn't handle)
      return state;
  }
}

export function initialState(now: () => number = Date.now): State {
  return { kind: "IDLE", startTimestamp: now() };
}
