---
phase: "03"
slug: agent-detection
status: pending
---

# Phase 03 Agent Detection — Human UAT Checklist

All items require running the unpacked extension in a Dev Host (F5) AND a real Claude Code install on this machine. Do not sign off remotely.

## Checklist 1 — Shell Integration tier (DET-01, DET-02, DET-04)

- [ ] **SC-3.1** Launch Dev Host (F5). Open integrated terminal (zsh on macOS preferred). Run `claude`. Verify Discord profile flips to AGENT_ACTIVE within 500 ms (use a stopwatch or Discord profile timer).
- [ ] **SC-3.2** With `claude` REPL active, send 3-5 user prompts. Verify Discord stays AGENT_ACTIVE across the entire session — no flicker to CODING during tool calls or model responses.
- [ ] **SC-3.3** Ctrl+C the `claude` REPL. Start a stopwatch. Verify Discord HOLDS AGENT_ACTIVE for 30 s (grace), then downgrades to CODING/IDLE.
- [ ] **SC-3.4** Open a new terminal, run `claude`, then close the terminal tab while it's running. Verify immediate AGENT_ACTIVE → CODING/IDLE (no grace — onDidCloseTerminal supersedes).
- [ ] **SC-3.5** Open two integrated terminals. Run `claude` in both. Verify both sessions tracked. Quit one (Ctrl+C). Verify Discord STAYS AGENT_ACTIVE (the second is still running). Quit the second. Verify Discord downgrades after the 30 s grace of the second session.

## Checklist 2 — JSONL fs-watch fallback (DET-05)

- [ ] **SC-3.6** Disable shell integration (e.g. `unsetopt PROMPT_SUBST` in zsh, or use a shell config without VS Code shell-integration script). Run `claude`. Verify Discord still flips to AGENT_ACTIVE within ~5 s via the JSONL fs-watch tier.
- [ ] **SC-3.7** (Linux only — best-effort) Repeat SC-3.6 on a Linux Dev Host. Verify the polling-stat fallback picks up the session (recursive fs.watch is unsupported on Linux).

## Checklist 3 — Other agents (DET-03)

- [ ] **SC-3.8** If aider is installed (`pip install aider-chat`), run `python -m aider` in a terminal. Verify Discord flips to AGENT_ACTIVE with agent=`aider`.

## Sign-off

Phase 03 manual sign-off requires SC-3.1, SC-3.2, SC-3.3, SC-3.4 minimum. SC-3.5..SC-3.8 are nice-to-have.
