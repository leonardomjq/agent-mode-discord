---
phase: 05-companion-plugin-oss-hygiene-assets-readme
plan: "04"
subsystem: oss-hygiene
tags: [github-templates, issue-templates, pr-template, oss]
dependency_graph:
  requires: []
  provides: [github-issue-templates, github-pr-template]
  affects: [contributor-workflow, bug-reporting, pr-quality]
tech_stack:
  added: []
  patterns: [github-issue-template-yaml-frontmatter]
key_files:
  created:
    - .github/ISSUE_TEMPLATE/bug_report.md
    - .github/ISSUE_TEMPLATE/feature_request.md
    - .github/PULL_REQUEST_TEMPLATE.md
  modified: []
decisions:
  - "Bug report redaction note added per T-05-07 threat (debug.verbose logs may contain workspace paths)"
  - "Persona section uses checkbox format to make Marcus/Steph personas actionable for triaging"
metrics:
  duration: 1 min
  completed: "2026-04-16T10:44:45Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
requirements:
  - DIST-03
  - DIST-04
  - DIST-05
---

# Phase 05 Plan 04: GitHub Issue and PR Templates Summary

Three structured GitHub templates to standardize bug reports with extension-specific diagnostic fields and enforce PR quality via checklist.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create issue templates | e8741bc | .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/feature_request.md |
| 2 | Create PR template | 20e9fdf | .github/PULL_REQUEST_TEMPLATE.md |

## What Was Built

### Bug Report Template (DIST-03)

`.github/ISSUE_TEMPLATE/bug_report.md` — Structured template with 6-field environment block capturing all signals the extension monitors:

- VS Code version, Cursor version, Discord version, OS, Agent CLI used, Shell
- Steps to Reproduce (numbered list)
- Expected vs Actual Behavior sections
- Debug Logs section with `agentMode.debug.verbose: true` instructions and a fenced code block placeholder
- Redaction note for workspace paths (per T-05-07 threat mitigation)

### Feature Request Template (DIST-04)

`.github/ISSUE_TEMPLATE/feature_request.md` — Structured template with:

- Problem statement field
- Proposed Solution field
- Persona section with Marcus (power user, terminal-centric, multi-agent) and Steph (casual, Claude-only, "just works") as checkboxes plus an Other option
- Alternatives Considered field
- Additional Context field

### PR Template (DIST-05)

`.github/PULL_REQUEST_TEMPLATE.md` — PR quality checklist with:

- Summary and Related Issue fields (enforcing file-issue-before-large-PR per CONTRIBUTING.md)
- Type of Change checkboxes (bug fix / new feature / breaking change / docs / refactor)
- 8-item quality checklist: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm check:bundle-size` (500 KB budget), no new runtime dependencies, no VS Code proposed APIs / `(vscode as any).*` casts, Conventional Commits format, 200-line file discipline
- Screenshots/GIFs section

## Deviations from Plan

None - plan executed exactly as written.

T-05-07 threat mitigation (redaction note in bug_report.md) was included inline per the threat model — this was specified in the plan's threat register and applied as a correctness requirement (Rule 2).

## Known Stubs

None — all three files are static markdown with no data wiring required.

## Threat Flags

None — static markdown templates with no code execution surfaces.

## Self-Check: PASSED

- `.github/ISSUE_TEMPLATE/bug_report.md`: FOUND
- `.github/ISSUE_TEMPLATE/feature_request.md`: FOUND
- `.github/PULL_REQUEST_TEMPLATE.md`: FOUND
- Commit e8741bc: FOUND (Task 1)
- Commit 20e9fdf: FOUND (Task 2)
- `debug.verbose` in bug_report.md: FOUND
- `Persona` in feature_request.md: FOUND
- `pnpm test` in PR template: FOUND
- `runtime dependencies` in PR template: FOUND
