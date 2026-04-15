/**
 * Phase-4 Wave-1 tests for the goblin pack loader (04-01).
 *
 * Requirements covered: PERS-01, PERS-07, PERS-08
 * Decisions covered:   D-25, D-26, D-27, D-28
 * Threats covered:     T-04-01 (size DoS), T-04-02 (prototype pollution)
 *
 * The Wave-0 it.todo stubs from this file were flipped to real `it(...)`
 * blocks in this plan. Tests inject a fake `deps` bag — no real fs reads.
 */
import { describe, it, expect } from "vitest";
import { loadPack, validatePack, type Pack, type PackLoaderDeps } from "../src/presence/packLoader";
import {
  MINIMAL_GOBLIN_FIXTURE,
  makeValidPack,
  makeInvalidPack,
} from "./presence/__helpers__/packFixtures";

// Minimal built-in pack used as the fallback target in loadPack tests.
const BUILTIN: Pack = MINIMAL_GOBLIN_FIXTURE as unknown as Pack;

interface FakeDepsState {
  readFileMap?: Record<string, string>;
  readFileThrow?: unknown;
  statMap?: Record<string, { size: number }>;
  statThrow?: unknown;
  logs: string[];
}

function makeFakeDeps(state: FakeDepsState): Partial<PackLoaderDeps> {
  return {
    readFile: (p: string) => {
      if (state.readFileThrow !== undefined) throw state.readFileThrow;
      if (state.readFileMap && p in state.readFileMap) return state.readFileMap[p];
      const err = new Error(`ENOENT: no such file or directory, open '${p}'`);
      (err as NodeJS.ErrnoException).code = "ENOENT";
      throw err;
    },
    stat: (p: string) => {
      if (state.statThrow !== undefined) throw state.statThrow;
      if (state.statMap && p in state.statMap) return state.statMap[p];
      const err = new Error(`ENOENT: no such file or directory, stat '${p}'`);
      (err as NodeJS.ErrnoException).code = "ENOENT";
      throw err;
    },
    now: () => new Date("2026-04-15T12:00:00.000Z"),
    log: (line: string) => {
      state.logs.push(line);
    },
  };
}

describe("validatePack", () => {
  it("accepts valid MINIMAL_GOBLIN_FIXTURE and round-trips pack.id === 'goblin'", () => {
    const result = validatePack(MINIMAL_GOBLIN_FIXTURE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.id).toBe("goblin");
  });

  it("rejects non-object inputs with 'pack must be object'", () => {
    const result = validatePack(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/pack must be object/);
  });

  it("rejects { id: 1 } (id must be string)", () => {
    const p = makeValidPack();
    (p as unknown as { id: number }).id = 1;
    const result = validatePack(p);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/id must be string/);
  });

  it("rejects { version: 2 } shape", () => {
    const result = validatePack(makeInvalidPack("bad-version"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version must be 1/);
  });

  it("rejects missing pools", () => {
    const result = validatePack(makeInvalidPack("missing-pools"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/pools/);
  });

  it("rejects pools.AGENT_ACTIVE as plain array (must be object with _primary)", () => {
    const result = validatePack(makeInvalidPack("bad-agent-active-shape"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/AGENT_ACTIVE/);
  });

  it("rejects non-string message inside CODING / IDLE pools", () => {
    const result = validatePack(makeInvalidPack("bad-message-type"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/CODING|messages/i);
  });

  it("rejects timeOfDay bucket with non-message-array value", () => {
    const result = validatePack(makeInvalidPack("bad-time-of-day"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/timeOfDay/);
  });

  it("does not mutate prototype when input contains __proto__ / constructor keys (T-04-02)", () => {
    // Using JSON.parse ensures __proto__ is an own enumerable property, not
    // re-applied as the actual prototype (which JSON.parse strips).
    const raw = JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":{"polluted":"yes"}}');
    const result = validatePack(raw);
    expect(result.ok).toBe(false);
    // Ensure validator did not leak the attack payload onto Object.prototype.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("loadPack", () => {
  it("returns built-in pack when customPackPath is empty (PERS-01)", () => {
    const state: FakeDepsState = { logs: [] };
    const pack = loadPack({ customPackPath: "", builtin: BUILTIN }, makeFakeDeps(state));
    expect(pack).toBe(BUILTIN);
  });

  it("messages.customPackPath overrides built-in on next tick via fs.readFileSync (PERS-07 / D-25)", () => {
    const custom = makeValidPack({ id: "custom" });
    const state: FakeDepsState = {
      logs: [],
      statMap: { "/valid/pack.json": { size: 1024 } },
      readFileMap: { "/valid/pack.json": JSON.stringify(custom) },
    };
    const pack = loadPack({ customPackPath: "/valid/pack.json", builtin: BUILTIN }, makeFakeDeps(state));
    expect(pack.id).toBe("custom");
  });

  it("invalid JSON at customPackPath falls back WHOLLY to built-in goblin (PERS-08 / D-26)", () => {
    const state: FakeDepsState = {
      logs: [],
      statMap: { "/invalid.json": { size: 16 } },
      readFileMap: { "/invalid.json": "not json{" },
    };
    const pack = loadPack({ customPackPath: "/invalid.json", builtin: BUILTIN }, makeFakeDeps(state));
    expect(pack).toBe(BUILTIN);
    expect(state.logs.some((l) => /parse/i.test(l))).toBe(true);
  });

  it("schema-invalid pack (missing pools) falls back to built-in + logs debug error (PERS-08 / D-27 / D-28)", () => {
    const state: FakeDepsState = {
      logs: [],
      statMap: { "/bad-shape.json": { size: 32 } },
      readFileMap: { "/bad-shape.json": JSON.stringify({ id: "x", version: 1 }) },
    };
    const pack = loadPack({ customPackPath: "/bad-shape.json", builtin: BUILTIN }, makeFakeDeps(state));
    expect(pack).toBe(BUILTIN);
    expect(state.logs.some((l) => /pools/i.test(l))).toBe(true);
  });

  it("file-size > 100_000 bytes at customPackPath rejected; falls back to built-in (T-04-01 DoS guard)", () => {
    const state: FakeDepsState = {
      logs: [],
      statMap: { "/huge.json": { size: 200_000 } },
    };
    const pack = loadPack({ customPackPath: "/huge.json", builtin: BUILTIN }, makeFakeDeps(state));
    expect(pack).toBe(BUILTIN);
    expect(state.logs.some((l) => /too large/i.test(l))).toBe(true);
  });

  it("missing file (ENOENT on stat) falls back to built-in + logs debug error", () => {
    const state: FakeDepsState = { logs: [] };
    const pack = loadPack({ customPackPath: "/missing.json", builtin: BUILTIN }, makeFakeDeps(state));
    expect(pack).toBe(BUILTIN);
    expect(state.logs.length).toBeGreaterThan(0);
  });
});
