# Feature Research

**Domain:** VS Code / Cursor Discord Rich Presence extension with native terminal-based AI agent detection (Claude Code + aider/codex/gemini/opencode regex)
**Researched:** 2026-04-12
**Confidence:** HIGH — grounded in PRD §16 competitive matrix, live vscord/discord-vscode issue trackers, and the trimmed v0.1 scope in `.planning/PROJECT.md`.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing any of these produces an issue within the first week of install (pattern confirmed on vscord + discord-vscode issue trackers).

| Feature | Why Expected | Complexity | Notes / Citation |
|---------|--------------|------------|-------|
| **RPC connect + exponential-backoff reconnect** | Discord desktop gets killed, restarted, or is launched *after* VS Code boots. If the extension doesn't survive that, it's broken within 10 minutes. | M | vscord #324 "disconnected time tolerance" shows users notice. Implement 5→10→20→40→60s with a 5s cooldown guard (Codex-Discord-Rich-Presence `src/discord.rs:35-36, 276-282` pattern). FR-4.2. |
| **`clearActivity(pid)` on deactivate — never `setActivity(null)`** | Ghost presences across window reloads are one of the most-cited historical bugs in every RPC library. | S | vscord learned this the hard way; we inherit the fix in FR-4.3. Pair with FR-4.4 (pid-scoped activity) for multi-window. |
| **Per-PID activity scoping for multi-window isolation** | Power users run 2–3 editor windows concurrently; if presences collide, "last window wins" feels broken. | S | FR-4.4. `process.pid` passed to every `setActivity` call. Single biggest "feels pro" signal with zero UI cost. |
| **Idle handling that doesn't orphan the RPC loop** | vscord #362 ("Activity isn't showing on others' discord view") and #326 ("Show 'Idling' when using HEX Editor view mode") are exactly this failure mode: state machine falls into a hole and never recovers. | M | FR-2.3 + idle timeout + explicit IDLE state with a copy string (not empty). `idleBehavior: show \| clear` setting. |
| **Privacy ignore lists that actually work** | vscord #205 "IP filtering / Hostname filtering broke" and discord-vscode #1922 "private Repos links are visible" / #1825 "Don't show IP in SSH" prove this is the #1 trust-breaking class of bug. | M | FR-6.4: `ignore.workspaces` (glob), `ignore.repositories` (regex), `ignore.organizations` (regex), `ignore.gitHosts` (regex). Matching *any* rule → extension goes fully silent (no presence at all — not a partial redaction). |
| **Per-field privacy toggles (workspace / filename / branch)** | discord-vscode #1922, vscord #258 ("Hide 'View Repository' button on private repos") and #273 ("separate option to hide workspace vs filename vs git repo"). Users demand granularity. | S | FR-6.1/6.2/6.3. Three enums (`show \| hide` for filename/branch, `show \| hide \| hash` for workspace). **Our v0.1 flips default to `show`** (project-specific call — personal use, no client work) but the machinery is intact for later. |
| **Rate-limit / throttle on `setActivity`** | Discord disconnects on spam. vscord ships 2s leading+trailing throttle in production; any tighter is a footgun. | S | FR-7.1 — 2000ms leading+trailing, last-call-wins queue. Not 15s (original PRD overcorrection). |
| **Live config reload (no window reload needed)** | Industry table stakes since VS Code 1.40. Any "restart editor to apply" prompt reads as amateur-hour. | S | FR-6.5. `onDidChangeConfiguration` handler applies on next presence tick. |
| **Git branch detection** | Nearly every presence extension shows branch. Absent = incomplete. | S | FR-3.1. Bridge `vscode.extensions.getExtension('vscode.git').exports.getAPI(1)`. No new runtime dep. |
| **Stable on Remote SSH / WSL** | vscord #26 ("stuck on Idling over SSH") is the single most-upvoted remote-work complaint. If we claim "terminal detection" but break over SSH, we own the next bug report. | M | Shell Integration API works over Remote SSH. Companion-lockfile tier (FR-1.1) works inside the remote host. fs-watch tier works on mounted `~/.claude/`. Document explicitly in README. |
| **Graceful "Discord not running" fallback** | Users launch VS Code before Discord routinely. Silent retry loop, never a toast. | S | FR-4.5. Only surface errors when `debug.verbose: true`. |
| **Marketplace-compliant (zero proposed APIs, zero `any` casts)** | Riko's extension uses `(vscode as any).chat` — that's a rejection trigger and a time bomb when the chat API changes. Users don't file this issue, but the Marketplace will. | S | PROJECT.md constraint. Stable-API only, `engines.vscode: ^1.93.0`. |
| **Works on Cursor / VSCodium / Windsurf (OpenVSX)** | vscord users filed install requests repeatedly (discord-vscode #1968 "Support for VSCodium"). OpenVSX publish is a 30-minute setup cost; skipping it locks out a quarter of the persona. | S | M7 in PRD. Publish to both Marketplace + OpenVSX on tag push. |
| **Idle copy string (not empty string)** | If IDLE renders as blank/cleared, it looks like the extension crashed. Needs a user-visible "I'm still here, just idle" copy. | S | FR-5.1 — packs all define an IDLE sub-pool. |
| **Elapsed timer on active state** | Every competitor ships it. Missing = feels static. | S | FR-5.7 — Discord `startTimestamp`, reset only on state transitions (not rotation/frame ticks). |

### Differentiators (Competitive Advantage — The Moat)

Features no existing competitor ships. Aligned with the Core Value in PROJECT.md ("when `claude` is running in the integrated terminal, Discord shows you as 'cooking'").

| Feature | Value Proposition | Complexity | Notes / Citation |
|---------|-------------------|------------|-------|
| **Terminal-native agent detection via Shell Integration API** | The *entire reason this project exists*. vscord (778k installs), iCrawl/discord-vscode (2.48M) — neither detects terminal commands. Their state model is `vscode.window.activeTextEditor`, so the moment you focus the terminal, they revert to Idling. | L | FR-1.2. `onDidStartTerminalShellExecution` + `onDidEndTerminalShellExecution` + `onDidChangeTerminalShellIntegration` (that third event is critical — shell integration activates async and you lose the first command without it). Regex applied after ANSI/prompt-prefix strip when `commandLine.confidence === Low`. |
| **Tiered detection fallback (companion > shell-int > fs-watch > polling)** | Single biggest reliability differentiator. Cursor-on-Windows has documented shell-integration bugs; fish/cmd users lack shell integration entirely. Competitors fail or false-negative in these environments. | L | FR-1.1 → FR-1.5. Precedence dedup (FR-1.6) ensures one logical session per `vscode.Terminal`. Highest-fidelity signal wins; lower tiers observed but don't mutate state. |
| **Multi-agent support out of the box** | Competitors split along agent lines: tsanva/cc-discord-presence is Claude-only, Codex-Discord-Rich-Presence is Codex-only, opencode-discord-presence is OpenCode-only. "One extension, all agents" is a structural win even if v0.1 only ships Claude copy. | M | FR-1.7 + regex covers 5 agents. `detect.customPatterns` lets users wire aider/codex/gemini/opencode with bespoke labels. |
| **Per-agent sub-labels on AGENT_ACTIVE state** | "claude · 2h 47m" reads very differently from a generic "AI pair programming." Builds social identity per tool. | S | §9.2 state machine. AGENT_ACTIVE carries an agent name that drives copy sub-pool selection. |
| **Claude Code companion plugin (lockfile pattern)** | Zero competitors ship an agent-side hook. `SessionStart`/`SessionEnd` → `~/.claude/agent-mode-discord.lock` is fidelity you simply cannot match with terminal regex. Also dodges the undocumented-JSONL-format trap. | S (2h per M5) | FR-1.1, M5. `claude plugin install` UX is already standard in the Claude Code ecosystem. |
| **`goblin` copy pack as the flagship personality** | vscord has "partial" custom-pack support; discord-vscode has none; Riko ships a personality layer but with generic copy. "locked in fr (the agent is, not me)" / "ratioed by an LLM" / "chat is this vibecoding" is differentiation users will screenshot. | S | Trimmed from 3 packs to just `goblin` in v0.1 per PROJECT.md. Default+professional deferred to v0.2 if community asks. |
| **No BYO Discord Client ID required (bundled default)** | Codex-Discord-Rich-Presence **requires** users to create a Discord Developer application, upload assets, and paste a Client ID before first run. That's a 20-minute onboarding for what should be 30 seconds. Install → works. | S | FR-4.1 — bundled default Client ID for the `Agent Mode` Discord app; `clientId` setting remains as an override escape hatch. |
| **Frame cycling + rotation clock with no-repeat invariant** | Static strings get boring; naive random rotation repeats. Two independent clocks (2s frame, 20s rotation) with Fisher-Yates queue + no-back-to-back invariant = the presence genuinely feels alive. | M | FR-5.6. Both clocks respect the 2s RPC throttle; rate limiter flushes whichever tick arrived latest. |
| **Tight configuration surface (≤ 20 keys)** | vscord has ~160 settings (the #1 complaint in their issue tracker adjacent feedback — #415 "allow fallback option when using object value," #286 "Settings & Variables issues"). We flex the opposite: every setting has a job, the UI fits on one screen. | S | FR-8 / PROJECT.md constraint. ≤ 20 keys in `contributes.configuration`. |
| **Generic detection infrastructure from day one** | `detect.customPatterns` means aider/codex/gemini/opencode light up with a single settings edit. No new release required. | S | FR-1.7. Undocumented but noteworthy: when Anthropic ships a new CLI variant, users can add the regex themselves before we ship a patch. |
| **Time-of-day copy pools** | "3am claude run, locked in" only fires at 3am. Small touch that makes the overlay feel context-aware, not random. | S | FR-5.1 / §9.6. `morning \| afternoon \| evening \| late_night` sub-keys on each agent sub-pool. |
| **Portfolio-grade presentation (polished README, demo GIF, positioning table)** | Not a code feature — a distribution feature. Every competitor's README is a wall of text. Above-the-fold GIF + 3-row competitor table + privacy FAQ is the moat for discovery. | S (included in M6b) | PROJECT.md Active list. |

### Anti-Features (Commonly Requested, Deliberately NOT Built)

Features that seem good but create problems or dilute the core value. All deferred/rejected with cause.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Bidirectional control (send prompts to the agent from Discord)** | "Wouldn't it be cool to talk to Claude from my phone?" | That's Claude Code Channels' product space — a separate, larger project. Pulls us into auth, message routing, agent-runtime lifecycle, and breaks our "read-only / local IPC only" security posture. Scope-annihilating. | Read-only presence; point at Claude Code Channels in the README for the other direction. PRD §3 Non-Goals. |
| **160-setting sprawl (vscord pattern)** | "Can you add one more toggle for...?" — legitimate edge cases accumulate | vscord #286 "Settings & Variables issues" + general reputation: their settings UI is impenetrable. Every new setting is a new test matrix cell, a new support burden, and a new regression surface. | Hard cap ≤ 20 settings in v0.1 (PROJECT.md constraint). Every new setting must justify its cost. Custom message packs serve as the extensibility escape hatch for copy tweaks. |
| **BYO Discord Client ID as mandatory onboarding** | Copied from Codex-Discord-Rich-Presence; "gives users control" | 20-minute onboarding, sub-5% completion rate for casual installs, kills Marketplace conversion. Also requires each user to upload asset PNGs — they won't, so presences look broken. | Bundled default Client ID. `clientId` setting still exists as override for power users / custom branding / forks. FR-4.1. |
| **Structural parsing of `~/.claude/projects/*.jsonl`** | "If we parse the JSONL we can show model, token count, cost, prompt text..." | Undocumented internal Anthropic format. One schema change breaks us in production. Pulls us into a reverse-engineering arms race with a first-party vendor. | Use mtime + existence as signal only. Wrap all reads in try/catch. Never parse structurally (PROJECT.md constraint). Telemetry bridge reserved for v0.2 via statusline or companion-plugin protocol. |
| **Agent telemetry bridge in v0.1 (model / cost / burn rate / context %)** | Community flexes these (ccusage, ccstatusline) | Doubles the v0.1 scope. Requires either JSONL parsing (anti-feature above) or statusline integration (not stable). Locks us into Claude-only until other agents add equivalents. | Reserve v0.2 roadmap slot (PRD §3 explicitly calls it out). Presence-only in v0.1 prevents scope collapse. |
| **Mobile / web Discord / Codespaces support** | "My Discord is on mobile too" / "Codespaces is my setup" | Discord RPC is **local IPC only** — Unix socket / Windows named pipe. Mobile and web Discord don't expose it. Codespaces has no local Discord process at all. Solving this requires a bounce server + OAuth + hosting — a product, not an extension. | Document desktop-only scope prominently in README. Mention `discord-flatpak-rpc-bridge` for Flatpak users. PRD §3 Non-Goals. |
| **Team features / shared activity dashboards / analytics** | "Show my squad everyone's cooking at once" | Pulls us into accounts, servers, data retention, GDPR. 10x scope. Also dilutes the "single-user local tool" privacy story. | Single-user local tool, period. PROJECT.md Out of Scope. |
| **RikoAppDev-style `(vscode as any).chat` detection + edit heuristic** | Zero-setup, no terminal integration needed | Proposed API surface → Marketplace compliance risk; API *will* change. Edit heuristic false-positives on every copy/paste, refactor, format-on-save. Riko shipped it 2026-04-04 — our differentiator is *not* doing this. | Shell Integration API (stable since 1.93). Explicit terminal-command matching, not behavior inference. |
| **Default pack + Professional pack in v0.1** | "Not everyone wants goblin voice" | Scope padding. 3x copy-writing cost, 3x screenshot cost, 3x Marketplace-listing asset cost. Author uses goblin; audiences for default/professional are imaginary in v0.1. | Ship `goblin` only; custom pack JSON path (FR-5.5) lets anyone swap in their own voice. Revisit default+professional in v0.2 if community asks. PROJECT.md Out of Scope. |
| **Cline / Roo Code detection via `getExtension(...).isActive`** | Covers more agents | Cline/Roo run *inside* a VS Code extension, not the terminal — detecting them means "is the extension installed and active" which is a different signal class (not command execution). Deferred for clean v0.1 story. | v0.2 roadmap. Custom patterns handle most cases meanwhile. |
| **Launch campaign (HN / X thread / subreddit drops / creator DMs / Product Hunt)** | "You should go hard on launch" | Weeks of overhead for a weekend project. Pressure to ship features the launch needs, not the product needs. | PROJECT.md: polished README + public repo + Marketplace + OpenVSX. Let organic discovery happen. PRD §13 Phase C explicitly deferred. |
| **OpenCode companion plugin in v0.1** | Mirror-symmetry with Claude | 2h extra, and author doesn't use OpenCode daily. Claude companion is the author's actual primary use case. | v0.2. OpenCode regex detection still works in v0.1 via tier-2. |
| **Discord Activity "Details" and "State" fields as freeform user-editable templates** | Maximum customization | Becomes a templating DSL with its own bugs (escape rules, missing-token fallback, etc.). vscord went this path and has the settings sprawl to prove it. | 6 fixed tokens (`{workspace}`, `{filename}`, `{language}`, `{branch}`, `{agent}`, `{elapsed}`) + custom message packs. No freeform template strings in settings. |
| **Automatic update / telemetry / "phone home"** | "How will we know if it breaks?" | Privacy violation for a tool whose entire USP is "it knows what you're doing." Users will uninstall on principle. | Zero outbound HTTP. Discord IPC only. PROJECT.md constraint. Rely on GitHub issues for bug reports. |

---

## Feature Dependencies

```
[Discord RPC client (M0/M2)]
    └──requires──> [@xhayper/discord-rpc lib]
    └──requires──> [Bundled Client ID (Discord Developer Portal, [HUMAN] step)]

[Terminal agent detection (M1)]
    └──requires──> [Shell Integration API (engines.vscode >= 1.93)]
    └──requires──> [ANSI/prompt-prefix stripper (Low-confidence commands)]
    └──requires──> [Regex detector + session map keyed by vscode.Terminal]

[Tiered detector precedence (FR-1.6)]
    └──requires──> [Shell integration detector]
    └──requires──> [Companion lockfile watcher]
    └──requires──> [fs-watch on ~/.claude/projects/*.jsonl]
    └──requires──> [Polling on vscode.window.terminals]

[State machine (M2)]
    └──requires──> [Detector signals (terminal + editor + idle timer)]
    └──requires──> [Git branch bridge (vscode.git extension API)]

[Personality layer (M3)]
    └──requires──> [State machine (agent name sub-label)]
    └──requires──> [Pack loader + JSON schema validation]
    └──requires──> [Rotation clock (20s) + frame clock (2s)]
    └──requires──> [Templater (after privacy redaction)]

[Privacy layer (M4)]
    └──requires──> [Config schema + onDidChangeConfiguration reload]
    └──enables───> [Templater (tokens render as empty → animator drops message)]
    └──enables───> [Ignore-list matcher (full silence on match)]

[Companion plugin (M5)]
    └──enhances──> [Terminal detection (highest-fidelity tier)]
    └──independent of──> [Shell Integration API]  (works even if tier 2 fails)

[Multi-window isolation]
    └──requires──> [pid-scoped setActivity/clearActivity calls (FR-4.4)]

[OSS hygiene + Publish (M6a/M7)]
    └──requires──> [Everything above green]
    └──requires──> [VSCE_PAT + OVSX_PAT ([HUMAN] steps)]

[Detection tier CONFLICTS]
[Lockfile signal] ──wins-over──> [Shell integration signal]
[Shell integration signal] ──wins-over──> [fs-watch signal]
[fs-watch signal] ──wins-over──> [Polling signal]
(all four tiers run concurrently; precedence resolves collisions per vscode.Terminal)
```

### Dependency Notes

- **Personality layer requires state machine:** the agent-name sub-label (claude/aider/codex/gemini/opencode) that selects the copy sub-pool is produced by the detector → state-machine chain. Without it, all agents share a single generic pool.
- **Templater requires privacy layer:** tokens like `{filename}` must resolve *through* privacy settings. Messages that become empty after substitution (e.g., `"editing {filename}"` with filename hidden → `"editing "`) must be dropped by the animator, not rendered.
- **Companion plugin enhances terminal detection without replacing it:** users who install it get higher fidelity; users who don't get tier-2 fallback. The feature is additive, not a dependency — critical that the extension ships fully functional for users who never install the companion.
- **Multi-window isolation is cheap but order-sensitive:** every call site that sets or clears activity must pass `process.pid`. One missed call site breaks it.
- **Lockfile vs shell-integration conflict:** both can fire for the same Claude session. Precedence dedup (FR-1.6) resolves this — without it, we'd double-count and AGENT_ACTIVE would stick on a ghost session after one signal cleared.

---

## MVP Definition

### Launch With (v0.1 — Trimmed Scope Per PROJECT.md)

Minimum viable product — the shipping v0.1 that validates the core value ("Discord shows you as cooking, not idling, when Claude runs in the terminal").

- [ ] **Terminal agent detection — Shell Integration (tier 2)** — core value dies without this
- [ ] **Regex generic enough for 5 agents (claude/aider/codex/gemini/opencode) + `npx`/`bunx`/`pnpm dlx` variants** — scope generic now, ship Claude copy only
- [ ] **Companion lockfile tier (tier 1)** — highest fidelity on author's primary workflow, 2h cost
- [ ] **fs-watch tier (tier 3) + polling tier (tier 4)** — Cursor-Windows + fish/cmd users don't fall off a cliff
- [ ] **Detector precedence dedup (FR-1.6)** — without it, tier collisions corrupt the session map
- [ ] **6-state machine (AGENT_ACTIVE > CODING > IDLE, agent always wins priority)** — the logical heart
- [ ] **Discord RPC client with exponential backoff reconnect + 2s throttle + pid-scoped activity + `clearActivity(pid)` on deactivate** — every failure mode competitors have hit, avoided
- [ ] **Git branch bridge** — table-stakes expectation
- [ ] **`goblin` message pack** — the v0.1 personality (default + professional deferred)
- [ ] **Rotation clock (20s) + frame clock (2s) + no-repeat invariant + time-of-day pools** — the "feels alive" layer
- [ ] **Templating with 6 tokens** — drives per-agent and per-workspace copy
- [ ] **Privacy settings (`show \| hide \| hash`) — defaults flipped to `show` in v0.1 per PROJECT.md** — machinery intact for future
- [ ] **Four ignore lists (workspaces/repos/orgs/gitHosts)** — escape valve users will exercise
- [ ] **Live config reload (no window reload)** — table stakes
- [ ] **≤ 20 settings in `contributes.configuration`** — anti-sprawl constraint
- [ ] **Zero proposed APIs, zero `any` casts** — Marketplace compliance
- [ ] **Publish to Marketplace + OpenVSX via GitHub Actions on tag push** — Cursor-native install is the point
- [ ] **OSS hygiene files (LICENSE, COC, SECURITY, CONTRIBUTING, PR/issue templates, CI)** — portfolio-grade repo
- [ ] **Portfolio-grade README with demo GIF above the fold, install instructions, privacy FAQ, competitive positioning table** — discovery depends on it

### Add After Validation (v0.2 / v1.x)

Features triggered by specific community signals, not shipped blind.

- [ ] **Default pack + Professional pack** — trigger: ≥ 3 GitHub issues asking for non-goblin copy
- [ ] **Agent telemetry bridge (model / session cost / today's cost / burn rate $/hr / context %)** — trigger: a daemon competitor (tsanva / Codex-Discord) wraps theirs in a VSIX with telemetry. Defensive slot reservation (PRD §3).
- [ ] **OpenCode companion plugin** — trigger: OpenCode ecosystem growth OR author switches daily driver
- [ ] **Cline / Roo Code detection via `vscode.extensions.getExtension(...).isActive`** — trigger: community PR or ≥ 5 issues asking for extension-based agents
- [ ] **Per-agent icons + copy sub-pools shipped (aider/codex/gemini/opencode assets)** — trigger: Marketplace install mix shows non-Claude users crossing 20%
- [ ] **Statusline bridge for Claude Code metrics (read ccstatusline output if present)** — trigger: ccstatusline stabilizes its emitted format

### Future Consideration (v2+)

Features to defer until product-market fit is clearly established and scope can absorb them.

- [ ] **Structural JSONL parsing** — only if Anthropic publishes a stable schema contract
- [ ] **Flatpak Discord workaround shipped in-extension** — currently documented as external workaround; bring in-house only if install mix shows Linux Flatpak > 10%
- [ ] **More than `goblin` voice packs shipped as bundled presets** — trigger: custom-pack downloads show clear clustering
- [ ] **Shared-pack marketplace / registry** — requires account system; pure dilution unless usage forces it
- [ ] **Windows-native shell integration polyfill for Cursor-Windows** — only if upstream doesn't fix the documented bug and user mix shifts to Windows
- [ ] **Mobile companion (read-only status mirror)** — requires server infra, out of local-IPC story

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Terminal detection via Shell Integration (tier 2) | HIGH | HIGH | P1 |
| Detector precedence dedup (FR-1.6) | HIGH | MEDIUM | P1 |
| Companion lockfile tier (tier 1) | HIGH | LOW | P1 |
| fs-watch fallback (tier 3) | MEDIUM | MEDIUM | P1 |
| Polling fallback (tier 4) | LOW | LOW | P1 |
| 6-state machine with agent-wins priority | HIGH | MEDIUM | P1 |
| Exponential backoff reconnect + 2s throttle | HIGH | MEDIUM | P1 |
| pid-scoped `clearActivity` / multi-window isolation | HIGH | LOW | P1 |
| Git branch bridge | MEDIUM | LOW | P1 |
| Goblin message pack | HIGH | LOW | P1 |
| Rotation + frame clock with no-repeat invariant | MEDIUM | MEDIUM | P1 |
| Template tokens (6 fixed) | MEDIUM | LOW | P1 |
| Privacy show/hide/hash per field | MEDIUM | LOW | P1 |
| Four ignore lists (glob + regex) | MEDIUM | LOW | P1 |
| Live config reload | HIGH | LOW | P1 |
| ≤ 20 settings constraint | MEDIUM | LOW | P1 |
| Zero proposed APIs, zero `any` casts | HIGH | LOW | P1 |
| OpenVSX publish (alongside Marketplace) | HIGH | LOW | P1 |
| Portfolio-grade README + demo GIF | HIGH | MEDIUM | P1 |
| OSS hygiene files (LICENSE / COC / SECURITY / CONTRIBUTING / templates / CI) | MEDIUM | LOW | P1 |
| Agent telemetry bridge (v0.2) | HIGH | HIGH | P2 |
| Default + Professional packs | MEDIUM | MEDIUM | P2 |
| Per-agent icons + copy sub-pools (full 5-agent coverage) | MEDIUM | MEDIUM | P2 |
| OpenCode companion plugin | LOW | MEDIUM | P2 |
| Cline / Roo Code detection | LOW | LOW | P3 |
| Statusline bridge | MEDIUM | HIGH | P3 |
| Shared-pack registry | LOW | HIGH | P3 |
| Mobile/web/Codespaces | LOW | VERY HIGH | P3 (explicit non-goal) |
| Bidirectional control | LOW | VERY HIGH | P3 (explicit non-goal) |
| Team / dashboard / analytics | LOW | VERY HIGH | P3 (explicit non-goal) |

**Priority key:**
- **P1** — Must have for launch (v0.1)
- **P2** — Should have, add when community signals demand
- **P3** — Nice to have / deferred indefinitely / explicit non-goal

---

## Competitor Feature Analysis

| Feature | LeonardSSH/vscord (778k) | iCrawl/discord-vscode (2.48M) | RikoAppDev/ai-agent-activity | tsanva/cc-discord-presence (Go) | Codex-Discord-RP (Rust) | opencode-discord-presence | **Agent Mode (v0.1)** |
|---------|--------------------------|-------------------------------|------------------------------|--------------------------------|------------------------|---------------------------|------------------------|
| Terminal command detection | — | — | Via `(vscode as any).chat` + edit heuristic (false-positive-prone, Marketplace-non-compliant) | Daemon (not editor-integrated) | Daemon (not editor-integrated) | Plugin (OpenCode-only) | **Shell Integration API (stable, tiered fallback)** |
| Multi-agent support | — | — | Partial | Claude only | Codex only | OpenCode only | **5 agents (Claude/aider/codex/gemini/opencode) + custom patterns** |
| Idle handling | Present (but #362/#326 show bugs) | Partial | Present | — | Present | Present | **6-state machine with explicit IDLE copy, timeout, clear/show modes** |
| Custom message packs | Partial (complex settings) | Partial | Present | — | — | — | **goblin pack + custom JSON path + schema-validated** |
| Privacy ignore lists | Partial (binary; #205 bugs) | Partial (regex; #1825 bugs) | — | — | — | — | **4 lists: workspaces (glob) / repos / orgs / gitHosts (regex)** |
| Per-field privacy toggles | Partial (#273 requested) | Partial (#1922 leaks) | — | — | — | — | **show \| hide \| hash per field (workspace/filename/branch)** |
| Git branch | Present | Present (#1947 bugs) | — | Present | Partial | — | **Built-in git extension bridge (FR-3)** |
| Multi-editor install | 5 apps | Partial | — | — | — | — | **Marketplace + OpenVSX (Cursor/VSCodium/Windsurf native)** |
| BYO Discord Client ID mandatory | Optional | — | Optional | — | **Required (UX killer)** | Optional | **Bundled default — zero onboarding friction** |
| Companion agent-side plugin | — | — | — | — | — | — | **Claude Code lockfile hook (FR-1.1)** |
| Multi-window pid isolation | Present | — | — | — | — | — | **pid-scoped activity (FR-4.4)** |
| Rate-limit / throttle | 2s (production-proven) | — | — | — | 5s cooldown | — | **2s leading+trailing (matches vscord)** |
| Reconnect backoff | Present | — | — | — | **Exponential with 5s cooldown guard** | — | **5→10→20→40→60s + 5s cooldown (Codex-RP pattern)** |
| Zero proposed APIs | ✓ | ✓ | **✗ (`(vscode as any).chat`)** | n/a | n/a | n/a | **✓ (hard constraint)** |
| Setting count | ~160 (sprawl complaint) | ~40 | ~15 | n/a (daemon config file) | n/a (daemon TOML) | n/a (plugin config) | **≤ 20 (hard constraint)** |
| Active maintenance | ✓ | Stale on Marketplace | New, dormant since 2026-04-04 | Dormant | Active | Dormant | **— (new)** |

---

## Key Findings Summary

1. **The moat is terminal detection done right, not any single headline feature.** Every competitor has *at least one* of: custom packs, privacy settings, git integration, multi-editor install. What nobody has is a tiered terminal detector that covers Shell Integration + companion plugin + fs-watch + polling with precedence dedup. That four-tier stack is the actual differentiator; everything else is table stakes done competently.

2. **vscord's issue tracker is a blueprint for what "competent" means.** #205 (IP filtering broken), #258/#273 (privacy granularity), #324 (reconnect tolerance), #286/#415 (setting sprawl), #362/#326 (idle bugs) — every one of these maps to a PRD FR. Hitting them all is what separates "ships" from "recognized as better than incumbents."

3. **The v0.1 scope trim (goblin-only, Claude-only copy, show-by-default privacy) is defensible but creates one real risk: per-agent icon/copy asymmetry.** A user who installs this and fires up aider sees the correct agent label ("aider") but generic copy and a generic icon. That reads as "Claude gets special treatment," which is fine for the author (Claude is their daily driver) but may generate a few issues. Pre-empt in README: "v0.1 ships Claude copy/assets; other agents detected with generic labels; per-agent icons + sub-pools in v0.2."

---

## Sources

**Competitors (PRD §16):**
- LeonardSSH/vscord — https://github.com/LeonardSSH/vscord (778k installs, ~160 settings, no terminal detection)
- iCrawl/discord-vscode — https://github.com/iCrawl/discord-vscode (2.48M installs, Marketplace stale, no terminal detection)
- RikoAppDev/ai-agent-activity-for-dc — shipped 2026-04-04, `(vscode as any).chat` casts + edit heuristic, Marketplace-non-compliant
- tsanva/cc-discord-presence — Go daemon, Claude-only
- Codex-Discord-Rich-Presence — Rust daemon, Codex-only, requires BYO Discord Client ID
- opencode-discord-presence — plugin, OpenCode-only, dormant

**Competitor issue trackers consulted (live fetch 2026-04-12):**
- vscord issues: #26 (SSH Idling — cited as "table stakes evidence" across terminal detection), #205 (IP filtering broke), #258 (hide View Repository button), #273 (separate workspace/filename/branch hide options), #286 (Settings & Variables issues), #324 (disconnected time tolerance), #326 (HEX Editor idle bug), #354 (high CPU), #362 (activity not showing to friends), #404 (Crostini freeze), #415 (fallback in ignore-list object), #420 (Jupyter detection)
- discord-vscode issues: #1825 (SSH IP leak), #1922 (private repos link leak), #1947 (git repo name blank), #1964 (editor label display options), #1968 (VSCodium support), #1998 (reset timer)

**Project documents:**
- `.planning/PROJECT.md` — active requirements, out-of-scope, constraints, key decisions (trimmed v0.1 scope)
- `discord-agent-presence-prd.md` §3 (Goals / Roadmap / Non-Goals), §5 (User Stories), §7 (FR-1 through FR-8), §14 (Risks), §16 (Competitive Analysis), §18 (Guardrails — referenced)

**Industry standards referenced:**
- VS Code Shell Integration API (stabilized 1.93, Aug 2024) — `onDidStartTerminalShellExecution`, `onDidEndTerminalShellExecution`, `onDidChangeTerminalShellIntegration`
- `@xhayper/discord-rpc` (upstream Khaomi/discord-rpc) — maintained RPC library; old `discord-rpc` npm package is 5 years dead
- Discord RPC rate-limit conventions (2s throttle is production-proven in vscord)

---
*Feature research for: VS Code / Cursor Discord Rich Presence with terminal-native Claude Code detection*
*Researched: 2026-04-12*
