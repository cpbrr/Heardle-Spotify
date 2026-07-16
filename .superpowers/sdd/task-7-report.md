# Task 7 report: actionable Spotify account failures

## Outcome

Implemented endpoint-aware Spotify Web API errors, Premium account validation before authenticated startup, playlist ownership guidance, safe upstream message preservation, and consistent Web Playback SDK Premium errors.

## Changes

- `SpotifyClient` now reads each non-204 response body as text, JSON-decodes it when possible, preserves non-HTML plain-text Spotify messages, and keeps existing JSON error messages.
- Empty `403` responses from `/me` now throw `spotify_account_not_allowed` with the required Developer Dashboard > Users Management guidance.
- `403` responses from playlist-items endpoints now throw `spotify_playlist_inaccessible` with the required own-or-collaborate guidance.
- Added `SpotifyApiClient` and `validateSpotifyAccount(signal?, client?)`; the validator calls `GET /me` and throws `spotify_premium_required` unless `product` is `premium`.
- Authenticated app startup now awaits account validation before creating `SpotifyPlayer` or dispatching `authChecked`. Abort and unmount guards run after the new await and before state/resource changes.
- Web Playback SDK `account_error` now always uses `spotify_premium_required` and `Spotify Premium is required for playback.` rather than exposing the SDK's generic account message.
- Updated the app integration harness to provide the new account-validation dependency.

## TDD evidence

### RED: account/client/player behavior

Command:

```text
npm run test:run -- src/spotify/spotifyClient.test.ts src/spotify/account.test.ts src/app/App.auth.test.tsx src/player/SpotifyPlayer.test.ts
```

Observed before production edits: exit 1. The account module could not be resolved, and four assertions failed for `spotify_account_not_allowed`, `spotify_playlist_inaccessible`, safe plain-text upstream messages, and `spotify_premium_required` SDK mapping. Summary: 3 failed files, 1 passed file; 4 failed and 12 passed tests.

### RED: authenticated startup ordering and friend guidance

Command:

```text
npm run test:run -- src/app/App.auth.test.tsx
```

Observed before editing `App.tsx`: exit 1. Both new tests failed because `validateSpotifyAccount` was called zero times and the app entered source selection instead of showing the Users Management error. Summary: 1 failed file; 2 failed and 2 passed tests.

### GREEN: targeted Task 7 suite

Command:

```text
npm run test:run -- src/spotify/spotifyClient.test.ts src/spotify/account.test.ts src/app/App.auth.test.tsx src/player/SpotifyPlayer.test.ts
```

Observed after implementation: exit 0; 4 files passed, 20 tests passed.

## Full verification

Command:

```text
npm run check
```

Fresh final run: exit 0.

- TypeScript project check passed.
- All API syntax checks passed.
- Vitest: 17 files passed, 110 tests passed.
- Production build passed; Vite transformed 1,790 modules.

An earlier full run identified that `App.integration.test.tsx` had no double for the new validator. After adding a Premium-success double, that file passed 12/12 in isolation. The first full parallel rerun then had four transient timing failures in that file; the app auth plus integration pair passed 16/16, and the fresh final full `npm run check` passed 110/110.

## Repository checks

- Ran `graphify update .`: rebuilt the graph with 562 nodes, 771 edges, and 74 communities.
- Ran `git diff --check`: exit 0. Output contained only existing LF-to-CRLF conversion warnings in unrelated dependencies and touched files; no whitespace errors.
- Self-review confirmed the exact required fallback messages/codes, safe upstream message retention, account validation before player creation and `authChecked`, and abort/unmount guards after the new async boundary.
- Confirmed no changes under legacy `public/`.
- Preserved and did not stage unrelated `node_modules/`, `dist/`, `.codex/`, and `graphify-out/` dirt.

## Concerns

- The test runner continues to emit the repository's existing Node experimental warning about unavailable `localStorage` configuration.
- Graphify reports that the installed skill metadata is 0.9.7 while the package is 0.9.11, and warns that two settings JSON files produced zero graph nodes. The required source graph update still completed successfully.
