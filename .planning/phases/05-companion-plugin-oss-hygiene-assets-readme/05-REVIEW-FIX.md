---
phase: 05-companion-plugin-oss-hygiene-assets-readme
fixed_at: 2026-04-16T07:28:00Z
review_path: .planning/phases/05-companion-plugin-oss-hygiene-assets-readme/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-04-16T07:28:00Z
**Source review:** `.planning/phases/05-companion-plugin-oss-hygiene-assets-readme/05-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (Critical + Warning only; 7 Info findings out of scope)
- Fixed: 6
- Skipped: 0

After all fixes: `pnpm test` → 319 / 319 passing across 20 files; `pnpm typecheck` → clean.

## Fixed Issues

### WR-01: SECURITY.md threat model falsely claims companion detector parses lockfile contents

**Files modified:** `SECURITY.md`
**Commit:** `f830d71`
**Applied fix:** Replaced the inaccurate "size-capped (≤ 4 KB) and JSON-validated before parsing" sentence with a description that matches `src/detectors/companion.ts` reality — the detector reads `mtimeMs` only via `fs.watchFile`, never opens or parses the file, and uses a 5-minute stale-mtime threshold to reap orphaned lockfiles.

### WR-02: README.md overstates configuration-key count (claims 20, actually 14)

**Files modified:** `README.md`
**Commit:** `e172508`
**Applied fix:** Verified live count by reading `package.json` `contributes.configuration.properties` — exactly 14 keys (clientId, idleBehavior, debug.verbose, animations.enabled, messages.customPackPath, privacy.{filename,gitBranch,workspaceName}, ignore.{gitHosts,organizations,repositories,workspaces}, detect.{customPatterns,sessionFileStalenessSeconds}). Updated both prose claim (line 97) and competitive-positioning table row (line 144) from `20` to `14`. The `≤ 20` CI cap in `check-config-keys.mjs` remains the budget ceiling — it is unchanged.

### WR-03: Install commands disagree across README.md, companion/README.md, and CAPTURE-INSTRUCTIONS.md

**Files modified:** `README.md`, `assets/CAPTURE-INSTRUCTIONS.md`
**Commit:** `b1dd69e`
**Applied fix:** Standardized on `claude plugin install ./companion/claude-code-plugin` (shell subcommand) as the primary form across all three docs, with `/plugin install ./companion/claude-code-plugin` (slash command) explicitly documented as the alternative for an already-running Claude Code session. README.md now shows both forms with disambiguation; CAPTURE-INSTRUCTIONS.md was changed from the slash-only form to list both forms. `companion/claude-code-plugin/README.md` was already correct and left untouched.

### WR-04: CAPTURE-INSTRUCTIONS.md references non-existent `pnpm vscode:package` script

**Files modified:** `assets/CAPTURE-INSTRUCTIONS.md`
**Commit:** `011ca88`
**Applied fix:** Confirmed via `package.json` that no `vscode:package` script exists (scripts: `build`, `build:dev`, `watch`, `check:*`, `test`, `test:watch`, `typecheck`, `lint`). Replaced the invocation with the no-dependency-required equivalent: `pnpm build` + `npx @vscode/vsce package --no-dependencies` + `code --install-extension agent-mode-discord-*.vsix` (also using a glob for the version, which sidesteps IN-03's v0.1.0 vs 0.0.1 mismatch in this file). Added a note that Phase 6 will wrap this in a `pnpm vscode:package` script when adding `@vscode/vsce` as a devDependency for marketplace publish.

### WR-05: `companionStalenessMs` orchestrator option is never wired from `extension.ts`

**Files modified:** `src/detectors/index.ts`
**Commit:** `2d15fee`
**Applied fix:** Chose the **remove-the-knob** branch of the reviewer's two options. Wiring it through would have required a new `agentMode.detect.*` config key, breaking the just-corrected "14 settings" README claim (would become 15) and requiring updates to `config.ts`, `package.json`, `config.test.ts` ("all 14 config keys" assertion), README config table, and competitive-positioning row. The 5-minute default is documented as fixed behavior in `companion/claude-code-plugin/README.md` (line 68) and SECURITY.md (post-WR-01), so removing the unreachable option aligns the orchestrator API with reality. Tests that need to override the threshold construct `createCompanionDetector` directly with `stalenessMs` (test/detectors.companion.test.ts:67), which remains supported. Added a code comment documenting the design choice.

Verified: 319/319 tests pass, typecheck clean, no other call sites reference `companionStalenessMs`.

### WR-06: Companion shell scripts have no error handling or `set -euo pipefail`

**Files modified:** `companion/claude-code-plugin/scripts/start.sh`, `companion/claude-code-plugin/scripts/stop.sh`
**Commit:** `c006eec`
**Applied fix:** Added `set -euo pipefail` and the `${HOME:?HOME is not set}` guard to both scripts as suggested in the REVIEW.md fix block. `bash -n` syntax check passes on both files. The `${HOME:?…}` form makes a missing `$HOME` (the original silent-failure mode) loud — the script now exits non-zero with an explicit error that surfaces in Claude Code's debug log, instead of silently `mkdir -p /` + `touch ""` no-ops.

---

_Fixed: 2026-04-16T07:28:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
