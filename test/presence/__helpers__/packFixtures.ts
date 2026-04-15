/**
 * Goblin pack fixture factories for Phase 4 tests.
 *
 * Pure TS, zero runtime deps. No vscode / vitest imports — these helpers are
 * consumed BY tests (pack loader, animator, templater, activity builder).
 *
 * Contract locked in 04-00-PLAN.md <interfaces>. See 04-CONTEXT.md §D-05 for the
 * canonical pack shape.
 */

/** A pack message is either a static string or an ordered string array (frame sequence). */
export type Message = string | string[];

export interface PackShape {
  id: string;
  version: number;
  pools: {
    AGENT_ACTIVE: {
      _primary: Message[];
      claude?: Message[];
      codex?: Message[];
      [agent: string]: Message[] | undefined;
    };
    CODING: Message[];
    IDLE: Message[];
  };
  timeOfDay?: {
    lateNight?: Message[];
    morning?: Message[];
    afternoon?: Message[];
    evening?: Message[];
    [bucket: string]: Message[] | undefined;
  };
}

/**
 * Minimal-but-valid pack object. Conforms to the D-05 shape with trimmed-down
 * pools so tests can reason about every pick deterministically.
 */
export const MINIMAL_GOBLIN_FIXTURE: PackShape = {
  id: "goblin",
  version: 1,
  pools: {
    AGENT_ACTIVE: {
      _primary: ["p1", ["f1.", "f1..", "f1..."]],
      claude: ["c1"],
      codex: ["x1"],
    },
    CODING: ["c1"],
    IDLE: ["i1"],
  },
  timeOfDay: {
    lateNight: ["ln1"],
    morning: ["m1"],
    afternoon: ["a1"],
    evening: ["e1"],
  },
};

export interface ValidPackOverrides {
  id?: string;
  primary?: Message[];
  claude?: Message[];
  codex?: Message[];
  coding?: Message[];
  idle?: Message[];
  timeOfDay?: Record<string, Message[]>;
}

/**
 * Returns a fresh deep-cloned copy of {@link MINIMAL_GOBLIN_FIXTURE} with the
 * supplied overrides shallow-merged into the matching pool keys. Zero-dep deep
 * clone via JSON round-trip — sufficient for the flat pack shape.
 */
export function makeValidPack(overrides?: ValidPackOverrides): PackShape {
  const clone: PackShape = JSON.parse(JSON.stringify(MINIMAL_GOBLIN_FIXTURE));
  if (!overrides) return clone;
  if (overrides.id !== undefined) clone.id = overrides.id;
  if (overrides.primary !== undefined) clone.pools.AGENT_ACTIVE._primary = overrides.primary;
  if (overrides.claude !== undefined) clone.pools.AGENT_ACTIVE.claude = overrides.claude;
  if (overrides.codex !== undefined) clone.pools.AGENT_ACTIVE.codex = overrides.codex;
  if (overrides.coding !== undefined) clone.pools.CODING = overrides.coding;
  if (overrides.idle !== undefined) clone.pools.IDLE = overrides.idle;
  if (overrides.timeOfDay !== undefined) clone.timeOfDay = { ...overrides.timeOfDay };
  return clone;
}

export type InvalidPackKind =
  | "not-object"
  | "bad-version"
  | "missing-pools"
  | "bad-agent-active-shape"
  | "bad-message-type"
  | "bad-time-of-day";

/**
 * Returns a malformed pack keyed by {@link InvalidPackKind}. Used by
 * packLoader tests to exercise the schema validator's reject paths (D-27).
 */
export function makeInvalidPack(kind: InvalidPackKind): unknown {
  switch (kind) {
    case "not-object":
      return 42;
    case "bad-version": {
      const p: PackShape = JSON.parse(JSON.stringify(MINIMAL_GOBLIN_FIXTURE));
      (p as unknown as { version: number }).version = 2;
      return p;
    }
    case "missing-pools":
      return { id: "x", version: 1 };
    case "bad-agent-active-shape": {
      const p: PackShape = JSON.parse(JSON.stringify(MINIMAL_GOBLIN_FIXTURE));
      // Replace AGENT_ACTIVE object with a plain array — breaks D-01 structure.
      (p.pools as unknown as { AGENT_ACTIVE: unknown }).AGENT_ACTIVE = ["p1", "p2"];
      return p;
    }
    case "bad-message-type": {
      const p: PackShape = JSON.parse(JSON.stringify(MINIMAL_GOBLIN_FIXTURE));
      (p.pools.CODING as unknown as unknown[])[0] = 1;
      return p;
    }
    case "bad-time-of-day": {
      const p: PackShape = JSON.parse(JSON.stringify(MINIMAL_GOBLIN_FIXTURE));
      (p.timeOfDay as unknown as { morning: unknown }).morning = "oops";
      return p;
    }
    default: {
      // Exhaustiveness guard — if InvalidPackKind grows, this fails at compile time.
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
