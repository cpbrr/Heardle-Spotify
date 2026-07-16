# Game Controls, Search Selection, Results, and Playlist Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add immediate song abandonment, persistent selected-track feedback, five-result song searches, answer artwork on every result, and reconnectable playlist authorization errors.

**Architecture:** Keep round state transitions in `gameEngine`, interaction orchestration in `GameScreen`, and answer presentation in `ResultView`. Keep search result limiting at the Spotify request boundary and represent keyboard activity separately from persistent selection. Preserve endpoint-aware Spotify errors while making ambiguous playlist `403` responses reconnectable.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Spotify Web API, Vite.

## Global Constraints

- `Skip +1s` keeps its existing six-clip behavior; `Skip song` is a separate immediate-loss action.
- Guess search remains global and independent of the selected answer source.
- In-round and `Specific track` searches return at most five Spotify tracks; artist, album, and playlist source limits stay unchanged.
- A chosen search result remains visibly selected and exposes `aria-selected=true` until the query changes or another result is chosen.
- Both won and lost results render the answer artwork when `imageUrl` exists and retain a square fallback otherwise.
- Playlist-items `403` errors offer `/api/login` reconnection and explain both playlist permission scopes and Spotify's owner/collaborator restriction.
- Existing Development Mode, Premium, rate-limit, forced-refresh, abort, and stale-request behavior remains intact.
- Do not modify legacy `public/` or stage unrelated `.codex/`, `dist/`, `graphify-out/`, or `node_modules/` changes.

---

### Task 1: Five-result track search and persistent selection

**Files:**
- Modify: `src/sources/catalog.ts`
- Modify: `src/sources/catalog.test.ts`
- Modify: `src/components/TrackSearch.tsx`
- Modify: `src/components/TrackSearch.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `searchTracks(query: string, signal?: AbortSignal, client?: SpotifyApiClient): Promise<Track[]>`.
- Produces: track searches capped at five results and `TrackSearch` rows whose persistent selection is independent from `activeIndex` keyboard navigation.

- [ ] **Step 1: Write failing request-limit and selection tests**

Add catalog assertions for these exact request paths:

```ts
expect(client.request).toHaveBeenCalledWith(
  '/search?q=dreams&type=track&limit=5',
  expect.objectContaining({ signal: undefined }),
);
expect(client.request).toHaveBeenCalledWith(
  '/search?q=dreams&type=track&limit=5',
  expect.anything(),
);
```

The first covers `searchTracks`; the second belongs in a `searchSources('track', 'dreams', ...)` case. Retain an album or playlist assertion using `limit=8` to prove non-track limits do not change.

Add a component test that clicks the second result and asserts:

```ts
expect(screen.getByRole('option', { name: /second song/i })).toHaveAttribute('aria-selected', 'true');
expect(screen.getByRole('option', { name: /first song/i })).toHaveAttribute('aria-selected', 'false');
```

Then move the pointer or keyboard active index to the first result and verify the second remains selected. Edit the query and verify no result remains selected and `onClear` fires.

- [ ] **Step 2: Run Task 1 tests and verify RED**

Run: `npm run test:run -- src/sources/catalog.test.ts src/components/TrackSearch.test.tsx`

Expected: request-path expectations fail on `limit=10`/`limit=8`, and clicked selection loses `aria-selected` when `activeIndex` changes.

- [ ] **Step 3: Implement the five-result boundary and selected-row state**

Change the global request to:

```ts
`/search?q=${encodeURIComponent(query.trim())}&type=track&limit=5`
```

In `searchSources`, calculate the per-type limit:

```ts
const limit = type === 'track' ? 5 : 8;
const payload = await client.request(
  `/search?q=${encodeURIComponent(query.trim())}&type=${type}&limit=${limit}`,
  { signal },
);
```

For each TrackSearch result, separate selection from keyboard activity:

```tsx
const isSelected = selectedTrack?.id === track.id;
const isActive = activeIndex === index;

<button
  role="option"
  aria-selected={isSelected}
  data-active={isActive ? 'true' : undefined}
  className="search-result track-search__result"
>
```

Keep `aria-activedescendant` driven by `activeIndex`. Style persistent selection with the existing green accent and give `[data-active="true"]` a distinct border-only treatment so hover/keyboard movement cannot erase the chosen state.

- [ ] **Step 4: Run Task 1 tests and verify GREEN**

Run: `npm run test:run -- src/sources/catalog.test.ts src/components/TrackSearch.test.tsx`

Expected: both files pass; song requests use five and persistent selection survives active-option changes.

- [ ] **Step 5: Commit**

```sh
git add -- src/sources/catalog.ts src/sources/catalog.test.ts src/components/TrackSearch.tsx src/components/TrackSearch.test.tsx src/styles/global.css
git commit -m "Improve Spotify track selection"
```

### Task 2: Immediate skip-song loss and result artwork

**Files:**
- Modify: `src/components/GameScreen.tsx`
- Modify: `src/components/GameScreen.test.tsx`
- Modify: `src/components/ResultView.tsx`
- Modify: `src/components/ResultView.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.integration.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: existing `giveUp(round: Round): Round`, `round.answer.imageUrl`, `GamePlayer.pause()`, and `onRoundComplete(round)`.
- Produces: `ResultViewProps.imageUrl: string | null` and a `Skip song` interaction that completes the round only after playback pauses.

- [ ] **Step 1: Write failing skip-song and artwork tests**

Add a GameScreen test that clicks `Skip song` and verifies the exact ordering and result:

```ts
expect(player.pause).toHaveBeenCalledTimes(1);
expect(onRoundChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'lost' }));
expect(onRoundComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'lost' }));
```

Add a rejected-pause case asserting neither round callback fires and `onAuthExpired` receives an authentication `AppError`.

Update ResultView tests to pass `imageUrl="https://images.test/answer.jpg"` for both outcomes and assert:

```ts
expect(screen.getByRole('img', { name: 'Answer Song album cover' })).toHaveAttribute(
  'src',
  'https://images.test/answer.jpg',
);
```

Add a `null` case asserting the placeholder remains and no result image exists. Add an App integration assertion proving the completed round passes the answer image through to ResultView.

- [ ] **Step 2: Run Task 2 tests and verify RED**

Run: `npm run test:run -- src/components/GameScreen.test.tsx src/components/ResultView.test.tsx src/app/App.integration.test.tsx`

Expected: `Skip song` is absent and ResultView rejects or ignores the new `imageUrl` expectation.

- [ ] **Step 3: Implement immediate loss and artwork rendering**

Import `giveUp` in GameScreen and add:

```ts
const skipSong = async () => {
  setError(null);
  try {
    await player.pause();
    update(giveUp(round));
  } catch (failure) {
    recover(failure);
  }
};
```

Render a separate enabled-state-matched button:

```tsx
<button type="button" disabled={disabled} onClick={() => void skipSong()}>Skip song</button>
```

Extend ResultView and its render branch:

```tsx
interface ResultViewProps {
  outcome: 'won' | 'lost';
  title: string;
  artist: string;
  imageUrl: string | null;
  onPlayFullTrack(): void;
  onPlayAnother(): void;
}

{imageUrl ? (
  <img className="artwork" src={imageUrl} alt={`${title} album cover`} />
) : (
  <div className="artwork artwork-placeholder" aria-hidden="true" />
)}
```

Pass `imageUrl={round.answer.imageUrl}` from App. Ensure `.artwork` retains a square aspect ratio and `object-fit: cover`.

- [ ] **Step 4: Run Task 2 tests and verify GREEN**

Run: `npm run test:run -- src/components/GameScreen.test.tsx src/components/ResultView.test.tsx src/app/App.integration.test.tsx`

Expected: all tests pass; pause failure cannot prematurely lose the round, and artwork appears for wins and losses.

- [ ] **Step 5: Commit**

```sh
git add -- src/components/GameScreen.tsx src/components/GameScreen.test.tsx src/components/ResultView.tsx src/components/ResultView.test.tsx src/app/App.tsx src/app/App.integration.test.tsx src/styles/global.css
git commit -m "Add skip song results feedback"
```

### Task 3: Reconnectable playlist authorization errors

**Files:**
- Modify: `src/spotify/spotifyClient.ts`
- Modify: `src/spotify/spotifyClient.test.ts`
- Modify: `src/app/App.integration.test.tsx`

**Interfaces:**
- Consumes: `AppError` support for `code`, `status`, and `loginUrl`; App failed-state reconnect rendering.
- Produces: playlist-items `403` with code `spotify_playlist_access_required`, status `403`, `loginUrl: '/api/login'`, and the exact combined message below.

- [ ] **Step 1: Write failing client and recovery tests**

Replace the ownership-only assertion with:

```ts
await expect(client.request('/playlists/id/items?limit=50')).rejects.toMatchObject({
  code: 'spotify_playlist_access_required',
  status: 403,
  loginUrl: '/api/login',
  message: 'Reconnect Spotify to grant playlist access. Spotify only allows playlists you own or collaborate on.',
});
```

Add an App integration case where catalog loading throws that AppError and assert both the combined message and a `Connect Spotify` link whose `href` is `/api/login`.

- [ ] **Step 2: Run Task 3 tests and verify RED**

Run: `npm run test:run -- src/spotify/spotifyClient.test.ts src/app/App.integration.test.tsx`

Expected: the client still emits `spotify_playlist_inaccessible` without a login URL, and the App recovery link is absent.

- [ ] **Step 3: Implement the combined reconnectable mapping**

Replace only the playlist-items `403` branch with:

```ts
throw new AppError(
  'Reconnect Spotify to grant playlist access. Spotify only allows playlists you own or collaborate on.',
  {
    code: 'spotify_playlist_access_required',
    status: 403,
    loginUrl: '/api/login',
  },
);
```

Do not change `/me`, `429`, generic status-message, or 401 forced-refresh behavior.

- [ ] **Step 4: Run Task 3 tests and verify GREEN**

Run: `npm run test:run -- src/spotify/spotifyClient.test.ts src/app/App.integration.test.tsx`

Expected: both files pass and the failed-state UI provides reconnection.

- [ ] **Step 5: Commit**

```sh
git add -- src/spotify/spotifyClient.ts src/spotify/spotifyClient.test.ts src/app/App.integration.test.tsx
git commit -m "Recover playlist authorization"
```

### Task 4: Full verification and graph refresh

**Files:**
- Modify only files required by failures exposed during verification.
- Update `graphify-out/` with the repository command without staging generated or pre-existing dirt.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: a fully verified, pushed `main` whose local and remote hashes match.

- [ ] **Step 1: Run the full project gate**

Run: `npm run check`

Expected: TypeScript, API syntax, all Vitest files, and Vite production build pass.

- [ ] **Step 2: Run the standalone elevated build**

Run outside the sandbox with user-approved elevation: `npm run build`

Expected: TypeScript build and Vite production build pass.

- [ ] **Step 3: Refresh Graphify**

Run: `graphify update .`

Expected: AST graph update completes without extraction failure.

- [ ] **Step 4: Audit diff and workspace scope**

Run: `git diff --check` and parse `git status --porcelain=v1`.

Expected: no whitespace errors and zero unexpected entries outside `.codex/`, `dist/`, `graphify-out/`, and `node_modules/`.

- [ ] **Step 5: Commit and push any verification correction**

If a real source or test correction was required, stage only its intended files and commit:

```sh
git commit -m "Complete game feedback improvements"
git push origin main
```

If no correction was needed, do not create an empty commit; Tasks 1-3 are already committed and must still be pushed.

- [ ] **Step 6: Verify remote head**

Run: `git fetch origin main && git rev-parse HEAD && git rev-parse origin/main`

Expected: both hashes are identical.
