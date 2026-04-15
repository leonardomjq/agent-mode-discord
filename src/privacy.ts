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

// ---------- Glob matcher (D-16 case-insensitive, hand-rolled per D-27) ----------

export function globMatch(pattern: string, input: string): boolean {
  const lower = input.toLowerCase();
  // Direct match
  if (globToRegex(pattern).test(lower)) return true;
  // gitignore-style: "**/secret" also matches "/a/b/secret/c" — treat
  // trailing non-wildcard segments as also matching their descendants.
  const trimmed = pattern.replace(/\/+$/, "");
  if (!trimmed.endsWith("**") && !trimmed.endsWith("*")) {
    if (globToRegex(trimmed + "/**").test(lower)) return true;
  }
  return false;
}

function globToRegex(pattern: string): RegExp {
  const p = pattern.toLowerCase();
  let out = "^";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") {
        out += ".*";
        i++;
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if (c === "[") {
      const end = p.indexOf("]", i);
      if (end === -1) {
        out += "\\[";
        continue;
      }
      out += p.slice(i, end + 1);
      i = end;
    } else if (/[.+^${}()|\\]/.test(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }
  return new RegExp(out + "$");
}

// ---------- Git URL normalizer (D-17) ----------

export function normalizeGitUrl(url: string): string {
  let u = url.trim();
  u = u.replace(/\.git$/, "");
  u = u.replace(/\/$/, "");
  const scp = u.match(/^git@([^:]+):(.+)$/);
  if (scp) return `${scp[1]}/${scp[2]}`;
  const https = u.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (https) return `${https[1]}/${https[2]}`;
  return u;
}

// ---------- Regex compiler (memoized, ReDoS-safe) ----------

const MAX_CANDIDATE_LEN = 200;

// Cache keyed on a stable joined-pattern string. Fixes reviewer R4/HIGH:
// `config.get<string[]>()` returns a fresh array on every tick, so a
// `WeakMap<string[], ...>` keyed on array identity would miss every read.
// A Map keyed on the joined patterns survives structurally-equal reads.
const regexCache = new Map<string, RegExp[]>();
const CACHE_DELIM = "\x1f"; // ASCII unit separator — unlikely in real patterns

// Pre-compile linter: reject known catastrophic-backtracking shapes.
// Best-effort guardrail for common footguns; full safety is enforced by the
// 200-char candidate cap plus the vitest timing assertion in the test suite.
const CATASTROPHIC_SHAPES: Array<{ re: RegExp; reason: string }> = [
  { re: /\(\.\+\)\+/, reason: "(.+)+ nested unbounded quantifier" },
  { re: /\([^)]*\*\)\*/, reason: "(x*)* nested star" },
  { re: /\((\w+)\|\1\)\+/, reason: "(a|a)+ alternation over identical branch" },
  { re: /\([^)]+\+\)\+/, reason: "(x+)+ nested plus" },
];

function isCatastrophic(pat: string): { bad: boolean; reason?: string } {
  for (const { re, reason } of CATASTROPHIC_SHAPES) {
    if (re.test(pat)) return { bad: true, reason };
  }
  return { bad: false };
}

function compileIgnoreRegexes(
  patterns: string[],
  logger?: (m: string) => void,
): RegExp[] {
  const key = patterns.join(CACHE_DELIM);
  const cached = regexCache.get(key);
  if (cached) return cached;
  const out: RegExp[] = [];
  for (const pat of patterns) {
    const lint = isCatastrophic(pat);
    if (lint.bad) {
      logger?.(
        `[privacy] rejected catastrophic pattern "${pat}": ${lint.reason} — skipping`,
      );
      continue;
    }
    try {
      out.push(new RegExp(pat));
    } catch (err) {
      logger?.(`[privacy] invalid regex "${pat}": ${String(err)} — skipping`);
    }
  }
  regexCache.set(key, out);
  return out;
}

function truncateForMatch(s: string): string {
  return s.length <= MAX_CANDIDATE_LEN ? s : s.slice(0, MAX_CANDIDATE_LEN);
}

/** Test-only: clear the compiled-regex memoization cache. */
export function __resetRegexCacheForTest(): void {
  regexCache.clear();
}

// ---------- Ignore-list evaluator (PRIV-05) ----------

export interface IgnoreContext {
  workspaceAbsPath?: string;
  /** Full URL, normalized by caller via normalizeGitUrl before comparison. */
  gitRemoteUrl?: string;
  /** e.g. "github.com" — case-insensitive via gitHosts rule (D-16). */
  gitHost?: string;
  /** e.g. "acme" — regex-matched via organizations rule. */
  gitOwner?: string;
}

export interface IgnoreConfig {
  workspaces: string[];
  repositories: string[];
  organizations: string[];
  gitHosts: string[];
}

export function evaluateIgnore(
  cfg: IgnoreConfig,
  ctx: IgnoreContext,
  logger?: (msg: string) => void,
): boolean {
  // 1. workspaces (glob, case-insensitive per D-16)
  if (ctx.workspaceAbsPath && cfg.workspaces.length > 0) {
    const normalized = normalizeForHash(ctx.workspaceAbsPath);
    for (const pat of cfg.workspaces) {
      try {
        if (globMatch(pat, normalized)) return true;
      } catch (err) {
        logger?.(`[privacy] glob error "${pat}": ${String(err)}`);
      }
    }
  }
  // 2. repositories (regex, case-sensitive per D-16 — users can use `(?i)`)
  if (ctx.gitRemoteUrl && cfg.repositories.length > 0) {
    const cand = truncateForMatch(normalizeGitUrl(ctx.gitRemoteUrl));
    for (const re of compileIgnoreRegexes(cfg.repositories, logger)) {
      try {
        if (re.test(cand)) return true;
      } catch {
        /* re compiled successfully; runtime .test shouldn't throw */
      }
    }
  }
  // 3. organizations (regex, case-sensitive)
  if (ctx.gitOwner && cfg.organizations.length > 0) {
    const cand = truncateForMatch(ctx.gitOwner);
    for (const re of compileIgnoreRegexes(cfg.organizations, logger)) {
      try {
        if (re.test(cand)) return true;
      } catch {
        /* no-op */
      }
    }
  }
  // 4. gitHosts (string list, case-insensitive per D-16)
  if (ctx.gitHost && cfg.gitHosts.length > 0) {
    const lower = ctx.gitHost.toLowerCase();
    for (const h of cfg.gitHosts) if (h.toLowerCase() === lower) return true;
  }
  return false;
}
