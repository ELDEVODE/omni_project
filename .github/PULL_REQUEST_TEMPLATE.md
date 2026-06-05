# Pull Request

Thanks for the PR. A few things to check before requesting review:

- [ ] `bun run typecheck` is clean
- [ ] `bun test` is green
- [ ] `bunx biome check .` shows no new errors
- [ ] New code is covered by tests
- [ ] If you touched a wire envelope in `packages/protocol/`, you coordinated
      in an issue first
- [ ] If you added a runtime dep, you checked `@qvac/sdk` and other peer
      deps are declared `peerDependencies` (not `dependencies`) so the
      no-SDK fallback keeps working

## Description

<!-- What does this change and why? -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds capability)
- [ ] Breaking change (fix or feature that would cause existing behavior to change)
- [ ] Documentation
- [ ] Refactor / chore

## How was this tested?

<!-- paste command output or describe manual verification -->

## Screenshots / recordings

<!-- for UI changes (web dashboard, mobile) -->

## Linked issues

<!-- `Fixes #123`, `Closes #456` -->
