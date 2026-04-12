# Architecture Research

**Domain:** VS Code / Cursor extension (event-driven TS bundle) bridging local terminal signals to Discord IPC
**Researched:** 2026-04-12
**Confidence:** HIGH (PRD §9 prescribes the layout; this doc verifies and challenges it)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       VS CODE HOST (activate)                        │
│  extension.ts: wire detectors + state + rpc; return disposables      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────────┐
│                        DETECTION LAYER                               │
│  (all VS Code–coupled; emit pure events)                             │
│  ┌──────────────┐ ┌──────────────────┐ ┌─────────────┐ ┌──────────┐  │
│  │ companion    │ │ shellIntegration │ │ sessionFiles│ │ polling  │  │
│  │ (fs.watch    │ │ (onDidStart/End  │ │ (fs.watch   │ │ (terminal│  │
│  │  lockfile)   │ │  ShellExecution) │ │  *.jsonl)   │ │  names)  │  │
│  └──────┬───────┘ └────────┬─────────┘ └──────┬──────┘ └────┬─────┘  │
│         │                  │                  │             │        │
│  ┌──────┴──────────────────┴──────────────────┴─────────────┴─────┐  │
│  │           detectors/index.ts — precedence + dedup              │  │
│  │  companion > shellIntegration > sessionFiles > polling         │  │
│  └─────────────────────────────┬──────────────────────────────────┘  │
│                                │ DetectorEvent { terminalId, agent }│
│  (editor.ts, git.ts emit CODING / branch events in parallel)         │
└────────────────────────────────┼─────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        CORE (pure, no vscode)                        │
│  ┌──────────────────┐   ┌──────────────────┐                         │
│  │  state/machine   │   │  state/context   │                         │
│  │  AGENT>CODING>   │──▶│  workspace,file, │                         │
│  │  IDLE transitions│   │  lang,branch,    │                         │
│  └────────┬─────────┘   │  agent,startedAt │                         │
│           │             └────────┬─────────┘                         │
│           ▼                      │                                   │
│  ┌──────────────────┐            │                                   │
│  │ presence/animator│  rotation 20s / frame 2s                       │
│  │  (no-repeat shuf)│──┐                                             │
│  └──────────────────┘  │                                             │
│           ┌────────────┘                                             │
│           ▼                                                          │
│  ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────┐   │
│  │ presence/templater│──▶│presence/activity │──▶│  rpc/throttle   │  │
│  │ {token} subst     │   │ Builder → payload│   │  2s lead+trail  │  │
│  └──────────┬────────┘   └──────────────────┘   └────────┬────────┘  │
│             │                                            │           │
│             ▼                                            ▼           │
│  ┌──────────────────┐                          ┌──────────────────┐  │
│  │    privacy.ts    │ (sole redaction point)   │   rpc/client.ts  │  │
│  │ show/hide/hash + │ called BY templater +    │ @xhayper wrapper │  │
│  │   ignore lists   │ context builder          │ backoff, pid     │  │
│  └──────────────────┘                          └────────┬─────────┘  │
└─────────────────────────────────────────────────────────┼────────────┘
                                                          │ IPC
                                                          ▼
                                                    Discord desktop
```

### Component Responsibilities

| # | Component | File | Responsibility | vscode? | ~LOC |
|---|-----------|------|----------------|---------|------|
| 1 | Entry | `src/extension.ts` | `activate()` wires modules, returns disposables; `deactivate()` calls `clearActivity(pid)` and disposes | Yes | 80 |
| 2 | Config accessor | `src/config.ts` | Typed read of `workspace.getConfiguration('agentMode')` + `onDidChangeConfiguration` emitter | Yes | 90 |
| 3 | Privacy (SINGLE redaction point) | `src/privacy.ts` | `redactWorkspace/Filename/Branch(raw, mode) → string \| undefined`; SHA-1 hash; ignore-list matcher (glob + regex) | No | 140 |
| 4 | RPC client | `src/rpc/client.ts` | `@xhayper/discord-rpc` wrapper: connect + exponential backoff (5→60s + 5s cooldown guard); pid-scoped `setActivity`/`clearActivity` | No (lib only) | 150 |
| 5 | Throttle | `src/rpc/throttle.ts` | Generic 2s leading+trailing throttle; last-call-wins; both animator clocks flow through here | No | 70 |
| 6 | State machine | `src/state/machine.ts` | Pure reducer: events → `AGENT_ACTIVE \| CODING \| IDLE`; agent-always-wins priority; idle timeout | No | 140 |
| 7 | State context | `src/state/context.ts` | Snapshot type + builder: `{workspace, filename, language, branch, agent, startedAt}`; immutable; `startTimestamp` reset only on state change | No | 80 |
| 8 | Detector orchestrator | `src/detectors/index.ts` | Composes 4 tiers; per-terminal session map; precedence/dedup; emits single stream of DetectorEvent to state machine | Yes | 160 |
| 9 | Companion detector | `src/detectors/companion.ts` | `fs.watch` on `~/.claude/agent-mode-discord.lock`; read-only | Minimal (uses `node:fs`; no vscode API) | 60 |
| 10 | Shell-integration detector | `src/detectors/shellIntegration.ts` | `onDidStart/End/ChangeTerminalShellIntegration`; ANSI+prompt strip; regex match; extract agent name | Yes | 180 |
| 11 | Session-file detector | `src/detectors/sessionFiles.ts` | `fs.watch` on `~/.claude/projects/*.jsonl` (mtime+existence only; NEVER parse) | No vscode | 100 |
| 12 | Polling detector | `src/detectors/polling.ts` | 5s interval over `vscode.window.terminals`; name-pattern matcher (empty by default) | Yes | 80 |
| 13 | Editor detector | `src/detectors/editor.ts` | `onDidChangeActiveTextEditor` + debounced `onDidChangeTextDocument` → CODING events | Yes | 90 |
| 14 | Git bridge | `src/detectors/git.ts` | Resolves branch via `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)`; emits branch changes | Yes | 80 |
| 15 | Pack loader | `src/presence/packLoader.ts` (new, split from animator) | Load + validate JSON packs (bundled + `customPackPath`); schema check; pool fallback resolution | No | 150 |
| 16 | Animator | `src/presence/animator.ts` | Two independent clocks: rotation 20s (Fisher-Yates no-repeat) + frame 2s (cycles frame arrays); both emit via throttle | No | 170 |
| 17 | Templater | `src/presence/templater.ts` | `{workspace}\|{filename}\|{language}\|{branch}\|{agent}\|{elapsed}` substitution; delegates redaction to privacy.ts; drops empty-after-sub messages | No | 90 |
| 18 | Activity builder | `src/presence/activityBuilder.ts` | `(Context, Frame, Privacy) → Discord activity payload`; picks `largeImageKey`/`smallImageKey` by agent + state | No | 100 |

**Total: 18 components, ~1870 LOC. Every file < 200 lines.** 11 of 18 have zero `vscode` imports — testable in vitest directly.

## Recommended Project Structure

```
agent-mode-discord/
├─ package.json                 # manifest + contributes.configuration (20 keys)
├─ tsconfig.json
├─ esbuild.mjs                  # single CJS bundle → dist/extension.cjs (<500KB)
├─ pnpm-lock.yaml
├─ .vscodeignore
├─ schema/
│  └─ pack.schema.json          # referenced by bundled + user packs
├─ src/
│  ├─ extension.ts              # activate / deactivate — wires modules
│  ├─ config.ts                 # typed workspace configuration + change stream
│  ├─ privacy.ts                # SINGLE redaction point (hash/hide/show + ignore lists)
│  ├─ rpc/
│  │  ├─ client.ts              # @xhayper wrapper — connect, backoff, pid-scoped
│  │  └─ throttle.ts            # 2s leading+trailing
│  ├─ state/
│  │  ├─ machine.ts             # pure reducer
│  │  └─ context.ts             # snapshot type + builder
│  ├─ detectors/
│  │  ├─ index.ts               # precedence / dedup orchestrator
│  │  ├─ companion.ts           # lockfile fs.watch (highest fidelity)
│  │  ├─ shellIntegration.ts    # primary — regex + ANSI strip
│  │  ├─ sessionFiles.ts        # ~/.claude/projects/*.jsonl mtime watcher
│  │  ├─ polling.ts             # terminal-name heuristic (last resort)
│  │  ├─ editor.ts              # CODING events
│  │  └─ git.ts                 # branch via vscode.git extension
│  └─ presence/
│     ├─ packs/                 # goblin.json (v0.1 only); default/professional deferred
│     ├─ packLoader.ts          # pack loading + schema validation + pool resolution
│     ├─ animator.ts            # rotation (20s) + frame (2s) clocks
│     ├─ templater.ts           # token substitution (calls privacy.ts)
│     └─ activityBuilder.ts     # Context+Frame → Discord payload
├─ companion/                   # SEPARATE ARTIFACT — not in VSIX
│  └─ claude-code-plugin/
│     ├─ .claude-plugin/plugin.json
│     └─ scripts/{start,stop}.sh
├─ assets/                      # large/small Discord images + per-agent icons
├─ test/                        # vitest; NO vscode import
│  ├─ state.machine.test.ts
│  ├─ throttle.test.ts
│  ├─ animator.test.ts
│  ├─ packLoader.test.ts
│  ├─ templater.test.ts
│  ├─ regex.test.ts             # 5 agents × 3 invocations + ANSI strip
│  └─ privacy.test.ts           # hash determinism + ignore lists
├─ README.md · LICENSE · CONTRIBUTING.md · SECURITY.md · CODE_OF_CONDUCT.md
├─ .gitignore · .vscodeignore
└─ .github/
   ├─ ISSUE_TEMPLATE/{bug_report.md,feature_request.md}
   ├─ PULL_REQUEST_TEMPLATE.md
   ├─ FUNDING.yml
   └─ workflows/{ci.yml,release.yml}
```

### Structure Rationale

- **`src/rpc/`, `src/state/`, `src/presence/`:** each folder corresponds to a layer in the pipeline (transport, core, rendering). Swapping the RPC library or adding a new renderer pool is a folder-scoped change.
- **`privacy.ts` at `src/` root (not under `presence/`):** it's called by both `templater` (rendering side) and `context` (ingest side, for the workspace hash) and by `detectors/index.ts` (ignore-list short-circuit). Living at the root makes it a first-class utility, not a presentation concern.
- **`config.ts` at `src/` root:** same reason — every layer reads config.
- **`packLoader.ts` split from `animator.ts`:** animator is already near the 200-line ceiling with two clocks + no-repeat bookkeeping. Pack parsing + schema validation + pool fallback is a separate responsibility. **This is one simplification vs PRD §9.4, which implied packs are handled inside animator.**
- **`companion/` sibling to `src/`:** the Claude Code plugin is installed separately via `claude plugin install`; it is never bundled into the VSIX. The `.vscodeignore` must exclude `companion/`.
- **`schema/pack.schema.json` at repo root:** referenced by `$schema` URL in bundled and user packs; shipped via GitHub raw URL, not in the VSIX runtime.
- **`test/` at repo root, not `src/__tests__/`:** vitest config targets `test/**/*.test.ts`; keeping tests out of `src/` guarantees no accidental vscode import leak.

## Architectural Patterns

### Pattern 1: Pure Core / Adapter Shell

**What:** All business logic (state machine, throttle, animator, templater, pack loader, privacy, activity builder) lives in modules with zero `vscode` import. VS Code–coupled code is confined to detectors + `extension.ts` + `config.ts`.
**When to use:** Whenever the host environment is hard/impossible to mock. `vscode` has no npm package; it is only resolvable inside the extension host. This pattern is the only way to make vitest tractable.
**Trade-offs:** One extra indirection (detectors emit framework-agnostic events instead of calling core methods directly). Payoff: 11 of 18 modules are trivially testable.

**Example:**
```typescript
// src/state/machine.ts — no vscode import
export type DetectorEvent =
  | { kind: 'agent.start'; terminalId: string; agent: AgentName }
  | { kind: 'agent.end'; terminalId: string }
  | { kind: 'editor.focus'; file: string; language: string }
  | { kind: 'editor.blur' }
  | { kind: 'idle.tick'; now: number };

export function reduce(state: State, event: DetectorEvent): State { /* ... */ }
```

### Pattern 2: Precedence Orchestrator with Per-Terminal Dedup

**What:** `detectors/index.ts` holds `Map<terminalId, { tier, agent }>`. All four tiers run concurrently; each candidate signal is compared against the current tier; only higher-fidelity signals mutate the map. When the companion lockfile disappears, the orchestrator demotes to whichever tier still has a live signal.
**When to use:** Any time you have heterogeneous signals of varying reliability pointing at the same underlying truth.
**Trade-offs:** Slightly more code than "first one wins." Payoff: companion plugin upgrade is observable without double-counting, and a Cursor-on-Windows user who never gets shell integration events still gets coverage via tier 3.

**Example:**
```typescript
// src/detectors/index.ts
const TIER = { companion: 0, shellIntegration: 1, sessionFiles: 2, polling: 3 };
function maybeUpgrade(tid: string, incoming: Tier, agent: AgentName) {
  const cur = map.get(tid);
  if (!cur || TIER[incoming] < TIER[cur.tier]) {
    map.set(tid, { tier: incoming, agent });
    emit({ kind: 'agent.start', terminalId: tid, agent });
  }
}
```

### Pattern 3: Two-Clock Animator Through a Single Throttle

**What:** Rotation clock (20s, picks next message; Fisher-Yates queue, no back-to-back repeat) and frame clock (2s, cycles inner frame arrays) are independent timers. Each tick routes through `rpc/throttle.ts` which collapses to one `client.setActivity` per 2s, last-payload-wins.
**When to use:** Whenever multiple drivers want to update the same rate-limited sink.
**Trade-offs:** Throttle must expose leading + trailing semantics; a naive debounce would eat the leading edge (first frame shows only after 2s — visibly wrong). Pattern matches vscord's production throttle (2000ms).

**Example:**
```typescript
// src/rpc/throttle.ts — no vscode import
export function createThrottle<T>(intervalMs: number, flush: (v: T) => void) {
  let pending: T | undefined;
  let leadingFired = false;
  let timer: NodeJS.Timeout | undefined;
  return (value: T) => {
    pending = value;
    if (!leadingFired) { leadingFired = true; flush(pending); pending = undefined; }
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined; leadingFired = false;
      if (pending !== undefined) { flush(pending); pending = undefined; }
    }, intervalMs);
  };
}
```

### Pattern 4: Single Redaction Point

**What:** `privacy.ts` is the only module that knows how `show | hide | hash` map to output strings, and the only module that owns ignore-list matching. Every other module that needs a workspace/filename/branch value calls into it. Context builder and templater never branch on privacy mode themselves.
**When to use:** Any time a privacy/redaction policy might evolve (v0.2 might add `partial` or per-pattern redactions). Centralizing keeps the call sites dumb and auditable.
**Trade-offs:** Slight call-site verbosity (`privacy.redactWorkspace(ctx.rawWorkspace)` vs `ctx.workspace`). Payoff: a single point-of-review for the "what leaks" FAQ and a single test file for hash determinism + glob/regex ignore matching.

## Data Flow

### Primary Pipeline (detector event → Discord payload)

```
┌──────────────┐   DetectorEvent   ┌──────────────┐   StateSnapshot   ┌──────────────┐
│  detectors/* │ ────────────────▶ │ state/machine│ ────────────────▶ │ state/context│
│  (4 tiers)   │                   │  (reducer)   │                   │  (builder)   │
└──────────────┘                   └──────────────┘                   └──────┬───────┘
                                                                             │
        ┌────────────────────────────────────────────────────────────────────┘
        │ Context { state, agent, workspace, filename, language, branch, startedAt }
        ▼
┌──────────────────┐  Frame (string)    ┌──────────────────┐  Rendered string
│ presence/animator│ ─────────────────▶ │presence/templater│ ────────────────┐
│ rotation(20s) +  │  via               │ resolves tokens; │                 │
│ frame(2s) clocks │  packLoader pool   │ calls privacy.ts │                 │
└──────────────────┘                    └──────────────────┘                 │
                                                                             ▼
                                                             ┌──────────────────────────┐
                                                             │ presence/activityBuilder │
                                                             │ → Discord activity obj   │
                                                             └────────────┬─────────────┘
                                                                          │ payload
                                                                          ▼
                                                                  ┌───────────────┐
                                                                  │ rpc/throttle  │ 2s lead+trail
                                                                  └───────┬───────┘
                                                                          │
                                                                          ▼
                                                                  ┌───────────────┐
                                                                  │ rpc/client.ts │ setActivity(pid)
                                                                  └───────┬───────┘
                                                                          │ IPC
                                                                          ▼
                                                                    Discord desktop
```

### State Machine Transitions

```
          companion lockfile appears ──────────┐
          OR shell-integration regex match     │
          OR session-file mtime bump           ▼
                                       ┌──────────────┐
                          ┌───────────▶│ AGENT_ACTIVE │
                          │            │   (+agent)   │
                          │            └──────┬───────┘
                          │                   │ all sessions end
                          │                   ▼
                  ┌──────────────┐ focus ┌──────────┐ idleTimeoutSec ┌──────┐
                  │    CODING    │◀──────│   IDLE   │◀───────────────│ ...  │
                  └──────┬───────┘ file  └──────────┘                └──────┘
                         │ blur/no activity
                         ▼
                  (back to IDLE after timeout)
```

Agent always wins: if an agent signal arrives while in CODING or IDLE, transition immediately. `startTimestamp` is reset *only* on state transition, never on rotation/frame ticks (so elapsed time is truthful).

### Key Data Flows

1. **Happy-path flow:** User runs `claude` in terminal → `onDidStartTerminalShellExecution` fires → `shellIntegration.ts` regex-matches "claude" → emits `agent.start` → `state/machine` transitions to `AGENT_ACTIVE` → `context` snapshot built (w/ privacy-redacted fields) → animator picks a pool message → templater substitutes + privacy redacts → activity builder produces payload → throttle flushes → `client.setActivity(payload, process.pid)` → Discord IPC → sidebar updates within ~500ms.
2. **Companion upgrade flow:** Shell integration detector emits tier-1 signal; ~50ms later companion detector emits tier-0 signal for the same terminal → orchestrator promotes → state unchanged, but logged; `{agent}` remains `claude`.
3. **Ignore-list short-circuit:** Any workspace change → `privacy.matchIgnoreLists(workspace, git)` → if match, orchestrator calls `rpc/client.clearActivity(pid)` and disables rotation clock; extension goes silent.
4. **Reconnect flow:** Discord dies → `client.ts` catches IPC error → schedules backoff at 5s (cooldown guard: no retry within 5s of last attempt) → escalates 10/20/40/60/60... → on success, replays the latest throttled payload.

## Build Order Recommendation

Matches PRD §12 milestone sequencing (M0 → M2 → M1 → M3 → M4 → M5). The ordering is deliberate: **build the sink before the sources.** Every later component has a working seam to integrate against.

| Order | Milestone | Components (in order) | Why this first |
|-------|-----------|----------------------|----------------|
| 1 | M0 Skeleton | `extension.ts` stub + `config.ts` stub + `rpc/client.ts` | Prove the VSIX loads, activation <50ms, bundle <500KB, Discord IPC connects with a hardcoded payload. No detection, no state machine, no animator. If RPC doesn't connect, nothing else matters. |
| 2 | M2 (first half) | `rpc/throttle.ts`, `state/machine.ts`, `state/context.ts`, `privacy.ts` | Pure modules. Write with vitest first; exhaustive transition table, throttle leading+trailing, hash determinism, ignore-list matcher. Zero vscode dependency means fast feedback. |
| 3 | M2 (second half) | `rpc/client.ts` hardened (backoff + cooldown + pid), `detectors/git.ts`, `detectors/editor.ts` | Plumb the first real state (CODING) end-to-end with throttle. Kill Discord mid-session, confirm reconnect. Two windows, confirm pid isolation. |
| 4 | M1 | `detectors/shellIntegration.ts`, `detectors/index.ts` (precedence), `detectors/sessionFiles.ts`, `detectors/polling.ts` | Now there's a working CODING pipeline; bolting on detectors just upgrades state to AGENT_ACTIVE. Regex unit-tested in isolation (no vscode), integration-tested in the dev host. |
| 5 | M3 | `presence/packLoader.ts`, `presence/animator.ts`, `presence/templater.ts`, `presence/activityBuilder.ts` | Personality rides on top of working state + RPC. Hardcoded payload from M0/M2 gets replaced by animator output. No-repeat invariant and frame cycle are pure-JS tests. |
| 6 | M4 | Expand `config.ts` + `package.json` `contributes.configuration` to 20 keys; live reload via `onDidChangeConfiguration` | Settings surface. Everything before was on defaults; now users can customize. |
| 7 | M5 | `detectors/companion.ts` + `companion/claude-code-plugin/` | Highest-fidelity tier added last. The orchestrator from step 4 already has the precedence slot for it. |
| 8 | M6a/b, M7 | OSS hygiene, assets, publish | Non-code. |

**Key seam:** step 1 produces a working `client.setActivity(fixed payload, pid)` call. Every subsequent step just improves the payload or the trigger. You never have a "big bang integration" moment.

## Verification of PRD §9.4 File Layout

| PRD §9.4 entry | Verdict | Notes |
|---|---|---|
| `src/extension.ts` | Keep | Activation wiring only. |
| `src/rpc/client.ts` + `throttle.ts` | Keep | Clean split. Throttle is pure, client is IPC. |
| `src/state/machine.ts` + `context.ts` | Keep | Pure reducer + snapshot. |
| `src/detectors/index.ts` + companion/shellIntegration/sessionFiles/polling/editor/git | Keep | Seven files. `index.ts` is the orchestrator. |
| `src/presence/packs/*.json` | Keep | Goblin only for v0.1 (PROJECT.md decision). Schema lives at `schema/pack.schema.json` at repo root, referenced by `$schema` URL. |
| `src/presence/animator.ts` | **Split** | Animator is already close to 200 lines with two clocks + queue shuffle + no-repeat bookkeeping. Pack loading + schema validation + pool resolution belongs in `presence/packLoader.ts`. PRD §9.4 implicitly bundled this into animator. |
| `src/presence/templater.ts` | Keep | Delegates all redaction to `privacy.ts`. |
| `src/presence/activityBuilder.ts` | Keep | `(Context, Frame) → DiscordActivity`. |
| `src/config.ts` | Keep | Root-level because every layer reads it. |
| `src/privacy.ts` | Keep | Root-level for the reason above — single redaction point, called from context + templater + detectors/index. |
| `companion/claude-code-plugin/` | Keep | Separate artifact, excluded from VSIX via `.vscodeignore`. |
| `assets/`, `test/`, `.github/` | Keep | Standard. |

**Delta from PRD §9.4: +1 file (`presence/packLoader.ts`).** That's the only real simplification. Everything else stands.

## Non-obvious Calls That Must Be Flagged

1. **Companion plugin is NOT bundled into the VSIX.** It is a separate artifact in `companion/claude-code-plugin/` installed by the user via `claude plugin install <github-url>`. The plugin's `SessionStart`/`SessionEnd` hooks write/remove `~/.claude/agent-mode-discord.lock`. **The extension only reads this file; it never writes to `~/.claude/*`.** (PRD §18 "Do not" list makes this a hard constraint.) `.vscodeignore` must exclude `companion/**`.

2. **`privacy.ts` is the SINGLE redaction point.** No other module branches on `show | hide | hash`. Concretely:
   - `state/context.ts` stores *raw* workspace/filename/branch — never redacts.
   - `presence/templater.ts` calls `privacy.redactX(ctx.rawX, config.privacy.X)` at render time only.
   - `detectors/index.ts` calls `privacy.matchIgnoreLists(...)` to short-circuit before any state update.
   - Tests for hash determinism (SHA-1 first 6 hex of normalized abs path) and ignore lists (glob for workspaces, regex for repos/orgs/hosts) live in exactly one file: `test/privacy.test.ts`.

3. **Animator has two independent clocks that both route through the throttle.**
   - **Rotation clock (20s):** picks next message from pool via Fisher-Yates queue; on queue drain, re-shuffle excluding most-recent entry (no back-to-back repeats).
   - **Frame clock (2s):** only active when the current message is a frame array; cycles in order, loops.
   - **Both call the same throttle.** The throttle collapses to at most one `setActivity` per 2s (matches vscord production throttle; PRD §FR-7.1). Never call `setActivity` directly from the animator.
   - Elapsed timer (`startTimestamp`) is set once on state-machine transition and never touched by either clock (PRD §FR-5.7).

4. **Never parse `~/.claude/projects/*.jsonl` content.** mtime + existence only. Wrap all reads in try/catch. Format is undocumented and Anthropic can change it. This is explicitly enforced in PRD §18.

5. **Always `clearActivity(process.pid)` on deactivate, never `setActivity(null)`.** `setActivity(null)` leaves ghost presences on some Discord versions; vscord learned this and switched.

## Scaling Considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| 1 window, 1 agent | Baseline. Works today. |
| N windows, N agents (same machine) | `process.pid`-scoped `setActivity`/`clearActivity` gives independent presences per window. No change needed. |
| Many terminals per window | `Map<terminalId, AgentSession>` in `detectors/index.ts`. Bounded by how many terminals VS Code allows (no practical cap). |
| 100s of rapid state flips | Throttle collapses to ≤1 update per 2s. Discord never sees the storm. |
| Discord dies for hours | Backoff stays at 60s cap; no resource growth; no toast. |

### Scaling Priorities

1. **First bottleneck:** Bundle size. `@xhayper/discord-rpc` pulls `@discordjs/rest` + `undici` transitively. If bundle exceeds 500 KB, pin `@xhayper/discord-rpc` exactly and audit with `esbuild --metafile` to identify what to mark external or tree-shake.
2. **Second bottleneck:** `fs.watch` on `~/.claude/projects/` can fire frequently during active Claude sessions. Debounce at the detector (250ms) before emitting to state machine.
3. **Third bottleneck:** Activation cost. `onStartupFinished` budget is 50ms. Defer `git.ts` and `sessionFiles.ts` initialization to `setImmediate` / first idle tick — activate() returns immediately after `extension.ts` registers disposables.

## Anti-Patterns

### Anti-Pattern 1: Redaction branching in every call site

**What people do:** `if (config.privacy.workspaceName === 'hash') { ... } else if ('hide') { ... }` scattered across templater, activity builder, debug logger.
**Why it's wrong:** Drift. A v0.2 privacy mode (e.g., `partial`) requires edits in N files, and some get missed.
**Do this instead:** `privacy.ts` exports `redactWorkspace(raw, mode) → string | undefined`. Callers call it and trust it.

### Anti-Pattern 2: Parsing `commandLine.value` for more than agent identity

**What people do:** Extract flags, prompts, file paths from the shell command string to show richer Discord status.
**Why it's wrong:** PRD §18 bans it. Low-confidence values have ANSI escapes + prompt prefixes; parsing them is unreliable and surfaces user secrets (API keys on CLI flags). Leaks via Discord Rich Presence — which is public — would be a serious bug.
**Do this instead:** Strip ANSI + regex-match agent name only. Everything else comes from editor state, git, and the filesystem.

### Anti-Pattern 3: Coupling animator to `vscode.window.setStatusBarMessage` or other host APIs

**What people do:** Animator reaches into `vscode.*` to show the same copy in a status bar indicator.
**Why it's wrong:** Moves the animator out of the pure-core layer. Suddenly untestable without a vscode shim.
**Do this instead:** Animator emits strings. If you want a status bar, write a tiny `src/presence/statusBar.ts` adapter that subscribes to the animator's output stream. Keep the animator host-agnostic.

### Anti-Pattern 4: `setActivity(null)` to clear presence

**What people do:** Call `client.user.setActivity(null)` or `client.clearActivity()` without pid.
**Why it's wrong:** Ghost presences on some Discord client versions; vscord #<...> documented this.
**Do this instead:** `client.user?.clearActivity(process.pid)`. Always pid-scoped, always `clearActivity`.

### Anti-Pattern 5: Activation event broader than `onStartupFinished`

**What people do:** `"activationEvents": ["*"]` or `"onLanguage:*"` for "safety."
**Why it's wrong:** Blows activation cost budget (50ms target) and pessimizes VS Code startup for every user. PRD §18 bans it.
**Do this instead:** `"onStartupFinished"` only. Everything downstream is event-driven from there.

### Anti-Pattern 6: Calling `setActivity` from both animator clocks directly

**What people do:** Rotation clock and frame clock both call `client.setActivity(...)` directly.
**Why it's wrong:** Doubles IPC traffic; Discord may rate-limit; last-call-wins guarantee breaks.
**Do this instead:** Both clocks write to `rpc/throttle.ts`; the throttle calls `client.setActivity(...)` at most once per 2s.

## Integration Points

### External Services

| Service | Integration pattern | Notes |
|---|---|---|
| Discord desktop | Local IPC via `@xhayper/discord-rpc` (Unix socket / Windows named pipe) | No outbound HTTP. Bundled default Client ID; user override via `clientId` setting. |
| VS Code built-in git | `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` | Stable API. Branch only; no commit/blame/status reads. |
| Claude Code companion plugin | `~/.claude/agent-mode-discord.lock` fs.watch | Plugin writes, extension reads. Empty file; mtime + existence only. |
| Claude session files | `~/.claude/projects/*.jsonl` fs.watch | mtime + existence only. NEVER parse content (undocumented format). |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| Detectors ↔ state machine | Event bus (detector emits `DetectorEvent`, machine consumes) | Pure-core machine has no vscode import. |
| State machine ↔ animator | Push snapshot via subscription | Animator restarts rotation clock on state change; context.startedAt carries `startTimestamp`. |
| Animator + frame clock ↔ RPC | Single throttle wrapper | Two drivers, one throttled sink. |
| Templater ↔ privacy | Synchronous function calls | Templater never branches on privacy mode; delegates entirely. |
| Config ↔ every module | `config.getXYZ()` accessors + `onConfigChange(listener)` | Live reload without window reload; each module subscribes to the slice it cares about. |

## Sources

- PRD `discord-agent-presence-prd.md` §9 Tech Design (9.1 Stack, 9.2 State machine, 9.3 Detection stack, 9.4 File Layout, 9.5 Example payloads, 9.6 Pack JSON schema), §FR-1 through FR-8, §12 Milestones, §18 Guardrails, §19 Appendix references.
- `.planning/PROJECT.md` — core value, constraints, Key Decisions (goblin-only v0.1, runtime dep lock, show-everything privacy default).
- VS Code Shell Integration API stable since 1.93 (Aug 2024): `vscode.d.ts` L7711-8142; release notes code.visualstudio.com/updates/v1_93.
- `@xhayper/discord-rpc` v1.3.1 (upstream `Khaomi/discord-rpc`) — successor to the dead `discord-rpc` npm package.
- vscord (LeonardSSH) production throttle (2000ms) and `clearActivity` over `setActivity(null)` precedent.
- Codex-Discord-Rich-Presence `src/discord.rs:35-36, 276-282` backoff/cooldown pattern.
- cc-discord-presence `~/.claude/projects/*.jsonl` mtime-only pattern.
- RikoAppDev/ai-agent-activity — example of what NOT to do (`(vscode as any).chat`).

---
*Architecture research for: VS Code / Cursor extension — terminal agent detection → Discord Rich Presence*
*Researched: 2026-04-12*
