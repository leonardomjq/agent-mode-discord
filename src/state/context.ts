/**
 * Phase 2 immutable snapshot builder.
 *
 * PURE-CORE: no vscode import. Called by driver (plan 02-07) on state change + reconnect replay.
 * D-06: buildContext(state, snapshots): PresenceContext — output feeds Phase 4 activityBuilder.
 *
 * Overlay rule: snapshot fields win over state fields (detector freshness).
 */

import type { State, DetectorSnapshots, PresenceContext } from "./types";

/**
 * Build an immutable presence context from reducer state + fresh detector snapshots.
 *
 * D-06: pure function. Called by driver (plan 02-07) on every state change and on
 * reconnect replay (RPC-04). Output feeds the Phase 4 activityBuilder.
 *
 * Overlay rule: snapshot fields win over state fields when BOTH present (detector
 * observations are fresher than reducer's last-known value). Missing snapshot
 * fields fall through to state fields. Missing in both → undefined.
 */
export function buildContext(
  state: State,
  snapshots: DetectorSnapshots = {},
): PresenceContext {
  return Object.freeze({
    kind: state.kind,
    agent: state.kind === "AGENT_ACTIVE" ? state.agent : undefined,
    filename: "filename" in state ? state.filename : undefined,
    language: "language" in state ? state.language : undefined,
    branch: snapshots.branch ?? state.branch,
    workspace: snapshots.workspace ?? state.workspace,
    startTimestamp: state.startTimestamp,
  });
}
