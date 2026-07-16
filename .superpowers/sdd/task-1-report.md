# Task 1 Report: Five-result track search and persistent selection

## Status

DONE_WITH_CONCERNS

## Scope

- Changed global Spotify track searches from 10 results to 5.
- Changed `searchSources` to request 5 results for tracks while retaining 8 for albums, playlists, and artists.
- Separated persistent selected-row state from pointer/keyboard active-row state in `TrackSearch`.
- Kept `aria-activedescendant` and the existing synchronous abort/stale-request behavior driven by `activeIndex` and the current request controller.
- Added a green selected-row treatment and a separate border-only active-row treatment.

## TDD Evidence

### RED

Command:

```text
npm run test:run -- src/sources/catalog.test.ts src/components/TrackSearch.test.tsx
```

Result: exit 1; 3 intended failures and 23 passes across 26 tests.

- `searchTracks` requested `limit=10` instead of `limit=5`.
- track-mode `searchSources` requested `limit=8` instead of `limit=5`.
- hovering the first option moved `aria-selected=true` away from the clicked second option.

### GREEN

Command:

```text
npm run test:run -- src/sources/catalog.test.ts src/components/TrackSearch.test.tsx
```

Result: exit 0; 2 test files passed, 26/26 tests passed.

## Full Verification

Command:

```text
npm run check
```

Result: exit 0.

- TypeScript project check passed.
- All API syntax checks passed.
- Vitest: 17 files passed, 122/122 tests passed.
- Vite production build passed.
- Node emitted existing experimental `localStorage` warnings during tests; no test failed.

Command:

```text
graphify update .
```

Result: exit 0; graph updated to 615 nodes, 818 edges, 78 communities.

Command:

```text
git diff --check
```

Result: exit 0; no whitespace errors. Git emitted line-ending notices for pre-existing dirty dependencies and the scoped files.

## React Review

Selection is derived directly from `selectedTrack?.id === track.id`, while active navigation is derived from `activeIndex === index`. This avoids duplicated synchronization effects and leaves the component's request lifecycle unchanged.

## Concerns

- Graphify warned that `.codex/hooks.json` and `.codex/settings.json` produced zero nodes. These unrelated configuration files are not part of Task 1.
- The worktree contains extensive unrelated `.codex`, `dist`, `graphify-out`, and `node_modules` changes. They were preserved and excluded from this commit.
