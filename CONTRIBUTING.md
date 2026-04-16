# Contributing

Thanks for your interest in `agent-mode-discord`. Please read this guide before
opening an issue or pull request, and review the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting Started

```bash
pnpm install
pnpm build
pnpm test
pnpm lint        # tsc --noEmit (per D-09 — no separate linter)
pnpm typecheck   # same as lint for now
```

The extension targets VS Code (and Cursor by inheritance). To run a development
copy, press `F5` in VS Code with this repository open.

## Workflow

1. **File an issue first** for anything larger than a one-line fix. PRs without a
   prior issue may be closed without review.
2. **Fork and branch from `main`.** Do not work directly on `main`.
3. **Conventional Commits required:** `feat:`, `fix:`, `docs:`, `test:`,
   `chore:`, `refactor:`, `perf:`. The phase scope (e.g. `feat(05-01):`) is
   used internally — external contributors do not need to add it.
4. **Keep PRs focused.** One concern per PR. Split unrelated changes into
   separate PRs.

## Code Standards

- TypeScript strict mode — no `any` casts unless documented with rationale
- **No new runtime dependencies** without explicit approval. Currently the only
  runtime dependency is `@xhayper/discord-rpc`.
- **Bundle budget: 500 KB** (enforced by CI)
- **No VS Code proposed APIs** — the extension must run on stable VS Code releases
- No `(vscode as any).*` casts — use proper types
- Files larger than ~200 lines should be split for readability

## Testing

- `pnpm test` must pass on all platforms (CI runs Linux, macOS, Windows)
- Pure-core modules (under `src/core/`, `src/detectors/`, `src/state/`) must be
  testable **without** importing `vscode` — keep VS Code APIs at the edges
- All tests use [Vitest](https://vitest.dev/)
- New behavior should land with tests; bug fixes should land with a regression test

## Branch Protection (per D-10)

The `main` branch requires:

- A pull request (no direct pushes)
- Passing CI on all 3 OS targets
- Owner self-approval is allowed (this is a solo project)

Branch protection is documented here rather than enforced by GitHub branch
protection rules — the repository owner relies on convention and CI.

## Maintainer Expectations (per D-13)

This is a solo project, maintained on my own schedule. Issues are welcome; PRs
require a filed issue first. **Response time varies — this is a passion project,
not a product.** I may go weeks between contribution sessions.

If a feature you want is not on the roadmap, the most reliable path forward is
to fork, build it, and use it locally. If it generalizes well I am happy to
review a PR.
