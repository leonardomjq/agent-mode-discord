---
phase: 03-agent-detection
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - scripts/check-api-surface.mjs
  - src/detectors/index.ts
  - src/detectors/polling.ts
  - src/detectors/regex.ts
  - src/detectors/sessionFiles.ts
  - src/detectors/shellIntegration.ts
  - src/extension.ts
  - test/detectors.index.test.ts
  - test/detectors.polling.test.ts
  - test/detectors.regex.test.ts
  - test/detectors.sessionFiles.test.ts
  - test/detectors.shellIntegration.test.ts
  - test/detectors/__helpers__/ansiFixtures.ts
  - test/detectors/__helpers__/fakeTerminal.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-14
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 3 Wave 1 introduces a four-tier agent detection stack (shell integration, session files, polling, plus orchestrator) built on a pure-core regex matcher. The code quality is high overall: D-18 (silent-fail) is consistently enforced, pure-core boundaries are honoured (regex.ts has zero vscode imports, and `scripts/check-api-surface.mjs` mechanically polices this), DET-06's zero-false-positive short-circuit is implemented correctly, and the test coverage is substantive (orchestrator precedence, staleness clamps, ANSI fixtures, grace-cancellation pitfalls all exercised).

Findings cluster around two clock-skew edge cases in `sessionFiles.ts` (future mtimes counted as "fresh", and `Date.now()` leaking around the injected `now` clock for timer scheduling on Linux), plus a handful of small consistency/robustness nits (inconsistent `^` anchoring between `polling.ts` and `buildMatcher`, `dirPollTimer` bypassing the injected `setInterval`, `check-api-surface.mjs` regex gaps). None of these are correctness-critical for Phase 3's scope and nothing rises to a security or data-loss issue.

No critical issues.

## Warnings

### WR-01: Future-mtime (clock skew or touched-future file) counts as active indefinitely

**File:** `src/detectors/sessionFiles.ts:131-134`
**Issue:** The staleness predicate is `nowMs - mtimeMs < thresholdMs`. When `mtimeMs > nowMs` (system clock skew, filesystem on a different host, or a deliberately `touch -t`ed future mtime), the subtraction is negative, which is always `< thresholdMs`, so the file is classified as active forever. A user who ever receives a JSONL with a future mtime (NFS/Samba mount, container clock drift, restored backup) will appear to be in an agent session permanently until the file is deleted or its mtime changes. Once stuck, the Linux 5 s poll loop cannot recover either.
**Fix:** Use an absolute-delta bound (and reject clearly-future files) before comparing:
```ts
const age = nowMs - mtimeMs;
// Reject files more than 1s in the future (clock skew tolerance) AND
// files older than thresholdMs. Only files with 0 <= age < threshold are fresh.
if (age >= -1000 && age < thresholdMs) {
  anyActive = true;
  break;
}
```

### WR-02: `dirPollTimer` bypasses the injected clock — Linux dir-appearance path is hard to test and hard-codes the real `setInterval`

**File:** `src/detectors/sessionFiles.ts:213`, also `src/detectors/sessionFiles.ts:174`, `src/detectors/sessionFiles.ts:180`
**Issue:** `SessionFilesDetectorOptions` injects `now`, `platform`, and `fs`, but never `setInterval`/`clearInterval`. The three `setInterval(...)` calls therefore always resolve to the real `globalThis.setInterval`. Tests happen to work because `vi.useFakeTimers()` monkey-patches the global, but any future consumer who injects a `now` override but runs under real timers (or switches test runners) will see drift: the dir-poll / Linux poll fires on wall-clock time while staleness evaluates on the injected clock. This is the same class of bug Phase 1 guarded against in `rpc/throttle.ts` by accepting a `setTimeout` factory.
**Fix:** Add `setInterval` / `clearInterval` to `SessionFilesDetectorOptions` and thread them through, matching the shape already used by `polling.ts` and `shellIntegration.ts`:
```ts
export interface SessionFilesDetectorOptions {
  // ...existing fields...
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}
// in createSessionFilesDetector:
const setIntervalFn = opts.setInterval ?? globalThis.setInterval;
const clearIntervalFn = opts.clearInterval ?? globalThis.clearInterval;
// replace every setInterval(...) / clearInterval(...) with the injected fn.
```

## Info

### IN-01: Polling detector double-anchors user patterns; `buildMatcher` does not

**File:** `src/detectors/polling.ts:84` vs `src/detectors/regex.ts:190`
**Issue:** `polling.ts` always prepends `^`: `new RegExp("^" + p)`. `buildMatcher` is smarter: `source.startsWith("^") ? source : \`^${source}\``. A user who reads the docstring ("each pattern is auto-anchored with ^") and writes `^Claude$` for polling gets compiled as `^^Claude$`, which is a valid regex (double start-anchor is a no-op) but inconsistent with `buildMatcher`'s contract. The inconsistency makes future refactors (e.g. sharing a helper) more error-prone.
**Fix:** Use the same guard as `buildMatcher`:
```ts
const anchored = p.startsWith("^") ? p : "^" + p;
compiled.push(new RegExp(anchored));
```

### IN-02: `check-api-surface.mjs` `BAD_CAST` regex doesn't catch parenthesised double-cast

**File:** `scripts/check-api-surface.mjs:8`
**Issue:** `BAD_CAST = /\bvscode\s+as\s+(?:unknown\s+as\s+)?any\b/` catches `vscode as any` and `vscode as unknown as any`, but misses the parenthesised variant `(vscode as unknown) as any`. A determined contributor could sneak the cast past CI. Low risk — no such pattern exists today and TS-ESLint would usually flag `as any` — but if the script is the guardrail, it should close the obvious hole.
**Fix:** Broaden to allow optional paren/whitespace around the inner cast:
```js
const BAD_CAST = /\b(?:\(\s*)?vscode\s+as\s+(?:unknown\s*\)?\s*as\s+)?any\b/;
```
Or keep the script simple and rely on a `@typescript-eslint/no-explicit-any` rule in CI.

### IN-03: `check-api-surface.mjs` walks `.d.ts` files the same as `.ts`

**File:** `scripts/check-api-surface.mjs:33`
**Issue:** `full.endsWith(".ts")` matches `*.d.ts` declaration files as well as source. For pure-core enforcement, `.d.ts` files are allowed to import vscode types (they're type-only by construction), but they're currently checked as if they were runtime sources. Today there are no hand-written `.d.ts` files under `src/`, so no false positive fires, but a contributor adding e.g. `src/detectors/types.d.ts` would get a misleading failure.
**Fix:** Skip declaration files:
```js
else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) out.push(full);
```

### IN-04: Orchestrator `chosen` redundancy is harmless but trips up static analysis

**File:** `src/detectors/index.ts:92`, `src/detectors/index.ts:98`
**Issue:** The guards `if (!wasActive && isActive && chosen)` and `else if (isActive && chosen && ...)` re-check `chosen` even though `isActive === (chosen !== undefined)` by construction (line 89). This is intentional defensive code but it makes TS narrowing visible while hiding the invariant. Not a bug — just noise.
**Fix:** Either drop the redundant checks (the TS narrowing already holds via the walrus-like line 89 assignment) or extract an explicit invariant comment, e.g.:
```ts
// Invariant: isActive === (chosen !== undefined). The `&& chosen` guards below
// are for TS's benefit — runtime cannot reach them with chosen === undefined.
```

### IN-05: `shellIntegration.ts` non-agent command after an agent leaves the session in a "running" state until the agent's own end event

**File:** `src/detectors/shellIntegration.ts:174`
**Issue:** `onShellExecutionEnd` returns early when the ending command doesn't match the tracked agent (correctly, per Pitfall 6). But this means: user runs `claude`, then runs `ls` before `claude` exits. The `ls` start is no-match → early return; the `ls` end is no-match → early return; `session.graceExpiresAt` is still `null`, so the session is forever "active" until the real `claude` end event fires. In practice this is harmless because VS Code always emits an end event per execution, so the real `claude` end WILL arrive eventually — and the pitfall-6 comment argues for this behaviour. Worth a unit test, however: "intermediate non-agent command does not prematurely end the session AND does not block the later agent-end event from triggering grace." The current test suite has grace-cancellation and close-supersedes-grace but not this interleaving.
**Fix:** Add a test:
```ts
it("non-agent command between agent start and agent end does not block the agent's own end", () => {
  // fireStart(t, "claude"); fireStart(t, "ls"); fireEnd(t, "ls"); fireEnd(t, "claude");
  // expect grace timer to be armed exactly once, at the claude end.
});
```

### IN-06: `polling.ts` uses `Array.prototype.includes` on a `readonly vscode.Terminal[]`, which is O(n·m) per tick

**File:** `src/detectors/polling.ts:106`
**Issue:** On every 5 s tick, the active-set cleanup does `current.includes(t)` for each tracked terminal, then re-runs `compiled.some((re) => re.test(t.name))`. With M tracked terminals and N visible terminals, that's O(M·N + M·K) per tick where K = number of compiled patterns. For typical workloads (M, N < 10) this is irrelevant; flagging only because terminal counts can grow in integration-test farms and the fix is trivial.
**Fix:** Build a `Set` once per tick:
```ts
const currentSet = new Set(current);
for (const t of [...activeSet]) {
  const stillPresent = currentSet.has(t);
  // ...
}
```
Not required — out of scope per the v1 "performance out of scope" rule — flagged only as a micro-cleanup for future refactor.

---

_Reviewed: 2026-04-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
