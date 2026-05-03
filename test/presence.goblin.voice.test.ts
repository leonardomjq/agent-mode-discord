/**
 * Phase-7 voice-rules invariants test (REQ-1, REQ-6, REQ-7).
 *
 * Loads BUILTIN_GOBLIN_PACK and enforces the locked voice rules from
 * 07-SPEC.md §"Voice rules". Future PRs that introduce banned tokens,
 * past-tense action verbs, or ungrammatical-after-Watching entries fail
 * this test in CI.
 *
 * Past-tense enforcement strategy: finite banned-suffix-list of common
 * action verbs. Avoids false positives on idiomatic adjectival uses
 * (`locked in`, `paused for review`) while catching the regression class
 * the SPEC's "no past tense" rule targets (`shipped`, `coded`, etc.).
 *
 * Pure unit test — no vscode, no fs, no clock injection. Deterministic.
 */
import { describe, expect, it } from "vitest";
import type { Message, Pack } from "../src/presence/types";
import { BUILTIN_GOBLIN_PACK } from "../src/presence/packLoader";

// --- Voice rules (locked in 07-SPEC.md §"Voice rules") -----------------------

const REQUIRED_AI_TOKENS = ["claude", "codex", "agent"] as const;

const BANNED_SUBSTRINGS = [
  "afk",
  "pair-coded",
  "touching grass",
  "stepped away",
  "agent-augmented",
  "outsourced",
  "vibe shipping",
  "prompt → PR",
  "brb",
] as const;

const BANNED_AFTER_WATCHING = [
  "Watching letting",
  "Watching between",
  "Watching reviewing",
  "Watching drafting",
] as const;

/**
 * Banned past-tense ACTION verbs (07-SPEC §Voice rules — "no past tense").
 *
 * Finite list rather than a generic /\w+ed\b/ regex to avoid false positives
 * on idiomatic adjectival uses: `locked in` (focused), `paused for review`
 * (stative). Both appear in the locked v1 pool and are SPEC-accepted.
 *
 * Append to this list when a new past-tense regression is observed in PR
 * review; do NOT remove `locked` / `paused` to make this stricter — they
 * would false-positive on the existing locked pool.
 *
 * Matched as whole words via `\bWORD\b` (case-insensitive) so "decoded"
 * does not trip on `coded` and "shipping" does not trip on `shipped`.
 */
const BANNED_PAST_TENSE_VERBS = [
  "shipped",
  "coded",
  "built",
  "merged",
  "wrote",
  "paired",
  "outsourced", // also in BANNED_SUBSTRINGS — belt-and-suspenders
  "augmented",
  "pair-coded", // hyphen included; regex below handles word boundaries
  "pushed",
  "committed",
  "deployed",
  "refactored",
] as const;

// --- Pool flattening helper --------------------------------------------------

/** Flatten Message (string | string[]) to a list of strings. Frame sequences
 *  (string[]) are flattened so per-frame voice rules apply to every visible
 *  state. The locked v1 pool ships only strings, but this guards future
 *  pack additions that may use frame sequences. */
function flatten(messages: Message[]): string[] {
  const out: string[] = [];
  for (const m of messages) {
    if (typeof m === "string") out.push(m);
    else if (Array.isArray(m)) out.push(...m);
  }
  return out;
}

/** Collect every pool entry from the pack (across _primary, claude, codex,
 *  CODING, IDLE). Excludes timeOfDay — that has separate count rules per
 *  SPEC §3 (one canonical entry per bucket). */
function collectPoolEntries(pack: Pack): { pool: string; entry: string }[] {
  const out: { pool: string; entry: string }[] = [];
  for (const [agentKey, msgs] of Object.entries(pack.pools.AGENT_ACTIVE)) {
    for (const e of flatten(msgs as Message[])) {
      out.push({ pool: `AGENT_ACTIVE:${agentKey}`, entry: e });
    }
  }
  for (const e of flatten(pack.pools.CODING)) out.push({ pool: "CODING", entry: e });
  for (const e of flatten(pack.pools.IDLE)) out.push({ pool: "IDLE", entry: e });
  return out;
}

/** Build a case-insensitive whole-word regex for a banned past-tense verb.
 *  Hyphens are escaped so "pair-coded" matches as a unit. */
function bannedVerbRegex(verb: string): RegExp {
  const escaped = verb.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// --- Tests -------------------------------------------------------------------

describe("goblin pack voice rules (07-SPEC §Voice rules)", () => {
  const entries = collectPoolEntries(BUILTIN_GOBLIN_PACK);

  it("collects at least 13 entries (sanity — REQ-1 lock)", () => {
    // Lower bound — the locked v1 pool has exactly 13. Allow >13 if a future
    // version expands without breaking voice rules.
    expect(entries.length).toBeGreaterThanOrEqual(13);
  });

  // Rule (a): every entry names the AI.
  for (const { pool, entry } of entries) {
    it(`names the AI [${pool}] "${entry}"`, () => {
      const lc = entry.toLowerCase();
      const named = REQUIRED_AI_TOKENS.some((tok) => lc.includes(tok));
      expect(named).toBe(true);
    });
  }

  // Rule (b): no banned tokens.
  for (const { pool, entry } of entries) {
    it(`has no banned tokens [${pool}] "${entry}"`, () => {
      const lc = entry.toLowerCase();
      for (const banned of BANNED_SUBSTRINGS) {
        expect(lc.includes(banned.toLowerCase())).toBe(false);
      }
    });
  }

  // Rule (c): fully lowercase.
  for (const { pool, entry } of entries) {
    it(`is fully lowercase [${pool}] "${entry}"`, () => {
      expect(entry).toBe(entry.toLowerCase());
    });
  }

  // Rule (d): grammatical after `Watching `.
  for (const { pool, entry } of entries) {
    it(`is grammatical after "Watching " [${pool}] "${entry}"`, () => {
      const composed = `Watching ${entry}`;
      for (const banned of BANNED_AFTER_WATCHING) {
        expect(composed.startsWith(banned)).toBe(false);
      }
    });
  }

  // Rule (e): no past-tense action verbs (07-SPEC §Voice rules — "no past
  // tense"). Enforced as a finite whole-word match list to avoid false
  // positives on idiomatic adjectival uses (`locked in`, `paused for review`).
  for (const { pool, entry } of entries) {
    it(`has no past-tense action verbs [${pool}] "${entry}"`, () => {
      for (const verb of BANNED_PAST_TENSE_VERBS) {
        const rx = bannedVerbRegex(verb);
        expect(
          rx.test(entry),
          `entry "${entry}" matches banned past-tense verb "${verb}" (07-SPEC §Voice rules — no past tense)`,
        ).toBe(false);
      }
    });
  }
});

describe("goblin pack pool counts (07-SPEC §Locked pool — REQ-1 lock)", () => {
  const p = BUILTIN_GOBLIN_PACK;

  it("AGENT_ACTIVE._primary has 4 entries", () => {
    expect(p.pools.AGENT_ACTIVE._primary).toHaveLength(4);
  });
  it("AGENT_ACTIVE.claude has 4 entries", () => {
    expect(p.pools.AGENT_ACTIVE.claude).toHaveLength(4);
  });
  it("AGENT_ACTIVE.codex has 3 entries", () => {
    expect(p.pools.AGENT_ACTIVE.codex).toHaveLength(3);
  });
  it("CODING has 2 entries", () => {
    expect(p.pools.CODING).toHaveLength(2);
  });
  it("IDLE has 2 entries", () => {
    expect(p.pools.IDLE).toHaveLength(2);
  });
  it("total locked entries === 13", () => {
    const total =
      p.pools.AGENT_ACTIVE._primary.length +
      p.pools.AGENT_ACTIVE.claude.length +
      p.pools.AGENT_ACTIVE.codex.length +
      p.pools.CODING.length +
      p.pools.IDLE.length;
    expect(total).toBe(13);
  });
});

describe("goblin pack timeOfDay canonical strings (07-SPEC §3 — REQ-3)", () => {
  const tod = BUILTIN_GOBLIN_PACK.timeOfDay!;
  it("lateNight === ['3am goblin shift']", () => {
    expect(tod.lateNight).toEqual(["3am goblin shift"]);
  });
  it("morning === ['morning service']", () => {
    expect(tod.morning).toEqual(["morning service"]);
  });
  it("afternoon === ['afternoon shift']", () => {
    expect(tod.afternoon).toEqual(["afternoon shift"]);
  });
  it("evening === ['evening service']", () => {
    expect(tod.evening).toEqual(["evening service"]);
  });
});
