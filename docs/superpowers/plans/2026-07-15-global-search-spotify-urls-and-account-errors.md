# Global Search, Spotify URLs, and Account Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search Spotify's global track catalog for guesses, resolve pasted track and playlist URLs, and turn account-specific Spotify failures into precise recovery instructions.

**Architecture:** A pure resource parser feeds catalog-level exact resolution and global search. Reusable React comboboxes consume those catalog interfaces, while the existing answer catalog remains source-specific. The Spotify HTTP and auth layers own status-aware errors, account validation, and a real forced-token refresh.

**Tech Stack:** React 19, TypeScript 7, Vitest, Testing Library, Spotify Web API, Spotify Web Playback SDK, Vercel Node functions.

## Global Constraints

- The selected source remains the answer pool; global search only broadens valid guesses.
- Accept `open.spotify.com` track/playlist URLs, localized URL paths, query strings, fragments, and `spotify:` track/playlist URIs.
- Do not resolve `spotify.link` redirects.
- Spotify search requests use a maximum `limit=10`.
- Playlist items use `/playlists/{id}/items?limit=50` and only work for playlists owned by or collaborative with the current user.
- Existing users must reconnect once to grant the new playlist scopes.
- Use test-driven development for every behavior change.
- Do not redesign unrelated game state or visuals.

---

### Task 1: Parse Spotify resources

**Files:**
- Create: `src/spotify/spotifyResource.ts`
- Create: `src/spotify/spotifyResource.test.ts`

**Interfaces:**
- Produces: `parseSpotifyResource(input: string): SpotifyResourceParseResult`
- Produces: `SpotifyResourceParseResult = { kind: 'text' } | { kind: 'invalid'; message: string } | { kind: 'resource'; resourceType: 'track' | 'playlist'; id: string }`

- [ ] **Step 1: Write the failing parser matrix**

```ts
import { describe, expect, it } from 'vitest';
import { parseSpotifyResource } from './spotifyResource';

describe('parseSpotifyResource', () => {
  it.each([
    ['https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh', 'track'],
    ['https://open.spotify.com/intl-th/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x#top', 'playlist'],
    ['spotify:track:4iV5W9uYEdYUVa79Axb7Rh', 'track'],
  ])('parses %s', (input, resourceType) => {
    expect(parseSpotifyResource(input)).toMatchObject({ kind: 'resource', resourceType });
  });

  it.each(['https://evil.example/track/abc', 'https://spotify.link/abc', 'spotify:album:abc'])('rejects unsupported resource %s', (input) => {
    expect(parseSpotifyResource(input)).toMatchObject({ kind: 'invalid' });
  });

  it('leaves ordinary search text alone', () => {
    expect(parseSpotifyResource('Dreams Fleetwood Mac')).toEqual({ kind: 'text' });
  });
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run: `npm run test:run -- src/spotify/spotifyResource.test.ts`

Expected: FAIL because `spotifyResource.ts` does not exist.

- [ ] **Step 3: Implement strict parsing**

```ts
export type SpotifyResourceType = 'track' | 'playlist';
export type SpotifyResourceParseResult =
  | { kind: 'text' }
  | { kind: 'invalid'; message: string }
  | { kind: 'resource'; resourceType: SpotifyResourceType; id: string };

const ID_PATTERN = /^[A-Za-z0-9]{10,64}$/;

export function parseSpotifyResource(input: string): SpotifyResourceParseResult {
  const value = input.trim();
  if (!value) return { kind: 'text' };
  const uri = value.match(/^spotify:([^:]+):([^:]+)$/i);
  if (uri) return parseParts(uri[1], uri[2]);
  if (!/^https?:\/\//i.test(value)) return { kind: 'text' };
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  if (url.hostname !== 'open.spotify.com') return invalid();
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0]?.startsWith('intl-')) parts.shift();
  return parseParts(parts[0], parts[1]);
}

function parseParts(type: string | undefined, id: string | undefined): SpotifyResourceParseResult {
  if ((type !== 'track' && type !== 'playlist') || !id || !ID_PATTERN.test(id)) return invalid();
  return { kind: 'resource', resourceType: type, id };
}

function invalid(): SpotifyResourceParseResult {
  return { kind: 'invalid', message: 'Paste a valid Spotify track or playlist link.' };
}
```

- [ ] **Step 4: Run the parser test and verify GREEN**

Run: `npm run test:run -- src/spotify/spotifyResource.test.ts`

Expected: one test file passes.

- [ ] **Step 5: Commit and push**

```sh
git add src/spotify/spotifyResource.ts src/spotify/spotifyResource.test.ts
git commit -m "Add Spotify resource parser"
git push origin main
```

### Task 2: Modernize catalog endpoints and add global resolution

**Files:**
- Modify: `src/sources/catalog.ts`
- Modify: `src/sources/catalog.test.ts`

**Interfaces:**
- Consumes: `parseSpotifyResource(input)` from Task 1.
- Produces: `searchTracks(query: string, signal?: AbortSignal, client?: SpotifyApiClient): Promise<Track[]>`
- Produces: `searchSources(...)` that returns exact pasted track/playlist descriptors across active modes.

- [ ] **Step 1: Add failing catalog tests**

```ts
it('searches the global track catalog with the development-mode limit', async () => {
  const client = clientFor({
    '/search?q=dreams&type=track&limit=10': { tracks: { items: [spotifyTrack('global')] } },
  });
  await expect(searchTracks('dreams', undefined, client)).resolves.toMatchObject([{ id: 'global' }]);
});

it('resolves a pasted track URL exactly', async () => {
  const id = '4iV5W9uYEdYUVa79Axb7Rh';
  const client = clientFor({ [`/tracks/${id}`]: spotifyTrack(id) });
  await expect(searchTracks(`https://open.spotify.com/track/${id}`, undefined, client)).resolves.toMatchObject([{ id }]);
});

it('loads current playlist items in pages of 50', async () => {
  const client = clientFor({
    '/playlists/playlist123/items?limit=50': { items: [{ item: spotifyTrack('one') }], next: null },
  });
  const result = await loadCatalog({ kind: 'playlist', id: 'playlist123', name: 'Mine', imageUrl: null }, undefined, client);
  expect(result.tracks.map((track) => track.id)).toEqual(['one']);
});
```

- [ ] **Step 2: Run catalog tests and verify RED**

Run: `npm run test:run -- src/sources/catalog.test.ts`

Expected: FAIL for missing `searchTracks`, old playlist URL, and old wrapper.

- [ ] **Step 3: Implement current endpoints and global track search**

```ts
export async function searchTracks(query: string, signal?: AbortSignal, client: SpotifyApiClient = spotifyClient): Promise<Track[]> {
  const parsed = parseSpotifyResource(query);
  if (parsed.kind === 'invalid') throw new AppError(parsed.message, { code: 'invalid_spotify_resource' });
  if (parsed.kind === 'resource') {
    if (parsed.resourceType !== 'track') throw new AppError('Paste playlist links in the source picker.', { code: 'wrong_spotify_resource_type' });
    const exact = normalizeTrack(await client.request(`/tracks/${parsed.id}`, { signal }));
    return exact ? [exact] : [];
  }
  if (query.trim().length < 2) return [];
  const response = await client.request<{ tracks?: { items?: unknown[] } }>(`/search?q=${encodeURIComponent(query.trim())}&type=track&limit=10`, { signal });
  return (response.tracks?.items || []).flatMap((item) => {
    const track = normalizeTrack(item);
    return track ? [track] : [];
  });
}
```

Change playlist collection to `/playlists/${source.id}/items?limit=50` and unwrap `record(item)?.item || record(item)?.track`. Change artist-mix search to `limit=10`. In `searchSources`, resolve pasted track with `/tracks/{id}` and playlist with `/playlists/{id}`, returning the resource's actual kind instead of the active mode.

- [ ] **Step 4: Run catalog tests and verify GREEN**

Run: `npm run test:run -- src/sources/catalog.test.ts`

Expected: catalog tests pass with current endpoint assertions.

- [ ] **Step 5: Commit and push**

```sh
git add src/sources/catalog.ts src/sources/catalog.test.ts
git commit -m "Support global Spotify catalog resolution"
git push origin main
```

### Task 3: Build the reusable track combobox

**Files:**
- Create: `src/components/TrackSearch.tsx`
- Create: `src/components/TrackSearch.test.tsx`
- Modify: `src/css/app.css`

**Interfaces:**
- Consumes: `searchTracks(query, signal)` from Task 2.
- Produces: `<TrackSearch disabled?: boolean onSelect(track: Track): void search?: TrackSearchFunction />`.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('debounces global search and selects a result outside the answer source', async () => {
  const track = makeTrack('global');
  const search = vi.fn().mockResolvedValue([track]);
  const onSelect = vi.fn();
  render(<TrackSearch onSelect={onSelect} search={search} />);
  await userEvent.type(screen.getByRole('combobox', { name: 'Guess' }), 'dreams');
  expect(await screen.findByRole('option', { name: /dreams/i })).toBeVisible();
  await userEvent.click(screen.getByRole('option', { name: /dreams/i }));
  expect(onSelect).toHaveBeenCalledWith(track);
});

it('cancels stale searches and exposes retry after failure', async () => {
  const search = vi.fn().mockRejectedValueOnce(new Error('Search unavailable')).mockResolvedValueOnce([]);
  render(<TrackSearch onSelect={vi.fn()} search={search} />);
  await userEvent.type(screen.getByRole('combobox', { name: 'Guess' }), 'dreams');
  expect(await screen.findByRole('alert')).toHaveTextContent('Search unavailable');
  await userEvent.click(screen.getByRole('button', { name: 'Retry search' }));
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm run test:run -- src/components/TrackSearch.test.tsx`

Expected: FAIL because `TrackSearch` does not exist.

- [ ] **Step 3: Implement the combobox**

Use `useDebouncedValue(query, 250)`, one `AbortController` per request, listbox roles, arrow-key navigation, Enter selection, artwork, loading/empty/error messages, retry nonce, and a selected-track summary. Keep async state within this component and call `onSelect` only after explicit keyboard or pointer selection.

Public component contract:

```tsx
export type TrackSearchFunction = (query: string, signal: AbortSignal) => Promise<Track[]>;

export interface TrackSearchProps {
  disabled?: boolean;
  onSelect(track: Track): void;
  search?: TrackSearchFunction;
}

export function TrackSearch(props: TrackSearchProps): React.JSX.Element;
```

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npm run test:run -- src/components/TrackSearch.test.tsx`

Expected: TrackSearch tests pass without act warnings.

- [ ] **Step 5: Commit and push**

```sh
git add src/components/TrackSearch.tsx src/components/TrackSearch.test.tsx src/css/app.css
git commit -m "Add global track search combobox"
git push origin main
```

### Task 4: Use global guesses in the game

**Files:**
- Modify: `src/components/GameScreen.tsx`
- Modify: `src/components/GameScreen.test.tsx`
- Modify: `src/app/App.integration.test.tsx`

**Interfaces:**
- Consumes: `TrackSearch` from Task 3.
- Changes `GameScreen` submission from source-track lookup to a selected `Track` value.

- [ ] **Step 1: Replace source-derived test assumptions with a failing global guess test**

```tsx
it('submits a globally searched track that is absent from the answer catalog', async () => {
  const outsideTrack = makeTrack('outside');
  const onRoundChange = vi.fn();
  render(<GameScreen round={round} player={player} searchTracks={vi.fn().mockResolvedValue([outsideTrack])} onRoundChange={onRoundChange} />);
  await userEvent.type(screen.getByRole('combobox', { name: 'Guess' }), outsideTrack.title);
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(outsideTrack.title, 'i') }));
  await userEvent.click(screen.getByRole('button', { name: 'Submit guess' }));
  expect(onRoundChange).toHaveBeenCalledWith(expect.objectContaining({ attemptIndex: 1 }));
});
```

- [ ] **Step 2: Run GameScreen and integration tests and verify RED**

Run: `npm run test:run -- src/components/GameScreen.test.tsx src/app/App.integration.test.tsx`

Expected: FAIL because `GameScreen` has no global search interface.

- [ ] **Step 3: Integrate TrackSearch**

Store `selectedGuess: Track | null`, render `TrackSearch`, disable submit until a selection exists, and call:

```ts
const next = submitGuess(round, {
  trackId: selectedGuess.id,
  label: `${selectedGuess.title} - ${selectedGuess.artistText}`,
});
```

Clear the selected guess after a non-terminal wrong guess. Preserve pause-before-terminal-transition and authentication recovery behavior.

- [ ] **Step 4: Run GameScreen and integration tests and verify GREEN**

Run: `npm run test:run -- src/components/GameScreen.test.tsx src/app/App.integration.test.tsx`

Expected: all selected tests pass.

- [ ] **Step 5: Commit and push**

```sh
git add src/components/GameScreen.tsx src/components/GameScreen.test.tsx src/app/App.integration.test.tsx
git commit -m "Search all Spotify tracks for guesses"
git push origin main
```

### Task 5: Resolve pasted resources in source selection

**Files:**
- Modify: `src/components/SourcePicker.tsx`
- Modify: `src/components/SourcePicker.test.tsx`

**Interfaces:**
- Consumes: resource-aware `searchSources` from Task 2.
- Preserves `onSelect(source: SourceDescriptor)`.

- [ ] **Step 1: Write failing cross-mode paste tests**

```tsx
it('accepts a playlist URL while the track mode is active', async () => {
  const playlist = { kind: 'playlist', id: 'playlist123', name: 'Shared', imageUrl: null } as const;
  const search = vi.fn().mockResolvedValue([playlist]);
  render(<SourcePicker onSelect={onSelect} search={search} />);
  await userEvent.click(screen.getByRole('button', { name: /specific track/i }));
  await userEvent.paste(screen.getByRole('combobox'), 'https://open.spotify.com/playlist/playlist123');
  await userEvent.click(await screen.findByRole('option', { name: 'Shared' }));
  expect(onSelect).toHaveBeenCalledWith(playlist);
});
```

- [ ] **Step 2: Run SourcePicker tests and verify RED**

Run: `npm run test:run -- src/components/SourcePicker.test.tsx`

Expected: FAIL because the current search result is coerced to the active kind.

- [ ] **Step 3: Render resource-aware results and errors**

Allow result keys and selection to use each returned descriptor's actual `kind`. Keep text-search behavior tied to the active mode, while pasted resources may return `track` or `playlist`. Surface `invalid_spotify_resource` and playlist access errors in the existing inline error/retry region.

- [ ] **Step 4: Run SourcePicker tests and verify GREEN**

Run: `npm run test:run -- src/components/SourcePicker.test.tsx`

Expected: source picker tests pass.

- [ ] **Step 5: Commit and push**

```sh
git add src/components/SourcePicker.tsx src/components/SourcePicker.test.tsx
git commit -m "Accept Spotify URLs in source search"
git push origin main
```

### Task 6: Repair OAuth scopes and forced refresh

**Files:**
- Modify: `api/_spotify.js`
- Modify: `api/token.js`
- Modify: `api/spotify-api.test.mjs`
- Modify: `src/auth/authClient.ts`
- Modify: `src/auth/authClient.test.ts`
- Modify: `src/spotify/spotifyClient.test.ts`

**Interfaces:**
- `getAccessToken(signal, true)` requests `/api/token?force=1`.
- `api/token.js` bypasses fresh-token-cookie reuse when `force=1`.

- [ ] **Step 1: Write failing scope and refresh tests**

```js
test('login requests private and collaborative playlist scopes', async () => {
  await login(request(), response());
  assert.match(response.headers.Location, /playlist-read-private/);
  assert.match(response.headers.Location, /playlist-read-collaborative/);
});

test('force refresh bypasses a nominally fresh rejected access token', async () => {
  const req = request({ url: '/api/token?force=1', cookie: freshTokenCookies });
  await token(req, res);
  assert.equal(refreshFetch.mock.calls.length, 1);
});
```

```ts
it('propagates a forced refresh after Spotify rejects a cached token', async () => {
  await getAccessToken(undefined, true);
  expect(fetch).toHaveBeenCalledWith('/api/token?force=1', expect.anything());
});
```

- [ ] **Step 2: Run auth/API tests and verify RED**

Run: `npm run test:run -- src/auth/authClient.test.ts src/spotify/spotifyClient.test.ts && npm run check:api`

Expected: FAIL on the force URL and missing scopes.

- [ ] **Step 3: Implement scopes and refresh propagation**

Add `playlist-read-private` and `playlist-read-collaborative` to `SCOPES`. In `getAccessToken`, choose `'/api/token?force=1'` when `forceRefresh` is true. In `api/token.js`, parse `req.url` against `config.origin`, set `force = searchParams.get('force') === '1'`, and define `stillFresh` as `!force && accessToken && expiresAt && ...`.

- [ ] **Step 4: Run auth/API tests and verify GREEN**

Run: `npm run test:run -- src/auth/authClient.test.ts src/spotify/spotifyClient.test.ts && npm run check:api`

Expected: tests and API syntax checks pass.

- [ ] **Step 5: Commit and push**

```sh
git add api/_spotify.js api/token.js api/spotify-api.test.mjs src/auth/authClient.ts src/auth/authClient.test.ts src/spotify/spotifyClient.test.ts
git commit -m "Fix Spotify scopes and forced token refresh"
git push origin main
```

### Task 7: Diagnose allowlist, Premium, playlist, and upstream failures

**Files:**
- Modify: `src/spotify/spotifyClient.ts`
- Modify: `src/spotify/spotifyClient.test.ts`
- Create: `src/spotify/account.ts`
- Create: `src/spotify/account.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.auth.test.tsx`
- Modify: `src/player/SpotifyPlayer.ts`
- Modify: `src/player/SpotifyPlayer.test.ts`

**Interfaces:**
- Produces: `validateSpotifyAccount(signal?: AbortSignal, client?: SpotifyApiClient): Promise<void>`.
- `SpotifyClient` assigns endpoint-aware `AppError.code` and messages.

- [ ] **Step 1: Write failing error and account tests**

```ts
it('explains an empty development-mode 403 from account validation', async () => {
  const client = clientReturning(new Response(null, { status: 403 }));
  await expect(client.request('/me')).rejects.toMatchObject({
    code: 'spotify_account_not_allowed',
    message: expect.stringContaining('Users Management'),
  });
});

it('explains playlist ownership restrictions', async () => {
  const client = clientReturning(new Response(null, { status: 403 }));
  await expect(client.request('/playlists/id/items?limit=50')).rejects.toMatchObject({
    code: 'spotify_playlist_inaccessible',
    message: expect.stringContaining('own or collaborate'),
  });
});

it('rejects non-Premium accounts before player setup', async () => {
  const client = { request: vi.fn().mockResolvedValue({ product: 'free' }) };
  await expect(validateSpotifyAccount(undefined, client)).rejects.toMatchObject({ code: 'spotify_premium_required' });
});
```

- [ ] **Step 2: Run targeted account/error tests and verify RED**

Run: `npm run test:run -- src/spotify/spotifyClient.test.ts src/spotify/account.test.ts src/app/App.auth.test.tsx src/player/SpotifyPlayer.test.ts`

Expected: FAIL for missing account validator and generic errors.

- [ ] **Step 3: Preserve response bodies and map context**

Read the response as text, JSON-decode when possible, retain safe Spotify messages, and use these fallbacks:

```ts
if (response.status === 403 && path === '/me') {
  throw new AppError('This Spotify account is not authorized for this development app. Add its Spotify email in Developer Dashboard > Users Management, then reconnect.', { code: 'spotify_account_not_allowed', status: 403 });
}
if (response.status === 403 && /\/playlists\/[^/]+\/items/.test(path)) {
  throw new AppError('Spotify only allows playlists you own or collaborate on.', { code: 'spotify_playlist_inaccessible', status: 403 });
}
```

Implement `validateSpotifyAccount` with `GET /me` and throw `spotify_premium_required` unless `profile.product === 'premium'`. Call it during authenticated startup before dispatching `authChecked`. Preserve abort/unmount guards. Continue mapping Web Playback SDK `account_error` to the same Premium message.

- [ ] **Step 4: Run targeted account/error tests and verify GREEN**

Run: `npm run test:run -- src/spotify/spotifyClient.test.ts src/spotify/account.test.ts src/app/App.auth.test.tsx src/player/SpotifyPlayer.test.ts`

Expected: targeted tests pass and generic friend-path 403 is no longer displayed.

- [ ] **Step 5: Commit and push**

```sh
git add src/spotify/spotifyClient.ts src/spotify/spotifyClient.test.ts src/spotify/account.ts src/spotify/account.test.ts src/app/App.tsx src/app/App.auth.test.tsx src/player/SpotifyPlayer.ts src/player/SpotifyPlayer.test.ts
git commit -m "Explain Spotify account access failures"
git push origin main
```

### Task 8: End-to-end verification and graph refresh

**Files:**
- Modify only files needed to fix failures exposed by full verification.
- Update: `graphify-out/` through the repository command without staging pre-existing unrelated artifacts.

- [ ] **Step 1: Run full verification**

Run: `npm run check`

Expected: typecheck, API syntax checks, all Vitest files, and Vite production build pass.

- [ ] **Step 2: Refresh the code graph**

Run: `graphify update .`

Expected: Graphify completes without an extraction error.

- [ ] **Step 3: Check the final diff**

Run: `git diff --check` and `git status --short`

Expected: no whitespace errors; only intended source, test, plan/spec, and tracked graph changes are staged or committed. Existing `node_modules`, `dist`, `.codex`, and unrelated untracked graph artifacts remain untouched.

- [ ] **Step 4: Commit and push any final verification corrections**

```sh
git add -- api/_spotify.js api/token.js api/spotify-api.test.mjs src/spotify/spotifyResource.ts src/spotify/spotifyResource.test.ts src/spotify/spotifyClient.ts src/spotify/spotifyClient.test.ts src/spotify/account.ts src/spotify/account.test.ts src/sources/catalog.ts src/sources/catalog.test.ts src/auth/authClient.ts src/auth/authClient.test.ts src/components/TrackSearch.tsx src/components/TrackSearch.test.tsx src/components/GameScreen.tsx src/components/GameScreen.test.tsx src/components/SourcePicker.tsx src/components/SourcePicker.test.tsx src/app/App.tsx src/app/App.auth.test.tsx src/app/App.integration.test.tsx src/player/SpotifyPlayer.ts src/player/SpotifyPlayer.test.ts src/css/app.css
git commit -m "Complete Spotify search and account fixes"
git push origin main
```

- [ ] **Step 5: Verify local and remote heads match**

Run: `git fetch origin main && git rev-parse HEAD && git rev-parse origin/main`

Expected: both hashes are identical.
