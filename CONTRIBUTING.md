# Contributing to OmniMesh

Thanks for helping build a decentralized, air-gapped AI mesh. OmniMesh is
still pre-1.0; every PR shapes the API.

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Report issues to **elpraise20@gmail.com**.

## Development setup

```bash
git clone https://github.com/omnimesh/omni.git
cd omni
bun install --frozen-lockfile
bun run typecheck
bun test
```

The `omni` binary used for `host` / `join` is the workspace itself during
development — there's nothing to install. The released standalone binary
comes from `bun --compile`.

### Workspace layout

- `packages/protocol` — wire types shared by host, worker, mobile, web
- `packages/host` — `omni host` (WebSocket mesh + dashboard + OpenAI-compat)
- `packages/worker` — `omni join` (QVAC provider + model runtime)
- `packages/mobile` — Expo phone client (iOS / Android, Metal / Vulkan)
- `packages/web` — bundled dashboard (`packages/web/src/`)
- `packages/cli` — `omni` command dispatcher

## Branch & PR model

- **`main`** is always green and deployable. Don't commit directly.
- **Branch off `main`**: `git checkout -b feat/short-name` or `fix/short-name`
- **One logical change per PR.** Squash commits if the history is noisy.
- **PR title** is the commit message — we'll squash-merge.

PR titles should follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(worker): add QVAC heartbeat backoff`
- `fix(mobile): suspend consumer on AppState background`
- `docs(README): add QVAC architecture section`
- `chore: bump qvac-sdk to 0.12.4`

## Testing

- Unit + integration tests run via `bun test` (must stay 100% green).
- The QVAC SDK is an **optional peer dep**; the host / worker / mobile boot
  in caps-only mode without it. Don't add `import '@qvac/sdk'` at the top
  of a module — wrap it in a dynamic import inside `tryLoadQVAC()`.
- New features need tests. Bug fixes need a regression test.

## Style

- TypeScript strict, no `any` (use `unknown` + narrowing).
- Biome handles formatting and most linting (`bunx biome check`).
- No comments unless they explain *why*, not *what*.
- Match the file's existing import style. We're not zealots about absolute
  vs. relative — but stay consistent inside one file.

## QVAC P2P

If your change touches the mesh control plane, the model registry, or the
P2P transport, please coordinate in an issue first. The protocol envelope
set is intentionally small (HELLO / BYE / PING / HEARTBEAT / CAPS_UPDATE /
PEER_UPDATE / INTENTS / ADMIN / LOG) — adding a new envelope has
back-compat implications across host, worker, and mobile.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). For
security issues, see [SECURITY.md](SECURITY.md).

## Releasing

Releases are cut by maintainers. The pipeline builds a `bun --compile`
binary for `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, and
`win32-x64`, computes SHA-256 sums, attaches them to a GitHub release, and
deploys the docs site to Pages.
