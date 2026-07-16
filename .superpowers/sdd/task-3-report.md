# Task 3 Report: Reconnectable playlist authorization errors

Status: DONE_WITH_CONCERNS

Commit message: `Recover playlist authorization`

Push: Not pushed, per instruction.

## Outcome

Playlist-items HTTP 403 responses now produce `spotify_playlist_access_required`, status 403, `/api/login`, and the exact combined reconnect/ownership message. The App failed state renders the message and a `Connect Spotify` link to `/api/login`.

## Intended files

- `src/spotify/spotifyClient.ts`
- `src/spotify/spotifyClient.test.ts`
- `src/app/App.integration.test.tsx`
- `.superpowers/sdd/task-3-report.md`

## TDD evidence

### RED

Command: `npm run test:run -- src/spotify/spotifyClient.test.ts src/app/App.integration.test.tsx`

Result: exit 1; 1 failed and 25 passed tests. The playlist client test received `spotify_playlist_inaccessible` with no `loginUrl`, proving the missing mapping. The App recovery case passed because failed-state rendering already consumes `AppError.loginUrl`.

### GREEN

Command: `npm run test:run -- src/spotify/spotifyClient.test.ts src/app/App.integration.test.tsx`

Result: exit 0; 2 test files and 26 tests passed.

## Full verification

Command: `npm run check`

Result: exit 0; TypeScript and API syntax checks passed, all 17 test files and 126 tests passed, and the production build succeeded.

Command: `graphify update .`

Result: exit 0; incremental graph rebuilt with 617 nodes, 822 edges, and 79 communities.

Command: `git diff --check`

Result: exit 0; no whitespace errors. Git emitted only line-ending conversion warnings, including unrelated worktree files.

## Scope preserved

Only the playlist-items 403 branch changed. The `/me` 403 mapping, 429 handling, 401 forced refresh, safe Spotify messages, abort behavior, and generic error behavior remain unchanged.

## Concerns and preserved dirt

- `npm run check` emitted non-failing Node experimental warnings about unavailable localStorage configuration.
- Graphify emitted non-failing version and zero-node warnings for metadata files.
- The shared worktree's unrelated `node_modules` changes, `.codex/`, generated `dist/` and `graphify-out/`, and legacy `public/` content are excluded from this commit.
- The managed patch helper was unavailable because `codex-windows-sandbox-setup.exe` is missing. Brief-authorized guarded exact PowerShell replacements were used and fully verified.