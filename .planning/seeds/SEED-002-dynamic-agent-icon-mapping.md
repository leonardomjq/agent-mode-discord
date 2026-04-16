---
id: SEED-002
status: dormant
planted: 2026-04-16
planted_during: v0.1.0 / Phase 05.2 (multi-window-leadership-election)
trigger_when: Phase 6 Discord asset upload OR v0.2.0 scoping OR first user issue requesting agent-specific icons
scope: Small
target_milestone: v0.1.x patch or v0.2.0
---

# SEED-002: Dynamic agent icon mapping

## Why This Matters

The extension already dispatches `agent-started` events with a specific `agent` label: `"claude"`, `"codex"`, `"gemini"`, `"aider"`, `"opencode"`, plus whatever users add via `agentMode.detect.customPatterns`. Currently the Discord presence uses a fixed `large_image` asset. A better UX would be:

- Claude Code running → Claude logo
- Codex running → OpenAI logo
- Gemini running → Google Gemini logo
- Aider running → Aider logo
- Unknown / custom agent → generic `agent-icon`
- Not running an agent (CODING state) → host editor logo (Cursor or VS Code based on `vscode.env.appName`)

This is a small code change that meaningfully increases presence quality — "Marcus sees Claude ran for 40 min, Steph sees Codex ran for 10 min" is more expressive than generic goblin art.

## When to Surface

**Trigger** — whichever comes first:

1. Phase 6 Discord asset upload step (PUB-01) — expand from `claude-icon` to the full set of per-agent icons
2. v0.2.0 scoping begins and quality-of-life improvements are being discussed
3. First user GitHub issue asking for agent-specific icons
4. Discord Dev Portal analytics show significant non-Claude agent usage (Codex/Gemini DAU > 10% of total)

## Scope Estimate

**Small** — ~1 hour of code + ~30 min of tests + human asset upload.

**Code side (1 hour):**
1. New `src/presence/iconMapping.ts` — pure module exporting `getIconAsset(agent: string | undefined, host: "vscode" | "cursor" | "windsurf") → { largeImage: string, largeText: string }`.
2. Built-in map: `claude → claude-icon`, `codex → codex-icon`, `gemini → gemini-icon`, `aider → aider-icon`, `opencode → opencode-icon`.
3. Fallback chain: specific agent key → generic `agent-icon` → host editor icon (`cursor-icon` / `vscode-icon`).
4. Wire into `src/presence/activityBuilder.ts` — replace hardcoded `large_image` with `iconMapping.getIconAsset(state.agent, host)`.
5. Host detection: read `vscode.env.appName` once at activation, map `"Visual Studio Code" → "vscode"`, `"Cursor" → "cursor"`, etc.
6. New config key `agentMode.iconMapping` — user-override for `{agentLabel: assetKey}` pairs.
7. Tests: `test/presence.iconMapping.test.ts` — map lookup, fallback chain, host detection, config override. ~25 lines.

**Asset side (human, one-time):**
Upload per-agent PNGs (1024×1024) to Discord Developer Portal with exact asset keys listed in the map. Source from vendor brand kits (Anthropic, OpenAI, Google, etc.). Nominative fair use covers "shows which tool is running" usage; keep attribution clean.

## Breadcrumbs

Code paths that need modification:

- `src/presence/activityBuilder.ts` — current `large_image` hardcode; replace with mapping lookup
- `src/presence/types.ts` — may need a minor type update for the mapping result
- `src/config.ts` — add `agentMode.iconMapping` config key with validation
- `package.json` contributes.configuration — new config entry
- `test/presence.activityBuilder.test.ts` — update existing tests for new asset key paths

Discord Developer Portal asset keys to upload (expansion of Phase 6 PUB-01):

- `claude-icon` (already in scope)
- `codex-icon`
- `gemini-icon`
- `aider-icon`
- `opencode-icon`
- `cursor-icon` (fallback for unknown agent in Cursor)
- `vscode-icon` (fallback for unknown agent in VS Code)
- `windsurf-icon` (if supporting Windsurf)
- `agent-icon` (last-resort generic)

Related decisions to revisit:

- Phase 6 plan `06-01` in ROADMAP.md — asset list should expand to include the full set when this seed activates
- `PRD §X competitive positioning` — this becomes a differentiator vs vscord/discord-vscode/RikoAppDev (none of them do per-agent icons because none of them detect agents)

## Notes

- The code is forward-compatible. If an asset key isn't uploaded to Discord Dev Portal, Discord silently skips the image (renders without it) — the fallback chain in the code then picks the next option. So the extension can ship code with the full map, and assets can be uploaded over time without code changes.
- Custom agent patterns added via `agentMode.detect.customPatterns` get their label passed through. User can add matching asset keys to their own Discord app if they fork the Client ID — or just hit the fallback.
- Consider a `large_text` field too: "Running Claude Code" / "Running Codex" / "Coding in Cursor" — reads on hover in Discord.
- D-13 `verbose` logging could include `[presence] agent=claude → asset=claude-icon` so users debugging "why is it showing the generic icon" can see the fallback chain.
