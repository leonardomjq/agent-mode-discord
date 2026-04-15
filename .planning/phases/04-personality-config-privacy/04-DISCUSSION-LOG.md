# Phase 4: Personality + config + privacy — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 04-personality-config-privacy
**Areas discussed:** goblin-copy-content, ignore-match-behavior, hash-determinism, idle-clear-timing, time-of-day-semantics

---

## A. Goblin pack content / vibe

| Option | Description | Selected |
|--------|-------------|----------|
| v1 — indie-hacker meme tone | Self-deprecating, relatable ("yapping at claude", "200k context, all of it mid", "one-shot attempt") | |
| v2 — agent-turn-limbo framing | Rewrote CODING pool away from "hand-rolling code" after user clarified users don't touch files | |
| v3 — effortless-flex tone | Cut self-deprecation, reframed around "building, afk" as the value prop, made primary pool agent-agnostic with per-agent as flavor | ✓ |

**User's choice:** v3 pack (final) — locked in D-05.

**User-supplied framing:** "The user never touches a file. He only writes in terminal and in a classical agent chatbox. He does other things while it cooks. He wants for people to know he is cool. That he is building. Then he searched an extension for this. He may use codex, claude, it doesn't matter. It's all the same. But most people will use claude code."

**Notes:**
- v1 and v2 both failed the audience frame — v1 was coder-culture-meme-coded (not agent-user-coded), v2 still assumed the user sits at the keyboard reading code.
- v3 leans hard into "building, afk" as the whole-product line. Every other line radiates from there.
- Kept `["cooking.", "cooking..", "cooking..."]` as the pack's signature frame animation — the verb is already canonical in the community.
- Explicitly cut `fs.watch` for pack reload, emoji in copy, and "yapping"-style self-deprecation lines during the tone calibration.

---

## B. Ignore behavior

| Option | Description | Selected |
|--------|-------------|----------|
| 1. Skip `setActivity` | Keep RPC connected, don't push updates; previous presence lingers on friend sidebar | |
| 2. `clearActivity(pid)` once, stay silent | First match tick clears presence, subsequent ticks no-op, resume on un-match | ✓ |

**User's choice:** Option 2 (confirmed via "yes" after recommendation).
**Notes:** Option 1 fails the whole point of `ignore.repositories: ["/employer-repo/"]` — stale flex-presence persisting after adding an ignore rule is worse than no extension. Locked in D-14.

---

## C. Hash determinism

| Option | Description | Selected |
|--------|-------------|----------|
| 1. Salt-free / portable | Two users with same path → same hash. Deterministic across the user's own machines. Friends who know your folder layout could reverse it. | ✓ |
| 2. Per-user salted | Hash includes `os.hostname()` or `machineId`. Collision-resistant but hash changes when the user moves machines. | |

**User's choice:** Option 1 (confirmed via "yes" after recommendation).
**Notes:** Personal-use tool, path-collision attack is not a real threat model. Portability across the author's own machines (home desktop ↔ travel laptop) is the real UX win. Revisit salting in v0.2 only if anyone actually requests it. Locked in D-15.

---

## D. Idle `clear` timing

| Option | Description | Selected |
|--------|-------------|----------|
| 1. Immediately on IDLE transition | First rotation tick after state becomes IDLE calls `clearActivity(pid)` | ✓ |
| 2. After a grace (e.g. 60 s) | Avoid flicker on brief editor-focus-loss | |
| 3. Never auto-clear (only on deactivate) | `clear` mode just suppresses IDLE copy, leaves last CODING presence visible | |

**User's choice:** Option 1 (confirmed via "yes" after recommendation).
**Notes:** Phase-3 already bakes in a 30 s flicker-guard; adding another grace here compounds and makes `clear` feel laggy. State machine is truth. Locked in D-20.

---

## E. Time-of-day pool semantics

| Option | Description | Selected |
|--------|-------------|----------|
| 1. Pure fallback (state-pool exhausted only) | Time-of-day lines essentially never fire given state pools always have content | |
| 2. 80/20 weighted mix-in, 4 buckets, local time | 80% state pool / 20% time-of-day per rotation; 4 local-time buckets | partial |
| 3. 3-way weighted mix (primary / sub-pool / time-of-day) | Initial recommendation v2 | |
| 4. State-specific 3-way weights (70/20/10 for ACTIVE, 85/15 for CODING, 90/10 for IDLE) | Final — differentiates weighting by state because sub-pools only apply to AGENT_ACTIVE | ✓ |

**User's choice:** Option 4 — state-specific weights (evolved during the discussion from option 2 → option 3 → option 4 as the sub-pool semantics got nailed down).

**Notes:**
- Pure fallback (option 1) was rejected — would make time-of-day gags essentially never fire.
- Option 2 (flat 80/20) didn't accommodate per-agent sub-pools.
- Option 3 introduced sub-pool weighting but applied the same weights to all states (wrong for CODING/IDLE which have no sub-pool dimension).
- Option 4 is the final lock — D-07 + D-08 weight-redistribution rules. Fisher-Yates no-repeat applies across the *actually-used* pool for that tick (D-09), not per-sub-pool.

---

## Claude's Discretion

Areas explicitly deferred to the planner (captured in CONTEXT.md `Claude's Discretion` subsection):
- Pack validator implementation (hand-rolled TypeScript narrowing vs ~50-line ad-hoc validator)
- `{elapsed}` formatting (`20m` vs `20 min` vs `20 minutes`)
- `setInterval` vs `setTimeout`-chain for the 20 s clock
- Config-key ordering within `package.json` `contributes.configuration`
- Output channel name (`"Agent Mode (Discord)"` vs `"agent-mode-discord"`)

---

## Deferred Ideas

Promoted to the CONTEXT.md `<deferred>` section:
- Per-agent sub-pools for aider/gemini/opencode (v0.2 PERS-V2-03)
- `default` / `professional` copy packs (permanently cut per PROJECT.md)
- Salted privacy hashes (v0.2 reconsideration)
- Agent telemetry (token count, $/hr, context %) — v0.2 reserved slot
- Emoji / image slots in rich presence — Phase 5 asset work
- `fs.watch`-based custom-pack reload — superseded by poll-on-tick
- Partial per-pool pack fallback — rejected in favor of whole-pack fallback
