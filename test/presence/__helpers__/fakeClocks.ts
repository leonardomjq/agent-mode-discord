/**
 * Deterministic injectable clocks bag for Phase 4 animator / templater tests.
 *
 * Mirrors the Phase 3 detector pattern (options-bag injection) — tests construct
 * `makeFakeClocks()` and pass `{ now, rand, setInterval, clearInterval }` into
 * the module under test. No monkey-patching of globals. Zero runtime deps.
 *
 * Contract locked in 04-00-PLAN.md <interfaces>.
 */

export interface FakeClocks {
  /** Returns the currently-injected Date (default 2026-04-14T12:00:00.000Z). */
  now: () => Date;
  /** Returns the next value from the seeded sequence; cycles when exhausted. */
  rand: () => number;
  /** Injected setInterval — returns an opaque token consumed by clearInterval. */
  setInterval: (fn: () => void, ms: number) => unknown;
  /** Injected clearInterval — accepts the token returned by setInterval. */
  clearInterval: (token: unknown) => void;
  /**
   * Advance the virtual-time cursor by `ms`. For each registered timer whose
   * `nextFireAt <= cursor`, fire `fn()` and reschedule `nextFireAt += ms` until
   * no more fire within the window.
   *
   * Does NOT advance the injected `now()` automatically — tests must call
   * {@link setNow} separately to move the wall clock.
   */
  advance(ms: number): void;
  /** Replace the pending rand() sequence; cursor resets to 0. */
  setRandSequence(seq: number[]): void;
  /** Override the now() return value (accepts Date or ISO string). */
  setNow(d: Date | string): void;
}

export interface MakeFakeClocksInit {
  now?: Date | string;
  randSeq?: number[];
}

interface TimerRec {
  fn: () => void;
  ms: number;
  nextFireAt: number;
}

const DEFAULT_NOW = "2026-04-14T12:00:00.000Z";
const DEFAULT_RAND = [0.5];

export function makeFakeClocks(init?: MakeFakeClocksInit): FakeClocks {
  let currentNow: Date = toDate(init?.now ?? DEFAULT_NOW);
  let randSeq: number[] = (init?.randSeq && init.randSeq.length > 0)
    ? init.randSeq.slice()
    : DEFAULT_RAND.slice();
  let randCursor = 0;

  const timers = new Map<number, TimerRec>();
  let nextToken = 1;
  let virtualCursor = 0;

  const clocks: FakeClocks = {
    now: () => new Date(currentNow.getTime()),
    rand: () => {
      const v = randSeq[randCursor % randSeq.length];
      randCursor++;
      return v;
    },
    setInterval: (fn: () => void, ms: number) => {
      const token = nextToken++;
      timers.set(token, { fn, ms, nextFireAt: virtualCursor + ms });
      return token;
    },
    clearInterval: (token: unknown) => {
      if (typeof token === "number") timers.delete(token);
    },
    advance: (ms: number) => {
      const target = virtualCursor + ms;
      // Loop until no timer is due within [virtualCursor, target]. Each fire
      // may re-register work; keep iterating until quiescent.
      // Cap iterations defensively so a badly-behaved fn() can't spin forever.
      for (let guard = 0; guard < 10_000; guard++) {
        let next: { token: number; rec: TimerRec } | null = null;
        for (const [token, rec] of timers) {
          if (rec.nextFireAt <= target) {
            if (!next || rec.nextFireAt < next.rec.nextFireAt) {
              next = { token, rec };
            }
          }
        }
        if (!next) break;
        virtualCursor = next.rec.nextFireAt;
        next.rec.nextFireAt += next.rec.ms;
        next.rec.fn();
      }
      virtualCursor = target;
    },
    setRandSequence: (seq: number[]) => {
      if (!seq || seq.length === 0) {
        randSeq = DEFAULT_RAND.slice();
      } else {
        randSeq = seq.slice();
      }
      randCursor = 0;
    },
    setNow: (d: Date | string) => {
      currentNow = toDate(d);
    },
  };

  return clocks;
}

function toDate(d: Date | string): Date {
  if (d instanceof Date) return new Date(d.getTime());
  return new Date(d);
}
