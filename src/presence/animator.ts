/**
 * Phase 4 pure-core two-clock animator (04-02).
 *
 * Owns the goblin-pack rendering pipeline:
 *  - Rotation clock (20 s, D-12 injectable): weighted pool pick (D-07) →
 *    Fisher-Yates no-repeat pick (D-09) → blank-skip loop with hard fallback
 *    (Pitfall 2) → onRender dispatch.
 *  - Frame clock (2 s, D-12 injectable): cycles `Message[]` frame sequences
 *    while animations.enabled=true (D-10); no-op for singleton strings or
 *    when animations disabled.
 *
 * Dispatch-only: the animator calls `onRender(text)` and does NOT talk to
 * Discord directly. Config and pack are pulled lazily (D-24) via `getConfig()`
 * and `getPack()` callbacks on every rotation tick — no caching.
 *
 * Pure-core: no vscode import; all side effects (timers, clocks, rand)
 * injected via AnimatorDeps. Mirrors src/detectors/sessionFiles.ts options-bag
 * pattern.
 *
 * Threats mitigated:
 *  - T-04-05 (blank-skip DoS): skip loop capped at MAX_BLANK_ATTEMPTS (10)
 *    then returns hard fallback "building, afk". Pitfall 2 in 04-RESEARCH.md.
 *  - T-04-06 (timer leak): both setInterval handles stored + cleared in stop().
 */

import type { Pack, Message } from "./types";
import { renderTemplate, isBlank, type TemplateTokens } from "./templater";
import type { AgentModeConfig } from "../config";

export type PresenceKind = "AGENT_ACTIVE" | "CODING" | "IDLE";

export interface AnimatorContext {
  kind: PresenceKind;
  /** Only meaningful when kind === "AGENT_ACTIVE"; maps to per-agent sub-pool. */
  agent?: string;
  /** Already-redacted by the privacy layer (activityBuilder owns redaction). */
  tokens: TemplateTokens;
}

export interface AnimatorDeps {
  now: () => Date;
  rand: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (t: unknown) => void;
}

export const realAnimatorDeps: AnimatorDeps = {
  now: () => new Date(),
  rand: () => Math.random(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (t) => clearInterval(t as ReturnType<typeof setInterval>),
};

export interface AnimatorOpts {
  getPack: () => Pack;
  getConfig: () => AgentModeConfig;
  getContext: () => AnimatorContext;
  onRender: (text: string) => void;
}

/** Internal weighted-pool entry consumed by pickWeightedPool. Exported so
 *  tests can exercise the helper directly (Phase-3 precedent: detectors/index
 *  re-exports internals). */
export interface PoolEntry {
  id: string;
  pool: Message[] | undefined;
  w: number;
}

const BLANK_FALLBACK = "building, afk";
const MAX_BLANK_ATTEMPTS = 10;
const ROTATION_MS = 20_000;
const FRAME_MS = 2_000;

/** Time-of-day bucket resolver (D-11). Uses local-time getHours() — DST is
 *  handled transparently by Date. */
export function timeOfDayBucket(
  d: Date,
): "lateNight" | "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  if (h < 6) return "lateNight";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

/**
 * Weighted pool picker with D-08 missing-pool redistribution: invalid entries
 * (undefined or empty pool) are filtered out BEFORE summing weights, so the
 * remaining entries retain their original weights relative to one another —
 * which is equivalent to redistributing the missing weight proportionally to
 * all survivors. Examples (AGENT_ACTIVE primary/sub/tod = 70/20/10):
 *   - sub missing → [primary=70, tod=10], total 80 → 87.5% / 12.5%
 *   - tod missing → [primary=70, sub=20], total 90 → 77.8% / 22.2%
 *   - both missing → [primary=70], total 70 → 100% primary
 *
 * Returns null only if no entries have a non-empty pool.
 */
export function pickWeightedPool(
  entries: PoolEntry[],
  rand: () => number,
): PoolEntry | null {
  const valid = entries.filter((e) => e.pool && e.pool.length > 0);
  if (valid.length === 0) return null;
  const total = valid.reduce((s, e) => s + e.w, 0);
  const r = rand() * total;
  let acc = 0;
  for (const e of valid) {
    acc += e.w;
    if (r < acc) return e;
  }
  return valid[valid.length - 1];
}

/**
 * Fisher-Yates no-repeat single-pick (D-09, Pitfall 1).
 *
 * - Singleton pool: returns the only member (no-repeat is impossible; the
 *   caller accepts the duplicate).
 * - Otherwise: draw a random index; if `pool[idx] === lastPicked`, advance to
 *   `(idx + 1) % len` to guarantee the immediate-repeat invariant holds.
 *
 * Per-pool `lastPicked` memory is the CALLER's responsibility (Map keyed by
 * pool id, e.g. "AGENT_ACTIVE:_primary").
 */
export function pickFromPool(
  pool: Message[],
  lastPicked: Message | null,
  rand: () => number,
): Message {
  if (pool.length === 1) return pool[0];
  let idx = Math.floor(rand() * pool.length);
  if (idx >= pool.length) idx = pool.length - 1; // rand() === 1 guard
  if (idx < 0) idx = 0;
  if (pool[idx] === lastPicked) idx = (idx + 1) % pool.length;
  return pool[idx];
}

/** Build the weighted-pool entries for the current AnimatorContext. */
function buildPoolEntries(
  pack: Pack,
  ctx: AnimatorContext,
  deps: AnimatorDeps,
): PoolEntry[] {
  const bucket = timeOfDayBucket(deps.now());
  const todPool = pack.timeOfDay?.[bucket];
  if (ctx.kind === "AGENT_ACTIVE") {
    const agentKey = ctx.agent ?? "";
    const subPool = agentKey ? pack.pools.AGENT_ACTIVE[agentKey] : undefined;
    return [
      { id: "AGENT_ACTIVE:_primary", pool: pack.pools.AGENT_ACTIVE._primary, w: 70 },
      { id: `AGENT_ACTIVE:${agentKey}`, pool: subPool, w: 20 },
      { id: `timeOfDay:${bucket}`, pool: todPool, w: 10 },
    ];
  }
  if (ctx.kind === "CODING") {
    return [
      { id: "CODING", pool: pack.pools.CODING, w: 85 },
      { id: `timeOfDay:${bucket}`, pool: todPool, w: 15 },
    ];
  }
  // IDLE
  return [
    { id: "IDLE", pool: pack.pools.IDLE, w: 90 },
    { id: `timeOfDay:${bucket}`, pool: todPool, w: 10 },
  ];
}

/**
 * Weighted pool pick → FY no-repeat pick → blank-skip loop.
 *
 * Each attempt consumes two rand() draws (one for pickWeightedPool, one for
 * pickFromPool) in the happy path. Updates `lastPicked` for the chosen pool
 * on every successful (non-blank) pick. If 10 consecutive attempts render
 * blank, returns the hard-fallback BLANK_FALLBACK ("building, afk"). Per
 * T-04-05 mitigation — bounds the loop so a fully-blank pack cannot spin
 * the CPU.
 */
function pickNextMessage(
  pack: Pack,
  cfg: AgentModeConfig,
  ctx: AnimatorContext,
  deps: AnimatorDeps,
  lastPicked: Map<string, Message>,
): Message {
  void cfg; // reserved for future per-config pick tweaks; not currently used
  for (let attempt = 0; attempt < MAX_BLANK_ATTEMPTS; attempt++) {
    const entries = buildPoolEntries(pack, ctx, deps);
    const chosen = pickWeightedPool(entries, deps.rand);
    if (!chosen || !chosen.pool) return BLANK_FALLBACK;
    const msg = pickFromPool(chosen.pool, lastPicked.get(chosen.id) ?? null, deps.rand);
    // Evaluate blank-after-substitution on the first frame (string or array[0]).
    const frame0 = Array.isArray(msg) ? msg[0] : msg;
    const rendered = renderTemplate(frame0, ctx.tokens);
    if (!isBlank(rendered)) {
      lastPicked.set(chosen.id, msg);
      return msg;
    }
    // Blank — try again; do NOT update lastPicked so the same draw sequence
    // can't converge on an infinite-retry record.
  }
  return BLANK_FALLBACK;
}

/**
 * Factory for a two-clock animator. Returns { start, stop, forceTick }.
 *
 * start(): immediate render (rotation tick 0) + registers rotation + frame
 *          setIntervals. Safe to call once; subsequent calls are idempotent
 *          (pre-existing timers are cleared first).
 * stop():  clears both timer handles (T-04-06). Subsequent tick fires are
 *          impossible. Idempotent.
 * forceTick(): synchronous rotation pick + render, used by activityBuilder on
 *          a state transition to flush the new state without waiting up to
 *          20 s. Does NOT reschedule the rotation interval.
 */
export function createAnimator(
  opts: AnimatorOpts,
  depsOverride: Partial<AnimatorDeps> = {},
): { start(): void; stop(): void; forceTick(): void } {
  const deps: AnimatorDeps = { ...realAnimatorDeps, ...depsOverride };
  const { getPack, getConfig, getContext, onRender } = opts;

  const lastPicked = new Map<string, Message>();
  let currentMessage: Message = BLANK_FALLBACK;
  let frameIdx = 0;
  let rotationTimer: unknown = null;
  let frameTimer: unknown = null;

  function renderCurrent(cfg: AgentModeConfig): void {
    const frame = Array.isArray(currentMessage)
      ? cfg.animations.enabled
        ? currentMessage[frameIdx]
        : currentMessage[0]
      : currentMessage;
    const tokens = getContext().tokens;
    onRender(renderTemplate(frame, tokens));
  }

  function rotationTick(): void {
    const pack = getPack();
    const cfg = getConfig();
    const ctx = getContext();
    currentMessage = pickNextMessage(pack, cfg, ctx, deps, lastPicked);
    frameIdx = 0;
    renderCurrent(cfg);
  }

  function frameTick(): void {
    const cfg = getConfig();
    if (!Array.isArray(currentMessage) || !cfg.animations.enabled) return;
    frameIdx = (frameIdx + 1) % currentMessage.length;
    renderCurrent(cfg);
  }

  function clearTimers(): void {
    if (rotationTimer !== null) {
      deps.clearInterval(rotationTimer);
      rotationTimer = null;
    }
    if (frameTimer !== null) {
      deps.clearInterval(frameTimer);
      frameTimer = null;
    }
  }

  return {
    start(): void {
      clearTimers(); // idempotent — safe to re-enter
      rotationTick(); // immediate first render
      rotationTimer = deps.setInterval(rotationTick, ROTATION_MS);
      frameTimer = deps.setInterval(frameTick, FRAME_MS);
    },
    stop(): void {
      clearTimers();
    },
    forceTick(): void {
      rotationTick();
    },
  };
}
