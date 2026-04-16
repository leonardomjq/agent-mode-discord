# Multi-window VS Code Behavior

> **Status:** Documented from a manual smoke test. v0.1.0 ships with no automated multi-window harness. Behavior described here was observed on a single tester's machine; cross-OS / cross-shell reproduction is welcome via GitHub Issues.

## Background

VS Code can run multiple windows simultaneously, each with its own extension host process. The Agent Mode extension scopes Discord IPC `setActivity` calls per `process.pid` via the wrapper in [`src/rpc/client.ts`](../src/rpc/client.ts) (around line 92), wired in [`src/extension.ts`](../src/extension.ts) line 70 where `createConnectionManager(clientId, process.pid, realBackoffDeps)` receives the per-window pid. In theory, each window's activity is isolated from the others.

In practice, **the visible behavior in Discord depends on which client connected most recently**, because Discord's IPC accepts multiple `setActivity` calls scoped by pid but its UI surfaces typically display one activity per Application at a time.

## Test Matrix

| Scenario | Setup | Expected | Observed |
|----------|-------|----------|----------|
| 1 window (baseline) | Open one VS Code window with this extension active. Run `claude` in the integrated terminal. | Presence flips to AGENT_ACTIVE within ~1s. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| 2 windows, same workspace | Open the same workspace folder in two windows. Run `claude` in window 1's terminal. | Presence reflects window 1's state. Window 2 stays IDLE / CODING based on its own activity. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| 2 windows, different workspaces | Open workspace A in window 1, workspace B in window 2. Run `claude` only in window 2's terminal. | Presence shows window 2 as AGENT_ACTIVE; window 1 stays IDLE / CODING. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| 3+ windows | Open three or more windows. Run `claude` in one. | Presence reflects the window where `claude` is running; other windows do not contribute conflicting state. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |
| Window 1 closes during AGENT_ACTIVE | While window 1 shows AGENT_ACTIVE, close window 1. Window 2 (with editor focused) remains open. | Presence transitions to window 2's state (CODING or IDLE). No ghost AGENT_ACTIVE. | _pending — see [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md)_ |

## Observed Behavior

_Smoke test deferred at plan 05.1-06 Task 2. See [05.1-HUMAN-UAT.md](../.planning/phases/05.1-polish-marketplace-prep/05.1-HUMAN-UAT.md) for the open task._

## Recommendations

- Treat presence as "the most recently connected window's view" when running multiple VS Code instances. If you need each window to surface independently in Discord, use a different Discord Client ID per window (`agentMode.clientId` setting; see [README.md — Bus factor](../README.md#bus-factor--using-your-own-client-id)).
- If you observe a "ghost" AGENT_ACTIVE that persists after closing the window where `claude` ran, file a GitHub Issue with `agentMode.debug.verbose` enabled — this would indicate the pid-aware `clearActivity(pid)` cleanup did not run.

## See Also

- [`src/rpc/client.ts`](../src/rpc/client.ts) — pid-aware setActivity / clearActivity wrappers
- [`src/extension.ts`](../src/extension.ts) — extension activate / deactivate lifecycle
- [README.md Troubleshooting](../README.md#troubleshooting)
