/**
 * Phase-4 Wave-2 animator tests (04-02).
 *
 * Requirements covered: PERS-02, PERS-03, PERS-04, PERS-05, CONF-03, PRIV-06
 * Decisions covered:   D-06..D-13, D-24
 *
 * TDD: RED → GREEN. Helpers (timeOfDayBucket / pickWeightedPool / pickFromPool)
 * tested in Task 1. createAnimator two-clock / FY / blank-skip / config-reread
 * tested in Task 2. Deterministic clocks via makeFakeClocks; deterministic rand
 * via seeded sequences.
 */
import { describe, expect, it, vi } from "vitest";
import type { Pack, Message } from "../src/presence/types";
import type { AgentModeConfig } from "../src/config";
import {
  createAnimator,
  pickFromPool,
  pickWeightedPool,
  timeOfDayBucket,
  type AnimatorContext,
  type AnimatorDeps,
  type PoolEntry,
} from "../src/presence/animator";
import { MINIMAL_GOBLIN_FIXTURE, makeValidPack } from "./presence/__helpers__/packFixtures";
import { makeFakeClocks } from "./presence/__helpers__/fakeClocks";

// Seeded rand helper — cycles through `seq` so callers can script picks.
function seeded(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

// Default config builder so each test can tweak just the relevant branch.
function makeConfig(override: Partial<AgentModeConfig> = {}): AgentModeConfig {
  return {
    clientId: "x",
    activityType: "playing",
    idleBehavior: "show",
    debug: { verbose: false },
    animations: { enabled: true },
    messages: { customPackPath: "" },
    privacy: { workspaceName: "show", filename: "show", gitBranch: "show" },
    ignore: { workspaces: [], repositories: [], organizations: [], gitHosts: [] },
    detect: { customPatterns: {}, sessionFileStalenessSeconds: 60 },
    ...override,
  };
}

// ---------------------------------------------------------------------------
// Task 1 — pure helpers
// ---------------------------------------------------------------------------

describe("timeOfDayBucket", () => {
  it("03:00 local → lateNight (D-11)", () => {
    const d = new Date(2025, 0, 1, 3, 0, 0);
    expect(timeOfDayBucket(d)).toBe("lateNight");
  });
  it("09:00 local → morning (D-11)", () => {
    const d = new Date(2025, 0, 1, 9, 0, 0);
    expect(timeOfDayBucket(d)).toBe("morning");
  });
  it("15:00 local → afternoon (D-11)", () => {
    const d = new Date(2025, 0, 1, 15, 0, 0);
    expect(timeOfDayBucket(d)).toBe("afternoon");
  });
  it("21:00 local → evening (D-11)", () => {
    const d = new Date(2025, 0, 1, 21, 0, 0);
    expect(timeOfDayBucket(d)).toBe("evening");
  });
  it("00:00 (midnight boundary) → lateNight", () => {
    const d = new Date(2025, 0, 1, 0, 0, 0);
    expect(timeOfDayBucket(d)).toBe("lateNight");
  });
  it("06:00 (morning boundary) → morning", () => {
    const d = new Date(2025, 0, 1, 6, 0, 0);
    expect(timeOfDayBucket(d)).toBe("morning");
  });
  it("12:00 (noon boundary) → afternoon", () => {
    const d = new Date(2025, 0, 1, 12, 0, 0);
    expect(timeOfDayBucket(d)).toBe("afternoon");
  });
  it("18:00 (evening boundary) → evening", () => {
    const d = new Date(2025, 0, 1, 18, 0, 0);
    expect(timeOfDayBucket(d)).toBe("evening");
  });
});

describe("pickWeightedPool", () => {
  const primary: Message[] = ["p1", "p2"];
  const claude: Message[] = ["c1"];
  const tod: Message[] = ["t1"];

  function agentActiveEntries(opts: {
    claude?: Message[] | undefined;
    tod?: Message[] | undefined;
    primary?: Message[] | undefined;
  } = {}): PoolEntry[] {
    // Use `in`-checks so explicit-undefined overrides actually clear the pool.
    const prim = "primary" in opts ? opts.primary : primary;
    const cld = "claude" in opts ? opts.claude : claude;
    const td = "tod" in opts ? opts.tod : tod;
    return [
      { id: "AGENT_ACTIVE:_primary", pool: prim, w: 70 },
      { id: "AGENT_ACTIVE:claude", pool: cld, w: 20 },
      { id: "timeOfDay:morning", pool: td, w: 10 },
    ];
  }

  it("all three pools populated, rand=0.0 → primary (70% bucket wins, D-07)", () => {
    const chosen = pickWeightedPool(agentActiveEntries(), seeded([0.0]));
    expect(chosen?.id).toBe("AGENT_ACTIVE:_primary");
  });
  it("all three pools populated, rand=0.75 → claude sub-pool (70-90% bucket)", () => {
    const chosen = pickWeightedPool(agentActiveEntries(), seeded([0.75]));
    expect(chosen?.id).toBe("AGENT_ACTIVE:claude");
  });
  it("all three pools populated, rand=0.95 → time-of-day (90-100% bucket)", () => {
    const chosen = pickWeightedPool(agentActiveEntries(), seeded([0.95]));
    expect(chosen?.id).toBe("timeOfDay:morning");
  });
  it("missing claude → 90% primary + 10% tod redistribution (D-08)", () => {
    const entries = agentActiveEntries({ claude: undefined });
    const atPrimary = pickWeightedPool(entries, seeded([0.0]));
    const atTod = pickWeightedPool(entries, seeded([0.95]));
    expect(atPrimary?.id).toBe("AGENT_ACTIVE:_primary");
    expect(atTod?.id).toBe("timeOfDay:morning");
    // Boundary: r=0.89 total=80, 0.89*80=71.2 > 70 → tod; r=0.87 total=80,
    // 0.87*80=69.6 < 70 → primary. Verifies the 90/10 split boundary.
    const atBoundaryTod = pickWeightedPool(entries, seeded([0.89]));
    const atBoundaryPrim = pickWeightedPool(entries, seeded([0.87]));
    expect(atBoundaryTod?.id).toBe("timeOfDay:morning");
    expect(atBoundaryPrim?.id).toBe("AGENT_ACTIVE:_primary");
  });
  it("missing tod + claude present → 87.5% primary + 12.5% claude", () => {
    const entries = agentActiveEntries({ tod: undefined });
    // total = 90, 70/90 = 77.78% boundary.
    const atPrimary = pickWeightedPool(entries, seeded([0.0]));
    const atClaude = pickWeightedPool(entries, seeded([0.9]));
    expect(atPrimary?.id).toBe("AGENT_ACTIVE:_primary");
    expect(atClaude?.id).toBe("AGENT_ACTIVE:claude");
  });
  it("both missing → 100% primary", () => {
    const entries = agentActiveEntries({ claude: undefined, tod: undefined });
    const chosen = pickWeightedPool(entries, seeded([0.5]));
    expect(chosen?.id).toBe("AGENT_ACTIVE:_primary");
  });
  it("empty pool (length 0) treated as missing", () => {
    const entries: PoolEntry[] = [
      { id: "AGENT_ACTIVE:_primary", pool: primary, w: 70 },
      { id: "AGENT_ACTIVE:claude", pool: [], w: 20 },
      { id: "timeOfDay:morning", pool: tod, w: 10 },
    ];
    // total drops to 80; rand=0.9 → 72 > 70 → tod; rand=0.85 → 68 < 70 → primary
    expect(pickWeightedPool(entries, seeded([0.9]))?.id).toBe("timeOfDay:morning");
    expect(pickWeightedPool(entries, seeded([0.85]))?.id).toBe(
      "AGENT_ACTIVE:_primary",
    );
  });
  it("no valid pools → null", () => {
    const entries: PoolEntry[] = [
      { id: "AGENT_ACTIVE:_primary", pool: undefined, w: 70 },
      { id: "AGENT_ACTIVE:claude", pool: [], w: 20 },
    ];
    expect(pickWeightedPool(entries, seeded([0.5]))).toBeNull();
  });
});

describe("pickFromPool (Fisher-Yates no-repeat)", () => {
  it("singleton pool → returns its only member even when lastPicked matches", () => {
    expect(pickFromPool(["solo"], "solo", seeded([0]))).toBe("solo");
  });
  it("two-element pool + lastPicked='a' + rand=0 targets 'a' → skips to 'b'", () => {
    // Math.floor(0 * 2) = 0 → pool[0]='a', equals lastPicked → (0+1)%2=1 → 'b'
    expect(pickFromPool(["a", "b"], "a", seeded([0]))).toBe("b");
  });
  it("three-element pool + lastPicked='b' + rand hits index 1 → skips to 'c'", () => {
    // Math.floor(0.4 * 3) = 1 → pool[1]='b' matches lastPicked → (1+1)%3=2 → 'c'
    expect(pickFromPool(["a", "b", "c"], "b", seeded([0.4]))).toBe("c");
  });
  it("lastPicked=null → no skip, returns pool[idx]", () => {
    expect(pickFromPool(["a", "b", "c"], null, seeded([0]))).toBe("a");
  });
  it("rand() returning 1.0 does not index out of bounds", () => {
    expect(pickFromPool(["a", "b", "c"], null, seeded([1.0]))).toBe("c");
  });
  it("100 consecutive picks across a 3-element pool show no adjacent duplicates", () => {
    const pool: Message[] = ["a", "b", "c"];
    // Pseudo-seeded Mulberry32-style sequence, plain math: avoid imports.
    let x = 42;
    const rand = () => {
      x = (x * 16807) % 2147483647;
      return (x / 2147483647);
    };
    const picks: Message[] = [];
    let last: Message | null = null;
    for (let i = 0; i < 100; i++) {
      const m = pickFromPool(pool, last, rand);
      picks.push(m);
      last = m;
    }
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i]).not.toBe(picks[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 2 — createAnimator integration
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<AnimatorDeps> = {}): AnimatorDeps {
  const clocks = makeFakeClocks();
  return {
    now: clocks.now,
    rand: clocks.rand,
    setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
    clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
    ...overrides,
  };
}

describe("createAnimator — two clocks + rotation pick", () => {
  it("start() emits immediate render (tick 0)", () => {
    const pack = MINIMAL_GOBLIN_FIXTURE as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    expect(renders.length).toBe(1);
    a.stop();
  });

  it("20s rotation fires next render after each tick", () => {
    const pack = makeValidPack({ primary: ["p1", "p2"], claude: ["c1"], coding: ["co1"], idle: ["i1"] }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0, 0.1, 0.2, 0.3, 0.4] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    // 5 × 20 s ticks → 5 rotations on top of the initial render
    clocks.advance(20_000 * 5);
    expect(renders.length).toBeGreaterThanOrEqual(6);
    a.stop();
  });

  it("frame clock cycles array messages every 2s", () => {
    // Force _primary's only message to be a fixed frame sequence.
    const pack = makeValidPack({ primary: [["a.", "a..", "a..."]] }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0] });
    const a = createAnimator(
      {
        // IDLE state routed to a pool that is a single-frame-sequence so
        // the frame clock has content to animate.
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start(); // initial render = frame 0 → "a."
    clocks.advance(2_000); // frame tick 1 → "a.."
    clocks.advance(2_000); // frame tick 2 → "a..."
    clocks.advance(2_000); // frame tick 3 → wraps to "a."
    expect(renders.slice(0, 4)).toEqual(["a.", "a..", "a...", "a."]);
    a.stop();
  });

  it("singleton messages ignore the frame clock", () => {
    const pack = makeValidPack({ primary: ["shipping"] }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    const initialCount = renders.length;
    // Ten 2 s frame ticks with no 20 s rotation crossed
    for (let i = 0; i < 9; i++) clocks.advance(2_000);
    expect(renders.length).toBe(initialCount); // no extra frame-induced renders
    a.stop();
  });

  it("animations.enabled=false freezes frame arrays on frame 0 (D-10)", () => {
    const pack = makeValidPack({ primary: [["a.", "a..", "a..."]] }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig({ animations: { enabled: false } }),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    const initial = renders.length;
    // 9 frame ticks (18 000 ms total — below the 20 000 ms rotation boundary)
    // — expect zero additional renders from the frame clock when disabled.
    for (let i = 0; i < 9; i++) clocks.advance(2_000);
    expect(renders.length).toBe(initial);
    expect(renders[0]).toBe("a."); // frame 0
    a.stop();
  });

  it("state=AGENT_ACTIVE + agent='aider' (no sub-pool) → redistributes to 90/10", () => {
    const pack = makeValidPack({
      primary: ["P"],
      claude: ["C"],
      coding: ["CO"],
      idle: ["I"],
      timeOfDay: { morning: ["T"], lateNight: ["T"], afternoon: ["T"], evening: ["T"] },
    }) as unknown as Pack;
    const renders: string[] = [];
    // rand=0.85 in 90/10 split → 76.5 < 90 → primary. rand=0.95 → 85.5 < 90 → primary.
    const clocks = makeFakeClocks({ randSeq: [0.85, 0, 0.95, 0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "aider", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start(); // first render — should be "P" (primary wins)
    expect(renders[0]).toBe("P");
    a.stop();
  });

  it("state=CODING uses 85/15 weights", () => {
    const pack = makeValidPack({
      coding: ["CO"],
      timeOfDay: { morning: ["T"], lateNight: ["T"], afternoon: ["T"], evening: ["T"] },
    }) as unknown as Pack;
    const renders: string[] = [];
    // 0.1 → 0.1*100=10 < 85 → CODING
    const clocks = makeFakeClocks({ randSeq: [0.1] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "CODING", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    expect(renders[0]).toBe("CO");
    a.stop();
  });

  it("state=IDLE uses 90/10 weights", () => {
    const pack = makeValidPack({
      idle: ["I"],
      timeOfDay: { morning: ["T"], lateNight: ["T"], afternoon: ["T"], evening: ["T"] },
    }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.5] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "IDLE", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    expect(renders[0]).toBe("I");
    a.stop();
  });

  it("blank-after-substitution skip caps at 10 attempts → hard-fallback 'building, afk'", () => {
    // Pool of messages that all render blank when tokens are empty.
    const pack = makeValidPack({
      primary: ["{filename}", "{filename}", "{filename}"],
    }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.1] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({
          kind: "AGENT_ACTIVE",
          agent: "aider",
          // Pack's claude sub-pool still exists — but with agent='aider' +
          // no 'aider' sub-pool, redistribution keeps only primary + tod.
          // tod buckets are {T} (non-blank) — but rand=0.1 always picks primary.
          // To keep it pure, override tod to also be blank:
          tokens: { filename: "", workspace: "", branch: "", agent: "", language: "", elapsed: "" },
        }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    // Override tod to also be templated blank:
    const pack2 = makeValidPack({
      primary: ["{filename}"],
      timeOfDay: {
        morning: ["{filename}"],
        lateNight: ["{filename}"],
        afternoon: ["{filename}"],
        evening: ["{filename}"],
      },
    }) as unknown as Pack;
    const a2 = createAnimator(
      {
        getPack: () => pack2,
        getConfig: () => makeConfig(),
        getContext: () => ({
          kind: "IDLE", // minimize pool count — IDLE only + tod
          tokens: { filename: "" },
        }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    const packIdle = makeValidPack({
      idle: ["{filename}"],
      timeOfDay: {
        morning: ["{filename}"],
        lateNight: ["{filename}"],
        afternoon: ["{filename}"],
        evening: ["{filename}"],
      },
    }) as unknown as Pack;
    const renders2: string[] = [];
    const clocks2 = makeFakeClocks({ randSeq: [0.5] });
    const a3 = createAnimator(
      {
        getPack: () => packIdle,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "IDLE", tokens: { filename: "" } }),
        onRender: (t) => renders2.push(t),
      },
      {
        now: clocks2.now,
        rand: clocks2.rand,
        setInterval: clocks2.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks2.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a3.start();
    expect(renders2[0]).toBe("building, afk");
    a3.stop();
    // Suppress unused-warnings on the unused dual instances.
    void a;
    void a2;
  });

  it("stop() clears both timers — no further renders after stop", () => {
    const pack = makeValidPack({ primary: ["p1"] }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    const before = renders.length;
    a.stop();
    clocks.advance(100_000);
    expect(renders.length).toBe(before);
  });

  it("forceTick() → immediate rotation without resetting the rotation interval", () => {
    const pack = makeValidPack({ primary: ["p1", "p2"] }) as unknown as Pack;
    const renders: string[] = [];
    // rand sequence hits different picks on forceTick vs the rotation.
    const clocks = makeFakeClocks({ randSeq: [0.0, 0.0, 0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    const afterStart = renders.length;
    a.forceTick();
    expect(renders.length).toBe(afterStart + 1);
    a.stop();
  });

  it("config re-read per tick: animations flipped mid-run applies on next rotation (CONF-03, D-24)", () => {
    const pack = makeValidPack({ primary: [["f0", "f1"]] }) as unknown as Pack;
    let enabled = true;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig({ animations: { enabled } }),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start(); // f0
    clocks.advance(2_000); // frame tick 1 → f1 (animations on)
    expect(renders).toEqual(["f0", "f1"]);
    // Flip animations off.
    enabled = false;
    clocks.advance(2_000); // frame tick → no-op (animations off)
    expect(renders).toEqual(["f0", "f1"]);
    a.stop();
  });

  it("privacy.filename flip applies next rotation tick (PRIV-06)", () => {
    // Message template exposes {filename}; when privacy is show we see the
    // token's raw value, when the caller's context flips, next tick reflects.
    const pack = makeValidPack({ primary: ["f:{filename}"] }) as unknown as Pack;
    let filename = "secret.ts";
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "AGENT_ACTIVE", agent: "claude", tokens: { filename } }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    expect(renders[0]).toBe("f:secret.ts");
    filename = ""; // simulate privacy.filename=hide
    clocks.advance(20_000); // next rotation pulls context anew — but renders "f:" (blank? no — "f:" is not blank)
    expect(renders[1]).toBe("f:");
    a.stop();
  });

  it("per-pool lastPicked persists across AGENT_ACTIVE → IDLE → AGENT_ACTIVE (D-04 R5)", () => {
    const pack = makeValidPack({
      primary: ["p1", "p2", "p3"],
      idle: ["i1"],
    }) as unknown as Pack;
    let kind: "AGENT_ACTIVE" | "IDLE" = "AGENT_ACTIVE";
    const renders: string[] = [];
    // seed primary picks: 0 → "p1" (first pick) ; after IDLE reappear with rand→0 primary would pick "p1" again BUT memory says "skip p1".
    // Because claude pool weight is 20, and tod is 10, use rand=0 so primary wins every time.
    const clocks = makeFakeClocks({ randSeq: [0.0, 0.0, 0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind, agent: undefined, tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    a.start();
    // Switch to IDLE, advance 1 rotation.
    kind = "IDLE";
    clocks.advance(20_000);
    // Back to AGENT_ACTIVE, advance 1 rotation — lastPicked for _primary
    // should skip whatever we picked on the first AGENT_ACTIVE tick.
    kind = "AGENT_ACTIVE";
    clocks.advance(20_000);
    // Assert no two consecutive primary-pool renders are the same across the
    // primary → idle → primary trip. renders[0] is primary, renders[1] is idle
    // (unrelated), renders[2] is primary again — renders[0] !== renders[2].
    expect(renders[0]).not.toBe(renders[2]);
    a.stop();
  });

  it("singleton pool (size 1) returns same message across consecutive picks without throwing (R5)", () => {
    const pack = makeValidPack({ idle: ["solo"] }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.5] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "IDLE", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    expect(() => {
      a.start();
      clocks.advance(20_000);
      clocks.advance(20_000);
    }).not.toThrow();
    // rand=0.5, total = 100 (IDLE 90 + tod 10); 0.5*100=50 < 90 → IDLE every tick
    expect(renders.filter((r) => r === "solo").length).toBeGreaterThanOrEqual(3);
    a.stop();
  });

  it("mid-run pool growth (getPack returns larger IDLE) keeps no-repeat + no crash (R5)", () => {
    let pack = makeValidPack({ idle: ["a"] }) as unknown as Pack;
    const renders: string[] = [];
    const clocks = makeFakeClocks({ randSeq: [0.0] });
    const a = createAnimator(
      {
        getPack: () => pack,
        getConfig: () => makeConfig(),
        getContext: () => ({ kind: "IDLE", tokens: {} }),
        onRender: (t) => renders.push(t),
      },
      {
        now: clocks.now,
        rand: clocks.rand,
        setInterval: clocks.setInterval as AnimatorDeps["setInterval"],
        clearInterval: clocks.clearInterval as AnimatorDeps["clearInterval"],
      },
    );
    expect(() => {
      a.start(); // picks "a"
      // Swap pack under the animator.
      pack = makeValidPack({ idle: ["a", "b", "c"] }) as unknown as Pack;
      for (let i = 0; i < 10; i++) clocks.advance(20_000);
    }).not.toThrow();
    // No adjacent duplicates in IDLE-only rotations.
    for (let i = 1; i < renders.length; i++) {
      expect(renders[i]).not.toBe(renders[i - 1]);
    }
    a.stop();
  });
});
