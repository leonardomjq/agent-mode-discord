# Multi-window Behavior

VS Code (and Cursor) can run multiple windows, each with its own extension host. goblin mode runs a leadership election so N open windows = one Discord card, not N flickering ones.

Implemented in [`src/state/leadership.ts`](../src/state/leadership.ts).

## How it works

The first window to activate writes `~/.claude/agent-mode-discord.leader.lock` via atomic `open(wx)`. That window owns Discord presence. All subsequent windows detect the lockfile, skip Discord IPC entirely, and poll every 30 seconds for a takeover opportunity.

If the leader exits cleanly, it unlinks the lockfile. If it crashes, the lockfile goes stale within 90 seconds (mtime-based liveness, no PID check), and the next follower poll attempts a greedy unlink + re-acquire.

## Contract

- **First window owns presence** — by lockfile-create order, not focus order.
- **Heartbeat:** 30 s — leader touches the lockfile mtime to signal liveness.
- **Stale threshold:** 90 s — followers attempt takeover after this.
- **Followers are silent** — no Discord IPC, no detectors, ~zero CPU.
- **Takeover starts fresh** — new leader initialises from `IDLE`, no state replay.

## Tips

- **Force a specific window to be leader:** open it first.
- **Verify which window is leader:** enable `agentMode.debug.verbose` and look for `[leadership] acquired — bootstrapping as leader` in the **Agent Mode (Discord)** output channel. Followers log `[leadership] held by another window — this window is a follower`.
- **Stuck after closing the leader window?** Wait at least 90 seconds — that's the stale-takeover window. If presence does not resume after 120 s, file an issue with `agentMode.debug.verbose: true`.

## See Also

- [`src/state/leadership.ts`](../src/state/leadership.ts) — election module
- [`src/extension.ts`](../src/extension.ts) — leader/follower wire-in
- [README → Troubleshooting](../README.md#troubleshooting)
