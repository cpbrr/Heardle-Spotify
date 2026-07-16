# Task 6 report: OAuth scopes and forced refresh

## Status

Implemented and verified. No push was performed, per parent-task instructions.

## Files changed

- api/_spotify.js
- api/token.js
- api/spotify-api.test.mjs
- src/auth/authClient.ts
- src/auth/authClient.test.ts
- .superpowers/sdd/task-6-report.md

src/spotify/spotifyClient.test.ts was reviewed but not changed: it already asserts that a Spotify 401 retries with getToken(undefined, true).

## RED

Commands:

    npm run test:run -- src/auth/authClient.test.ts src/spotify/spotifyClient.test.ts
    node --test api/spotify-api.test.mjs
    npm run check:api

Expected failures observed before production edits:

- Vitest: 1 of 10 tests failed because forced getAccessToken fetched /api/token instead of /api/token?force=1.
- API contracts: 2 of 8 tests failed because the login scope omitted both playlist-read scopes and /api/token?force=1 reused the fresh access cookie without calling Spotify.
- API syntax checks passed.

## GREEN

The same focused verification passed after the minimal implementation:

- Vitest: 2 files passed, 10 tests passed.
- Node API contracts: 8 tests passed.
- API syntax checks passed.

The OAuth assertion parses the Location URL, checks the complete decoded scope list, and confirms the new adjacent scopes are encoded with +. The refresh assertion checks the exact form body: grant_type=refresh_token&refresh_token=refresh-token.

## Full check

npm run check passed:

- TypeScript check passed.
- API syntax checks passed.
- Vitest: 16 files passed, 102 tests passed.
- Production build passed (1,789 modules transformed).

The test run emitted Node experimental warnings about unavailable localStorage; these are pre-existing/non-failing warnings.

## Graphify

graphify update . passed and rebuilt the graph with 540 nodes, 739 edges, and 72 communities.

Graphify also reported its existing version mismatch warning and two zero-node configuration files (hooks.json, settings.json). Generated graphify-out/ files were not staged.

## Diff and self-review

- git diff --check passed for the scoped Task 6 files.
- Scope is minimal: two OAuth scopes, a conditional forced client URL, URL parsing in the token function, and a forced-refresh guard on fresh-cookie reuse.
- Only force=1 activates the bypass; ordinary token requests retain the current fresh-cookie fast path.
- Forced refresh still requires a refresh-token cookie and retains existing error/cookie-clearing behavior.
- API test cleanup restores the original global fetch after every test.
- Unrelated worktree changes, including node_modules, dist, .codex, and graph output, were preserved and excluded from the commit.

## Concerns

No Task 6 correctness concerns found. The workspace has extensive unrelated dependency/build/generated-file dirt, so staging is intentionally path-scoped.