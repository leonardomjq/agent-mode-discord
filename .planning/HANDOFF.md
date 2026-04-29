# Where We Stand — Handoff

**Last updated:** 2026-04-29 (Phase 6 prep — repo on GitHub, credentials half-done)
**Purpose:** Single source of truth for "what's left before v0.1.0 ships" when returning after a break.

## What changed 2026-04-29

- Repo created + pushed to https://github.com/leonardomjq/agent-mode-discord (was offline-only before)
- `OVSX_PAT` secret added to GitHub Actions (one of two needed for release.yml)
- Repo metadata set: description, 6 topics, branch protection, vulnerability alerts, secret scanning, squash-only merges, delete head branch on merge
- Identity sweep: publisher swapped from `agent-mode-dev` placeholder to `leonardomjq`; author/bugs/homepage fields added; CODEOWNERS + README install snippets + bus-factor profile link all swapped to `leonardomjq`
- CI fix: removed `version: 9` from `pnpm/action-setup@v4` calls (conflicted with `packageManager` field in package.json)
- Windows test skip: `test/detectors.sessionFiles.test.ts` skipped on win32 (fake-fs path-sep bug, not production issue) → SEED-004 plants v0.1.1 fix
- All 3 OS matrix CI green on main
- Local VSIX dry-run packs cleanly (183 KB packed, 12 files)



---

## The 30-second answer

- **Project:** VS Code / Cursor extension that flips your Discord status to `AGENT_ACTIVE` with goblin-voice copy when Claude Code (or any AI agent) runs in your terminal. Differentiator: detects the *agent*, not just the editor.
- **Status:** Code-complete for v0.1.0. 330/330 tests passing. Bundle 227 KB (45% of 500 KB budget). Pending credentials + assets before Marketplace publish.
- **Phases complete:** 1, 2, 3, 4, 5, 5.1, 5.2. **Phase 6 (Publish) pending.**
- **Next session trigger:** "let's keep doing it" after completing the checklist below, OR "where do we stand" to see updated status.

---

## What you need to do (checklist)

### 🖼️ Assets you need to create (1-2 hours, your part)

- [ ] **`assets/icon.png`** — 128×128 PNG of the goblin mascot. Marketplace listing thumbnail. Without this, Marketplace shows a generic placeholder (kills click-through). Drop any PNG with that name at `assets/icon.png` and the manifest already points at it (package.json `icon` field already set in Phase 5.1).

- [ ] **`assets/demo.gif`** — 15-30 second GIF showing Discord sidebar flipping "Idling → AGENT_ACTIVE" when `claude` starts. **This is the single most important asset** — Marketplace listing conversion depends on it. Full capture process documented in [`assets/CAPTURE-INSTRUCTIONS.md`](../assets/CAPTURE-INSTRUCTIONS.md). Needs:
  - Discord desktop open, you online
  - VS Code with the extension loaded (F5 debug is fine)
  - Companion plugin installed: `claude plugin install ./companion/claude-code-plugin`
  - A screen recorder + `ffmpeg` + `gifsicle` for post-processing

- [ ] **Discord Developer Portal art assets** (browser, 30 min) — go to [discord.com/developers/applications](https://discord.com/developers/applications) → your app (Client ID: `1493599126217297981`) → Rich Presence → Art Assets. Upload:
  - `agent-mode-large` — 1024×1024 PNG
  - `agent-mode-small` — 512×512 PNG
  - `claude-icon` — per-agent icon (goblin wearing Claude colors, or the Anthropic mark)

  Without these, Discord shows broken image icons in the presence rendering.

### 🔑 Credentials you need to create (browser work, 1-2 hours)

**Do OpenVSX FIRST** — namespace claim has variable lead time (days to weeks for Eclipse Foundation approval). Start this and let it cook while you do the others.

- [x] **OpenVSX namespace + token** ✅ DONE 2026-04-29 — token added as `OVSX_PAT` secret. Namespace `leonardomjq` will be auto-created with contributor rights on first `ovsx publish`. Owner-claim issue filed at https://github.com/EclipseFdn/open-vsx.org/issues/10004 (manual Eclipse Foundation approval, days/weeks lead time, NON-BLOCKING for v0.1.0).

- [ ] **VS Code Marketplace — Microsoft Partner Center publisher account**
  - Go to [marketplace.visualstudio.com/manage/publishers](https://marketplace.visualstudio.com/manage/publishers)
  - Create a publisher account. **Choose a real name** (not `agent-mode-dev` placeholder). Suggested: `leonardojaques`. **You can't rename it later.**
  - This creates a Microsoft Partner Center identity under the hood — accept the ToS
  - Note: the `publisher` field in `package.json` will need updating from `agent-mode-dev` to whatever you pick. Phase 6 plan 06-06 handles that edit.

- [ ] **Azure DevOps Personal Access Token (VSCE_PAT)**
  - Go to [dev.azure.com](https://dev.azure.com) → sign in with the same Microsoft account
  - User Settings (top right) → Personal Access Tokens → New Token
  - Organization: "all accessible organizations"
  - Scope: **Marketplace → Manage** (custom defined, not "Full access")
  - Expiration: up to 1 year (set to max; easier to manage)
  - Copy the token — you'll never see it again
  - Add to GitHub repo secrets as `VSCE_PAT`

### 🐙 GitHub repo setup (5 minutes)

- [x] **Branch protection on `main`** ✅ DONE 2026-04-29 — require PR + 3 OS CI checks + conversation resolution; admin bypass on (DIST-07 closed).

- [x] **GitHub repo description + topics** ✅ DONE 2026-04-29 — description + 6 topics set via `gh repo edit`.

### ✅ Verification tests (10 minutes total, anytime)

- [ ] **Multi-window smoke test** — per `docs/MULTI-WINDOW.md` 6-scenario matrix. Tests the Phase 5.2 single-leader behavior. Open 2 VS Code windows, confirm only one drives Discord; kill the leader, confirm the follower takes over within 90s.

- [ ] **Local VSIX install test** (closest thing to real Marketplace experience):
  ```bash
  pnpm build
  npx @vscode/vsce package --no-dependencies
  code --install-extension agent-mode-discord-0.1.0.vsix
  ```
  Restart VS Code. Open Discord. Run `claude` in terminal. Confirm flip.

---

## When you're ready to publish — say "let's keep doing it"

With everything above done, a fresh session with `let's keep doing it` will kick off:

```
/gsd-discuss-phase 6 --auto
/gsd-plan-phase 6 --auto
/gsd-execute-phase 6
```

### Phase 6 plan breakdown (already scoped in ROADMAP.md)

| Plan | Work | Who executes |
|------|------|-------------|
| 06-01 | Discord Developer Portal asset upload (the PNGs above) | You — done pre-session per checklist |
| 06-02 | Add `VSCE_PAT` + `OVSX_PAT` to GitHub repo secrets | You — done pre-session per checklist |
| 06-03 | Author `.github/workflows/release.yml` (tag → publish to both) | Claude |
| 06-04 | Local dry-runs (`vsce publish --dry-run`, `ovsx publish --dry-run`) | Claude runs, you review output |
| 06-05 | Tag `v0.1.0` and push, verify listings live within 30 min | You push tag, Claude watches |
| 06-06 | Update `package.json` publisher field from `agent-mode-dev` to real name | Claude |
| 06-07 | Add Marketplace + OpenVSX install-count badges to README (shields.io) | Claude (needs live listing URLs, so runs after 06-05) |
| 06-08 | Update README Observability section with live dashboard links | Claude (needs live listings) |

**Total Claude-side execution time:** ~30-45 minutes once credentials + assets are in place.

---

## Quick-reference: current state

- **Tests:** 330/330 passing (21 test files)
- **Bundle:** 227 KB / 500 KB budget (45%)
- **Build:** `pnpm build` produces `dist/extension.cjs` + `dist/THIRD_PARTY_LICENSES.md` (auto-emitted from esbuild metafile, 3 packages attributed)
- **Architecture:** 4-tier agent detection (companion lockfile → VS Code Shell Integration → JSONL session files → terminal polling); pure-core state machine; single-leader multi-window via `~/.claude/agent-mode-discord.leader.lock`
- **Runtime deps:** 1 (`@xhayper/discord-rpc` — bundled into dist)
- **VS Code baseline:** `^1.93.0` (Shell Integration GA)
- **Cursor compat:** Cursor's bundled VS Code baseline ≥ 1.93 (documented in `docs/CURSOR-COMPAT.md`)
- **Companion plugin path:** `companion/claude-code-plugin/` — installable via `claude plugin install ./companion/claude-code-plugin`
- **Bundled Discord Client ID:** `1493599126217297981` (overridable via `agentMode.clientId` setting)

---

## Open UAT items (tracked in GSD)

- **`.planning/phases/05-companion-plugin-oss-hygiene-assets-readme/05-HUMAN-UAT.md`**
  - [ ] Record `assets/demo.gif` (DIST-10)
  - [ ] Enable GitHub branch protection on `main` (DIST-07)

- **`.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md`**
  - [ ] Drop in `assets/icon.png` (128×128 PNG)
  - [ ] Run multi-window smoke test per new 6-scenario matrix in `docs/MULTI-WINDOW.md` (now verifies single-leader Phase 5.2 behavior, not the old "depends on Discord" behavior)

Run `/gsd-audit-uat` to see these surface in one view.

---

## Future seeds (will auto-surface at next milestone)

- **`SEED-001`** — `@vscode/extension-telemetry` opt-in for feature-level usage data. **Trigger:** 30 days post-v0.1.0 OR Marketplace install count > 100. Currently the Discord Dev Portal + Marketplace dashboards give you DAU/MAU + install counts without any telemetry code. Defer until scale makes it worth the complexity.
- **`SEED-002`** — Dynamic agent icon mapping (`claude-icon` for Claude, `codex-icon` for Codex, `gemini-icon` for Gemini, fallback to Cursor/VS Code icon). **Trigger:** Phase 6 asset upload OR v0.2.0 OR first user issue requesting it. Code change is ~1 hour; asset uploads are the real work.
- **`SEED-003`** — Claude Desktop / multi-surface architecture. Strategic capture of "what if Claude Desktop becomes Claude Code's primary home?" — includes 3 paths (standalone daemon / monorepo refactor / wait-and-see). **Trigger:** Anthropic exposes Desktop plugin API OR Discord DAU shows Desktop migration pattern.

## Backlog

- **`999.1`** — Cursor-on-Windows reproduction harness for fs-watch fallback. Currently documented in README troubleshooting but never actually tested by us. Promote via `/gsd-review-backlog` when ready.

---

## Commands for returning sessions

| You say | Claude does |
|---------|-------------|
| `where do we stand` | Reads this file + runs `/gsd-progress`, summarizes what's left |
| `let's keep doing it` | Assumes credentials + assets are ready, runs Phase 6 autonomously |
| `/gsd-progress` | Shows roadmap + UAT + seeds + backlog in one native view |
| `/gsd-audit-uat` | Shows all open HUMAN-UAT items across phases |
| `/gsd-check-todos` | Lists pending todos (none currently) |

---

## Strategic context (don't forget)

- **This is a passion project + portfolio piece**, not a SaaS. Ship window was 2 weeks. Success = "I have data" (Discord Dev Portal + Marketplace dashboards), not "I have users".
- **Core value:** detects `claude-in-terminal` — the differentiator from existing Discord-presence VS Code extensions (vscord, discord-vscode, RikoAppDev). None of them detect agents.
- **Do not feature-creep v0.1.0.** Everything that tempts you mid-work belongs in seeds/backlog (captured above).
- **Phase 6 is mostly gated on you, not Claude.** The bottleneck is credentials + assets. Once those exist, publishing is a script.

---

*Generated at the clean stopping point after Phase 5.2 completion. Update this file whenever the state diverges from what's written here — it's the single source of truth for "what next".*
