---
phase: "05"
plan: "02"
subsystem: companion-plugin
tags: [companion, lockfile, claude-code-plugin, hooks, shell-scripts]
dependency_graph:
  requires: []
  provides:
    - companion/claude-code-plugin — installable Claude Code plugin structure
    - SessionStart hook writes ~/.claude/agent-mode-discord.lock
    - SessionEnd hook removes ~/.claude/agent-mode-discord.lock
  affects:
    - Phase 05-01 companion detector (tier-1) reads lockfile presence/mtime
tech_stack:
  added:
    - bash shell scripts (companion plugin hooks)
  patterns:
    - Claude Code plugin structure (.claude-plugin/plugin.json + hooks/hooks.json)
    - Lockfile as presence/absence signal (mtime-only, no content parsing)
key_files:
  created:
    - companion/claude-code-plugin/.claude-plugin/plugin.json
    - companion/claude-code-plugin/hooks/hooks.json
    - companion/claude-code-plugin/scripts/start.sh
    - companion/claude-code-plugin/scripts/stop.sh
    - companion/claude-code-plugin/README.md
  modified: []
decisions:
  - "D-06: Plugin structure uses .claude-plugin/plugin.json for manifest, hooks/hooks.json at plugin root (not inside .claude-plugin/) per RESEARCH Pitfall 1"
  - "D-03: start.sh uses touch (empty file, mtime-as-signal); stop.sh uses rm -f"
  - "SessionStart matcher is startup|resume to keep lockfile mtime fresh on resumed sessions (RESEARCH Pitfall 4)"
  - "SessionEnd matcher is * to fire on all exit paths (clear, logout, prompt_input_exit, crash)"
  - "5-second hook timeout — generous for a sub-1ms shell script"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 0
---

# Phase 05 Plan 02: Companion Plugin Structure Summary

Companion Claude Code plugin with SessionStart/SessionEnd hooks that write/remove `~/.claude/agent-mode-discord.lock` — the tier-1 (highest-fidelity) agent-detection signal for the VS Code extension.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create plugin manifest and hooks | 6ec212a | .claude-plugin/plugin.json, hooks/hooks.json |
| 2 | Create shell scripts + plugin README | ecec13f | scripts/start.sh, scripts/stop.sh, README.md |

## What Was Built

The `companion/claude-code-plugin/` directory is a complete, installable Claude Code plugin:

- **`.claude-plugin/plugin.json`** — Plugin manifest with name `agent-mode-discord-companion`, v0.1.0, description, author (Leonardo Jaques), MIT license.
- **`hooks/hooks.json`** — Declares two hooks:
  - `SessionStart` with matcher `startup|resume` (covers new sessions and resumed sessions, keeping mtime fresh) pointing to `start.sh`
  - `SessionEnd` with matcher `*` (fires on all exit paths) pointing to `stop.sh`
  - Both hooks use `${CLAUDE_PLUGIN_ROOT}/scripts/` path resolution with 5-second timeout
- **`scripts/start.sh`** — `mkdir -p + touch $HOME/.claude/agent-mode-discord.lock`; bash shebang; +x permission tracked in git
- **`scripts/stop.sh`** — `rm -f $HOME/.claude/agent-mode-discord.lock`; bash shebang; +x permission tracked in git
- **`README.md`** — Documents permanent install (`claude plugin install`) and dev/testing (`--plugin-dir`), How It Works section, Lockfile Location, and Troubleshooting (stale lockfile after crash, non-firing hooks, Windows caveat)

## Deviations from Plan

None — plan executed exactly as written. All RESEARCH Pitfalls applied as specified:
- Pitfall 1: hooks.json at plugin root, not inside .claude-plugin/
- Pitfall 4: SessionStart matcher is `startup|resume` (not just `startup`)
- Pitfall 6: Executable permissions set via both `chmod +x` and `git update-index --chmod=+x`

## Known Stubs

None. All files are complete and wired to production paths.

## Threat Flags

No new security surface beyond what is documented in the plan's threat model:
- T-05-01 (lockfile orphan on crash): documented in README Troubleshooting; mitigated by companion detector's 5-minute mtime stale check (Plan 05-01)
- T-05-05 (script tampering): scripts run with user permissions; no privilege escalation possible

## Self-Check: PASSED

- [x] `companion/claude-code-plugin/.claude-plugin/plugin.json` — FOUND
- [x] `companion/claude-code-plugin/hooks/hooks.json` — FOUND
- [x] `companion/claude-code-plugin/scripts/start.sh` — FOUND, executable
- [x] `companion/claude-code-plugin/scripts/stop.sh` — FOUND, executable
- [x] `companion/claude-code-plugin/README.md` — FOUND
- [x] Commit 6ec212a (Task 1) — FOUND in git log
- [x] Commit ecec13f (Task 2) — FOUND in git log
