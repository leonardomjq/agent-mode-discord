---
status: complete
phase: 02-core-pipeline
source:
  - .planning/phases/02-core-pipeline/02-07-SUMMARY.md
  - .planning/phases/02-core-pipeline/02-HUMAN-UAT.md
started: 2026-04-14T12:41:04Z
updated: 2026-04-14T13:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. IDLE transition on 5-minute timer (SC-1 / STATE-02)
expected: |
  Launch Dev Host (F5 from repo root), open a .ts file, and within 2 s Discord's friends sidebar shows your activity with the filename in the state string (CODING state). Close the file tab, focus the terminal, start a 5 min 10 s timer, and do not touch any editor. At timer completion, Discord shows "Idle" in the state string. Re-focus an editor and CODING restores immediately.
result: pass
notes: |
  CODING → filename flip verified within 2 s of focusing a .tsx file (Discord showed "Agent Mode" + "page.tsx").
  IDLE verified: after ~6 min of the same .tsx file being focused (no switches, no terminal commands, no other detector-firing events), Discord flipped to "Idle" as the idle-tick fired. STATE-02 satisfied per spec.
  OBSERVATION worth flagging for Phase 3/4: the idle timer measures "time since last detector-firing event", not "time since last keystroke". So a user who stays on the same file reading code for 5+ min will also go IDLE — which does not match the vscord-style "text-change resets timer" heuristic. For this user's workflow (always-in-terminal with claude) this is a non-issue because Phase 3's AGENT_ACTIVE events keep firing. For casual code-reading users it may surprise. Revisit if Phase 4 UAT flags it.
  Incidentally uncovered 3 real bugs that required orchestrator fixes before Discord would show anything at all:
    1. Missing .vscode/launch.json (Phase 1 gap) — created.
    2. Hardcoded client ID placeholder (Phase 1 [HUMAN] gap) — swapped in Discord app "Agent Mode" ID 1493599126217297981.
    3. esbuild shim was too aggressive: @discordjs/rest shimmed to throwing Proxy but @xhayper/discord-rpc Client constructor always does `new REST()`. Replaced with minimal REST stub that also provides `options.cdn` write target (READY handler sets it).

### 2. Discord kill/restart replay with backoff ladder (SC-3 / RPC-03, RPC-04)
expected: |
  With CODING visible in Discord, kill Discord desktop entirely (`killall Discord` on macOS). Open Dev Host Output panel → `Log (Extension Host)`. Within ~5 s you see `[agent-mode-discord] RPC login rejected:` debug lines at the backoff ladder cadence — 5 s, then 10 s, 20 s, 40 s, capped at 60 s. No two attempts are within 5 s of each other. After ~30 s of failed retries, relaunch Discord. Within the current ladder tick (≤ 60 s) the activity reappears in Discord without touching the editor.
result: pass

### 3. Two-window pid isolation (SC-4 / RPC-01)
expected: |
  Launch two Dev Host windows. In window 1 open `a.ts`; in window 2 open `b.ts`. Checking from a friend's Discord or a second Discord account, you see TWO distinct activities under "Agent Mode" — one with `a.ts`, one with `b.ts`. Close window 1 and wait 5 s: only the `a.ts` activity disappears; the `b.ts` activity remains intact.
result: skipped
reason: |
  User declined — setup requires two Dev Host windows plus a friend or second Discord account, and the scenario (multiple parallel AI sessions in separate windows) is not part of the user's actual workflow. Unit-test coverage in 02-04 (rpc.client.backoff.test.ts) and 02-07 (extension driver) exercises pid-scoped setActivity/clearActivity directly — this UAT would only validate that real Discord honors the pid argument, which it does per @xhayper/discord-rpc docs. Revisit if a real multi-window user reports a collision.

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 1

## Gaps

[none yet]
