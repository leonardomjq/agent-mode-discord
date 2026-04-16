---
id: SEED-001
status: dormant
planted: 2026-04-16
planted_during: v0.1.0 / Phase 05 (companion-plugin-oss-hygiene-assets-readme)
trigger_when: 30 days post-v0.1.0 release OR Marketplace install count > 100, whichever first
scope: Small
target_milestone: v0.2.0
---

# SEED-001: @vscode/extension-telemetry opt-in for feature-level usage signal

## Why This Matters

The Discord Developer Portal (DAU/MAU/activity counts) and Marketplace + OpenVSX
install dashboards are sufficient observability for v0.1.0's baseline questions:
"How many people installed it? How many actually launched it? Where in the world
are they?" Those answers come for free with the existing architecture.

Per-feature instrumentation is a different question. It tells you which detector
tier actually fires in the wild (companion vs shellIntegration vs sessionFiles vs
polling), how often custom packs override the goblin pack, whether the privacy
escape hatches (`ignore.*`) get used, and which Discord client versions throw
errors in `ConnectionManager`. That data shapes which directions of v0.2.0+ are
worth investing in. Without it, roadmap decisions are guesses.

`@vscode/extension-telemetry` is the right vehicle because:
- It auto-respects VS Code's `telemetry.telemetryLevel` setting (off | crash |
  error | all). No bespoke opt-out gating to maintain.
- Routes to Azure Application Insights — free tier covers anything under ~10K
  MAU comfortably.
- It's the official Microsoft package — extensions using it don't need extra
  marketplace policy review for telemetry.

But it adds outbound HTTP. The current SECURITY.md threat model is "zero
outbound HTTP requests" — adding telemetry breaks that promise. The version
that adds telemetry MUST also rewrite SECURITY.md, the privacy FAQ in the
README, and the marketplace listing description.

## When to Surface

**Trigger:** 30 days post-v0.1.0 release **OR** Marketplace install count > 100,
whichever comes first.

This seed should be presented during `/gsd-new-milestone` when the milestone
scope matches any of these conditions:

- The milestone is v0.2.0 or later
- The milestone explicitly mentions "observability", "telemetry", "metrics",
  "usage data", "instrumentation"
- The milestone discusses feature prioritization based on user data

If neither condition is met by the time v0.2.0 is being scoped, do not force
this in — defer to v0.3.0. Telemetry without a clear question to answer adds
maintenance burden and privacy surface for no benefit.

## Scope Estimate

**Small** — Roughly half a phase of work, conservatively a single 4-plan phase:

1. Add `@vscode/extension-telemetry` dep, instantiate reporter in `extension.ts`
   activate(), dispose in deactivate(). ~30 lines.
2. Choose 5–10 events to track (detector-tier-active, pack-loaded, ignore-rule-fired,
   rpc-reconnect-after-N-attempts, config-change-applied, error events). Wire
   send sites — each is one line at the right call site.
3. Set up Azure App Insights resource (Microsoft Partner Center) and inject the
   instrumentation key as a build-time constant.
4. Update SECURITY.md, README Privacy FAQ, and marketplace listing description
   to reflect the new outbound HTTP path. Add a v0.2.0 CHANGELOG entry that
   prominently announces telemetry + how to opt out (`telemetry.telemetryLevel: off`).

## Breadcrumbs

Code paths that telemetry would naturally instrument:

- `src/extension.ts:36` — `activate()` is the natural place to instantiate the
  TelemetryReporter
- `src/extension.ts:128` — `dispatch()` could emit per-state-transition counts
- `src/detectors/index.ts:78` — `recomputeAndDispatch()` is where the
  active-tier-changed event would fire
- `src/rpc/client.ts:188` — `disconnected` handler could count reconnects
- `src/presence/packLoader.ts` — pack-load success/failure rate
- `src/config.ts` — config-change applied counts

Related decisions to revisit when activating this seed:

- D-01 (no outbound HTTP) in `.planning/PROJECT.md` Key Decisions — needs to
  be amended or marked superseded
- Threat model entry in `.planning/phases/05-.../05-CONTEXT.md` re: extension's
  network surface
- `scripts/check-no-network.mjs` — the build-time guard that asserts no
  outbound network code; needs updating to whitelist `@vscode/extension-telemetry`

## Notes

- Do NOT enable telemetry in v0.1.0 even as opt-in. The "zero outbound HTTP"
  story is a marketable property — keeping it through v0.1.0 ships a privacy-
  pure baseline that establishes trust before asking for permission to
  instrument.
- When activated, the FIRST telemetry event sent should be `version_first_run`
  with the extension version — this lets you measure how fast a new release
  propagates through the install base and validate the telemetry pipeline
  itself.
- Trigger condition uses Marketplace install count rather than time alone
  because if the extension hits 100+ installs in week 1, the data is more
  valuable to act on than waiting 30 days.
- Consider whether to also instrument the companion plugin itself (separate
  decision — Claude Code plugin telemetry is different surface).
