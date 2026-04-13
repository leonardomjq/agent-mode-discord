/**
 * Phase 2 leading + trailing last-wins throttle (RPC-02 / STATE-06).
 *
 * PURE-CORE: no vscode import, no @xhayper import. Enforced by scripts/check-api-surface.mjs (D-16).
 * Injectable timer deps so vitest uses `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })`.
 *
 * Downstream: plan 02-07 driver calls createThrottle(setActivityWrapper, 2000) once per extension activation.
 * On reconnect (RPC-04), driver re-invokes the throttled fn — throttle applies normal leading/trailing rules.
 */

/**
 * Phase 2 leading + trailing last-wins throttle.
 *
 * PURE-CORE: no vscode import, no @xhayper import. Injectable timers for vitest.
 * D-09 lives standalone (not inside rpc/client.ts) · D-10 last-wins · RPC-02 / STATE-06.
 *
 * Semantics:
 * - First call in an idle window fires `fn` immediately (leading edge).
 * - Subsequent calls inside the same window overwrite a single held slot (last-wins).
 * - When the window elapses, if a payload is held, `fn` fires once with it (trailing edge).
 * - If no payload is held at window-end (only one call landed), no trailing fire.
 */
export interface ThrottleDeps {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimeout: (t: NodeJS.Timeout) => void;
}

export const realThrottleDeps: ThrottleDeps = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
};

export function createThrottle<T>(
  fn: (payload: T) => void | Promise<void>,
  windowMs: number,
  deps: ThrottleDeps = realThrottleDeps,
): (payload: T) => void {
  let lastFiredAt = -Infinity;
  let pendingPayload: { value: T } | null = null;
  let trailingTimer: NodeJS.Timeout | null = null;

  const fireTrailing = () => {
    trailingTimer = null;
    if (pendingPayload) {
      const { value } = pendingPayload;
      pendingPayload = null;
      lastFiredAt = deps.now();
      void fn(value);
    }
  };

  return (payload: T) => {
    const now = deps.now();
    const elapsed = now - lastFiredAt;
    if (elapsed >= windowMs) {
      // Leading edge — fire immediately, discard any pending.
      lastFiredAt = now;
      pendingPayload = null;
      if (trailingTimer) {
        deps.clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      void fn(payload);
    } else {
      // Inside window — hold latest (overwrite), schedule trailing if not already.
      pendingPayload = { value: payload };
      if (!trailingTimer) {
        const remaining = windowMs - elapsed;
        trailingTimer = deps.setTimeout(fireTrailing, remaining);
      }
    }
  };
}
