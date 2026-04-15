/**
 * Phase-4 pure-core templater (PERS-06).
 *
 * Substitutes the 6 canonical tokens — {workspace} {filename} {language} {branch}
 * {agent} {elapsed} — at render time. Unknown tokens (including typos) render
 * as empty strings, never as the literal `{foo}`, so a pack author's typo never
 * leaks into Discord.
 *
 * The animator (04-02) and activityBuilder (04-04) call `renderTemplate` per
 * message (and per frame for string[] sequences). Blank-skip semantics are
 * documented on `isBlank`: this module only detects fully-whitespace output —
 * the animator owns the skip-cap policy (10 attempts then hard-fallback per
 * 04-RESEARCH Pitfall 2).
 *
 * Pure-core — no vscode import, no side effects, deterministic.
 *
 * Threat mitigation T-04-03 (ReDoS): the token regex `/\{(\w+)\}/g` is linear —
 * no nested quantifiers, no user-supplied pattern compilation here.
 */

export interface TemplateTokens {
  workspace?: string;
  filename?: string;
  language?: string;
  branch?: string;
  agent?: string;
  elapsed?: string;
}

const TOKEN_RE = /\{(\w+)\}/g;

/** Substitutes `{token}` placeholders with their string value. Unknown or
 *  undefined tokens render as `""` (never as the literal `{token}`). */
export function renderTemplate(message: string, tokens: TemplateTokens): string {
  return message.replace(TOKEN_RE, (_match, key: string) => {
    const val = (tokens as Record<string, string | undefined>)[key];
    return typeof val === "string" ? val : "";
  });
}

/** True iff the input is empty or contains only whitespace (after trim).
 *  Callers use this to implement PERS-06 skip-blank semantics — a message
 *  that rendered to `""` or `"   "` should rotate to the next pick. */
export function isBlank(s: string): boolean {
  return s.trim().length === 0;
}
