---
status: testing
phase: 02-core-pipeline
source:
  - .planning/phases/02-core-pipeline/02-07-SUMMARY.md
  - .planning/phases/02-core-pipeline/02-HUMAN-UAT.md
started: 2026-04-14T12:41:04Z
updated: 2026-04-14T12:41:04Z
---

## Current Test

number: 2
name: Discord kill/restart replay with backoff ladder (SC-3 / RPC-03, RPC-04)
expected: |
  With CODING visible in Discord, kill Discord desktop entirely (`killall Discord` on macOS). Open Dev Host Output panel → `Log (Extension Host)`. Within ~5 s you see `[agent-mode-discord] RPC login rejected:` debug lines at the backoff ladder cadence — 5 s, then 10 s, 20 s, 40 s, capped at 60 s. No two attempts are within 5 s of each other. After ~30 s of failed retries, relaunch Discord. Within the current ladder tick (≤ 60 s) the activity reappears in Discord without touching the editor.
awaiting: user response

## Tests

### 1. IDLE transition on 5-minute timer (SC-1 / STATE-02)
expected: |
  Launch Dev Host (F5 from repo root), open a .ts file, and within 2 s Discord's friends sidebar shows your activity with the filename in the state string (CODING state). Close the file tab, focus the terminal, start a 5 min 10 s timer, and do not touch any editor. At timer completion, Discord shows "Idle" in the state string. Re-focus an editor and CODING restores immediately.
result: partial-pass
notes: |
  CODING → filename flip verified (Discord showed "Agent Mode" + "page.tsx" within 2 s of focusing a .tsx file). IDLE 5-minute timer check skipped — user's real workflow is always-in-terminal (claude code) so the file-editor IDLE path is not load-bearing for their use case. Re-verify IDLE during Phase 3 UAT where AGENT_ACTIVE → IDLE transitions will be exercised naturally.
  Incidentally uncovered 3 real bugs that required orchestrator fixes before Discord would show anything at all:
    1. Missing .vscode/launch.json (Phase 1 gap) — created.
    2. Hardcoded client ID placeholder (Phase 1 [HUMAN] gap) — swapped in Discord app "Agent Mode" ID 1493599126217297981.
    3. esbuild shim was too aggressive: @discordjs/rest shimmed to throwing Proxy but @xhayper/discord-rpc Client constructor always does `new REST()`. Replaced with minimal REST stub that also provides `options.cdn` write target (READY handler sets it).
result_overall: pass (CODING path verified end-to-end; IDLE path deferred by user decision)

### 2. Discord kill/restart replay with backoff ladder (SC-3 / RPC-03, RPC-04)
expected: |
  With CODING visible in Discord, kill Discord desktop entirely (`killall Discord` on macOS). Open Dev Host Output panel → `Log (Extension Host)`. Within ~5 s you see `[agent-mode-discord] RPC login rejected:` debug lines at the backoff ladder cadence — 5 s, then 10 s, 20 s, 40 s, capped at 60 s. No two attempts are within 5 s of each other. After ~30 s of failed retries, relaunch Discord. Within the current ladder tick (≤ 60 s) the activity reappears in Discord without touching the editor.
result: [pending]

### 3. Two-window pid isolation (SC-4 / RPC-01)
expected: |
  Launch two Dev Host windows. In window 1 open `a.ts`; in window 2 open `b.ts`. Checking from a friend's Discord or a second Discord account (Discord hides your own presence from yourself), you see TWO distinct activities under "Visual Studio Code" — one with `a.ts`, one with `b.ts`. Close window 1 and wait 5 s: only the `a.ts` activity disappears; the `b.ts` activity remains intact.
result: [pending]

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0

## Gaps

[none yet]
