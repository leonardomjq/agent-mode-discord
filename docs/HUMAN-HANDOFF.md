# Phase 1 Human Handoff

**Status:** Phase 1 code complete. Two external-service actions start here — approval has variable lead time and BLOCKS Phase 6 publish if not started now. The third section is the manual acceptance checklist.

---

## Why this doc exists

Phase 1 ships a working skeleton: extension loads, connects to Discord desktop via local IPC, publishes a hardcoded `hello world` activity, cleans up on every shutdown path. Everything a machine can verify is verified by `pnpm test` and CI.

Three things a machine cannot do:
1. Create an app in the Discord Developer Portal and give us a real Client ID.
2. Claim the OpenVSX publisher namespace (Eclipse Foundation approval — variable lead time).
3. Run the extension in a real VS Code Extension Development Host with a real Discord desktop instance and confirm the hello world activity appears within 2 s (SKEL-06).

Do all three now. Items 1 and 2 block Phase 6; item 3 is your Phase 1 sign-off.

---

## Checklist 1 — Discord Developer Portal app creation

Estimated time: ~15 min. Blocks: Phase 6 (PUB-01). Start immediately.

- [ ] 1.1 Go to <https://discord.com/developers/applications> and sign in with your Discord account.
- [ ] 1.2 Click **New Application**. Name it exactly **`Agent Mode`**. Accept the ToS.
- [ ] 1.3 On the application page, copy the **Application ID** (this is the Discord Rich Presence **Client ID**). It's a 18–19 digit numeric string.
- [ ] 1.4 Open `src/rpc/client.ts`. Locate the constant:
  ```ts
  export const DEFAULT_CLIENT_ID: string =
    process.env.AGENT_MODE_CLIENT_ID ?? "REPLACE_ME_IN_PHASE_1_HANDOFF";
  ```
  Replace `"REPLACE_ME_IN_PHASE_1_HANDOFF"` with your new Client ID as a string literal. Commit the change as `chore: set default discord client id`. Do NOT put it in a `.env` file — the Client ID is a public identifier (not a secret); bundling it is correct.
- [ ] 1.5 Back in the Developer Portal → **Rich Presence** → **Art Assets**. Upload two placeholder PNGs:
  - `agent-mode-large` — 1024 × 1024 px (use any square placeholder for now; final art ships Phase 6).
  - `agent-mode-small` — 512 × 512 px.
  Save.
- [ ] 1.6 Run `pnpm build && pnpm test` to confirm the new Client ID string doesn't break anything (smoke test uses a mock, so this is purely a compile check).

When Phase 6 comes: revisit this app, upload final art (`claude-icon` + final `agent-mode-large/small`), and you're done.

**Acceptance for Checklist 1:** `grep "REPLACE_ME_IN_PHASE_1_HANDOFF" src/` returns nothing.

---

## Checklist 2 — OpenVSX namespace claim

Estimated time: ~10 min to submit, **approval lead time is variable (hours to weeks)**. Blocks: Phase 6 (PUB-02). Start immediately — this is the single longest-lead item in the whole project.

- [ ] 2.1 Create an Eclipse Foundation account at <https://accounts.eclipse.org/user/register> if you don't have one. Use the same email you'll publish under.
- [ ] 2.2 Sign the Eclipse Contributor Agreement (ECA): <https://accounts.eclipse.org/user/eca>. Required for OpenVSX publishing.
- [ ] 2.3 Generate an OpenVSX access token at <https://open-vsx.org/user-settings/tokens>. Save it in your password manager as `OVSX_PAT` — we'll need it in Phase 6.
- [ ] 2.4 Claim your publisher namespace at <https://open-vsx.org/user-settings/namespaces>. Submit the request. Pick a namespace that matches (or is the same as) your future Marketplace publisher name.
- [ ] 2.5 Record the namespace + submission date below:
  - Namespace: `<fill-me-in>`
  - Submitted: `<YYYY-MM-DD>`
- [ ] 2.6 If approval hasn't landed by the time Phase 6 starts, proceed with Marketplace-only publish per STATE.md blockers note (release workflow should `continue-on-error` on the OpenVSX step).

**Acceptance for Checklist 2:** Submission recorded. Poll the page weekly until status reads *Approved*.

---

## Checklist 3 — Phase 1 acceptance (manual Dev Host verification)

Run AFTER Checklist 1 (needs a real Client ID). Validates SKEL-03 (activation <50 ms), SKEL-06 (hello world visible in Discord friends sidebar), SKEL-07 (no ghost presence on abnormal termination). Estimated time: ~10 min.

**Prerequisites:**
- Discord desktop running and logged in (Rich Presence uses local IPC — the web client will not work).
- `pnpm install && pnpm build && pnpm test` all green.
- Checklist 1 complete (real Client ID in `DEFAULT_CLIENT_ID`).

**Steps:**

- [ ] 3.1 In VS Code, open this repo. Press `F5` → an Extension Development Host window opens. Confirm it opens without error popup.
- [ ] 3.2 In the Dev Host window (the new one that opened), observe the Discord friends sidebar. Within 2 s you should see **Playing Agent Mode** with the details line **`hello world`**. (SKEL-06)
- [ ] 3.3 In the Dev Host window: `Cmd/Ctrl+Shift+P` → "Developer: Show Running Extensions" → find `agent-mode-discord` in the list. The **Activation** column should show a value under **50 ms**. (SKEL-03)
- [ ] 3.4 Close the Dev Host window normally (Cmd+Q / Alt+F4). Within 5 s, "Playing Agent Mode" should disappear from Discord. No ghost.
- [ ] 3.5 Repeat: press `F5` in the main VS Code window to launch the Dev Host again. Then kill the Dev Host's extension host process directly via `kill -TERM <pid>` (macOS/Linux) or the Task Manager (Windows). Wait 5 s. Confirm "Playing Agent Mode" disappears. No ghost. (SKEL-07 — SIGTERM path)
- [ ] 3.6 Repeat step 3.5 with `kill -INT <pid>` (or `Ctrl+C` if running the host in a terminal). Confirm cleanup happens. (SKEL-07 — SIGINT path)
- [ ] 3.7 Launch Dev Host again with `F5`. Confirm exactly ONE "Playing Agent Mode" appears in Discord — not duplicated from a lingering prior session. (validates SKEL-08 belt-and-braces cleanup in real conditions)

**If any step fails:** open a GitHub issue titled `Phase 1 acceptance: <step-id> failed` with `debug.verbose` console output (for Phase 1, that means `console.debug` output — open `Help > Toggle Developer Tools` in the Dev Host window to see it).

**Acceptance for Checklist 3:** All 7 steps tick green. Phase 2 can start.

---

## What happens next

Phase 2 ("Core pipeline") adds the state machine, throttle, backoff, pid-scoped multi-window, editor + git detectors. It depends on this Phase 1 handoff being complete — specifically on Checklist 3 confirming the real IPC seam works. Checklist 1 and Checklist 2 do NOT block Phase 2 (they block Phase 6), but start them now.

Sign off here with your date and initials:

- [ ] Checklist 1 complete: `<YYYY-MM-DD>` — `<initials>`
- [ ] Checklist 2 submitted (approval pending OK): `<YYYY-MM-DD>` — `<initials>`
- [ ] Checklist 3 complete: `<YYYY-MM-DD>` — `<initials>`
