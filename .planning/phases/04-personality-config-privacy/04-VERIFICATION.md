---
phase: 04-personality-config-privacy
verified: 2026-04-15T00:00:00Z
status: human_needed
score: 20/20 automated must-haves verified — 8 items require Dev-Host UAT
verdict: >-
  All PERS-01..08, PRIV-01..07, CONF-01..05 implementation artifacts exist,
  are substantive, wired into extension.ts, and data-flowing. Every automated
  CI gate (typecheck, tests, bundle-size, api-surface, config-keys,
  no-network, pack-inlined) passes. Outstanding items are the 8 Dev-Host
  UAT checks (04-HUMAN-UAT.md) — these require a running Discord desktop
  and cannot be verified programmatically.
coverage:
  pers: 8/8 implemented
  priv: 7/7 implemented
  conf: 5/5 implemented
  total: 20/20
gates:
  typecheck: pass
  tests: pass (309/309)
  bundle_size: pass (218 KB / 500 KB; 43.6%)
  api_surface: pass (22 .ts files, 11 pure-core, no violations)
  check_no_network: pass (zero forbidden HTTP patterns in dist/extension.cjs)
  check_config_keys: pass (14/20 keys, all have title/description/default/enumDescriptions)
  check_pack_inlined: pass (goblin canonical strings present in bundle)
human_verification:
  - test: SC-4.1 Animator + cooking frame cycling + no-repeat
    expected: 20 s rotation + 2 s frame cycle + no consecutive duplicates
    why_human: Requires live Discord desktop + 60 s observation window
  - test: SC-4.2 animations.enabled=false freezes frames
    expected: Multi-frame messages stay on first frame; 20 s rotation still fires
    why_human: Requires Dev Host + Settings UI
  - test: SC-4.3 Workspace hash mode determinism
    expected: 6-hex-char hash appears; reopen yields identical hash
    why_human: Requires Dev Host restart cycle
  - test: SC-4.4 gitBranch=hide applies within 20 s
    expected: Branch disappears from Discord state; no reload
    why_human: Requires Discord presence visual check
  - test: SC-4.5 ignore.workspaces clears presence
    expected: Discord shows NO activity; removing rule restores presence
    why_human: Requires Discord sidebar visual confirmation
  - test: SC-4.6 ignore.gitHosts silences on match
    expected: Extension goes silent within 20 s
    why_human: Requires GitHub-hosted repo + Discord visual
  - test: SC-4.7 Settings UI renders ≤20 keys cleanly
    expected: All 14 keys render with title, description, default, enum dropdowns
    why_human: Requires VS Code Settings editor visual inspection
  - test: SC-4.8 debug.verbose gate in output channel
    expected: Verbose true → log lines; verbose false → no new lines
    why_human: Requires Output panel observation
---

# Phase 04: Personality + Config + Privacy — Verification Report

**Phase Goal (ROADMAP.md):** Replace hardcoded activity with animator-driven copy from the goblin pack. 20-key configuration surface with live reload. Full privacy mode implementation with ignore lists. Single `package.json` manifest edit for all three sub-areas.

**Verified:** 2026-04-15
**Status:** human_needed — all automated evidence passes, 8 Dev-Host UAT items remain
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | With `claude` running, frames cycle every 2 s; messages rotate every 20 s; no consecutive duplicates | ? HUMAN (SC-4.1) | `animator.ts:72-73` `ROTATION_MS=20_000` / `FRAME_MS=2_000`; Fisher-Yates no-repeat at `animator.ts:126-137`; 38 vitest cases in `test/presence.animator.test.ts` |
| SC-2 | `privacy.workspaceName` show→hash applies ≤20 s; deterministic SHA-1 first-6-hex of normalized path | ? HUMAN (SC-4.3) | `privacy.ts:24-49` hashWorkspace + normalizeForHash; 34 tests in `test/privacy.test.ts`; `config.ts:52-53` live-read per tick |
| SC-3 | `ignore.workspaces` match → zero Discord updates (full silence, not partial redaction); remove → restore | ? HUMAN (SC-4.5) | `activityBuilder.ts:178-186` evaluateIgnore → onClear once, stay silent; `privacy.ts:211-255` evaluateIgnore impl |
| SC-4 | `contributes.configuration` ≤20 keys each with title/description/default/enumValues; flip without reload | ✓ VERIFIED | `package.json:20-132` (14 keys); `check:config-keys` PASS; `extension.ts:159-164` onDidChangeConfiguration + forceTick |
| SC-5 | Zero outbound HTTP in built bundle (Discord IPC only); CI-verifiable | ✓ VERIFIED | `scripts/check-no-network.mjs` wired in `.github/workflows/ci.yml:40-41`; static grep PASS on 223 KB bundle |

**Automated Score:** 20/20 individual requirements implemented. SC-1/SC-2/SC-3 have code + unit-test evidence but end-to-end behavior needs Dev-Host UAT.

### Requirement Coverage

**PERS — Personality (8/8)**

| Req | Description | Status | Evidence |
|-----|-------------|--------|----------|
| PERS-01 | `goblin` is the only built-in pack | ✓ | `src/presence/goblin.json` is the sole pack; `packLoader.ts:33` `BUILTIN_GOBLIN_PACK` constant; `check:pack-inlined` PASS |
| PERS-02 | 20 s rotation w/ fallback chain state → agent sub-pool → time-of-day | ✓ | `animator.ts:72 ROTATION_MS`; `animator.ts:140-167` buildPoolEntries with D-07 weights |
| PERS-03 | Fisher-Yates no-repeat invariant | ✓ | `animator.ts:126-137` pickFromPool; per-pool `lastPicked` Map at `animator.ts:224` |
| PERS-04 | 2 s frame clock cycles string[] frames | ✓ | `animator.ts:73 FRAME_MS=2000`; `animator.ts:249-254` frameTick |
| PERS-05 | `animations.enabled=false` freezes on frame 0 | ✓ | `animator.ts:231-235` renderCurrent branches on cfg.animations.enabled |
| PERS-06 | 6-token templater + blank-skip + empty-render for hidden tokens | ✓ | `templater.ts:30-39` renderTemplate (unknown → ""); animator blank-skip loop at `animator.ts:187-202` MAX_BLANK_ATTEMPTS=10 |
| PERS-07 | `messages.customPackPath` picks up on next rotation, no reload | ✓ | `packLoader.ts:134-173` loadPack; `extension.ts:80-89` getPack polled per tick (D-25) |
| PERS-08 | Schema validation + debug log + fallback to goblin on invalid pack | ✓ | `packLoader.ts:71-87` validatePack; fallback chain at `packLoader.ts:140-172`; `extension.ts:86` log wiring |

**PRIV — Privacy (7/7)**

| Req | Description | Status | Evidence |
|-----|-------------|--------|----------|
| PRIV-01 | workspaceName: show (default) / hide / hash (6-hex SHA-1 deterministic) | ✓ | `privacy.ts:24-49` normalizeForHash + hashWorkspace; `package.json:78-89` enum default=`show` |
| PRIV-02 | filename: show (default) / hide | ✓ | `package.json:56-66`; `activityBuilder.ts:95` redact(filename, …) |
| PRIV-03 | gitBranch: show/hide via vscode.git `getAPI(1)` without added dep | ✓ | `gitBranch.ts:29-45` ext `vscode.git`, getAPI(1); uses built-in extensions API — no package.json dep |
| PRIV-04 | Silent degrade if vscode.git missing/disabled; debug-log only | ✓ | `gitBranch.ts:28-49` try/catch wraps entire path; empty-string on any failure; logger debug-gated |
| PRIV-05 | ignore.workspaces (glob) + repositories (regex) + organizations (regex) + gitHosts (string) → full silence | ✓ | `privacy.ts:211-255` evaluateIgnore (4 branches); `package.json:90-117` all four keys; `activityBuilder.ts:179-186` clear-once-stay-silent |
| PRIV-06 | Privacy flip applies ≤ 20 s, no reload | ✓ | `config.ts:42` readConfig lazy per tick; `extension.ts:92-111` getConfig = readConfig on each call |
| PRIV-07 | No outbound HTTP; verifiable via CI | ✓ | `scripts/check-no-network.mjs` FAILs on http/https/fetch/undici/axios/node-fetch/XHR/globalThis.fetch; wired at `.github/workflows/ci.yml:40-41`; PASS |

**CONF — Configuration (5/5)**

| Req | Description | Status | Evidence |
|-----|-------------|--------|----------|
| CONF-01 | ≤20 keys each w/ title/description/default/enumValues | ✓ | `package.json:20-132` (14 keys — headroom 6); `check-config-keys.mjs` PASS; validates title/description/default + enum→enumDescriptions length match |
| CONF-02 | `clientId` override; blank → bundled default | ✓ | `config.ts:44-46` `clientIdRaw.trim()===""?DEFAULT_CLIENT_ID:clientIdRaw`; `package.json:21-26` default `""` |
| CONF-03 | `onDidChangeConfiguration` applies on next tick, no reload | ✓ | `extension.ts:159-164` listener + forceTick; readConfig is lazy (no module cache) |
| CONF-04 | `idleBehavior: show\|clear` — clear stays connected, no disconnect loop | ✓ | `package.json:27-37`; `activityBuilder.ts:189-195` IDLE+clear → onClear once; `extension.ts:74-76` onClear uses `rpcClearActivity(live, pid)`, never `setActivity(null)`, never destroys client |
| CONF-05 | `debug.verbose` default false; gates output channel | ✓ | `package.json:38-43`; `outputChannel.ts:22-33` log() gates on `cfg.debug.verbose` when `verboseOnly` true |

**No orphaned requirements.** All 20 phase-04 requirement IDs map to implementation artifacts.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/presence/types.ts` | Pack / Message / ValidateResult types | ✓ VERIFIED | 41 lines, zero runtime |
| `src/presence/packLoader.ts` | loadPack + validatePack + 100 KB cap + BUILTIN_GOBLIN_PACK | ✓ VERIFIED | 174 lines; pure-core; T-04-01/T-04-02 mitigations in place |
| `src/presence/animator.ts` | 2-clock animator, weighted pick, FY no-repeat, blank-skip cap | ✓ VERIFIED | 282 lines; injectable deps; 38 tests |
| `src/presence/templater.ts` | 6-token substitution + isBlank | ✓ VERIFIED | 47 lines; 17 tests; ReDoS-safe `/\{(\w+)\}/g` |
| `src/presence/activityBuilder.ts` | formatElapsed + buildTokens + buildPayload + factory (ignore/idle gates) | ✓ VERIFIED | 211 lines; 30 tests |
| `src/presence/goblin.json` | D-05 canonical pack | ✓ VERIFIED | Matches D-05 byte-for-byte (_primary 15 items incl. 2 frame-sequences, claude/codex sub-pools, CODING 7, IDLE 7, 4 timeOfDay buckets) |
| `src/privacy.ts` | SHA-1 hash + glob + normalizeGitUrl + evaluateIgnore + ReDoS-safe regex cache | ✓ VERIFIED | 256 lines; 34 tests; catastrophic-pattern linter + 200-char truncation + memoized cache |
| `src/gitBranch.ts` | vscode.git async-activation adapter with silent degrade | ✓ VERIFIED | 51 lines; 7 tests |
| `src/config.ts` | 14-key readConfig, lazy | ✓ VERIFIED | 71 lines; 7 tests |
| `src/outputChannel.ts` | "Agent Mode (Discord)" channel + verbose-gated log | ✓ VERIFIED | 39 lines; 6 tests |
| `src/extension.ts` wiring | createActivityBuilder + onDidChangeConfiguration + poll-on-tick pack | ✓ VERIFIED | 190 lines; driver composes throttled setActivity + clearActivity; forceTick on state transition + config change + reconnect |
| `scripts/check-no-network.mjs` | CI grep forbidden HTTP surface | ✓ VERIFIED | 107 lines; FORBIDDEN list covers http/https/fetch/undici/axios/got/node-fetch/XHR; PASS on current bundle |
| `scripts/check-config-keys.mjs` | ≤20 keys with title/desc/default/enumDescriptions | ✓ VERIFIED | 66 lines; validates enum↔enumDescriptions length parity |
| `scripts/check-pack-inlined.mjs` | goblin inlined in built bundle | ✓ VERIFIED | 33 lines; PASS |
| `package.json` contributes.configuration | 14 agentMode.* keys | ✓ VERIFIED | Single manifest edit owned by phase 4 as planned |
| `.github/workflows/ci.yml` | wire new checks | ✓ VERIFIED | Lines 37-41 invoke check:config-keys + check:no-network |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| extension.ts | packLoader | `loadPack({customPackPath, builtin: BUILTIN_GOBLIN_PACK}, {...realPackLoaderDeps, log})` `extension.ts:82-88` | ✓ WIRED |
| extension.ts | activityBuilder | `createActivityBuilder({getState, getConfig, getPack, onSet, onClear, getIgnoreContext, log})` `extension.ts:91-111` | ✓ WIRED |
| activityBuilder | animator | `createAnimator({getPack,getConfig,getContext,onRender}, deps)` `activityBuilder.ts:161-203` | ✓ WIRED |
| animator | templater | `renderTemplate(frame, tokens)` `animator.ts:194, 237` | ✓ WIRED |
| activityBuilder | privacy.redact | per-field in `buildTokens` `activityBuilder.ts:89-97` | ✓ WIRED |
| activityBuilder | privacy.evaluateIgnore | `activityBuilder.ts:180` → onClear once | ✓ WIRED |
| extension.ts | onDidChangeConfiguration | `vscode.workspace.onDidChangeConfiguration` + forceTick `extension.ts:159-164` | ✓ WIRED |
| extension.ts | throttle → RPC setActivity | `createThrottle` → `mgr.setActivity` `extension.ts:67-72` | ✓ WIRED |
| extension.ts | RPC clearActivity(pid) | `rpcClearActivity(live, process.pid)` `extension.ts:73-76` (never setActivity(null)) | ✓ WIRED |
| CI | check:no-network | `.github/workflows/ci.yml:40-41` | ✓ WIRED |
| CI | check:config-keys | `.github/workflows/ci.yml:37-38` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Real Data? | Status |
|---|---|---|---|---|
| activityBuilder.onRender text | rendered frame | animator rotation → pickWeightedPool → pickFromPool → renderTemplate(frame, tokens) | Yes — pack pulled from packLoader (goblin inlined), tokens from live State + live config | ✓ FLOWING |
| Discord setActivity payload | throttledSet(payload) | onSet ← buildPayload(text, state).details | Yes — text non-empty or `"building, afk"` fallback (`activityBuilder.ts:118`) | ✓ FLOWING |
| workspace token | cfg.privacy.workspaceName + state.workspace | config.ts readConfig + extension.ts state | Yes — read lazily per tick; state populated by Phase-2 editor detector | ✓ FLOWING |
| branch token | state.branch | gitBranch.getCurrentBranch on state transition (`extension.ts:133`) | Yes — vscode.git API; silent empty on missing ext | ✓ FLOWING |

No HOLLOW_PROP / DISCONNECTED issues detected.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Type-check clean | `pnpm typecheck` | no errors | ✓ PASS |
| All tests green | `pnpm test` | 309/309 across 19 files | ✓ PASS |
| Build succeeds | `pnpm build` | dist/extension.cjs produced | ✓ PASS |
| Bundle size under 500 KB | `pnpm check:bundle-size` | 218 KB / 500 KB (43.6%) | ✓ PASS |
| API-surface purity | `pnpm check:api-surface` | 22 .ts, 11 pure-core, 0 violations | ✓ PASS |
| No outbound HTTP in bundle | `pnpm check:no-network` | Zero forbidden patterns in 223 KB | ✓ PASS |
| Config keys validated | `pnpm check:config-keys` | 14/20, all meta fields present | ✓ PASS |
| Goblin inlined in bundle | `pnpm check:pack-inlined` | 2/2 canonical strings found | ✓ PASS |

### Anti-Patterns Found

Grep for TODO / FIXME / placeholder / stub markers inside `src/` → **zero matches**. No `as any` casts on `vscode` (api-surface gate enforces). Redact `hash` for non-workspace fields throws a hard Error (`privacy.ts:58-62`) — intentional defensive guard, not a stub.

**Minor observations (info only, not blockers):**
- `extension.ts:98-109` notes that `state.gitRemoteUrl` is not yet populated by the Phase-2 git detector. Repositories / organizations / gitHosts ignore branches therefore only fire once a future plan threads the remote URL through. PRIV-05's four branches are all implemented in `privacy.ts`; the integration gap is a known limitation surfaced by the author in an inline comment and does not contradict acceptance text (which is about the evaluator, not the plumbing). Consider surfacing as a Phase-5 carry-forward.

### Human Verification Required

See YAML frontmatter `human_verification:` and `04-HUMAN-UAT.md`. 4 hard gates (SC-4.1, 4.3, 4.5, 4.7) + 4 secondary (4.2, 4.4, 4.6, 4.8). All require Dev Host + Discord desktop, which cannot be run from verification.

### Gaps Summary

None blocking. All 20 requirements have implementation evidence and passing automated gates. Status is `human_needed` solely because the ROADMAP success criteria require Discord-visible behavioral confirmation (rotation timing, determinism of hash, visual silence under ignore) that cannot be proven by unit tests alone.

**Recommended next step:** execute `04-HUMAN-UAT.md` in the Dev Host; if all 8 boxes check, flip status to `passed`.

---

*Verified: 2026-04-15*
*Verifier: Claude (gsd-verifier)*
