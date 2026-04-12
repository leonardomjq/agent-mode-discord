# Phase 1: Skeleton + RPC seam — Context

**Gathered:** 2026-04-12
**Status:** Ready for planning
**Source:** PRD Express Path (`discord-agent-presence-prd.md`)

<domain>
## Phase Boundary

Phase 1 delivers the smallest possible end-to-end seam: an extension that builds, packages, loads in an Extension Development Host, connects to Discord desktop via local IPC, publishes a hardcoded "hello world" activity, and cleans up without leaving ghost presences. CI enforces a 500 KB bundle-size guardrail and a proposed-API ban before any later phase can ship. `[HUMAN]` credential prerequisites with variable lead time (Discord Developer Portal app creation, OpenVSX namespace claim) are kicked off here because Phase 6 cannot complete without them.

**In scope:**
- Repo scaffolding (pnpm + TypeScript + esbuild + vitest)
- `package.json` manifest (activation event, workspace trust flags, `engines.vscode`)
- `src/extension.ts` (activate/deactivate) + `src/rpc/client.ts` v0 (connect, hardcoded `setActivity`, `clearActivity(pid)` on shutdown, SIGINT/SIGTERM handlers, belt-and-braces cleanup on activate)
- CI: bundle-size check (500 KB threshold via esbuild metafile) + proposed-API grep guard
- One vitest smoke test using a fake RPC transport
- `[HUMAN]` handoff doc listing Discord app + OpenVSX namespace checklists

**Out of scope (later phases):**
- State machine / editor detectors / git bridge → Phase 2
- Exponential backoff, throttle, pid scoping beyond basic `clearActivity(pid)` → Phase 2
- Agent detection → Phase 3
- Personality packs, animator, privacy → Phase 4
- Companion plugin, OSS hygiene files, README → Phase 5
- Publish workflow, tag → Phase 6

</domain>

<decisions>
## Implementation Decisions

### Stack
- **Package manager:** pnpm (not npm, not yarn — PRD §18 guardrail)
- **Language:** TypeScript ^5.4, `strict: true`
- **Bundler:** esbuild ^0.24 (not webpack, not rollup — PRD §18)
- **Bundle output:** Single CJS file at `dist/extension.cjs`
- **Test runner:** vitest ^2 (not jest, not mocha — PRD §18)
- **VSIX tooling:** `@vscode/vsce` ^3.7 (dev dep, used in later phases)
- **OpenVSX tooling:** `ovsx` ^0.10 (dev dep, used in later phases)
- **Runtime dependency (only one allowed):** `@xhayper/discord-rpc` ^1.3.1 — NEVER use the dead `discord-rpc` npm package

### Manifest (`package.json`)
- `engines.vscode: ^1.93.0` — shell integration stabilized Aug 2024
- `activationEvents: ["onStartupFinished"]` — nothing broader (no `"*"`, no `onLanguage:*`)
- `capabilities.untrustedWorkspaces: { supported: true }` — extension never executes workspace code
- `capabilities.virtualWorkspaces: false` — local IPC + local git required
- `main: "./dist/extension.cjs"`
- No `enabledApiProposals`, ever
- No `(vscode as any).*` casts, ever
- `contributes.configuration` — empty or minimal in Phase 1; the ≤20-key surface arrives in Phase 4

### RPC client (`src/rpc/client.ts` v0)
- Wraps `@xhayper/discord-rpc` `Client` — connect with bundled default Client ID (placeholder until `[HUMAN]` fills it in from the Discord Developer Portal; commit a visible `TODO` constant or env-default)
- On activate: call `client.user?.clearActivity(process.pid)` once (belt-and-braces cleanup from prior crashed session) BEFORE setting any new payload
- Publish a single hardcoded activity payload: `{ details: "hello world", startTimestamp: Date.now() }` (or similar; must be visible in the Discord friends sidebar)
- On deactivate: `client.user?.clearActivity(process.pid)` — NEVER `setActivity(null)` (leaves ghost presences)
- Install `SIGINT` + `SIGTERM` process handlers that call `clearActivity(pid)` before exiting
- All RPC failures must be silent (no toasts, no editor blocking); no verbose-log gate is required yet (that arrives with `debug.verbose` in Phase 4) — for Phase 1, try/catch every RPC call and swallow errors
- No backoff, no throttle, no pid-scoped multi-window logic — those arrive in Phase 2 (but `clearActivity(pid)` already takes the pid argument)

### Extension entry (`src/extension.ts`)
- `activate(context: vscode.ExtensionContext)`: instantiate RPC client, connect, run belt-and-braces clear, publish hello-world activity, register deactivate disposables
- `deactivate()`: call `clearActivity(pid)`, close RPC client
- Register SIGINT/SIGTERM handlers in activate; remove them on deactivate to avoid double-registration if the extension is reloaded

### Build (`esbuild.mjs`)
- Target: `node18` (or `node20` — matches `@types/node@^22` dev dep, but runtime target is the VS Code Node version; Electron bundled Node is compatible with node18 target)
- Format: `cjs`
- Platform: `node`
- External: `vscode` (always)
- `bundle: true`, `minify: true`, `sourcemap: false` for packaged build, `sourcemap: "linked"` for dev build
- `metafile: true` — written to `dist/metafile.json` for the bundle-size check
- Single entrypoint: `src/extension.ts`

### Bundle-size check (CI)
- Script at `scripts/check-bundle-size.mjs` (or inline in CI): reads `dist/metafile.json`, sums `outputs["dist/extension.cjs"].bytes`, fails if > 500 * 1024 bytes
- Run after `pnpm build` in CI
- Fails the PR on regression; "500 KB" means `<= 500 KB` packaged VSIX AND `<= 500 KB` for the bundle itself (the VSIX check happens in later phases via `vsce ls` — Phase 1 enforces the bundle threshold as the primary guardrail)

### Proposed-API / `any`-cast grep guard (CI)
- Script at `scripts/check-api-surface.mjs` (or inline in CI): greps `src/**/*.ts` for:
  - `enabledApiProposals` in `package.json` (must be absent)
  - `(vscode as any)` substring in any `.ts` file
- Fails the build if either pattern matches

### Smoke test (vitest)
- `test/rpc.client.smoke.test.ts`
- Exercises the RPC connect + `clearActivity(pid)` flow using a fake transport — inject a mock/fake `Client` (either a hand-rolled stub or a vitest mock of `@xhayper/discord-rpc`)
- Assert: connect is called, `clearActivity` is called on deactivate with the correct `pid`, no unhandled promise rejections
- `pnpm test` exits 0
- Test code must NOT import `vscode` — keep it a pure-Node test (see §9.4 layout: `test/` is `vitest — no vscode dep`)

### `[HUMAN]` handoff doc
- Written as `docs/HUMAN-HANDOFF.md` (or `.planning/phases/01-skeleton-rpc-seam/HUMAN-HANDOFF.md` — planner decides)
- Checklist 1 (Discord Developer Portal):
  1. Create app named "Agent Mode" at https://discord.com/developers/applications
  2. Copy Client ID → update constant in `src/rpc/client.ts` (or `.env`)
  3. Upload placeholder PNGs (`agent-mode-large` 1024×1024, `agent-mode-small` 512×512) — final art ships in Phase 6
- Checklist 2 (OpenVSX namespace):
  1. Create Eclipse Foundation account
  2. Claim namespace at https://open-vsx.org/user-settings/namespaces
  3. Note approval has variable lead time — BLOCKS Phase 6 if not started now
- Document must explicitly flag that these two items gate Phase 6 publish

### File layout (Phase 1 only)
```
agent-mode-discord/
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ esbuild.mjs
├─ .vscodeignore
├─ .gitignore
├─ src/
│  ├─ extension.ts           # activate / deactivate
│  └─ rpc/
│     └─ client.ts           # v0 — connect, hardcoded setActivity, clearActivity(pid), SIGINT/SIGTERM
├─ test/
│  └─ rpc.client.smoke.test.ts
├─ scripts/
│  ├─ check-bundle-size.mjs
│  └─ check-api-surface.mjs
├─ .github/
│  └─ workflows/
│     └─ ci.yml              # pnpm install --frozen-lockfile + build + bundle-size + api-surface + test
└─ docs/
   └─ HUMAN-HANDOFF.md
```

Phase 5 adds OSS hygiene files (LICENSE, CODE_OF_CONDUCT, SECURITY, CONTRIBUTING, issue/PR templates, dependabot). Phase 1 CI exists specifically for the bundle-size + API-surface guardrails — the full matrix (Ubuntu + macOS + Windows) arrives in Phase 5.

### Guardrails (enforce throughout all plans)
- Files under 200 lines — split along natural boundaries if larger
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- No runtime deps beyond `@xhayper/discord-rpc`
- Every FS read + Discord call wrapped in try/catch; errors logged at debug level (Phase 1 can use `console.debug` as a placeholder; the output channel arrives with `debug.verbose` in Phase 4)
- No network requests except Discord IPC

### Claude's Discretion
- Exact CI workflow shape for Phase 1 (single job vs. matrix — Phase 1 can be a single Ubuntu job; the cross-platform matrix arrives in Phase 5 per PRD M6a)
- Whether the bundle-size check is inline in `ci.yml` or a separate `scripts/check-bundle-size.mjs` file (prefer the script for testability)
- Exact name/path of the HUMAN handoff doc — `docs/HUMAN-HANDOFF.md` vs. a phase-scoped location
- Whether to ship a placeholder Client ID constant vs. reading from an `.env` file (placeholder constant with a clearly-marked `TODO` is simpler for v0)
- `tsconfig.json` settings beyond `strict: true` and reasonable Node/ES2022 targets
- Whether to include `@types/node@^22` or pin to match the VS Code Electron Node version

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product requirements
- `discord-agent-presence-prd.md` — Full PRD. Phase 1 touches: §7.4 (Discord RPC FRs), §8 (NFRs — compatibility, workspace trust, footprint, dependencies, API surface, network, failure mode), §9.1 (stack), §9.4 (file layout), §12.M0 (skeleton milestone DoD), §18 (guardrails for implementing agents), §19 (technical references)
- `.planning/REQUIREMENTS.md` — SKEL-01 through SKEL-10 (10 requirements this phase MUST satisfy)
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 items) and plan breakdown (01-01 through 01-05)

### Project state
- `.planning/STATE.md` — Project decisions and history
- `.planning/PROJECT.md` — Key project decisions

### External technical references (from PRD §19)
- `@xhayper/discord-rpc` v1.3.1 — https://www.npmjs.com/package/@xhayper/discord-rpc
- VS Code Shell Integration API (not used in Phase 1 but pinned by `engines.vscode: ^1.93.0`) — https://code.visualstudio.com/updates/v1_93
- `@vscode/vsce` — https://www.npmjs.com/package/@vscode/vsce

</canonical_refs>

<specifics>
## Specific Ideas

- **Client ID placeholder pattern:** export `const DEFAULT_CLIENT_ID = process.env.AGENT_MODE_CLIENT_ID ?? "TODO_FILL_FROM_DEV_PORTAL"` so the `[HUMAN]` handoff is a one-line edit without touching logic.
- **Belt-and-braces ordering:** on activate, the sequence is (1) connect RPC, (2) `clearActivity(pid)` — swallow errors if no prior ghost exists, (3) `setActivity(helloWorldPayload)`. This matches SKEL-08.
- **SIGINT/SIGTERM handler registration:** register once in activate, guard against double-registration with a module-level `handlersRegistered` flag or `process.off` cleanup in deactivate. Do not register at module import time.
- **Bundle-size script output:** print both the current size and the threshold, with a clear PASS/FAIL line, so CI logs are self-explanatory.
- **API-surface grep:** use ripgrep-compatible patterns so the script works cross-platform; prefer a pure-Node glob + regex implementation over shelling out to `grep`.

</specifics>

<deferred>
## Deferred Ideas

- **Exponential backoff reconnect, throttle, pid-scoped multi-window handling, git bridge** → Phase 2 (PRD M2, RPC-02/03/04, STATE-06)
- **`debug.verbose` setting + output channel** → Phase 4 (CONF-05, RPC-05)
- **Full `contributes.configuration` surface (≤20 keys)** → Phase 4 (CONF-01)
- **Cross-platform CI matrix (Ubuntu + macOS + Windows)** → Phase 5 (DIST-06)
- **OSS hygiene files (LICENSE, CODE_OF_CONDUCT, SECURITY, CONTRIBUTING, issue/PR templates)** → Phase 5 (M6a)
- **Dependabot, branch protection** → Phase 5
- **README, demo GIF, competitive positioning** → Phase 5 (M6b)
- **Agent detection, state machine, personality packs, privacy modes, animator** → Phases 2–4
- **Release workflow (`release.yml`), publish, `v0.1.0` tag, Discord assets, Marketplace/OpenVSX tokens** → Phase 6

</deferred>

---

*Phase: 01-skeleton-rpc-seam*
*Context gathered: 2026-04-12 via PRD Express Path*
