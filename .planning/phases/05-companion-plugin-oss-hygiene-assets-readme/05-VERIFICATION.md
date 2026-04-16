---
phase: 05-companion-plugin-oss-hygiene-assets-readme
verified: 2026-04-16T07:15:00Z
status: human_needed
score: 16/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm main branch protection is enforced at the GitHub repo level (Settings > Branches > Branch protection rules)"
    expected: "main branch requires PR + passing CI; no direct pushes allowed"
    why_human: "GitHub branch protection rules are a remote repository setting — cannot be verified from local filesystem or git commands without admin API access"
  - test: "Record assets/demo.gif following assets/CAPTURE-INSTRUCTIONS.md — run claude in VS Code terminal with companion plugin installed and Discord open"
    expected: "GIF shows Discord sidebar flipping from Idling to AGENT_ACTIVE within 15-30 seconds, file is under 8 MB, loops cleanly"
    why_human: "Requires live Discord client, VS Code extension loaded, companion plugin installed, and screen recording — explicitly deferred by user at checkpoint in plan 05-06"
---

# Phase 5: Companion Plugin + OSS Hygiene + Assets + README — Verification Report

**Phase Goal:** Three parallel sub-deliverables — Claude Code companion plugin (tier-1 detector signal per D-01), OSS repo hygiene + CI workflow, demo GIF + portfolio-grade README. No `src/` changes except `src/detectors/companion.ts` + orchestrator wiring.
**Verified:** 2026-04-16T07:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Lockfile at ~/.claude/agent-mode-discord.lock is watched via fs.watchFile and dispatches agent-started/agent-ended | VERIFIED | `src/detectors/companion.ts` lines 100, 89, 92 — watchFile with listener dispatching agent-started (mtimeMs>0, !stale) and agent-ended (file gone or stale) |
| 2 | Lockfile older than 5 minutes treated as orphaned and dispatches agent-ended | VERIFIED | `src/detectors/companion.ts:85` — `now() - curr.mtimeMs > stalenessMs`; DEFAULT_STALENESS_MS = 5min; 9/9 tests pass including staleness test |
| 3 | Companion tier-1 suppresses lower tiers when active | VERIFIED | `src/detectors/index.ts:84` — `for (const tier of [1, 2, 3, 4])` linear scan breaks on first hit; tier-1 wins all lower tiers |
| 4 | companion/** is excluded from VSIX package | VERIFIED | `.vscodeignore:9` — `companion/**` present; `assets/**` also present |
| 5 | companion/claude-code-plugin/ contains valid Claude Code plugin structure | VERIFIED | `.claude-plugin/plugin.json` (name, version, description, author, license); `hooks/hooks.json` (SessionStart + SessionEnd hooks with ${CLAUDE_PLUGIN_ROOT} paths) |
| 6 | SessionStart hook writes lockfile; SessionEnd hook removes it | VERIFIED | `hooks/hooks.json` — SessionStart matcher `startup\|resume` calls `start.sh`; SessionEnd matcher `*` calls `stop.sh`; `start.sh` does `touch $LOCKFILE`; `stop.sh` does `rm -f $LOCKFILE`; both are executable (+x) |
| 7 | LICENSE contains MIT text with 2026 and Leonardo Jaques | VERIFIED | `LICENSE` — "MIT License", "Copyright (c) 2026 Leonardo Jaques" confirmed |
| 8 | CODE_OF_CONDUCT.md is Contributor Covenant 2.1 with contact method filled | VERIFIED | "Contributor Covenant Code of Conduct", "version 2.1", no [INSERT ...] placeholders — contact replaced with GitHub Issues link |
| 9 | SECURITY.md and CONTRIBUTING.md exist with required content | VERIFIED | SECURITY.md has "Reporting a Vulnerability" section; CONTRIBUTING.md has Conventional Commits, pnpm install, "passion project" maintainer-posture |
| 10 | GitHub issue + PR templates have all required structured fields | VERIFIED | `bug_report.md` has `debug.verbose` capture; `feature_request.md` has Persona (Marcus/Steph) checkboxes; `PULL_REQUEST_TEMPLATE.md` has `pnpm test` + no new runtime dependencies |
| 11 | CI runs on pull_request with 3-OS matrix (ubuntu, macos, windows) | VERIFIED | `.github/workflows/ci.yml` — `on: pull_request`, matrix `[ubuntu-latest, macos-latest, windows-latest]`, `fail-fast: false` |
| 12 | CI steps include pnpm install --frozen-lockfile, pnpm lint, pnpm test, pnpm build, pnpm check:bundle-size | VERIFIED | All 5 steps confirmed in ci.yml (lines 30, 34, 39, 45, 51) |
| 13 | pnpm lint runs tsc --noEmit; lint script exists in package.json | VERIFIED | `package.json` — `"lint": "tsc --noEmit"` |
| 14 | Dependabot configured for npm and github-actions with weekly schedule | VERIFIED | `.github/dependabot.yml` — both ecosystems, `interval: "weekly"` |
| 15 | README has all 13 sections per D-12 in order (tagline, demo GIF, features, install, goblin preview, config, privacy FAQ, competitive table, troubleshooting, contributing, sponsor, license, maintainer-posture) | VERIFIED | README.md 200 lines — all 13 sections confirmed; demo GIF placeholder comment at line 14; competitive table with vscord/discord-vscode/RikoAppDev; troubleshooting covers Cursor-on-Windows, fish, cmd.exe, Flatpak Discord |
| 16 | package.json repository URL updated to leonardojaques/agent-mode-discord | VERIFIED | `package.json` — `"url": "https://github.com/leonardojaques/agent-mode-discord.git"` |
| 17 | main branch protection requires PR + green CI before merge | UNCERTAIN — human needed | CONTRIBUTING.md documents branch protection (line 52: "A pull request (no direct pushes)"; line 54: "Owner self-approval is allowed"); actual GitHub branch protection rule enforcement cannot be verified from filesystem |

**Score:** 16/17 truths verified (1 uncertain — escalated to human verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/detectors/companion.ts` | fs.watchFile-based tier-1 companion lockfile detector | VERIFIED | 118 lines; exports createCompanionDetector, CompanionDetector, CompanionDetectorOptions; fs.watchFile on line 100 |
| `src/detectors/index.ts` | Updated orchestrator with tier-1 wiring | VERIFIED | 165 lines; TierNumber = 1\|2\|3\|4; companion wired as tier-1; iterates [1,2,3,4] |
| `test/detectors.companion.test.ts` | Unit tests for companion detector (min 60 lines) | VERIFIED | 198 lines; 9 tests all passing |
| `companion/claude-code-plugin/.claude-plugin/plugin.json` | Plugin manifest | VERIFIED | name, version, description, author, license all present |
| `companion/claude-code-plugin/hooks/hooks.json` | SessionStart + SessionEnd hooks | VERIFIED | Both hooks declared with ${CLAUDE_PLUGIN_ROOT} path references; matcher startup\|resume and * |
| `companion/claude-code-plugin/scripts/start.sh` | Touch lockfile script (+x) | VERIFIED | Contains `touch "$LOCKFILE"`, bash shebang, executable (-rwxr-xr-x) |
| `companion/claude-code-plugin/scripts/stop.sh` | Remove lockfile script (+x) | VERIFIED | Contains `rm -f "$LOCKFILE"`, bash shebang, executable (-rwxr-xr-x) |
| `companion/claude-code-plugin/README.md` | Installation and usage instructions | VERIFIED | Exists; documents `claude plugin install` and `--plugin-dir` methods |
| `LICENSE` | MIT with 2026 + Leonardo Jaques | VERIFIED | 21 lines, MIT License text, correct year and owner |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 | VERIFIED | Full CC 2.1 text; contact placeholder replaced |
| `SECURITY.md` | Vulnerability reporting policy | VERIFIED | Has "Reporting a Vulnerability" section and scope |
| `CONTRIBUTING.md` | Contribution guidelines | VERIFIED | Dev loop, Conventional Commits, issue-before-PR, branch protection, maintainer-posture |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Structured bug report template | VERIFIED | 8-field environment block + debug.verbose log capture section |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Structured feature request template | VERIFIED | Problem, Proposed Solution, Persona (Marcus/Steph) checkboxes |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist | VERIFIED | 8-item checklist including pnpm test, no runtime deps, PRD guardrails |
| `.github/workflows/ci.yml` | 3-OS matrix CI pipeline | VERIFIED | ubuntu/macos/windows matrix, fail-fast:false, all required steps |
| `.github/dependabot.yml` | Dependabot configuration | VERIFIED | npm + github-actions ecosystems, weekly schedule |
| `assets/CAPTURE-INSTRUCTIONS.md` | Demo GIF capture instructions | VERIFIED | Full capture sequence, ffmpeg+gifsicle pipeline documented |
| `assets/demo.gif` | Demo GIF for README (DIST-10) | MISSING — human deferred | User deferred GIF recording at plan 05-06 checkpoint; placeholder comment in README at line 14 |
| `README.md` | Portfolio-grade README with all 13 sections (min 200 lines) | VERIFIED | 200 lines; all 13 sections present; demo GIF section is a placeholder comment |
| `package.json` | Updated repository URL | VERIFIED | https://github.com/leonardojaques/agent-mode-discord.git |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/detectors/companion.ts` | `fs.watchFile` | Node.js built-in stat polling | WIRED | `fs.watchFile(lockfilePath, ...)` at line 100 |
| `src/detectors/index.ts` | `src/detectors/companion.ts` | createCompanionDetector import + tier-1 | WIRED | `import { createCompanionDetector } from "./companion"` line 3; wired at lines 139, 153 |
| `companion/claude-code-plugin/hooks/hooks.json` | `companion/claude-code-plugin/scripts/start.sh` | ${CLAUDE_PLUGIN_ROOT}/scripts/start.sh | WIRED | `"command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/start.sh"` |
| `.github/workflows/ci.yml` | `package.json` lint script | `pnpm lint` | WIRED | ci.yml line 34 runs `pnpm lint`; package.json has `"lint": "tsc --noEmit"` |
| `README.md` | `assets/demo.gif` | Markdown image/comment | PARTIAL | README has placeholder comment `<!-- Demo GIF: see assets/CAPTURE-INSTRUCTIONS.md -->` — actual GIF not yet recorded |
| `README.md` | `CONTRIBUTING.md` | Markdown link | WIRED | Line 181: `[CONTRIBUTING.md](CONTRIBUTING.md)` |
| `README.md` | `LICENSE` | License section reference | WIRED | Line 196: `[MIT](LICENSE)` |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase delivers static files (documentation, config, shell scripts) and a detector module. No rendering components with dynamic data sources.

Companion detector data flow is mechanically verified: lockfile mtime → watchFile listener → agent-started/agent-ended dispatch → orchestrator tier ladder. All 9 unit tests verify this flow end-to-end.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All companion detector tests pass (9 tests) | `pnpm test test/detectors.companion.test.ts` | 9/9 passed in 309ms | PASS |
| Build succeeds and bundle stays within 500 KB | `pnpm build && pnpm check:bundle-size` | 219.2 KB / 43.8% of threshold | PASS |
| plugin.json and hooks.json are valid JSON with required fields | `node -e "const p=require('./companion/.../plugin.json')..."` | name: agent-mode-discord-companion, SessionStart: true, SessionEnd: true | PASS |
| package.json lint script and repo URL | `node -e "const p=require('./package.json')..."` | lint: tsc --noEmit, repo: leonardojaques/agent-mode-discord | PASS |
| Live companion plugin install test | `claude plugin install ./companion/claude-code-plugin` | SKIPPED — requires running Claude Code session | ? SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COMP-01 | 05-02 | Valid companion plugin structure | SATISFIED | companion/claude-code-plugin/ with plugin.json + hooks + scripts |
| COMP-02 | 05-02 | `claude plugin install` works | NEEDS HUMAN | Structural check passed; live install requires running Claude Code |
| COMP-03 | 05-02 | SessionStart writes lockfile within 200ms | NEEDS HUMAN | `start.sh` does `touch $LOCKFILE`; 200ms timing requires live measurement |
| COMP-04 | 05-02 | SessionEnd removes lockfile within 200ms | NEEDS HUMAN | `stop.sh` does `rm -f $LOCKFILE`; timing requires live measurement |
| COMP-05 | 05-01 | Extension watches lockfile via fs.watch, promotes to tier-0 | SATISFIED | `src/detectors/companion.ts` watchFile; orchestrator tier-1 wiring |
| COMP-06 | 05-01 | Lockfile tier suppresses lower tiers at debug-log only | SATISFIED | Orchestrator linear scan breaks on first active tier; only debug logs for lower tiers |
| COMP-07 | 05-01 | companion/ excluded from VSIX | SATISFIED | `.vscodeignore` line 9: `companion/**` |
| DIST-01 | 05-03 | MIT LICENSE with current year + owner | SATISFIED | LICENSE verified: MIT, 2026, Leonardo Jaques |
| DIST-02 | 05-03 | CODE_OF_CONDUCT.md (CC 2.1), SECURITY.md, CONTRIBUTING.md | SATISFIED | All three files exist with required content |
| DIST-03 | 05-04 | bug_report.md with VS Code, Cursor, Discord, OS, agent CLI, shell, steps, debug log fields | SATISFIED | All 8 fields present including debug.verbose capture section |
| DIST-04 | 05-04 | feature_request.md with problem, solution, persona fields | SATISFIED | Problem, Proposed Solution, Persona (Marcus/Steph) present |
| DIST-05 | 05-04 | PULL_REQUEST_TEMPLATE.md with tests pass, no new deps, PRD guardrails | SATISFIED | 8-item checklist including pnpm test, no new runtime deps |
| DIST-06 | 05-05 | CI matrix ubuntu+macos+windows with install/lint/test/build/bundle-size | SATISFIED | ci.yml confirmed: 3-OS matrix, all 5 required steps |
| DIST-07 | 05-03, 05-07 | main branch protection requires PR + green CI | NEEDS HUMAN | CONTRIBUTING.md documents it; GitHub enforcement not verifiable locally |
| DIST-08 | 05-05 | Dependabot enabled via .github/dependabot.yml | SATISFIED | dependabot.yml: npm + github-actions, weekly |
| DIST-09 | 05-07 | README with all required sections (tagline, demo GIF, install, goblin, privacy FAQ, competitive table, troubleshooting, sponsor, MIT, maintainer-posture) | SATISFIED | 200-line README with all 13 sections; demo GIF is placeholder comment |
| DIST-10 | 05-06 | Demo GIF under 8 MB, 15-30s loop, shows Idling -> AGENT_ACTIVE | NOT SATISFIED — deferred | assets/demo.gif does not exist; deferred by user at plan 05-06 checkpoint |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/detectors/index.ts` | 16 | Stale comment: "tier 1 — companion (RESERVED for Phase 5; not wired here)" — companion IS wired at lines 139, 153 | INFO | Misleading for future readers; no runtime impact |
| `SECURITY.md` | 53 | False claim: "Lockfiles read by the companion detector...are size-capped (≤ 4 KB) and JSON-validated before parsing" — companion.ts only reads mtimeMs, never opens the file | WARNING | Factual error in security-facing document; creates false attack surface expectation (flagged as WR-01 in code review) |
| `CODE_OF_CONDUCT.md` | 39 | Grammar slip: "enforcement at via [GitHub Issues]" — duplicated preposition | INFO | Copy quality; no functional impact (flagged as IN-01 in code review) |
| `companion/claude-code-plugin/scripts/start.sh` | all | No `set -euo pipefail`; unset $HOME would silently fail | WARNING | If $HOME is unset, `touch ""` fails silently — tier-1 detector gets no signal with no user-visible error (flagged as WR-06 in code review) |
| `companion/claude-code-plugin/scripts/stop.sh` | all | No `set -euo pipefail` | WARNING | Same as above for session end |
| `README.md` | 97, 144 | Claims "20 settings" — actual count in package.json is 14 (flagged as WR-02 in code review) | WARNING | Misleading claim in competitive positioning table; not a blocker |

None of the above anti-patterns are blockers for the phase goal. The SECURITY.md inaccuracy (WR-01) and shell script defensive hardening (WR-06) are the most actionable warnings; both are documented in 05-REVIEW.md.

---

### Human Verification Required

#### 1. Main Branch Protection Enforcement

**Test:** Visit the GitHub repository Settings > Branches > Branch protection rules for `main`
**Expected:** Rule exists requiring: PR before merge, CI status checks required, direct pushes blocked; owner self-approval allowed
**Why human:** GitHub branch protection is a remote repository setting enforced server-side. It cannot be verified from the local filesystem, git log, or without admin API access. CONTRIBUTING.md documents the intent (line 50-54) but documentation does not prove enforcement.

#### 2. Demo GIF Recording (DIST-10)

**Test:** Follow `assets/CAPTURE-INSTRUCTIONS.md` — record a 15-30 second screen capture showing Discord sidebar flipping from Idling to AGENT_ACTIVE when `claude` is started in the VS Code terminal with the companion plugin installed. Optimize with ffmpeg + gifsicle to stay under 8 MB.
**Expected:** `assets/demo.gif` exists at repo root, under 8 MB, shows the Idling → AGENT_ACTIVE → return-to-idle sequence, loops cleanly
**Why human:** Requires a live Discord desktop client, the VS Code extension actively loaded (F5 or installed VSIX), the companion plugin installed (`claude plugin install ./companion/claude-code-plugin`), and a screen recorder. This was explicitly deferred by user decision at the plan 05-06 interactive checkpoint. The README currently shows a placeholder comment at line 14 in place of the GIF.

After recording: `git add assets/demo.gif && git commit -m "feat(05-06): add demo GIF showing Idling → AGENT_ACTIVE flip"`

#### 3. Companion Plugin Live Install + Lockfile Timing (COMP-02, COMP-03, COMP-04)

**Test:** From a Claude Code session, run `claude plugin install ./companion/claude-code-plugin` (or `claude --plugin-dir ./companion/claude-code-plugin` for testing). Start and end a session. Use `ls -la ~/.claude/agent-mode-discord.lock` to confirm the file appears and disappears.
**Expected:** Plugin installs without error; lockfile created within 200ms of session start; lockfile removed within 200ms of session end; VS Code extension flips presence to AGENT_ACTIVE and back
**Why human:** Requires a running Claude Code session with shell hooks wired. The structural checks (plugin.json valid, hooks.json wired, scripts executable) are all verified — the 200ms timing guarantee requires a live measurement.

---

### Gaps Summary

No automated gaps block phase goal achievement. All code artifacts exist, are substantive, and are wired. The three human verification items are:

1. **DIST-07 — Branch protection enforcement**: Documented in CONTRIBUTING.md; GitHub enforcement unverifiable locally. Likely already configured but requires human confirmation.

2. **DIST-10 — Demo GIF**: `assets/demo.gif` does not exist. This is a known, user-approved deferral from plan 05-06. The README has a placeholder comment; the capture instructions are complete. This is a foreground human task.

3. **COMP-02/03/04 — Live plugin install + timing**: Structural checks pass. The 200ms timing claims require a live companion plugin session to verify end-to-end.

**Code review warnings from 05-REVIEW.md that need follow-up before Phase 6 publish:**
- WR-01: Correct SECURITY.md false claim about lockfile parsing (1-line fix)
- WR-02: Correct README config-key count from 20 to 14 (2-location fix)
- WR-03: Reconcile `claude plugin install` vs `claude /plugin install` inconsistency across docs
- WR-04: Fix CAPTURE-INSTRUCTIONS.md reference to non-existent `pnpm vscode:package` script
- WR-06: Add `set -euo pipefail` to both companion shell scripts

These are documentation and defensive-hardening fixes, not phase-gate blockers. They are tracked in 05-REVIEW.md and should be resolved before v0.1.0 publish (Phase 6).

---

_Verified: 2026-04-16T07:15:00Z_
_Verifier: Claude (gsd-verifier)_
