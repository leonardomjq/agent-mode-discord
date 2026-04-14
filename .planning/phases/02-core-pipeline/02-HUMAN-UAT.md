---
phase: 02
doc: human-uat
status: ready-for-uat
created: 2026-04-13
updated: 2026-04-13
---

# Phase 2 — Dev Host Manual Verification

Three behaviors that cannot be automated in vitest. Run ALL three after Phase 2 code is green in CI. Check each box and sign off at the end.

## Prerequisites

- [ ] Discord desktop installed and logged in (any Discord >= 2023; pid-scoping was introduced in ~2021 but the incumbent bug pattern was fixed mid-2022).
- [ ] `pnpm build` is green on the branch under test.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm check:bundle-size`, `pnpm check:api-surface` all green.
- [ ] One workspace folder with at least one `.ts` or `.js` file ready to open.

## Checklist 1 — IDLE transition on timer (SC-1)

**Requirement:** STATE-02 — No focused editor + `idleTimeoutSeconds` elapsed → IDLE.

**Why manual:** `idleTimeoutSeconds` is hardcoded to 300_000 ms in Phase 2; vitest uses fake timers but wall-clock observation confirms the driver uses real `setTimeout`, not a test-only shortcut.

1. Launch Dev Host (F5 from repo root).
2. Open any `.ts` file in the Dev Host workspace.
3. Verify Discord friends sidebar shows activity with the filename in the state string within 2 s (CODING state).
4. Close the file tab. Focus the terminal. Leave all editors closed.
4a. Inspect Output panel → `Log (Extension Host)`. After the file closes, you should see NO new `[agent-mode-discord]` log lines (the reducer no-ops on editor-closed; only the idle timer will fire the next visible event 5 minutes later).
5. Start a timer on your phone for **5 minutes 10 seconds**.
6. Wait. Do not re-focus an editor.
7. At timer completion: verify Discord friends sidebar shows IDLE copy (Phase 2 renders plain "idle" — no goblin messages until Phase 4).
7a. The Discord state-string should show "Idle" (no workspace, no branch — Phase 2 activity payload drops empty fields; Phase 4 personality pack adds goblin copy).
8. Re-focus an editor — verify presence flips back to CODING immediately.

- [ ] Step 3 — CODING shown with filename ___________________________
- [ ] Step 7 — IDLE shown after 5 min elapsed _______________________
- [ ] Step 8 — CODING restored on editor re-focus ___________________

## Checklist 2 — Discord kill/restart replay (SC-3)

**Requirement:** RPC-03 + RPC-04 — 5→10→20→40→60 s backoff with 5 s cooldown floor; activity replays within one backoff tick on Discord restart.

**Why manual:** Requires actual Discord desktop process lifecycle; vitest mocks the socket.

1. Launch Dev Host, open a file, verify CODING appears in Discord sidebar.
2. Open Dev Host Output panel; select channel `Log (Extension Host)` (Phase 2 logs via `console.debug` — Phase 4 migrates to a dedicated channel).
3. Kill Discord desktop entirely:
   - macOS: `killall Discord`
   - Linux: `pkill Discord`
   - Windows: Task Manager → end `Discord.exe`
4. Observe Output panel → Log (Extension Host). Within ~5 s of killing Discord, you'll see a `[agent-mode-discord] RPC login rejected:` debug line. Subsequent retries log the same message at the ladder cadence: **5 s → 10 s → 20 s → 40 s → 60 s cap**. The 5 s cooldown floor means no two consecutive login attempts should be less than 5 s apart in the timestamps.
5. After ~30 s of failed retries, relaunch Discord desktop.
6. Watch the Output log — within the current ladder tick (≤ 60 s from Discord relaunch) you should see a success line OR the activity re-appears in the Discord friends sidebar without clicking anything in the editor.

- [ ] Step 3 — Discord killed __________________________
- [ ] Step 4 — Retry cadence matches ladder (note timestamps): ___, ___, ___
- [ ] Step 6 — Activity replays within one backoff tick after Discord relaunch _____
- [ ] No two connect attempts within 5 s of each other (verify from timestamps above)

## Checklist 3 — Two-window pid isolation (SC-4)

**Requirement:** RPC-01 — Two VS Code windows open simultaneously produce two independent Discord activities; closing one does not clear the other.

**Why manual:** Requires two real VS Code Dev Host windows + real Discord with pid-scoping honored (see 02-RESEARCH Pitfall 7 — older Discord clients don't honor pid; test on current Discord).

1. Close all Dev Host windows. Launch Dev Host (F5).
2. In the first window, open a file (`a.ts`). Verify Discord shows one activity with `a.ts` in the state string.
3. Launch a second Dev Host (Cmd/Ctrl+Shift+P → "Developer: New Window"; then F5 from a second clone of the repo, or open a second folder in the existing Dev Host).
4. In the second window, open a different file (`b.ts`).
5. **Observe Discord friends sidebar on your Discord mobile or a second Discord desktop account** (Discord shows YOUR own activity as one entry — the pid-scoped second activity is visible to friends, not to you. Ask a friend or use a test account).
6. Confirm two distinct activities, one with `a.ts`, one with `b.ts`, both under "Visual Studio Code" or the branded app name.
   Observation: each activity's state string contains the filename (`a.ts` in window 1, `b.ts` in window 2). If only one activity is visible OR both show the same filename, pid isolation has failed — document Discord client version in sign-off.
7. Close the first window. Wait 5 s.
8. Verify the second window's activity (`b.ts`) remains intact; only the `a.ts` activity disappears.

- [ ] Step 6 — Two independent activities visible (screenshot encouraged) ____
- [ ] Step 8 — Closing window 1 does not clear window 2's activity ____

**Note on Discord version:** If step 6 shows only one activity (the most recent window wins), you may be on an older Discord client that does not honor pid-scoping. This is NOT an extension bug — document the Discord version in the sign-off.

## Sign-off

| Check | Status | Observer | Date |
|-------|--------|----------|------|
| Checklist 1 (SC-1 / STATE-02) | | | |
| Checklist 2 (SC-3 / RPC-03, RPC-04) | | | |
| Checklist 3 (SC-4 / RPC-01) | | | |

Discord client version tested: __________________
OS / VS Code version tested: __________________

Signed off by: __________________ on ______________
