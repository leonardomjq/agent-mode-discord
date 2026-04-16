# Multi-window VS Code Behavior

> **Status (v0.1.0 / Phase 05.2):** Single-leader semantics are implemented in
> [`src/state/leadership.ts`](../src/state/leadership.ts). Behavior is now
> deterministic: the first window to start owns Discord presence; all others stay
> silent. This is a behavior change vs pre-05.2 (see Background).

## Background

VS Code can run multiple windows simultaneously, each with its own extension
host process. Before Phase 05.2, every window opened its own Discord IPC
connection; Discord merged them and surfaced whichever was most recently
updated — producing inconsistent results that varied across Discord versions and
confused users with stale or flickering presence.

As of Phase 05.2, Agent Mode runs a leadership election on startup. The first
window to activate writes `~/.claude/agent-mode-discord.leader.lock` via an
atomic `open(wx)` call (D-02). That window owns Discord presence exclusively.
All subsequent windows detect the lockfile, skip Discord IPC entirely, and poll
every 30 seconds to watch for a takeover opportunity (D-05).

If the leader window exits cleanly, it unlinks the lockfile (D-07). If it
crashes, the lockfile becomes stale within 90 seconds (D-03/D-08), and the next
follower poll attempts a greedy unlink + re-acquire, bootstrapping as the new
leader (D-04/D-06).

## The Contract

- **First window owns presence (D-02).** The leader is whichever window
  successfully creates the lockfile first — not the most recently focused window.
- **Heartbeat: 30 seconds (D-03).** The leader touches the lockfile mtime every
  30 s to signal liveness.
- **Staleness threshold: 90 seconds (D-04).** A follower that observes a lockfile
  mtime older than 90 s attempts a greedy stale-takeover.
- **Followers are silent (D-05).** No Discord IPC is opened; no detectors run;
  CPU use is zero beyond a 30 s poll.
- **Takeover starts fresh (D-06).** The new leader initialises from `IDLE` — no
  state replay across processes.
- **Graceful exit (D-07).** The leader unlinks the lockfile in `deactivate()`.
- **Crash recovery (D-08).** On crash, the lockfile ages stale within 90 s. No
  PID-liveness check — mtime is the sole signal.

## Test Matrix

| Scenario | Setup | Expected | Observed |
|----------|-------|----------|----------|
| A. 1 window (baseline) | Open one VS Code window. Run `claude` in the integrated terminal. | Window acquires leadership within ~1 s. Presence flips to AGENT_ACTIVE within ~1 s. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| B. 2 windows, same workspace | Open the same workspace in two windows in succession. Run `claude` in window 2's terminal. | Window 1 (opened first) is leader. Window 2 is a silent follower. Running `claude` in window 2 has NO effect on Discord. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| C. 2 windows, different workspaces | Open workspace A in window 1, workspace B in window 2. Run `claude` only in window 2's terminal. | Window 1 is leader. Window 2 is silent. Running `claude` in window 2 has NO effect on Discord. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| D. 3+ windows | Open three or more windows in sequence. Run `claude` in any non-first window. | Window 1 is leader; windows 2..N are silent followers. Only `claude` in window 1 affects Discord. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| E. Leader exits during AGENT_ACTIVE | While window 1 (leader) shows AGENT_ACTIVE, close window 1 cleanly. Window 2 remains open. | Window 1's `deactivate()` unlinks the lockfile (D-07). Within ~30 s window 2 acquires leadership, bootstraps detectors + RPC, and starts from IDLE (D-06). | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| F. Leader crash during AGENT_ACTIVE | While window 1 (leader) shows AGENT_ACTIVE, kill its extension host via "Developer: Stop Extension Host". Window 2 remains open. | Lockfile becomes stale ~90 s after the leader's last heartbeat. Window 2's next 30 s poll observes the stale mtime, performs greedy unlink + `open(wx)`, and bootstraps. Discord activity resumes within ~90-120 s of the crash. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |

## Recommendations

- **To force a specific window to be leader**, open that window first.
- **To verify which window is leader**, enable `agentMode.debug.verbose` and look
  for the line `[leadership] acquired — bootstrapping as leader` in the Output
  panel (D-13). Followers log `[leadership] held by another window — this window
  is a follower`.
- **If presence is stuck after closing the leader window**, wait at least 90
  seconds before filing an issue — that is the stale-takeover window per D-03/D-04.
  If presence does not resume after 120 s, file an issue with
  `agentMode.debug.verbose: true` enabled.
- The previous "use a different Discord Client ID per window" workaround is no
  longer needed and is no longer recommended — single-leader is the intended UX.

## See Also

- [`src/state/leadership.ts`](../src/state/leadership.ts) — the leadership election module
- [`src/extension.ts`](../src/extension.ts) — leader/follower wire-in (`createDriver`)
- [README.md Troubleshooting](../README.md#troubleshooting)
- [`.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md`](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md) — open smoke-test entry
