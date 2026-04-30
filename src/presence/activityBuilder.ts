/**
 * Phase-4 pure-core activity builder (plan 04-04).
 *
 * The glue that binds packLoader + animator + templater + privacy + Phase-1
 * RPC. Consumers (plan 04-08 extension wiring) pass in callbacks for:
 *   - getState / getConfig / getPack (live-reread per tick, D-24)
 *   - onSet(payload) / onClear() — Phase-1 RPC surface
 *   - getIgnoreContext — populated by the vscode.git adapter (04-07)
 *
 * Implements:
 *   - formatElapsed (Discord short form: "45s" / "20m" / "2h 15m")
 *   - buildTokens (State + config → TemplateTokens w/ privacy redaction)
 *   - buildPayload (rendered text + State → SetActivity; Discord-safe details)
 *   - createActivityBuilder: wraps createAnimator, enforces
 *       - D-14 ignore-match = clear-once-stay-silent
 *       - D-20 idleBehavior='clear' = clear-once-stay-silent
 *       - D-24 live config reread per tick
 *
 * PURE-CORE: no vscode import. All side effects (RPC, git API) are injected
 * by the extension wiring via the callbacks in ActivityBuilderOpts.
 *
 * Threats mitigated:
 *   - T-04-10 (RPC thrash on idle flap): stateful lastWasCleared flag fires
 *     onClear exactly once per ignore/idle entry; resumes normal pipeline only
 *     after first non-match tick.
 *   - T-04-11 (workspace disclosure): delegates to redact() from privacy.ts.
 */

import type { SetActivity } from "@xhayper/discord-rpc";
import type { State } from "../state/types";
import type { AgentModeConfig } from "../config";
import type { Pack } from "./types";
import {
  createAnimator,
  realAnimatorDeps,
  type AnimatorContext,
  type AnimatorDeps,
} from "./animator";
import type { TemplateTokens } from "./templater";
import { evaluateIgnore, redact, type IgnoreContext } from "../privacy";

const FALLBACK_DETAILS = "building, afk";

/**
 * Generic Discord asset key shown when no agent is active OR when the active
 * agent has no per-provider asset uploaded yet.
 */
const FALLBACK_LARGE_KEY = "agent-mode-large";

/**
 * Maps detected agent names → Discord Dev Portal art-asset keys (SEED-002).
 *
 * Built-in agents emit lowercase strings (see src/detectors/regex.ts). Custom
 * agents added via `agentMode.detect.customPatterns` fall back to the generic
 * key. Per-key uploads are managed at https://discord.com/developers/applications
 * → Rich Presence → Art Assets and propagate within ~30 seconds of save —
 * adding new icons does NOT require a code change here unless the agent name
 * is new to the detector regex set.
 */
const AGENT_ICON_KEYS: Record<string, string> = {
  claude: "claude-icon",
  codex: "codex-icon",
  gemini: "gemini-icon",
  aider: "aider-icon",
  opencode: "opencode-icon",
};

function resolveLargeImageKey(agent: string): string {
  if (!agent) return FALLBACK_LARGE_KEY;
  return AGENT_ICON_KEYS[agent.toLowerCase()] ?? FALLBACK_LARGE_KEY;
}

/**
 * Discord-convention short-form elapsed formatter:
 *   0     → "0s"
 *   45_000 → "45s"
 *   60_000 → "1m"
 *   20m    → "20m"
 *   1h     → "1h 0m"
 *   2h 15m → "2h 15m"
 *
 * Guards NaN / undefined / negative / Infinity → "0s".
 */
export function formatElapsed(ms: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "0s";
  const totalS = Math.floor(ms / 1000);
  if (totalS < 60) return `${totalS}s`;
  const totalM = Math.floor(totalS / 60);
  if (totalM < 60) return `${totalM}m`;
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return `${h}h ${m}m`;
}

/** Extract final path segment (workspace basename). */
function workspaceBasename(absPath: string): string {
  const parts = absPath.split(/[\\/]/).filter((s) => s.length > 0);
  return parts.length > 0 ? parts[parts.length - 1] : absPath;
}

/**
 * Build TemplateTokens from State + config, applying per-field privacy
 * redaction. For workspace:
 *   - "show" → basename (user-visible repo name, never absolute path)
 *   - "hide" → ""
 *   - "hash" → 6-hex SHA-1 of the full absolute path (determinism matches
 *     plan 04-07's normalizeForHash contract)
 */
export function buildTokens(
  state: State,
  cfg: AgentModeConfig,
  now: Date,
): TemplateTokens {
  const elapsedMs = state.startTimestamp ? now.getTime() - state.startTimestamp : 0;
  const workspaceRaw = state.workspace ?? "";
  let workspace = "";
  if (workspaceRaw) {
    const redacted = redact("workspace", workspaceRaw, cfg.privacy.workspaceName);
    workspace = cfg.privacy.workspaceName === "show"
      ? workspaceBasename(redacted)
      : redacted;
  }
  const filenameField = "filename" in state ? (state.filename ?? "") : "";
  const filename = redact("filename", filenameField, cfg.privacy.filename);
  const branchField = state.branch ?? "";
  const branch = redact("branch", branchField, cfg.privacy.gitBranch);
  const language = "language" in state ? (state.language ?? "") : "";
  const agent = state.kind === "AGENT_ACTIVE" ? (state.agent ?? "") : "";
  return {
    workspace,
    filename,
    language,
    branch,
    agent,
    elapsed: formatElapsed(elapsedMs),
  };
}

/**
 * Assemble the SetActivity payload. v0.1 emits a single `details` field + the
 * state.startTimestamp — no secondary `state` string. Discord requires
 * non-empty details, so an empty rendered string falls back to "building, afk"
 * (the phase's canonical copy line).
 */
export function buildPayload(renderedText: string, state: State): SetActivity {
  const agent = state.kind === "AGENT_ACTIVE" ? (state.agent ?? "") : "";
  const largeImageKey = resolveLargeImageKey(agent);
  const largeImageText = agent ? `${agent} agent active` : "Agent Mode";
  return {
    details: renderedText.length > 0 ? renderedText : FALLBACK_DETAILS,
    startTimestamp: state.startTimestamp,
    largeImageKey,
    largeImageText,
  };
}

// --- Factory ----------------------------------------------------------------

export interface ActivityBuilderOpts {
  getState: () => State;
  getConfig: () => AgentModeConfig;
  getPack: () => Pack;
  /** Called when the extension should send a SetActivity payload. */
  onSet: (payload: SetActivity) => void;
  /** Called when the extension should clear activity (D-14 / D-20). */
  onClear: () => void;
  /** Resolves git ignore context; injected because the vscode.git adapter lives outside pure-core. */
  getIgnoreContext: () => IgnoreContext;
  log?: (msg: string) => void;
}

export type ActivityBuilderDeps = AnimatorDeps;

/**
 * Factory — wires the animator's onRender into the ignore-gate / idle-gate /
 * onSet pipeline.
 *
 * The animator owns the 20s rotation + 2s frame clocks, weighted pool picks,
 * Fisher-Yates no-repeat, blank-skip with hard fallback. This layer decides
 * what to do with each rendered frame:
 *
 *   1. If evaluateIgnore() matches: onClear exactly once, stay silent.
 *   2. If state=IDLE && idleBehavior=clear: onClear exactly once, stay silent.
 *   3. Otherwise: reset lastWasCleared + onSet(buildPayload(text, state)).
 */
export function createActivityBuilder(
  opts: ActivityBuilderOpts,
  depsOverride: Partial<ActivityBuilderDeps> = {},
): { start(): void; stop(): void; forceTick(): void } {
  const deps: ActivityBuilderDeps = { ...realAnimatorDeps, ...depsOverride };
  const { getState, getConfig, getPack, onSet, onClear, getIgnoreContext, log } = opts;

  let lastWasCleared = false;

  const animator = createAnimator(
    {
      getPack,
      getConfig,
      getContext: (): AnimatorContext => {
        const state = getState();
        const cfg = getConfig();
        return {
          kind: state.kind,
          agent: state.kind === "AGENT_ACTIVE" ? state.agent : undefined,
          tokens: buildTokens(state, cfg, deps.now()),
        };
      },
      onRender: (text: string) => {
        const state = getState();
        const cfg = getConfig();

        // D-14: ignore-match = clear-once, stay silent.
        const ignoreCtx = getIgnoreContext();
        if (evaluateIgnore(cfg.ignore, ignoreCtx, log)) {
          if (!lastWasCleared) {
            onClear();
            lastWasCleared = true;
          }
          return;
        }

        // D-20: idleBehavior='clear' = clear-once, stay silent.
        if (state.kind === "IDLE" && cfg.idleBehavior === "clear") {
          if (!lastWasCleared) {
            onClear();
            lastWasCleared = true;
          }
          return;
        }

        // Normal pipeline — reset the clear-once latch and emit SetActivity.
        lastWasCleared = false;
        onSet(buildPayload(text, state));
      },
    },
    deps,
  );

  return {
    start: () => animator.start(),
    stop: () => animator.stop(),
    forceTick: () => animator.forceTick(),
  };
}
