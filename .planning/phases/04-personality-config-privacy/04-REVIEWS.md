---
phase: 4
reviewers: [cursor]
reviewed_at: 2026-04-15T14:08:18Z
plans_reviewed: [04-00, 04-01, 04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09]
model: auto (cursor free plan)
notes: claude skipped (running inside Claude Code); gemini/codex/opencode/qwen/coderabbit not installed
---

# Cross-AI Plan Review — Phase 4

## Cursor Review

## 04-00-PLAN Review

### Summary
Strong Wave-0 scaffolding plan with good coverage mapping to requirements and clear guardrails, but it mixes executable implementation details into a scaffolding phase and includes a couple of brittle verification commands that may fail due to tooling assumptions (`grep`, `tail`, runtime command shapes).

### Strengths
- Excellent requirement traceability: directly maps PERS/PRIV/CONF to test files.
- Good sequencing: establishes helpers and CI guard scripts before implementation work.
- Explicit pure-core guard extension is a strong architectural control.
- Human UAT checklist is concrete and aligned to success criteria.
- Safe-empty behavior for new checks is pragmatic for early wave.

### Concerns
- **MEDIUM**: Verification commands rely on shell patterns forbidden elsewhere in your standards (plan text uses `grep`, `tail`) and may create process mismatch for executors.
- **MEDIUM**: `check-no-network` skeleton whitelisting strategy is underdefined and could create false confidence.
- **LOW**: Scaffolding plan prescribes too many implementation specifics for later phases, increasing coupling.
- **LOW**: `it.todo` volume is large; maintenance burden if requirements shift mid-phase.

### Suggestions
- Keep 04-00 strictly scaffold-only; move behavior-rich acceptance to 04-01+ plans.
- Replace brittle shell verification snippets with a single script-based validation command.
- Add one “coverage index” file listing requirement → test stub to reduce drift risk.
- Clarify that TODO descriptions are normative but not exact-string locked.

### Risk Assessment
**MEDIUM** — good foundation, but risk of process friction and false-positive confidence from skeletal guardrails.

---

## 04-01-PLAN Review

### Summary
Well-scoped and high quality. It correctly centralizes pack types/validation/loading with fallback behavior and addresses prototype-pollution and oversized file concerns. Main risk is temporary minimal built-in pack behavior until 04-05, which can cause inconsistent behavior in parallel work.

### Strengths
- Clear separation of `types.ts` and `packLoader.ts`.
- Strong validator contract (`ValidateResult`) with deterministic fallback.
- Good handling of invalid JSON, ENOENT, oversized files.
- Explicit no-toast/logging behavior consistent with project policy.
- Pure-core enforcement updated in same plan.

### Concerns
- **MEDIUM**: Temporary “minimal builtin” (until 04-05) can break assumptions in downstream tests/plans if sequencing slips.
- **LOW**: `now` dep in `PackLoaderDeps` appears unused in core behavior.
- **LOW**: Returning `p as Pack` after validation is acceptable, but stronger narrowing could reduce future schema drift bugs.

### Suggestions
- Require 04-05 before any behavior tests that depend on real goblin pool sizes.
- Remove unused `now` dep unless needed for future cache behavior.
- Add explicit test for array-of-frames containing empty strings (edge case).

### Risk Assessment
**LOW-MEDIUM** — technically solid with minor sequencing sensitivity.

---

## 04-02-PLAN Review

### Summary
This is the highest-complexity plan and mostly well-designed: two-clock model, weighted pool selection, per-pool no-repeat memory, and blank-skip cap are all aligned with requirements. Biggest risks are subtle state/render race conditions and overfitting implementation details into tests.

### Strengths
- Correctly models independent 20s rotation + 2s frame clocks.
- Per-pool no-repeat memory is the right fix for cross-pool repeat drift.
- Explicit fallback redistribution logic is requirement-faithful.
- Blank-skip cap with hard fallback prevents infinite loops.
- Injected dependencies make deterministic timer/random tests feasible.

### Concerns
- **HIGH**: `renderCurrent` re-calls `getContext()` at frame ticks; if state changes between rotation/frame ticks, rendered frame may mix old message with new tokens.
- **MEDIUM**: Weighted fallback math is described but not fully encoded as normalized probability assertions in tests.
- **MEDIUM**: Plan risks code size/complexity overflow in one file (<300 lines hard).
- **LOW**: `pickFromPool` is “not truly Fisher-Yates,” just anti-repeat random index; naming mismatch may confuse maintainers.

### Suggestions
- Snapshot context at rotation boundaries (or intentionally document frame-time live token behavior).
- Add probability sanity tests over large sample windows with tolerance bands.
- Split helpers into internal sections to keep file maintainable.
- Rename helper from “Fisher-Yates” to “no-repeat random picker” unless true shuffle queue is used.

### Risk Assessment
**MEDIUM-HIGH** — behaviorally correct direction, but subtle timing/token consistency bugs are likely if not carefully implemented.

---

## 04-03-PLAN Review

### Summary
Clean, focused, low-risk plan. It solves templating with minimal complexity and keeps pure-core boundaries intact. Main caveat is unknown-token-to-empty behavior potentially hiding content mistakes silently.

### Strengths
- Very well scoped and implementable quickly.
- Deterministic pure function design.
- Explicit blank detection helper separation is good for animator integration.
- Linear regex choice avoids ReDoS concerns.
- Good testability.

### Concerns
- **LOW**: Unknown-token drop to empty can mask pack authoring mistakes.
- **LOW**: Leaves punctuation artifacts (`" · "`) by design; acceptable but may feel odd in practice.
- **LOW**: No token escaping needed now, but worth documenting.

### Suggestions
- Add optional debug-only warning hook for unknown tokens (not runtime-visible unless verbose).
- Add one snapshot test covering mixed known/unknown token strings.
- Document that cleanup of punctuation artifacts is intentionally out of scope.

### Risk Assessment
**LOW** — straightforward and robust.

---

## 04-04-PLAN Review

### Summary
Good glue-layer design and correctly captures clear-once semantics for ignore/idle without disconnecting RPC. Main risk is state flag coupling (`lastWasCleared`) for two independent reasons (ignore vs idle clear), which can cause incorrect suppression/resume behavior.

### Strengths
- Strong alignment with D-14/D-20 clear-once policies.
- Keeps RPC lifecycle constraints intact (`clearActivity`, no `setActivity(null)`, no destroy).
- Clear interfaces for extension adapter wiring.
- Good elapsed formatter behavior and token-building responsibility split.

### Concerns
- **HIGH**: Single `lastWasCleared` flag is overloaded for ignore and idle conditions; transitions between conditions may suppress required clears or early resume.
- **MEDIUM**: `buildPayload` using only `details` may underuse Discord `state` channel and constrain future UX.
- **MEDIUM**: Workspace basename + hash path handling in one helper is easy to regress.
- **LOW**: Potential stale branch unless extension wiring updates branch aggressively.

### Suggestions
- Track clear state with reason enum (`none | ignore | idle`) instead of boolean.
- Add tests for ignore→idle and idle→ignore transitions explicitly.
- Keep `buildPayload` open for future `state` usage but define v0.1 rationale in code comments.
- Add regression test for hashed workspace while show-mode uses basename.

### Risk Assessment
**MEDIUM** — correct architecture, but clear-state logic needs refinement to avoid edge bugs.

---

## 04-05-PLAN Review

### Summary
Simple data-commit plan and largely fine. The biggest issue is enforcing “verbatim” JSON content while later logic may depend on normalization or compatibility changes; also some verification commands assume TS runtime import patterns that may not work as written.

### Strengths
- Clear objective, minimal scope.
- Canonical pack inclusion prevents copy drift.
- Good emphasis on message length constraints.
- Bundle-inlining verification is practical.

### Concerns
- **MEDIUM**: “Verbatim” lock can block legitimate fixes if schema evolves slightly.
- **LOW**: Verification command snippets are brittle (`require('./src/presence/packLoader.ts')`).
- **LOW**: Unicode arrow is intentional, but ASCII-default policy exception should be documented once.

### Suggestions
- Keep content canonical but allow explicit “revision with decision log” path.
- Validate with `validatePack` in test suite, not ad-hoc node one-liners.
- Add one JSON schema smoke test tied to pack file.

### Risk Assessment
**LOW-MEDIUM** — low technical risk, minor process brittleness.

---

## 04-06-PLAN Review

### Summary
Strong config foundation plan with good schema discipline and low conceptual risk. The biggest risk is drift between `package.json` defaults and `readConfig()` defaults over time, plus tight coupling of logging to config reads.

### Strengths
- Proper namespace structure and key-cap governance.
- `readConfig()` shape is clear and aligned with requirements.
- `clientId` fallback behavior is explicitly handled.
- Output channel singleton + debug gating matches no-toast posture.
- `check-config-keys` script is valuable and pragmatic.

### Concerns
- **MEDIUM**: Default-value duplication (`package.json` + `readConfig`) invites drift.
- **MEDIUM**: `log()` reading config each call can be noisy in hot paths.
- **LOW**: `__resetForTest` in production module is okay but should be explicitly test-only guarded in docs.
- **LOW**: Key order constraints are cosmetic and can create unnecessary diff churn.

### Suggestions
- Add one test that compares schema defaults vs `readConfig` defaults.
- Consider `log` caller responsibility for verbosity in hot loops to avoid repeated config reads.
- Keep `check-config-keys` validating enumDescriptions length equality (good) and consider required `type`.

### Risk Assessment
**MEDIUM** — functionally strong, but long-term drift risk unless cross-check tests are added.

---

## 04-07-PLAN Review

### Summary
Very important and mostly well-designed plan. It handles privacy and ignore semantics comprehensively, but regex memoization strategy (array identity via `WeakMap`) is weak with per-tick fresh arrays and may not deliver intended performance. Also, privacy bypass risk exists if ignore context fields are missing upstream.

### Strengths
- Correct hash normalization spec implementation.
- Good separation between pure-core privacy logic and VS Code git adapter.
- Strong handling of invalid regex patterns and silent degradation.
- Correct git URL normalization and case semantics.
- Clear test coverage intent for security/performance edge cases.

### Concerns
- **HIGH**: `WeakMap<string[], RegExp[]>` memoization likely ineffective because config reads usually create new arrays each tick.
- **MEDIUM**: ReDoS mitigation via truncation helps but doesn’t fully prevent pathological regex runtime.
- **MEDIUM**: Ignore matching depends on `gitRemoteUrl/gitOwner/gitHost` being populated; if extension wiring omits them, ignore rules silently underperform.
- **LOW**: Throwing on `hash` mode for non-workspace fields could be noisy if misconfigured; maybe safer to degrade/log.

### Suggestions
- Memoize by stable key (joined pattern string) rather than array identity.
- Add timeout-budget test around pathological regexes and document limitations.
- Ensure extension wiring guarantees ignore context hydration or logs when unavailable.
- Consider non-throw behavior for unsupported hash mode in production path (return empty + debug log).

### Risk Assessment
**MEDIUM-HIGH** — critical correctness area; good design but performance and integration details need tightening.

---

## 04-08-PLAN Review

### Summary
Necessary integration plan with solid end-to-end intent, but this is the most integration-risky piece. It introduces multiple moving parts in `extension.ts` at once (activity builder, pack loading, config listener, branch refresh), which can cause subtle race conditions and duplicate force-ticks.

### Strengths
- Correctly centralizes all extension wiring in one plan to avoid merge conflicts.
- Preserves existing throttle/RPC seams instead of re-architecting.
- Adds live-reload listener consistent with lazy config reads.
- Explicit cleanup in deactivate path.

### Concerns
- **HIGH**: Double `forceTick` on state transitions + async branch refresh can cause churn and redundant updates.
- **HIGH**: Assumptions about state fields (`gitRemoteUrl`, `branch`) may not match existing `State` type, leading to adapter leakage or silent no-op ignore matching.
- **MEDIUM**: Repeated `readConfig()` + `loadPack()` per tick may be heavier than needed (likely okay but should be measured).
- **MEDIUM**: Extracting git host/owner via string split on normalized URL can break on malformed remotes.

### Suggestions
- Debounce/serialize `forceTick` calls around branch refresh.
- Confirm `State` contract first; if fields missing, add explicit adapter function with safe defaults.
- Cache pack load result for one tick execution path to avoid duplicate reads in same render cycle.
- Add integration test around config flip + state transition + branch refresh ordering.

### Risk Assessment
**HIGH** — central integration point; likely source of regressions if not executed carefully.

---

## 04-09-PLAN Review

### Summary
Good CI guardrail intent, but static grep alone is weaker than PRIV-07 wording (“zero outbound HTTP requests”) and can miss obfuscated/dynamic patterns while also producing occasional false positives. Still useful as a pragmatic baseline.

### Strengths
- Fast, deterministic CI check that blocks obvious regressions.
- Properly positioned after build step.
- Includes `check:config-keys` integration in CI.
- Explicitly avoids over-whitelisting forbidden patterns.

### Concerns
- **MEDIUM**: Static token scan cannot prove runtime no-network behavior; requirement language implies stronger assurance.
- **MEDIUM**: `fetch(` treated as warning (not fail) weakens guardrail.
- **LOW**: Regex-based scanning can be brittle against minified/transformed code style changes.
- **LOW**: Negative test (“temporarily add undici”) is manual and easy to skip.

### Suggestions
- Promote suspicious `fetch(` to fail unless explicitly allowlisted with rationale.
- Add optional nightly runtime intercept test in follow-up (as you note) and link it to PRIV-07 hardening.
- Version-lock scan patterns in one constant with documented rationale to reduce accidental edits.
- Emit matched snippet context to improve debuggability in CI logs.

### Risk Assessment
**MEDIUM** — valuable guardrail, but not sufficient alone to fully satisfy strict “no outbound HTTP” assurance.

---

## Cross-Plan Overall Assessment

### Summary
The phase is well-architected and thoughtfully decomposed (scaffold → core modules → integration → CI guardrails). The biggest systemic risks are in integration/state timing (`04-08`), clear-state logic (`04-04`), and privacy/ignore performance semantics (`04-07`). If those three are tightened, the plan set is strong and likely to meet Phase-4 goals.

### Key Cross-Plan Strengths
- Strong requirement traceability and explicit success criteria.
- Good pure-core discipline with adapter boundaries.
- Clear security awareness (ReDoS, proto pollution, no outbound HTTP).
- Deterministic testing strategy with injected clocks/randomness.

### Key Cross-Plan Risks
- **HIGH**: Integration races and duplicate renders in `extension.ts`.
- **MEDIUM**: Clear-once boolean state model too coarse for dual clear reasons.
- **MEDIUM**: Regex memoization ineffectiveness + potential ignore under-hydration.
- **MEDIUM**: Network assertion may be interpreted as stronger than it is.

### Recommended Priority Fixes (before execution)
1. Refine `createActivityBuilder` clear-state tracking to reason-based state.
2. Harden `04-08` sequencing around branch refresh and `forceTick`.
3. Change regex memoization key strategy in `privacy.ts`.
4. Strengthen `check-no-network` to fail on `fetch(` unless explicitly justified.
5. Add one cross-check test ensuring `package.json` defaults match `readConfig()` defaults.

### Overall Risk
**MEDIUM** — high-quality planning with a few high-impact integration/security-verification gaps that are fixable before implementation.

---

## Consensus Summary

Only one external reviewer (cursor) — no cross-model consensus available.

### Cursor's top concerns

Review the full cursor output above. Recurring themes to weigh when feeding back via `/gsd-plan-phase 4 --reviews`:

- Verification snippets using raw shell patterns (grep/tail) in acceptance_criteria may conflict with repo conventions; consider replacing with script-based validation.
- `check-no-network` whitelist strategy needs sharper definition to avoid false-positive safety.
- 04-00 scaffolding includes too many implementation specifics for later phases — keep strictly scaffold-only.
- ReDoS mitigation for user-supplied regex should be audited beyond the 200-char truncate.
- Fisher-Yates no-repeat + per-pool lastPicked invariants need explicit test cases for state transitions (confirmed not-reset per D-04).

### Next

`/gsd-plan-phase 4 --reviews` to replan incorporating cursor's feedback, or proceed to `/gsd-execute-phase 4` if you want to address review comments inline during execution.
