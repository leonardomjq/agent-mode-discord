/**
 * Phase 4 pack loader + hand-rolled schema validator (pure-core, zero-dep).
 *
 * Covers:
 *  - PERS-01: goblin is the only built-in pack (built-in is caller-supplied via opts.builtin)
 *  - PERS-07: messages.customPackPath overrides built-in on next tick (D-25 poll-on-rotation)
 *  - PERS-08: schema validation + whole-pack fallback (D-26) + debug-channel log (D-28)
 *
 * Threats mitigated:
 *  - T-04-01 (DoS): stat(path).size > 100_000 → reject before read
 *  - T-04-02 (prototype pollution): validator enumerates known keys only; never spreads raw input
 *
 * PURE-CORE: imports only node:fs (types) — no vscode. Side effects injected
 * via PackLoaderDeps (mirrors src/detectors/sessionFiles.ts options-bag pattern).
 */

import { readFileSync, statSync } from "node:fs";
import type { Pack, ValidateResult, Message } from "./types";
import goblinPackJson from "./goblin.json";

export type { Pack, ValidateResult, Message } from "./types";

/**
 * Canonical built-in goblin pack (PERS-01). Imported statically so esbuild's
 * default JSON loader inlines it into dist/extension.cjs (verified by
 * scripts/check-pack-inlined.mjs). This is the `builtin` fallback that
 * loadPack() returns when no custom pack is configured, on validation failure,
 * or on any fs error (D-26 whole-pack fallback).
 *
 * Plan 04-04 (activityBuilder) consumes this constant; plan 04-05 landed it
 * here so the import graph exists the moment Wave-2 plans wire up.
 */
export const BUILTIN_GOBLIN_PACK: Pack = goblinPackJson as Pack;

/** Maximum byte size of a custom pack file (T-04-01 DoS mitigation). */
const MAX_CUSTOM_PACK_BYTES = 100_000;

export interface PackLoaderDeps {
  /** Throws on ENOENT / read error. Returns utf8 contents. */
  readFile: (p: string) => string;
  /** Throws on ENOENT. Returns the file size in bytes. */
  stat: (p: string) => { size: number };
  /** Clock source — kept in the deps bag for test injection (mirrors sessionFiles.ts). */
  now: () => Date;
  /** Debug-channel sink. No-op by default; extension.ts injects the real output channel in plan 04-08. */
  log: (line: string) => void;
}

export const realPackLoaderDeps: PackLoaderDeps = {
  readFile: (p) => readFileSync(p, "utf8"),
  stat: (p) => {
    const s = statSync(p);
    return { size: s.size };
  },
  now: () => new Date(),
  log: () => {
    /* no-op default; extension.ts injects the real outputChannel logger in plan 04-08 */
  },
};

/**
 * Hand-rolled schema validator (~40 lines incl. helpers).
 *
 * Safety model (T-04-02): reads only enumerated keys (`id`, `version`, `pools`,
 * `timeOfDay`). Never calls `Object.assign`, spreads, or property iteration on
 * raw input other than what structural checks require. The return
 * `{ pack: p as unknown as Pack }` is safe because TS narrowing has confirmed
 * every consumed key passes shape checks and downstream consumers only read
 * those enumerated keys.
 */
export function validatePack(raw: unknown): ValidateResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "pack must be object" };
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string") return { ok: false, error: "id must be string" };
  if (p.version !== 1) return { ok: false, error: "version must be 1" };
  if (!p.pools || typeof p.pools !== "object") return { ok: false, error: "pools missing" };
  const pools = p.pools as Record<string, unknown>;
  if (!isAgentActivePool(pools.AGENT_ACTIVE))
    return { ok: false, error: "pools.AGENT_ACTIVE invalid" };
  if (!isMessageArray(pools.CODING))
    return { ok: false, error: "pools.CODING must be array of messages" };
  if (!isMessageArray(pools.IDLE))
    return { ok: false, error: "pools.IDLE must be array of messages" };
  if (p.timeOfDay !== undefined && !isTimeOfDay(p.timeOfDay))
    return { ok: false, error: "timeOfDay invalid" };
  return { ok: true, pack: p as unknown as Pack };
}

/** A Message is string | string[] (string[] is a frame sequence — D-02). */
function isMessage(x: unknown): boolean {
  if (typeof x === "string") return true;
  return Array.isArray(x) && x.every((s) => typeof s === "string");
}

function isMessageArray(x: unknown): boolean {
  return Array.isArray(x) && x.every(isMessage);
}

/**
 * AGENT_ACTIVE must be an object with a `_primary: Message[]` key; any other
 * own-enumerable keys (e.g. `claude`, `codex`) must also be Message[].
 * Explicitly rejects the "plain array" shape (the other pools' shape).
 */
function isAgentActivePool(x: unknown): boolean {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (!isMessageArray(o._primary)) return false;
  for (const k of Object.keys(o)) {
    if (!isMessageArray(o[k])) return false;
  }
  return true;
}

function isTimeOfDay(x: unknown): boolean {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  for (const k of ["lateNight", "morning", "afternoon", "evening"]) {
    if (o[k] !== undefined && !isMessageArray(o[k])) return false;
  }
  return true;
}

/**
 * Load the active pack for this rotation tick.
 *
 * Decision chain (D-25/D-26/D-28):
 *   1. customPackPath empty → return builtin (no fs read)
 *   2. stat fails / size > 100_000 → log + return builtin (T-04-01)
 *   3. readFile fails → log + return builtin
 *   4. JSON.parse fails → log + return builtin
 *   5. validatePack fails → log + return builtin (D-26 whole-pack fallback)
 *   6. all green → return the custom pack
 */
export function loadPack(
  opts: { customPackPath: string; builtin: Pack },
  depsOverride: Partial<PackLoaderDeps> = {},
): Pack {
  const deps: PackLoaderDeps = { ...realPackLoaderDeps, ...depsOverride };
  const { customPackPath, builtin } = opts;
  if (!customPackPath) return builtin;
  try {
    const { size } = deps.stat(customPackPath);
    if (size > MAX_CUSTOM_PACK_BYTES) {
      deps.log(
        `[packLoader] custom pack too large (${size} > ${MAX_CUSTOM_PACK_BYTES}): ${customPackPath} — falling back to built-in`,
      );
      return builtin;
    }
    let raw: string;
    try {
      raw = deps.readFile(customPackPath);
    } catch (err) {
      deps.log(`[packLoader] custom pack read failed: ${String(err)} — falling back`);
      return builtin;
    }
    // ME-04: mitigate TOCTOU between stat() and readFile() — if the file was
    // swapped (e.g. symlink repointed to /dev/zero) between calls, the
    // contents may exceed MAX_CUSTOM_PACK_BYTES even though stat reported
    // under-cap. Second check on actual content length bounds memory.
    if (raw.length > MAX_CUSTOM_PACK_BYTES) {
      deps.log(
        `[packLoader] custom pack content exceeded ${MAX_CUSTOM_PACK_BYTES} bytes after read (TOCTOU?) — falling back`,
      );
      return builtin;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      deps.log(`[packLoader] custom pack JSON parse error: ${String(err)} — falling back`);
      return builtin;
    }
    const result = validatePack(parsed);
    if (!result.ok) {
      deps.log(`[packLoader] custom pack schema invalid: ${result.error} — falling back`);
      return builtin;
    }
    return result.pack;
  } catch (err) {
    deps.log(`[packLoader] custom pack stat failed: ${String(err)} — falling back`);
    return builtin;
  }
}
