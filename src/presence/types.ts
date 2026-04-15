/**
 * Phase 4 pack-contract types — shared across packLoader, animator, templater,
 * activityBuilder. Pure type module, zero runtime code.
 *
 * See 04-CONTEXT.md §D-01..D-05 for the canonical pack shape and
 * 04-01-PLAN.md <interfaces> for the locked contracts.
 *
 * PURE-CORE: no vscode import (enforced by scripts/check-api-surface.mjs).
 */

/** A pack message is either a static string or an ordered frame sequence (cycled on the 2 s frame clock). */
export type Message = string | string[];

/** Weighted-pool identifier consumed by the animator (D-07). */
export type PoolId = "AGENT_ACTIVE" | "CODING" | "IDLE";

/**
 * Canonical goblin pack shape (D-01..D-05). `version` is a schema lock —
 * future breaking changes bump this and get their own validator branch.
 */
export interface Pack {
  id: string;
  version: 1;
  pools: {
    AGENT_ACTIVE: { _primary: Message[]; [agent: string]: Message[] };
    CODING: Message[];
    IDLE: Message[];
  };
  timeOfDay?: {
    lateNight?: Message[];
    morning?: Message[];
    afternoon?: Message[];
    evening?: Message[];
  };
}

/** Discriminated Result returned by validatePack — consumers narrow on `ok`. */
export type ValidateResult =
  | { ok: true; pack: Pack }
  | { ok: false; error: string };
