---
phase: 04-personality-config-privacy
reviewed: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/config.ts
  - src/extension.ts
  - src/gitBranch.ts
  - src/outputChannel.ts
  - src/presence/activityBuilder.ts
  - src/presence/animator.ts
  - src/presence/goblin.json
  - src/presence/packLoader.ts
  - src/presence/templater.ts
  - src/presence/types.ts
  - src/privacy.ts
  - scripts/check-api-surface.mjs
  - scripts/check-config-keys.mjs
  - scripts/check-no-network.mjs
  - scripts/check-pack-inlined.mjs
  - scripts/__fixtures__/forbidden-fixture.cjs
findings:
  critical: 0
  high: 1
  medium: 4
  low: 4
  info: 4
  total: 13
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-15
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 04 adds the goblin-pack animator, templater, privacy redaction + ignore-list evaluator, config reader, pack loader, activity builder, VS Code wiring, and four CI guards. Overall the code is carefully structured: pure-core boundary is enforced via a CI script, all external side effects are injected via options-bags (D-12 pattern), validators are zero-dep and enumerate only known keys (T-04-02 mitigation), and the network-guard is strict (fetch promoted to FAIL, TCP-net heuristic). Error handling is uniformly try/catch → debug-log → silent degrade per D-28.

Main concerns: one **high-severity** cross-platform bug in the ignore-list glob matcher (Windows path separators are not normalized before matching, so `ignore.workspaces` patterns will silently never fire on Windows hosts); one concurrency race in `extension.ts` where the async branch refresh can clobber a concurrent state update; a few smaller robustness issues (unbounded regex cache, multi-root git workspace ignored, readConfig() called inside every log line, TOCTOU between stat/readFile in the pack loader). No critical security issues, no hardcoded secrets, no crash paths, no injection vectors.

## High Issues

### HI-01: Glob matcher fails on Windows workspace paths

**File:** `src/privacy.ts:217-225` (and `src/privacy.ts:72-114`)
**Category:** bug
**Issue:** `evaluateIgnore` normalizes the workspace path via `normalizeForHash(ctx.workspaceAbsPath)` which converts separators to forward-slash. However, `globToRegex` converts `*` to `[^/]*` — which is correct for the normalized input — but the user-supplied glob pattern is not itself separator-normalized. A user on Windows supplying `C:\projects\secret\**` (or the VS Code settings UI auto-producing a backslash path) will match against `c:/projects/secret/...`, and the literal `\p`, `\s` sequences in the pattern get escaped per the `/[.+^${}()|\\]/` branch and never match. Result: `ignore.workspaces` silently fails for any backslash pattern on Windows. This is a privacy-affecting bug — a user configured to ignore a workspace will still broadcast it.

**Fix:**
```ts
export function globMatch(pattern: string, input: string): boolean {
  // Normalize BOTH sides to POSIX-style before matching.
  const normalizedPattern = pattern.split("\\").join("/");
  const normalizedInput = input.split("\\").join("/");
  const lower = normalizedInput.toLowerCase();
  if (globToRegex(normalizedPattern).test(lower)) return true;
  const trimmed = normalizedPattern.replace(/\/+$/, "");
  if (!trimmed.endsWith("**") && !trimmed.endsWith("*")) {
    if (globToRegex(trimmed + "/**").test(lower)) return true;
  }
  return false;
}
```
Add a test case: `globMatch("C:\\projects\\secret\\**", "c:/projects/secret/x")` must return `true`.

## Medium Issues

### ME-01: Async branch refresh can clobber concurrent state updates

**File:** `src/extension.ts:129-139`
**Category:** bug
**Issue:** On a state-kind transition, `getCurrentBranch()` is awaited, then `state = { ...state, branch } as State` overwrites the module-level `state`. If another `dispatch()` runs synchronously between the `await` resolving and this assignment (e.g., a new event from a detector), that update is written first, then silently overwritten by the stale-plus-branch snapshot. Because `ext.activate()` can take hundreds of ms on cold start, the window is non-trivial.

**Fix:** Either capture a sequence number and discard stale resolutions, or apply the branch update via dispatch so the reducer is the single writer:
```ts
void getCurrentBranch(...).then((branch) => {
  if (shuttingDown) return;
  // Merge into latest state, not the captured one.
  state = { ...state, branch } as State;
  activityBuilder.forceTick();
});
```
Today this already reads `state` fresh at closure-exit via module scope, so the fix is `state = { ...state, branch }` (already present). The real risk is a race where dispatch between now and the .then replaces `state.kind` — and the branch overwrite races. Consider guarding with the previous state.kind and skipping the merge if kind changed again.

### ME-02: Unbounded regex cache in privacy.ts

**File:** `src/privacy.ts:137,179`
**Category:** quality
**Issue:** `regexCache: Map<string, RegExp[]>` grows indefinitely. Any change to `ignore.repositories` or `ignore.organizations` inserts a new entry without evicting the prior one. Over a long VS Code session with frequent config edits, memory grows. Low practical risk, but the cache is unbounded with no TTL, no size cap, and no LRU eviction.

**Fix:** Cap the cache at a small size (e.g., 16 entries) and evict FIFO/LRU:
```ts
const MAX_CACHE = 16;
// after regexCache.set(key, out):
if (regexCache.size > MAX_CACHE) {
  const firstKey = regexCache.keys().next().value;
  if (firstKey !== undefined) regexCache.delete(firstKey);
}
```

### ME-03: `readConfig()` called on every log line

**File:** `src/outputChannel.ts:26-28`
**Category:** quality/perf-adjacent
**Issue:** `log()` defaults to `verboseOnly: true`, which forces a synchronous `vscode.workspace.getConfiguration("agentMode")` read per log statement to check `debug.verbose`. The packLoader logs once per tick on fallback; evaluateIgnore logs on each invalid regex. On hot paths (rotation tick = 20s, small cost) this is fine, but the pattern couples a log sink to the full config subsystem. If debug.verbose is off (default), we still pay for the config read.

**Fix:** Cache `debug.verbose` in a module variable updated by the `onDidChangeConfiguration` listener in `extension.ts`, or accept a `shouldLog: () => boolean` callback at channel-construct time. Either keeps `log()` O(1).

### ME-04: TOCTOU between `stat` and `readFile` in pack loader

**File:** `src/presence/packLoader.ts:142-155`
**Category:** security (low-risk, user-owned file)
**Issue:** `stat` checks size first, then `readFile` reads the contents. Between those calls the file could be replaced with a larger payload. Because the path is user-configured and the max is 100 KB, the DoS vector is limited, but the size guarantee is not atomic. A symlink swap to `/dev/zero` or `/dev/random` between stat and read would bypass the size cap.

**Fix:** Read with a byte limit rather than stat-then-read. Use a single `fs.openSync` + `readSync` capped at `MAX_CUSTOM_PACK_BYTES + 1` and reject if the buffer fills:
```ts
// readFile deps signature: (path, maxBytes) => { truncated: boolean; content: string }
```
Alternatively, accept the TOCTOU given the threat model (user editing their own config path); document it explicitly in `T-04-01` mitigation notes.

## Low Issues

### LO-01: Multi-root workspaces only check the first git repository

**File:** `src/gitBranch.ts:44-45`
**Category:** bug
**Issue:** `api.repositories[0]?.state?.HEAD` always reads the first repo. In a multi-root VS Code workspace, the repository matching the active file is ignored. The branch shown in Discord could belong to a completely different repo than the one the user is actually editing.

**Fix:** Resolve the repository matching `vscode.window.activeTextEditor?.document.uri` first, fall back to `[0]`:
```ts
const active = vscode.window.activeTextEditor?.document.uri;
const repo = active
  ? api.repositories.find(r => active.fsPath.startsWith(r.rootUri.fsPath))
  : undefined;
const head = (repo ?? api.repositories[0])?.state?.HEAD;
```
Requires broadening the `GitAPI` type to include `rootUri`. Document as known limitation if deferring.

### LO-02: `pickFromPool` idx clamping order masks bugs

**File:** `src/presence/animator.ts:132-135`
**Category:** quality
**Issue:** The guard sequence is: compute `idx = Math.floor(rand() * pool.length)`, then clamp `idx >= pool.length` → `pool.length - 1`, then `idx < 0` → `0`. `Math.floor(rand() * pool.length)` with `rand() >= 0` cannot produce a negative index; the `idx < 0` branch is dead. The `idx >= pool.length` guard only fires for the `rand() === 1.0` edge case (spec says rand is `[0, 1)` but `Math.random` can technically return values very close to 1). Minor: the dead branch is defensive but obscures intent.

**Fix:** Drop the `idx < 0` guard or comment "defensive — `rand()` is contractually `[0,1)` but some injected clocks round up". The `>= pool.length` guard is legitimate defensive coding.

### LO-03: `timeOfDayBucket` comment claims DST-safe but uses `getHours()`

**File:** `src/presence/animator.ts:77-85`
**Category:** bug (edge case)
**Issue:** `timeOfDayBucket` uses `d.getHours()`, which is local time and does handle DST transitions correctly in most cases. However, during a DST fall-back the hour 01:00–02:00 repeats, and during spring-forward 02:00–03:00 is skipped. This is normally irrelevant (1-hour anomaly once per year), but the comment "DST is handled transparently by Date" oversells. Not a real bug, just a documentation claim to soften.

**Fix:** Change comment to "Local time via getHours() — DST transitions produce a ±1h bucket anomaly twice/year; acceptable for copy rotation."

### LO-04: `formatElapsed` `typeof ms !== "number"` check is redundant

**File:** `src/presence/activityBuilder.ts:56`
**Category:** quality
**Issue:** The function signature is `ms: number`. The runtime `typeof ms !== "number"` guard is unreachable under strict TS. Defensive for the `as SetActivity` escape hatch callers, but dead per the type system. Keep for boundary-robustness, but document as such.

**Fix:** Either drop and rely on TS, or comment `// defensive: consumers occasionally pass undefined through ?? chains`.

## Info

### IN-01: `_primary` shape contradiction in `isAgentActivePool`

**File:** `src/presence/packLoader.ts:104-112`
**Category:** quality
**Issue:** The loop `for (const k of Object.keys(o))` validates every key including `_primary`, then the explicit `if (!isMessageArray(o._primary))` check above is redundant with the loop. The explicit check is fine as a fail-fast but the comment should note the loop would catch it anyway.

**Fix:** No action needed; optional cleanup to drop the explicit `_primary` check now that the generic loop covers it.

### IN-02: `void cfg` reserved-for-future comment

**File:** `src/presence/animator.ts:186`
**Category:** quality
**Issue:** `pickNextMessage` takes `cfg: AgentModeConfig` but only uses `void cfg`. This is a YAGNI-adjacent placeholder and also adds a required parameter that provides no value today. Consider removing from the signature until a real consumer lands.

**Fix:** Remove the parameter; re-add when the first consumer needs it. Or keep with a clearer comment on the intended future use.

### IN-03: Dead branch — workspace hash path can't hit `""` fallback

**File:** `src/presence/activityBuilder.ts:87-93`
**Category:** quality
**Issue:** `if (workspaceRaw)` guards the entire block, then the ternary decides `show` → basename vs else → redacted. When mode is `"hide"`, `redact` returns `""`, and we assign `workspace = ""`. That's correct, but it reads ambiguously next to the `if (workspaceRaw)` guard. A brief comment would help future readers.

**Fix:** Add inline comment `// redact() returns "" for mode='hide'; no extra handling needed`.

### IN-04: `extension.ts` state-extension cast

**File:** `src/extension.ts:100-108`
**Category:** quality
**Issue:** `const anyState = state as State & { gitRemoteUrl?: string }` — State doesn't yet carry `gitRemoteUrl`. The comment explicitly calls this out as a future integration point. Acknowledged, but a TODO-tagged follow-up task would make it harder to forget.

**Fix:** Either add a TODO with a phase tag: `// TODO(phase-5): thread gitRemoteUrl through State`, or extend the State type now so `anyState` is no longer needed.

---

## Next Steps

1. **HI-01** should be fixed before release — it silently breaks a privacy feature on Windows hosts.
2. **ME-01** should be patched with a small reordering; the state-race is latent but real and low-cost to fix.
3. **ME-02 through ME-04** are maintainability/robustness items — address opportunistically or schedule for Phase 5 polish.
4. **LO-01** (multi-root git) should at minimum be documented in `04-HUMAN-UAT.md` as a known limitation if not fixed.
5. **Info items** are commentary — no action required.

---

_Reviewed: 2026-04-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
