/**
 * Phase 2 privacy redaction — stub with Phase 4-ready signature (D-15).
 *
 * PURE-CORE: no vscode import. Consumed by plan 02-07 driver on every
 * workspace / filename / branch value before the activity builder sees it.
 *
 * Phase 2 defaults every callsite to `mode: "show"` (pass-through). Phase 4
 * will wire real config reads and flip the default per PRD §FR-6. The
 * `hash` branch throws in Phase 2 so any caller accidentally enabling it
 * fails loudly rather than leaking un-hashed strings as "hashed".
 *
 * Phase 4 will: (a) replace the hash throw with SHA-1 6-char prefix;
 * (b) accept an optional `ignore: Set<string>` arg for the full privacy
 * config. Neither change alters this signature.
 */
export type RedactField = "workspace" | "filename" | "branch";
export type RedactMode = "show" | "hide" | "hash";

export function redact(field: RedactField, value: string, mode: RedactMode): string {
  switch (mode) {
    case "show":
      return value;
    case "hide":
      return "";
    case "hash":
      throw new Error("not implemented until Phase 4");
    default:
      // Unknown mode (only reachable via `as RedactMode` cast) — default-safe to `show`.
      return value;
  }
}
