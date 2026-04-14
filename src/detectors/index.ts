import * as vscode from "vscode";
import type { Event } from "../state/types";
import { createShellIntegrationDetector } from "./shellIntegration";
import { createSessionFilesDetector } from "./sessionFiles";
import { createPollingDetector } from "./polling";

/**
 * Phase 3 Wave 1 — detectors orchestrator (DET-04 + DET-07).
 *
 * Composes tier-2 shellIntegration, tier-3 sessionFiles, tier-4 polling child
 * detectors into a single deterministic-precedence pipeline that dispatches
 * exactly one `agent-started`/`agent-ended` sequence to the parent driver.
 *
 * Tier precedence (highest fidelity first):
 *   tier 1 — companion  (RESERVED for Phase 5; not wired here)
 *   tier 2 — shellIntegration
 *   tier 3 — sessionFiles
 *   tier 4 — polling
 *
 * Aggregate rules (DET-04 across tiers):
 *   - agent-started fires when the "any tier active" boolean flips false→true.
 *   - agent-ended fires when "any tier active" flips true→false.
 *   - When the highest-tier active source's agent label changes (or a higher
 *     tier activates and supersedes a lower tier's label), a NEW agent-started
 *     fires with the new label (no agent-ended in between — the reducer treats
 *     this as an intra-AGENT_ACTIVE field update per 02-01-SUMMARY).
 *
 * DET-07 structural suppression:
 *   Lower-tier signals are still recorded in tierStates but do not influence
 *   the dispatched agent label when a higher tier is active. The higher tier
 *   "wins" by virtue of recomputeAndDispatch iterating [2, 3, 4] and breaking
 *   on the first active tier.
 *
 * D-18: every tier-state mutation + dispatch wrapped in try/catch.
 */

type TierNumber = 2 | 3 | 4;

interface TierState {
  active: boolean;
  agent: string | undefined;
  lastActivityAt: number;
}

export interface DetectorsOrchestratorOptions {
  /** Phase 4 wires detect.customPatterns. v0.1 default = undefined (built-ins only). */
  customPatterns?: Record<string, string[]>;
  /** Phase 4 wires detect.polling.terminalNamePatterns. v0.1 default = empty (no polling). */
  pollingPatterns?: string[];
  /** Phase 4 wires detect.sessionFileStalenessSeconds. v0.1 default = 60. */
  sessionFileStalenessSeconds?: number;
  /** Override for tests — inject child detector factories. */
  factories?: {
    shellIntegration?: typeof createShellIntegrationDetector;
    sessionFiles?: typeof createSessionFilesDetector;
    polling?: typeof createPollingDetector;
  };
}

/**
 * Start all tier-2..4 detectors, route each into a tier-aware intercept, and
 * dispatch the aggregated result into the parent driver's dispatch fn.
 */
export function createDetectorsOrchestrator(
  dispatch: (event: Event) => void,
  opts: DetectorsOrchestratorOptions = {},
): vscode.Disposable {
  const tierStates = new Map<TierNumber, TierState>();
  let aggregateActive = false;
  let lastDispatchedAgent: string | undefined;

  const safeDispatch = (event: Event): void => {
    try { dispatch(event); } catch { /* silent D-18 */ }
  };

  const recomputeAndDispatch = (): void => {
    try {
      // Find highest-tier active state — iterate [2, 3, 4] and break on first hit.
      let chosen: { tier: TierNumber; agent: string; lastActivityAt: number } | undefined;
      for (const tier of [2, 3, 4] as const) {
        const s = tierStates.get(tier);
        if (s?.active && s.agent) {
          chosen = { tier, agent: s.agent, lastActivityAt: s.lastActivityAt };
          break;
        }
      }

      const wasActive = aggregateActive;
      const isActive = chosen !== undefined;
      aggregateActive = isActive;

      if (!wasActive && isActive && chosen) {
        safeDispatch({ type: "agent-started", agent: chosen.agent });
        lastDispatchedAgent = chosen.agent;
      } else if (wasActive && !isActive && lastDispatchedAgent) {
        safeDispatch({ type: "agent-ended", agent: lastDispatchedAgent });
        lastDispatchedAgent = undefined;
      } else if (isActive && chosen && chosen.agent !== lastDispatchedAgent) {
        // Highest-tier source changed agent label — dispatch new agent-started.
        // The reducer treats this as an intra-AGENT_ACTIVE field update
        // (startTimestamp preserved per 02-01-SUMMARY).
        safeDispatch({ type: "agent-started", agent: chosen.agent });
        lastDispatchedAgent = chosen.agent;
      }
    } catch { /* silent D-18 */ }
  };

  const makeTierDispatch = (tier: TierNumber): ((event: Event) => void) => {
    return (event: Event): void => {
      try {
        if (event.type === "agent-started") {
          tierStates.set(tier, {
            active: true,
            agent: event.agent,
            lastActivityAt: Date.now(),
          });
          recomputeAndDispatch();
        } else if (event.type === "agent-ended") {
          tierStates.set(tier, {
            active: false,
            agent: undefined,
            lastActivityAt: 0,
          });
          recomputeAndDispatch();
        } else {
          // Defensive forwarding: detectors should never emit other event types,
          // but if one does, forward unchanged so the parent driver sees it.
          safeDispatch(event);
        }
      } catch { /* silent D-18 */ }
    };
  };

  const factories = opts.factories ?? {};
  const shellIntegration = (factories.shellIntegration ?? createShellIntegrationDetector)({
    customPatterns: opts.customPatterns,
  });
  const sessionFiles = (factories.sessionFiles ?? createSessionFilesDetector)({
    stalenessSeconds: opts.sessionFileStalenessSeconds,
  });
  const polling = (factories.polling ?? createPollingDetector)({
    patterns: opts.pollingPatterns,
  });

  const childDisposables: vscode.Disposable[] = [];
  try { childDisposables.push(shellIntegration.start(makeTierDispatch(2))); } catch { /* silent */ }
  try { childDisposables.push(sessionFiles.start(makeTierDispatch(3))); } catch { /* silent */ }
  try { childDisposables.push(polling.start(makeTierDispatch(4))); } catch { /* silent */ }

  return {
    dispose: (): void => {
      for (const d of childDisposables) {
        try { d.dispose(); } catch { /* silent D-18 */ }
      }
    },
  };
}
