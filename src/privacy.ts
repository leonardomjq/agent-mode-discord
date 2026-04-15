/**
 * Phase 4 privacy layer — redaction + ignore-list evaluator.
 *
 * PURE-CORE: no `vscode` import. Consumed by:
 *   - plan 04-04 activityBuilder → redact() per-field + evaluateIgnore() gate
 *   - plan 04-08 extension wiring → hashWorkspace() once-on-state-transition
 *
 * D-15: SHA-1 6-hex-prefix of path-normalized workspace absolute path.
 * D-16: workspaces + gitHosts case-insensitive; repositories + organizations
 *       case-sensitive (users can use `(?i)` in patterns for insensitivity).
 * D-17: git URL normalization (strip .git, strip trailing /, scp→slash form).
 * T-04-03: ReDoS mitigation via (a) try/catch compile, (b) pre-compile linter
 *          that rejects catastrophic shapes, (c) 200-char candidate truncate,
 *          (d) memoized regex cache keyed on stable joined-pattern string.
 */
import { createHash } from "node:crypto";
import * as path from "node:path";

export type RedactField = "workspace" | "filename" | "branch";
export type RedactMode = "show" | "hide" | "hash";

// ---------- Hash (D-15, PRIV-01) ----------

export function normalizeForHash(
  absPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  // Use the platform-specific path module so tests on darwin can simulate win32
  // semantics (and vice versa). `path.win32` / `path.posix` have the same
  // `resolve` / `sep` shape; `path.resolve` preserves absolute win32 paths
  // even when the host is POSIX.
  const mod = platform === "win32" ? path.win32 : path.posix;
  let p = mod.resolve(absPath);
  p = p.split(mod.sep).join("/");
  if (platform === "win32" && /^[a-zA-Z]:/.test(p)) {
    p = p[0].toLowerCase() + p.slice(1);
  }
  return p;
}

export function hashWorkspace(
  absPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return createHash("sha1")
    .update(normalizeForHash(absPath, platform))
    .digest("hex")
    .slice(0, 6);
}

export function redact(field: RedactField, value: string, mode: RedactMode): string {
  switch (mode) {
    case "show":
      return value;
    case "hide":
      return "";
    case "hash":
      if (field !== "workspace") {
        throw new Error(
          `privacy mode 'hash' only supported for workspace, not ${field}`,
        );
      }
      return hashWorkspace(value);
    default:
      // Unknown mode (only reachable via `as RedactMode` cast) — default-safe to `show`.
      return value;
  }
}
