---
phase: "04"
slug: personality-config-privacy
status: pending
---

# Phase 04 Personality + Config + Privacy — Human UAT Checklist

All items require running the unpacked extension in a Dev Host (F5) with Discord desktop connected. Do not sign off remotely.

## Checklist 1 — Animator + Goblin Pack (PERS-01..05)

- [ ] **SC-4.1** Launch Dev Host (F5). Run `claude` in the integrated terminal. Observe Discord activity for 60 s. Confirm: (a) messages rotate every ~20 s; (b) the "cooking." → "cooking.." → "cooking..." frame animation cycles every ~2 s when the "cooking" message is active; (c) no two consecutive rotations show the identical message.
- [ ] **SC-4.2** Open VS Code Settings, set `agentMode.animations.enabled` to `false`. Observe that multi-frame messages (cooking/thinking) now stay on their first frame (".") but the 20 s rotation still fires.

## Checklist 2 — Privacy + Hash (PRIV-01..04)

- [ ] **SC-4.3** With `claude` running, set `agentMode.privacy.workspaceName` to `hash`. Within 20 s, confirm Discord state shows a 6-hex-char string (e.g., `6e36a2`) instead of the workspace name. Reload VS Code and re-open the same workspace — confirm the SAME 6-hex hash appears (deterministic).
- [ ] **SC-4.4** Set `agentMode.privacy.gitBranch` to `hide`. Confirm the branch disappears from Discord state within 20 s without a window reload.

## Checklist 3 — Ignore Lists (PRIV-05)

- [ ] **SC-4.5** Set `agentMode.ignore.workspaces` to `["**"]` (match everything). Within 20 s, confirm Discord profile shows NO activity (no goblin copy, no stale state). Remove the rule; within 20 s Discord re-populates normally.
- [ ] **SC-4.6** Set `agentMode.ignore.gitHosts` to `["github.com"]`. If current repo is on GitHub, confirm the extension goes silent within 20 s.

## Checklist 4 — Config surface (CONF-01..05)

- [ ] **SC-4.7** Open Settings, search "Agent Mode". Confirm ≤20 keys render, each with a human title, description, default value, and dropdowns for enum fields.
- [ ] **SC-4.8** Set `agentMode.debug.verbose` to `true`. Open Output → "Agent Mode (Discord)". Perform any settings change (e.g., flip animations.enabled). Confirm a debug log line appears in the channel. Flip verbose back to `false`; confirm no further lines appear.

## Sign-off

SC-4.1, SC-4.3, SC-4.5, SC-4.7 are the minimum hard gates. SC-4.2, SC-4.4, SC-4.6, SC-4.8 are secondary.
