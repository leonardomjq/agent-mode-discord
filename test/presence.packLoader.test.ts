/**
 * Phase-4 Wave-0 test stubs for the goblin pack loader.
 *
 * Requirements covered: PERS-01, PERS-07, PERS-08
 * Decisions covered:   D-25, D-26, D-27, D-28
 * Threats covered:     T-04-01 (size DoS), T-04-02 (prototype pollution)
 *
 * Wave 1+ plans flip these it.todo entries into real tests and add the
 * `src/presence/packLoader` import at the top.
 */
import { describe, it } from "vitest";

describe("packLoader", () => {
  it.todo("built-in pack is loaded from src/presence/goblin.json when customPackPath is empty (PERS-01)");
  it.todo("messages.customPackPath overrides built-in on next tick via fs.readFileSync (PERS-07 / D-25)");
  it.todo("invalid JSON at customPackPath falls back WHOLLY to built-in goblin (PERS-08 / D-26)");
  it.todo("schema-invalid pack (missing pools) falls back to built-in + logs debug error (PERS-08 / D-27 / D-28)");
  it.todo("file-size > 100_000 bytes at customPackPath rejected; falls back to built-in (T-04-01 DoS guard)");
  it.todo("validatePack rejects { version: 2 } shape");
  it.todo("validatePack rejects pools.AGENT_ACTIVE as plain array (must be object with _primary)");
  it.todo("validatePack rejects non-string message inside CODING / IDLE pools");
  it.todo("validatePack accepts valid MINIMAL_GOBLIN_FIXTURE and round-trips pack.id === 'goblin'");
  it.todo("validatePack does not mutate prototype when input contains __proto__ / constructor keys (T-04-02 prototype pollution)");
});
