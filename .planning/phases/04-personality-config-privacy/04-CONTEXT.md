# Phase 4: Personality + config + privacy — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the hardcoded Discord activity from Phase 1 with a goblin-pack-driven animator (20 s rotation clock + 2 s frame clock, Fisher-Yates no-repeat), a templater that substitutes `{workspace} {filename} {language} {branch} {agent} {elapsed}` at render time, a privacy redaction layer (`show | hide | hash`) with ignore lists (`workspaces / repositories / organizations / gitHosts`), and a ≤20-key `contributes.configuration` surface that live-reloads on `onDidChangeConfiguration`. No new runtime deps. No outbound HTTP. Ships end-to-end through the existing Phase-2 driver → throttle → RPC pipeline.

</domain>

<audience_frame>
## Audience Frame (locked — informs all copy + UX decisions)

**Primary user profile** (captured from this discussion):

- The user lives in the terminal with an agent CLI (Claude Code, Codex, aider, etc.) or a classical agent chatbox (Cursor chat pane). They rarely touch a file directly.
- They do other things while the agent cooks — YouTube, coffee, errands, other windows. The extension's job is to broadcast that they're *still building* during those stretches.
- **The extension is a flex.** They want Discord friends to see that they're cooking with AI, that they're cutting-edge, that they're shipping. Not a productivity tool with Discord as a side-effect — a Discord-status tool with productivity as the substrate.
- Agent-agnostic by usage: they may use Claude today and Codex tomorrow. Per-agent flavor is a wink to the tribe, not the primary voice.
- Most users land on Claude Code. Claude sub-pool exists, but primary copy stays agent-neutral.

**Implication for copy tone:**
- Effortless cool > relatable indie-hacker meme
- Kill self-deprecation ("one-shot attempt", "yapping at claude", "200k context, all of it mid") — it undermines the flex
- Kill coder-at-keyboard framing ("hand-rolling code", "commit message surgery") — the user isn't at the keyboard; that's the whole point
- `building, afk` is the whole value prop as status text. The pack's entire tone radiates from that line.

</audience_frame>

<decisions>
## Implementation Decisions

### Goblin Pack Content & Structure

- **D-01:** Three state pools (`AGENT_ACTIVE`, `CODING`, `IDLE`). AGENT_ACTIVE is structured as an object with `_primary` (agent-agnostic) + per-agent sub-pools (`claude`, `codex` in v0.1; `_fallback` stays cut in favor of clean weight redistribution). CODING and IDLE are flat arrays.
- **D-02:** Messages are either `string` or `string[]`. String arrays are frame sequences cycled on the 2 s frame clock (e.g. `["cooking.", "cooking..", "cooking..."]`). Singletons render statically between rotations.
- **D-03:** v0.1 ships per-agent sub-pools for `claude` and `codex` only. Other detected agents (`aider`, `gemini`, `opencode`) hit the `_primary` pool 100% — their 20% sub-pool weight redistributes to `_primary` (→ 90% `_primary` / 0% sub-pool / 10% time-of-day).
- **D-04:** Message length target ≤ 50 chars — Discord rich-presence `details`/`state` are ~128-char max but readability drops hard past ~50.
- **D-05:** Canonical goblin pack content (committed as `src/presence/goblin.json`, validated against the pack schema at load time):

  ```json
  {
    "id": "goblin",
    "version": 1,
    "pools": {
      "AGENT_ACTIVE": {
        "_primary": [
          ["cooking.", "cooking..", "cooking..."],
          "shipping",
          "building",
          "in the kitchen",
          "letting it cook",
          "the agent is cooking",
          "building, afk",
          "pair-coded with AI",
          "agent-augmented",
          "vibe shipping",
          "prompt → PR",
          "delegated",
          "agent on the case",
          ["thinking.", "thinking..", "thinking..."],
          "outsourced the boring parts"
        ],
        "claude": [
          "shipping with claude",
          "claude locked in",
          "letting claude cook",
          "pair-coded with claude"
        ],
        "codex": [
          "shipping with codex",
          "codex locked in"
        ]
      },
      "CODING": [
        "reviewing the diff",
        "approving the plan",
        "queueing the next prompt",
        "steering the agent",
        "between prompts",
        "the review pass",
        "checking the work"
      ],
      "IDLE": [
        "context cooling",
        "agent.sleep()",
        "touching grass",
        "afk, still building",
        "stepped away",
        "brb, thinking",
        "mid-brainstorm"
      ]
    },
    "timeOfDay": {
      "lateNight": ["3am build session", "the night shift", "shipping before sleep"],
      "morning":   ["first prompt of the day", "morning build", "caffeine-loaded"],
      "afternoon": ["post-lunch build", "3pm focus sprint"],
      "evening":   ["golden hour shipping", "evening build session"]
    }
  }
  ```

### Animator — Pool-Pick Weights & Fallback

- **D-06:** Each 20 s rotation performs a weighted pool pick first, then a Fisher-Yates no-repeat pick within the chosen pool.
- **D-07:** State-specific weights:

  | State | Weights |
  |-------|---------|
  | `AGENT_ACTIVE` | 70% `_primary` · 20% per-agent sub-pool · 10% time-of-day |
  | `CODING` | 85% CODING pool · 15% time-of-day |
  | `IDLE` | 90% IDLE pool · 10% time-of-day |

- **D-08:** **Missing-pool fallback:** if a weighted sub-pool is missing or empty, its weight redistributes to the state's primary pool. Examples:
  - Detected agent has no sub-pool (`aider`) → 90% `_primary` / 0% / 10% time-of-day
  - Current bucket's time-of-day pool is empty → 87.5% `_primary` / 12.5% sub-pool (for `AGENT_ACTIVE`)
  - Both sub-pool and time-of-day missing → 100% state pool
- **D-09:** **Fisher-Yates no-repeat invariant** applies across the actually-used pool for that tick (i.e., the pool selected by the weighted roll). Prevents the "tiny time-of-day pool cycles predictably" bug.
- **D-10:** **`animations.enabled: false`** freezes frame sequences on frame 0 (statically) but still performs 20 s rotations. Non-sequence messages unaffected.
- **D-11:** **Time-of-day buckets** (local time via `new Date()`): `lateNight` 00:00–06:00, `morning` 06:00–12:00, `afternoon` 12:00–18:00, `evening` 18:00–24:00. No DST special-casing — `Date` handles it.
- **D-12:** **Injectable clocks** for tests: animator options-bag accepts `now?: () => Date`, `rand?: () => number`, `setInterval?` / `clearInterval?`. Mirrors the Phase-3 detector pattern so tests stay deterministic without monkey-patching globals.
- **D-13:** **`{elapsed}` anchor** resets on every state transition. `cooking for 20 min` resets to `0` on the next `agent-ended → agent-started` cycle. Matches Discord's own `startTimestamp` semantics.

### Privacy

- **D-14:** **Ignore-match behavior = clear-once, stay silent.** On the first rotation tick after any ignore rule matches, call `client.user?.clearActivity(process.pid)` exactly once. Subsequent ticks during the match: no-op (no `setActivity`, no `clearActivity`). First tick after match clears: resume normal pipeline. Keeps RPC connected throughout. Rejects the "skip setActivity and leave stale presence" interpretation.
- **D-15:** **Hash = salt-free, portable, SHA-1 first 6 hex chars of normalized workspace absolute path.** Normalization: `path.resolve()` → POSIX-style forward slashes → lowercase Windows drive letter only (no other lowercasing). No home-dir collapse. No symlink resolution — same workspace reached via symlink vs direct path is semantically different and should hash differently. Revisit salting in v0.2 if anyone actually requests it.
- **D-16:** **Ignore-list matching case semantics:**
  - `ignore.workspaces` (glob) — case-insensitive on all platforms (user's mental model for workspace paths is case-insensitive)
  - `ignore.repositories` (regex) — case-sensitive (regex users expect literal semantics; case insensitivity is expressible via `(?i)` prefix)
  - `ignore.organizations` (regex) — same rule as repositories
  - `ignore.gitHosts` (string list) — case-insensitive (e.g., `github.com` should match `GitHub.com`)
- **D-17:** **Git URL normalization before regex match** for `ignore.repositories` / `ignore.organizations`: strip `.git` suffix, strip `/` trailing slash, collapse `git@host:owner/repo` → `host/owner/repo` and `https://host/owner/repo` → `host/owner/repo`. Regex then matches against the normalized form. Documented in the pack-schema README.
- **D-18:** **Built-in `vscode.git` integration (PRIV-03/04):** use `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)`. If the API is missing, disabled, or throws, silently degrade to empty-branch (no crash, no toast — debug-channel log only). Every access wrapped in try/catch.

### Idle Behavior

- **D-19:** **`idleBehavior: show | clear`, default `show`.** Default `show` renders the IDLE goblin pool (we'd be shipping a disabled feature otherwise).
- **D-20:** **`clear` fires immediately** on the first rotation tick after the state machine transitions to IDLE. No additional grace — the Phase-3 30 s flicker-guard already provides the grace window. Adding another here compounds into laggy state perception.

### Config Surface

- **D-21:** **Nested namespace** — all keys live under `agentMode.*` with subsection grouping (e.g. `agentMode.privacy.workspaceName`, `agentMode.ignore.workspaces`, `agentMode.messages.customPackPath`, `agentMode.detect.customPatterns`). VS Code's settings editor renders nested keys as grouped sections; flat is unreadable past ~10 keys.
- **D-22:** **≤20 total keys.** Provisional inventory (subject to planner refinement):

  | # | Key | Type | Default | Req |
  |---|-----|------|---------|-----|
  | 1 | `agentMode.clientId` | string | `""` (→ bundled) | CONF-02 |
  | 2 | `agentMode.idleBehavior` | enum `show\|clear` | `show` | CONF-04 |
  | 3 | `agentMode.debug.verbose` | boolean | `false` | CONF-05 |
  | 4 | `agentMode.animations.enabled` | boolean | `true` | PERS-05 |
  | 5 | `agentMode.messages.customPackPath` | string | `""` | PERS-07 |
  | 6 | `agentMode.privacy.workspaceName` | enum `show\|hide\|hash` | `show` | PRIV-01 |
  | 7 | `agentMode.privacy.filename` | enum `show\|hide` | `show` | PRIV-02 |
  | 8 | `agentMode.privacy.gitBranch` | enum `show\|hide` | `show` | PRIV-03 |
  | 9 | `agentMode.ignore.workspaces` | string[] (glob) | `[]` | PRIV-05 |
  | 10 | `agentMode.ignore.repositories` | string[] (regex) | `[]` | PRIV-05 |
  | 11 | `agentMode.ignore.organizations` | string[] (regex) | `[]` | PRIV-05 |
  | 12 | `agentMode.ignore.gitHosts` | string[] | `[]` | PRIV-05 |
  | 13 | `agentMode.detect.customPatterns` | object | `{}` | DET-10 (Phase 3 already consumes) |
  | 14 | `agentMode.detect.sessionFileStalenessSeconds` | number | `60` | DET-05 (Phase 3 already consumes) |
  | — | **Spare slots 15–20** | — | reserved for planner | — |

  Phase-4 planner may add up to 6 more keys. **Hard cap is 20** (CONF-01). Keys 13–14 are already consumed by Phase 3 but are listed here for completeness since Phase 4 owns the manifest edit.

- **D-23:** Every key requires `title`, `description`, `default`, and (where applicable) `enumValues` in `package.json` `contributes.configuration`. Validated in CI.
- **D-24:** **Live reload via `onDidChangeConfiguration`** — config reads are lazy (pulled on each rotation tick), not cached at activation. Flip-to-apply latency = next tick (≤ 20 s). No window reload required.

### Custom-Pack Loading (PERS-07)

- **D-25:** **Poll-on-rotation-tick.** Every 20 s rotation reads `messages.customPackPath` via `fs.readFileSync` (small file, no async complexity). No `fs.watch` — one more Node handle isn't worth it given the 20 s cadence already bounds user-perceived latency.
- **D-26:** **Whole-pack fallback on schema invalidation.** Invalid pack → debug-channel log the validation error → fall back entirely to built-in goblin for that tick. No partial/per-pool fallback — "half-goblin, half-custom" is a confusing bug class.
- **D-27:** **Schema validation** runs on every load (cheap). Validated shape: `{ id, version, pools: { AGENT_ACTIVE, CODING, IDLE }, timeOfDay? }` with all the D-01/D-02 structural rules. Use a zero-dep validator (hand-rolled TypeScript narrowing or a ~50-line ad-hoc validator) — no `ajv`, no `zod`, bundle stays lean.
- **D-28:** **No toasts on pack error** (aligns with PROJECT.md "no toasts" constraint). Debug-channel log only. User opens Output → "Agent Mode (Discord)" to see what went wrong.

### Network Guardrail (PRIV-07)

- **D-29:** **Network-traffic CI assertion** runs against the built bundle in a fresh VS Code profile for a 10-minute window. Zero outbound HTTP requests allowed (Discord IPC — local Unix socket / Windows named pipe — does not count). Implementation outline: spawn Extension Host with the built bundle, use a null HTTP agent / process-level network shim to capture attempts, fail on any non-zero count. Actual test harness is a Phase-4 planner concern; the guardrail contract is fixed here.

### Claude's Discretion

- **Pack validator implementation details** — whether to hand-roll TypeScript narrowing or write a ~50-line ad-hoc validator (both meet D-27's zero-dep constraint; planner picks whichever fits the existing code style).
- **`{elapsed}` formatting** — `20 min`, `20m`, `20 minutes`? No strong user preference; Discord convention is short (`20m`, `2h 15m`). Planner picks.
- **Per-rotation `setInterval` vs `setTimeout` chain** — both implement a 20 s clock; `setTimeout` reschedule is slightly more drift-resistant but slightly more code. Planner picks.
- **Order in which `contributes.configuration` keys appear in `package.json`** — grouped by namespace (privacy keys together, ignore keys together) with alphabetical within each group.
- **Output channel name formatting** — `"Agent Mode (Discord)"` or `"agent-mode-discord"`? Planner picks what renders cleanest in VS Code's Output picker.

### Folded Todos

None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level specs
- `.planning/PROJECT.md` — locks goblin-as-only-pack, `show` default for privacy, zero outbound HTTP, bundle ≤ 500 KB, file ≤ 200 lines
- `.planning/REQUIREMENTS.md` — PERS-01..PERS-08, PRIV-01..PRIV-07, CONF-01..CONF-05 full acceptance text
- `.planning/ROADMAP.md` §"Phase 4: Personality + config + privacy" — 5 Success Criteria + 9 plan skeletons

### Prior phase context (carry-forward)
- `.planning/phases/01-skeleton-rpc-seam/01-CONTEXT.md` — RPC client + `clearActivity(pid)` contract used by D-14
- `.planning/phases/02-core-pipeline/02-CONTEXT.md` — driver/throttle/reducer pipeline Phase 4 plugs animator into; Phase-2 `redact()` signature at `src/privacy.ts`
- `.planning/phases/03-agent-detection/03-CONTEXT.md` — 30 s flicker-guard + 60 s session-file staleness; injected-clocks pattern re-used in D-12

### VS Code API surface
- VS Code `contributes.configuration` reference (stable API — no proposed surface used)
- VS Code `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` (Git extension API, consumed for PRIV-03)
- VS Code `ConfigurationChangeEvent` / `onDidChangeConfiguration` (consumed for CONF-03 / D-24)

### Discord Rich Presence
- `@xhayper/discord-rpc` `setActivity` / `clearActivity(pid)` (already wired in Phase 1) — no API changes, just new copy sources
- Discord RP field budgets: `details` ~128 chars, `state` ~128 chars, `largeImageText` ~128 chars (informs D-04 target)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/privacy.ts` — Phase-2 stub with Phase-4-ready signature (`redact(field, value, mode)`). Phase 4 replaces the `hash` throw with real SHA-1 impl (D-15) and adds the ignore-list evaluator alongside.
- `src/rpc/client.ts` — already exposes `clearActivity(pid)` via the wrapped `@xhayper/discord-rpc` client; D-14 reuses it, no new surface.
- `src/rpc/throttle.ts` — Phase-2 2 s leading+trailing throttle. Animator ticks land in the throttle untouched; Phase 4 doesn't modify the throttle contract.
- `src/state/machine.ts` — 6-state machine already emits `AGENT_ACTIVE` sub-label for per-agent routing; D-07's per-agent sub-pool consumes this.
- `src/detectors/regex.ts` — pure-core `normalizeCommandLine` helper already exists; if the ignore-list evaluator needs any ANSI/prefix stripping for git-URL normalization, adapt the same pattern (but D-17 spec doesn't require ANSI strip — URLs are clean).
- `src/detectors/index.ts` orchestrator — per-terminal agent label dispatches into the driver; the animator consumes the current state + agent label from the reducer (no new detector work needed).

### Established Patterns
- **Options-bag injection** — every module under `src/detectors/` uses an options-bag with injectable side effects (`now`, `rand`, `setInterval`, `clearInterval`, `fs` factories). D-12 mandates the animator use the same pattern. Planner should not introduce a new pattern for Phase 4.
- **Pure-core boundary** — `src/detectors/regex.ts` is locked in `scripts/check-api-surface.mjs` PURE_CORE_PATHS. Phase 4 should add `src/presence/animator.ts`, `src/presence/templater.ts`, `src/presence/packLoader.ts` (except the file-read path), `src/presence/activityBuilder.ts`, and `src/privacy.ts` (logic) to PURE_CORE_PATHS — none of these need `vscode`. Adapter modules (config reader, `vscode.git` consumer) stay outside pure-core.
- **Wave-0 test scaffolding** — Phase 3 established the `Wave 0 test stub / Wave 1 flip it.todo → passing` pattern (03-00). Phase 4 planner should consider the same structure since there are 9 plans clustered into roughly 3 waves.
- **Soft file-size target 200 lines / hard 300** — Phase 3 consistently overran soft but stayed under hard; same precedent applies.
- **Debug-channel-only errors** — no toasts anywhere in the codebase. Confirmed in D-28.

### Integration Points
- **Driver (`src/driver.ts` from Phase 2)** — currently calls a hardcoded activity builder. Phase 4 plan 04-04 (`activityBuilder.ts`) replaces it. The driver's signature into the animator stays the same shape as the Phase-2 stub.
- **`extension.ts` (Phase 3 wired orchestrator here)** — Phase 4 adds config-change listener + animator construction. Keep the pattern: construct in `activate()`, dispose in `deactivate()`, no side effects at import time.
- **`package.json` `contributes.configuration`** — currently empty. Phase 4 owns the full 20-key manifest edit in one atomic commit (per roadmap's "Single `package.json` manifest edit").
- **CI (`.github/workflows/` — landed in Phase 1)** — Phase 4 plan 04-09 adds the network-traffic assertion step to the existing workflow; no new workflow file.
- **Bundle budget** — currently 212 KB / 500 KB. Phase 4 must fit goblin.json + animator + templater + activity builder + privacy impl + network-test harness into the remaining ~288 KB. Zero new runtime deps (D-27, D-29) is the main budget protection.

</code_context>

<specifics>
## Specific Ideas

**The flex is the product.** Every copy-tone call in this phase should trace back to `building, afk` — the line that captures the whole value prop. If a message makes the user sound like they're *struggling*, *waiting*, or *confused*, it goes in the cutting-room floor. Effortless cool is the ceiling.

**Agent-agnostic voice by default, agent-specific as flavor wink.** 70% of AGENT_ACTIVE picks don't name any model. The per-agent sub-pool (20%) is a tribe wink ("claude locked in" lands differently for a Claude Code user than "shipping with claude" — the former is the cool nod, both ship).

**"Cooking" is the iconic frame-anim.** Across this community — Twitter, Discord, Cursor group chats — "cooking" is already the verb. Keep the `["cooking.", "cooking..", "cooking..."]` frame array as the pack's signature line. Don't overload it — one frame sequence per pool is enough; adding three more would diffuse the bit.

**Copy references the author actually has in mind:**
- "building, afk" — the whole value prop
- "prompt → PR" — the agentic dev mental model
- "letting it cook" / "let him cook" — the meme template
- "3am build session" — the developer-culture nod without the self-deprecation

**No emojis in copy strings** — Discord activity text renders consistently across desktop/web; emojis are inconsistent and leak into shell-integration normalization edge cases. Emoji lives in `largeImage` / `smallImage` slots (Phase 5 asset work).

</specifics>

<deferred>
## Deferred Ideas

- **Per-agent sub-pools for `aider`, `gemini`, `opencode`** — v0.2 (PERS-V2-03). v0.1 ships Claude + Codex flavor only; others fall through to `_primary` via D-08's weight redistribution.
- **Additional copy packs (`default`, `professional`)** — killed in PROJECT.md, permanently out-of-scope for v0.1. Revisit if a post-launch community asks.
- **Salted privacy hashes** — revisit in v0.2 if anyone actually requests it (D-15). Personal-use tool; path-collision attack isn't a real threat model here.
- **Agent telemetry (token count, $/hr, context %)** — reserved slot in v0.2 roadmap (PERS-V2-04 / DET-V2-03). Don't add token counters to goblin copy (e.g. "200k context" line was cut for this reason — it implies telemetry we're not shipping).
- **Emoji / image slots in rich presence** — `largeImage` / `smallImage` / `largeImageText` assets land in Phase 5 (DIST-*). Phase 4 only wires `details` + `state` + `startTimestamp`.
- **`fs.watch`-based custom-pack reload** — superseded by D-25 poll-on-tick. Revisit if users complain about 20 s reload latency (unlikely — the pack is a bag of copy lines, not live code).
- **Partial per-pool pack fallback** — rejected in D-26 in favor of whole-pack fallback. Revisit only if pack schema evolves into a plugin-like structure.

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 04` returned zero matches.

</deferred>

---

*Phase: 04-personality-config-privacy*
*Context gathered: 2026-04-14*
