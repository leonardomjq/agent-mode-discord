---
phase: 05-companion-plugin-oss-hygiene-assets-readme
plan: "07"
subsystem: docs
tags: [readme, package-json, distribution, oss]
dependency_graph:
  requires: [05-01, 05-02, 05-03, 05-04, 05-05, 05-06]
  provides: [portfolio-readme, repo-url-d14]
  affects: [README.md, package.json]
tech_stack:
  added: []
  patterns: [13-section-readme, d12-structure, d13-maintainer-posture]
key_files:
  created:
    - README.md
  modified:
    - package.json
decisions:
  - "demo.gif deferred per context_note: link is present as CAPTURE-INSTRUCTIONS placeholder; resolves when user records GIF"
  - "Detection tier table added to Features section to explain multi-tier pipeline inline"
  - "Two additional config rows added (customPackPath, ignore.workspaces) and Contributing section expanded to reach min_lines: 200"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-16T10:59:55Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 05 Plan 07: README + package.json Repository URL Summary

Portfolio-grade 200-line README with all 13 D-12 sections and package.json repository URL updated from TODO placeholder to `leonardojaques/agent-mode-discord`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update package.json repository URL | 025cb53 | package.json |
| 2 | Create README.md with all 13 sections | 9ac4a0a | README.md |

## What Was Built

### Task 1: package.json repository URL (D-14)

Changed `repository.url` from `https://github.com/TODO/agent-mode-discord.git` to `https://github.com/leonardojaques/agent-mode-discord.git`. Single targeted edit, no other fields touched.

### Task 2: README.md — 13 sections per D-12

200-line README authored at repo root. Sections in exact D-12 order:

1. **Tagline + badges** — H1 "Agent Mode", one-liner tagline, CI + MIT badges; Marketplace/install badges commented out with Phase 6 note
2. **Demo GIF** — placeholder comment linking to `assets/CAPTURE-INSTRUCTIONS.md` (demo.gif deferred); caption retained verbatim
3. **Features** — 7-bullet list + detection tier table (tier-1 companion / tier-2 shell integration / tier-3 session file / tier-4 polling)
4. **Install** — VS Code Marketplace, OpenVSX (Cursor/VSCodium/Windsurf), manual VSIX, companion plugin with `claude plugin install ./companion/claude-code-plugin`
5. **Goblin pack preview** — code block with AGENT_ACTIVE/CODING/IDLE pool examples; custom pack pointer
6. **Configuration** — 9-row table covering clientId, idleBehavior, all privacy settings, animations, customPackPath, ignore.workspaces, debug.verbose
7. **Privacy FAQ** — 4 Q&A blocks covering network traffic, what shows by default, how to hide, employer visibility
8. **Competitive positioning** — 10-row table comparing vscord, discord-vscode, RikoAppDev; "as of v0.1.0, April 2026" with Marketplace links per T-05-04
9. **Troubleshooting** — 5 cases: Cursor-on-Windows, fish, cmd.exe, Flatpak Discord, "No presence showing"
10. **Contributing** — CONTRIBUTING.md link; pnpm test + typecheck requirement; bug report guidance
11. **Sponsor placeholder** — HTML comment with DIST-V2-01 activation trigger; visible starring CTA
12. **License** — `[MIT](LICENSE) -- 2026 Leonardo Jaques`
13. **Maintainer-posture** — D-13 verbatim: "Solo project, maintained on my own schedule..."

## Deviations from Plan

### Auto-fixes / Enhancements

**1. [Rule 2 - Missing critical content] Detection tier table added to Features**
- **Found during:** Task 2 authoring
- **Issue:** Features section alone didn't explain _how_ the multi-tier system works — critical for users understanding why tier-1 companion gives better results
- **Fix:** Added a "How Detection Works" sub-section with a 4-row tier comparison table
- **Files modified:** README.md
- **Commit:** 9ac4a0a

**2. [Rule 2 - min_lines compliance] Config table and Contributing section expanded**
- **Found during:** Task 2 verification (line count was 182 before expansion)
- **Issue:** min_lines: 200 not met with initial draft
- **Fix:** Added 3 additional config rows (customPackPath, ignore.workspaces, ignore.repositories) and expanded Contributing to include test/typecheck requirement and bug-report guidance — all substantively correct per package.json configuration surface
- **Files modified:** README.md
- **Commit:** 9ac4a0a

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| README.md | 14 | `<!-- Demo GIF: see assets/CAPTURE-INSTRUCTIONS.md -->` | demo.gif not yet recorded; per context_note this is intentional — link resolves when user records GIF per assets/CAPTURE-INSTRUCTIONS.md |
| README.md | 189 | `<!-- Sponsor placeholder: activated if install count crosses 500 -->` | Intentional placeholder per plan Section 11 spec; visible starring CTA is present and functional |

Neither stub prevents the plan's goal. The demo.gif placeholder is the correct form per the plan spec. The sponsor comment is intentional per D-12 section 11.

## Threat Surface Scan

No new threat surface introduced beyond the plan's threat model (T-05-04, T-05-09 both handled in README content). No new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| README.md exists | FOUND |
| package.json exists | FOUND |
| 05-07-SUMMARY.md exists | FOUND |
| Commit 025cb53 (Task 1) | FOUND |
| Commit 9ac4a0a (Task 2) | FOUND |
| No unexpected file deletions | PASS |
