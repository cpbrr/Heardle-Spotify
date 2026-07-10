# Heardle Spotify Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken legacy Heardle client with a responsive, tested Spotify Premium game that works through Vercel in production and local development.

**Architecture:** A React, Vite, and TypeScript single-page app owns explicit auth, source, catalog, player, and game states. Vercel Functions keep OAuth tokens in HTTP-only cookies, while typed frontend services isolate Spotify HTTP and Web Playback SDK boundaries so they can be tested deterministically.

**Tech Stack:** Node 24, React 19.2.7, Vite 8.1.4, TypeScript 7.0.2, Vitest 4.1.10, Testing Library 16.3.2, jsdom 29.1.1, Lucide React 1.24.0, Vercel Functions, Spotify Web API, Spotify Web Playback SDK.

## Global Constraints

- Deploy to Vercel and support the same flow through `vercel dev` locally.
- Require Spotify Premium and explain that requirement before login.
- Preserve seven sources: artist mix, artist discography, playlist, album, specific track, top tracks, and liked tracks.
- Use searchable selectors instead of raw Spotify ID fields.
- Keep unlimited rounds, in-game source switching, and a locally persisted streak.
- Use six clip limits: 1, 2, 4, 7, 11, and 16 seconds.
- Use near-black surfaces, off-white text, neutral borders, restrained Spotify green, and no horizontal overflow at 390 by 844 pixels.
- Keep client secrets and refresh tokens out of browser-readable storage.
- Use test-first development for every behavior change.

---

## Planned File Structure

```text
api/
  _spotify.js                 OAuth configuration, cookies, and token requests
  callback.js                 OAuth callback handler
  login.js                    OAuth redirect handler
  logout.js                   Cookie clearing handler
  status.js                   Configuration and session status handler
  token.js                    Access-token and refresh handler
  spotify-api.test.mjs        Backend contract tests
src/
  app/App.tsx                 State composition and top-level routing
  app/appReducer.ts           Explicit application state transitions
  app/appReducer.test.ts
  auth/authClient.ts          Browser calls to Vercel auth functions
  auth/authClient.test.ts
  components/AppHeader.tsx
  components/ConfigurationScreen.tsx
  components/LoginScreen.tsx
  components/SourcePicker.tsx
  components/SourcePicker.test.tsx
  components/GameScreen.tsx
  components/GameScreen.test.tsx
  components/ResultView.tsx
  components/StatusMessage.tsx
  game/gameEngine.ts           Attempts, clips, guesses, streak, selection
  game/gameEngine.test.ts
  player/SpotifyPlayer.ts      Web Playback SDK lifecycle adapter
  player/SpotifyPlayer.test.ts
  sources/catalog.ts           Source loading, pagination, normalization
  sources/catalog.test.ts
  sources/sourceStorage.ts     Active source and history persistence
  sources/sourceStorage.test.ts
  spotify/spotifyClient.ts     Typed Spotify HTTP client and retry handling
  spotify/spotifyClient.test.ts
  spotify/types.ts             Shared normalized and response types
  styles/global.css            Tokens and responsive application styling
  test/setup.ts                jsdom matchers and browser mocks
  main.tsx                     React entry point
index.html                     Vite document shell
public/icon.png                Existing app icon
.env.example                   Local configuration names
package.json                   Build, test, typecheck, and dev scripts
tsconfig.json
tsconfig.app.json
vite.config.ts
vercel.json                    SPA and API routing
README.md                      Setup, OAuth, test, and deployment guide
```

Legacy `public/views`, `public/js`, and `public/css` are removed only after the Vite app passes browser verification.

### Task 1: Establish The Typed Vite Application

**Files:**
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/test/setup.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `vite.config.ts`
- Modify: `package.json`
- Modify: `vercel.json`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: a Vite SPA mounted at `#root`, an `App` component, Vitest jsdom setup, and scripts used by all later tasks.

- [ ] **Step 1: Write a failing application-shell test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the product identity while startup state is checked', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Heardle' })).toBeVisible();
    expect(screen.getByText('Checking Spotify connection...')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test and verify the old repository cannot execute it**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: FAIL because Vitest, React, and `src/app/App.tsx` do not exist.

- [ ] **Step 3: Replace the root toolchain and add the minimal shell**

Set `package.json` scripts to:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest",
  "test:run": "vitest run",
  "typecheck": "tsc -b --pretty false",
  "check:api": "node --check api/_spotify.js && node --check api/status.js && node --check api/login.js && node --check api/callback.js && node --check api/token.js && node --check api/logout.js",
  "check": "npm run typecheck && npm run check:api && npm run test:run && npm run build",
  "start": "vercel dev"
}
```

Pin the package versions from the plan header, add matching `@types/react`, `@types/react-dom`, `@types/node`, and `@testing-library/jest-dom`, and use this initial component:

```tsx
export function App() {
  return (
    <main>
      <h1>Heardle</h1>
      <p>Checking Spotify connection...</p>
    </main>
  );
}
```

Configure Vitest with `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, and CSS handling. Rewrite both `/` and `/game` to `/index.html` in `vercel.json` while leaving `/api/*` untouched.

- [ ] **Step 4: Install dependencies and verify the shell**

Run: `npm install`

Run: `npm test -- --run src/app/App.test.tsx && npm run typecheck && npm run build`

Expected: one passing test, successful TypeScript build, and generated `dist/index.html`.

- [ ] **Step 5: Commit the application foundation**

```bash
git add package.json package-lock.json index.html src/main.tsx src/app/App.tsx src/app/App.test.tsx src/test/setup.ts tsconfig.json tsconfig.app.json vite.config.ts vercel.json
git commit -m "Build typed Heardle app foundation"
```

### Task 2: Make OAuth Configuration And Errors Reliable

**Files:**
- Create: `.env.example`
- Create: `api/spotify-api.test.mjs`
- Modify: `api/_spotify.js`
- Modify: `api/status.js`
- Modify: `api/login.js`
- Modify: `api/callback.js`
- Modify: `api/token.js`
- Modify: `api/logout.js`
- Create: `src/auth/authClient.ts`
- Create: `src/auth/authClient.test.ts`

**Interfaces:**
- Produces: `getAuthStatus(signal): Promise<AuthStatus>`, `getAccessToken(signal): Promise<TokenResult>`, `logout(): Promise<void>`, `loginUrl`, and backend errors shaped as `{ code, message, retryable, loginUrl? }`.

- [ ] **Step 1: Add failing backend contract tests**

Use lightweight request/response doubles to assert:

```js
assert.deepEqual(body, {
  code: 'missing_spotify_credentials',
  message: 'Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to continue.',
  retryable: false,
  redirectUri: 'http://localhost:3000/api/callback',
});
assert.equal(statusCode, 503);
```

Also assert state-cookie flags, production `Secure`, callback state rejection, token refresh success, refresh failure cookie clearing, and logout method handling.

- [ ] **Step 2: Run the backend tests and verify the current 500 contract fails**

Run: `node --test api/spotify-api.test.mjs`

Expected: FAIL because current handlers return `error`, use status 500, and lack the consistent retry contract.

- [ ] **Step 3: Implement the consistent backend contract**

Add this helper to `api/_spotify.js` and use it in every handler:

```js
function sendError(res, status, code, message, options = {}) {
  sendJson(res, status, {
    code,
    message,
    retryable: Boolean(options.retryable),
    ...(options.loginUrl ? { loginUrl: options.loginUrl } : {}),
    ...(options.redirectUri ? { redirectUri: options.redirectUri } : {}),
  });
}
```

Return 503 for missing server configuration, 401 for missing or expired auth, 405 for unsupported methods, and preserve redirect errors as query parameters that the frontend can translate. Add `.env.example` with empty `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and commented `SPOTIFY_REDIRECT_URI`.

- [ ] **Step 4: Write failing auth-client tests**

```ts
it('does not keep a rejected token request cached', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(401, { code: 'not_authenticated', message: 'Sign in again.', retryable: false, loginUrl: '/api/login' }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh', expiresAt: Date.now() + 3_600_000 }));
  await expect(getAccessToken()).rejects.toMatchObject({ code: 'not_authenticated' });
  await expect(getAccessToken()).resolves.toMatchObject({ accessToken: 'fresh' });
});
```

- [ ] **Step 5: Implement and verify the auth client**

Implement typed JSON parsing, shared `AppError`, in-flight token deduplication, expiry-aware token reuse, and cache clearing after rejection or logout.

Run: `node --test api/spotify-api.test.mjs && npm test -- --run src/auth/authClient.test.ts`

Expected: all backend and auth-client tests pass.

- [ ] **Step 6: Commit OAuth reliability**

```bash
git add .env.example api src/auth
git commit -m "Make Spotify authentication recoverable"
```

### Task 3: Define Application State And Persistence

**Files:**
- Create: `src/spotify/types.ts`
- Create: `src/app/appReducer.ts`
- Create: `src/app/appReducer.test.ts`
- Create: `src/sources/sourceStorage.ts`
- Create: `src/sources/sourceStorage.test.ts`

**Interfaces:**
- Produces: `Track`, `SourceDescriptor`, `AuthStatus`, `AppState`, `AppAction`, `appReducer`, `loadSource`, `saveSource`, `loadStreak`, `saveStreak`, `loadRecentTrackIds`, and `saveRecentTrackIds`.

- [ ] **Step 1: Write failing reducer and storage tests**

Cover startup, missing configuration, login, choosing a source, stale catalog request rejection, player preparation, ready, playing, round completion, recoverable error with `resumeAction`, source serialization, corrupt local storage, and bounded recent IDs.

```ts
expect(appReducer(loadingState(4), { type: 'catalogLoaded', requestId: 3, tracks })).toEqual(loadingState(4));
expect(loadStreak(storageContaining({ heardleStreak: 'not-json' }))).toBe(0);
expect(saveRecentTrackIds(storage, key, ids)).toHaveLength(20);
```

- [ ] **Step 2: Run tests and verify missing modules**

Run: `npm test -- --run src/app/appReducer.test.ts src/sources/sourceStorage.test.ts`

Expected: FAIL because the typed domain does not exist.

- [ ] **Step 3: Implement discriminated unions and defensive persistence**

Use this state shape as the stable boundary:

```ts
type AppState =
  | { phase: 'checking-auth' }
  | { phase: 'needs-configuration'; status: AuthStatus }
  | { phase: 'needs-login'; status: AuthStatus; resumeAction?: ResumeAction }
  | { phase: 'choosing-source'; source?: SourceDescriptor }
  | { phase: 'loading-catalog'; source: SourceDescriptor; requestId: number }
  | { phase: 'preparing-player'; source: SourceDescriptor; tracks: Track[] }
  | { phase: 'ready' | 'playing'; session: GameSession }
  | { phase: 'round-complete'; session: GameSession; outcome: 'won' | 'lost' }
  | { phase: 'error'; error: AppError; resumeAction?: ResumeAction };
```

Validate every parsed local-storage value, namespace keys with `heardle:`, cap history at 20 IDs per source, and never persist access tokens.

- [ ] **Step 4: Verify and commit application state**

Run: `npm test -- --run src/app/appReducer.test.ts src/sources/sourceStorage.test.ts && npm run typecheck`

Expected: all tests and type checking pass.

```bash
git add src/app/appReducer.ts src/app/appReducer.test.ts src/sources/sourceStorage.ts src/sources/sourceStorage.test.ts src/spotify/types.ts
git commit -m "Define reliable Heardle application state"
```

### Task 4: Build The Spotify Client And Catalog Pipeline

**Files:**
- Create: `src/spotify/spotifyClient.ts`
- Create: `src/spotify/spotifyClient.test.ts`
- Create: `src/sources/catalog.ts`
- Create: `src/sources/catalog.test.ts`

**Interfaces:**
- Consumes: `getAccessToken`, `Track`, and `SourceDescriptor`.
- Produces: `spotifyRequest<T>(path, options)`, `searchSources(kind, query, signal)`, `loadCatalog(source, signal)`, and `normalizeTrack(value): Track | null`.

- [ ] **Step 1: Write failing HTTP-client tests**

Assert Authorization headers, one token-refresh retry after Spotify 401, `Retry-After` propagation for 429, abort behavior, JSON error parsing, and no retries for non-retryable 4xx responses.

```ts
await expect(spotifyRequest('/me')).rejects.toMatchObject({
  code: 'spotify_rate_limited',
  retryable: true,
  retryAfterMs: 2_000,
});
```

- [ ] **Step 2: Implement the typed Spotify request boundary**

Use one fetch wrapper, convert every failure to `AppError`, retry exactly once after forcing a token refresh, and accept an `AbortSignal` on every request.

- [ ] **Step 3: Write failing catalog tests for all seven sources**

Fixture tests must cover artist mix search, exact artist discography pagination, playlist pagination, album tracks, a specific track, `/me/top/tracks`, `/me/tracks`, null playlist entries, local tracks, missing URIs, episodes, duplicate IDs, market restrictions, and empty results.

```ts
expect(normalizeTrack(localTrack)).toBeNull();
expect(await loadCatalog({ kind: 'liked' }, signal)).toEqual([expectedTrack]);
expect(exclusionCounts).toEqual({ duplicates: 1, unavailable: 2, unsupported: 1 });
```

- [ ] **Step 4: Implement bounded pagination and normalization**

Use `Map<string, Track>` for deduplication, follow Spotify `next` links sequentially, cap loaded tracks at 500, cap artist releases at 100, and return `{ tracks, exclusions }`. Artist mix uses a track search scoped to the selected artist name; artist discography selects an exact artist and loads releases plus their playable tracks.

- [ ] **Step 5: Verify and commit the Spotify data layer**

Run: `npm test -- --run src/spotify src/sources/catalog.test.ts && npm run typecheck`

Expected: HTTP, normalization, pagination, and seven-source tests pass.

```bash
git add src/spotify src/sources/catalog.ts src/sources/catalog.test.ts
git commit -m "Build typed Spotify catalog pipeline"
```

### Task 5: Isolate The Web Playback SDK

**Files:**
- Create: `src/player/spotify-sdk.d.ts`
- Create: `src/player/SpotifyPlayer.ts`
- Create: `src/player/SpotifyPlayer.test.ts`

**Interfaces:**
- Consumes: `getAccessToken` and a `Track.uri`.
- Produces: `SpotifyPlayer.connect()`, `activate()`, `playClip(uri, limitMs, onProgress)`, `pause()`, `playFullTrack(uri)`, `seek(positionMs)`, and `destroy()`.

- [ ] **Step 1: Write failing player lifecycle tests with an SDK double**

Assert a single SDK script load, token callback refresh, device readiness timeout, `activateElement()` before the play HTTP request, device transfer, seek-to-zero, clip stop at the exact active limit under fake timers, pause cleanup, destroy cleanup, and recoverable Premium/device errors.

```ts
await player.activate();
await player.playClip('spotify:track:abc', 2_000, onProgress);
expect(sequence).toEqual(['sdk.activate', 'transfer.device', 'seek.0', 'play.uri']);
vi.advanceTimersByTime(2_000);
expect(pauseRequest).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Run the player tests and verify the adapter is missing**

Run: `npm test -- --run src/player/SpotifyPlayer.test.ts`

Expected: FAIL because the SDK adapter does not exist.

- [ ] **Step 3: Implement one lifecycle owner**

Use a module-level SDK-script promise, a bounded 10-second device wait, one active stop timer, animation-frame progress callbacks, and an internal `AbortController` for playback commands. Reset visible state after every command failure and never expose the access token through component props.

- [ ] **Step 4: Verify and commit playback**

Run: `npm test -- --run src/player/SpotifyPlayer.test.ts && npm run typecheck`

Expected: all lifecycle and cleanup tests pass.

```bash
git add src/player
git commit -m "Isolate Spotify playback lifecycle"
```

### Task 6: Implement The Game Engine

**Files:**
- Create: `src/game/gameEngine.ts`
- Create: `src/game/gameEngine.test.ts`

**Interfaces:**
- Consumes: normalized `Track[]`, persisted recent IDs, and persisted streak.
- Produces: `CLIP_LIMITS`, `createRound`, `submitGuess`, `skipAttempt`, `giveUp`, `completeRound`, `normalizeGuess`, and `selectRoundTrack`.

- [ ] **Step 1: Write failing rule tests**

Cover the exact clip array, six attempts, wrong guesses, skips, correct guesses by ID, normalized title-and-artist fallback, no answer leakage, loss after attempt six, give-up loss, streak increment/reset, non-repetition, one-track catalogs, and deterministic random selection.

```ts
expect(CLIP_LIMITS).toEqual([1_000, 2_000, 4_000, 7_000, 11_000, 16_000]);
expect(submitGuess(round, { trackId: answer.id })).toMatchObject({ status: 'won' });
expect(completeRound(lostRound, 7).streak).toBe(0);
```

- [ ] **Step 2: Run tests and verify the game engine is missing**

Run: `npm test -- --run src/game/gameEngine.test.ts`

Expected: FAIL because the game module does not exist.

- [ ] **Step 3: Implement pure game transitions**

Keep every function immutable and deterministic, inject the random number function into `selectRoundTrack`, normalize Unicode and whitespace for fallback comparisons, and represent attempt rows as `{ kind: 'pending' | 'skipped' | 'incorrect' | 'correct'; guess?: Track }`.

- [ ] **Step 4: Verify and commit game rules**

Run: `npm test -- --run src/game/gameEngine.test.ts && npm run typecheck`

Expected: all game-rule tests pass.

```bash
git add src/game
git commit -m "Implement deterministic Heardle game rules"
```

### Task 7: Build Setup And Searchable Source Selection

**Files:**
- Create: `src/components/ConfigurationScreen.tsx`
- Create: `src/components/LoginScreen.tsx`
- Create: `src/components/SourcePicker.tsx`
- Create: `src/components/SourcePicker.test.tsx`
- Create: `src/components/StatusMessage.tsx`
- Create: `src/hooks/useDebouncedValue.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: auth client, `searchSources`, source descriptors, and reducer actions.
- Produces: accessible configuration, login, source-type, and searchable selection states.

- [ ] **Step 1: Write failing setup and source-picker component tests**

Verify missing credentials show exact variable names and callback URI without navigating; login shows the Premium requirement and `Connect Spotify`; seven source choices are visible; searchable choices debounce by 250ms, cancel stale searches, support arrows/Enter/Escape, show artwork and metadata, retain queries on failure, and emit a complete `SourceDescriptor`.

- [ ] **Step 2: Run tests and verify components are missing**

Run: `npm test -- --run src/components/SourcePicker.test.tsx src/app/App.test.tsx`

Expected: FAIL because the new states and components do not exist.

- [ ] **Step 3: Implement setup states and the source dialog/drawer**

Use semantic buttons and listbox/option roles, Lucide icons only for copy, search, close, and source switching, live regions for loading/errors, a minimum 44px touch target, and no raw ID entry. Immediate sources dispatch `{ kind: 'top' }` or `{ kind: 'liked' }`; searched sources include selected Spotify ID, name, and artwork.

- [ ] **Step 4: Verify and commit source selection**

Run: `npm test -- --run src/components/SourcePicker.test.tsx src/app/App.test.tsx && npm run typecheck`

Expected: setup and keyboard interaction tests pass.

```bash
git add src/components src/hooks src/app/App.tsx src/app/App.test.tsx
git commit -m "Build searchable Spotify source selection"
```

### Task 8: Build And Integrate The Game Interface

**Files:**
- Create: `src/components/AppHeader.tsx`
- Create: `src/components/GameScreen.tsx`
- Create: `src/components/GameScreen.test.tsx`
- Create: `src/components/ResultView.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/appReducer.ts`

**Interfaces:**
- Consumes: catalog loader, game engine, player adapter, persistence helpers, and source picker.
- Produces: the complete authenticated source-to-round-to-result workflow.

- [ ] **Step 1: Write failing integration-style component tests**

With mocked auth, catalog, and player services, verify catalog loading, six stable rows, play activation, clip labels, wrong guess, skip, correct guess, loss, full-track result playback, `Play another`, streak persistence, source switching, stale request cancellation, expired-token login state, and interrupted-action resumption.

```tsx
await user.click(screen.getByRole('button', { name: 'Play 1 second clip' }));
expect(player.activate).toHaveBeenCalledBefore(player.playClip);
await user.click(screen.getByRole('button', { name: 'Skip +1s' }));
expect(screen.getByRole('button', { name: 'Play 2 second clip' })).toBeVisible();
```

- [ ] **Step 2: Run tests and verify the workflow is incomplete**

Run: `npm test -- --run src/components/GameScreen.test.tsx`

Expected: FAIL because the integrated game UI does not exist.

- [ ] **Step 3: Implement the authenticated workflow**

Create the player exactly once after auth, load catalogs with request IDs and abort signals, derive guess options locally from the loaded catalog, keep attempt-row dimensions stable, pause before every source/round transition, and dispatch typed recovery states for every rejected boundary.

- [ ] **Step 4: Verify and commit the complete workflow**

Run: `npm test -- --run src/components/GameScreen.test.tsx src/app && npm run typecheck`

Expected: source, player, game, result, switching, and auth-resume tests pass.

```bash
git add src/app src/components
git commit -m "Integrate the complete Heardle game flow"
```

### Task 9: Apply The Responsive Listening-Studio Design

**Files:**
- Create: `src/styles/global.css`
- Modify: `src/main.tsx`
- Modify: all `src/components/*.tsx` requiring class names
- Test: `src/components/responsive.test.tsx`

**Interfaces:**
- Produces: the accepted near-black responsive visual system with stable desktop and mobile dimensions.

- [ ] **Step 1: Write failing structural responsive tests**

Assert one `main`, a compact `header`, accessible icon labels, no fixed 700px controls, stable six-row markup, source dialog semantics, artwork dimensions, and reduced-motion support.

- [ ] **Step 2: Run tests and verify design tokens are absent**

Run: `npm test -- --run src/components/responsive.test.tsx`

Expected: FAIL because the final structure and stylesheet are missing.

- [ ] **Step 3: Implement the tokenized stylesheet**

Define exact tokens:

```css
:root {
  color-scheme: dark;
  --bg: #0d0f0e;
  --surface: #151816;
  --surface-raised: #1b1f1c;
  --text: #f4f6f4;
  --muted: #9ca39e;
  --border: #343a36;
  --accent: #1ed760;
  --accent-strong: #18b950;
  --danger: #e45b5b;
  --radius: 8px;
  --content: 42rem;
}
```

Use grid/flex constraints, `minmax(0, 1fr)`, `width: min(100% - 32px, var(--content))`, fixed attempt-row minimum heights, square artwork, 44px controls, focus-visible outlines, `overflow-wrap: anywhere` for configuration values, and a `prefers-reduced-motion` block. Do not use viewport-scaled font sizes, negative letter spacing, gradients, nested cards, or decorative blobs.

- [ ] **Step 4: Verify structural tests and production build**

Run: `npm test -- --run src/components/responsive.test.tsx && npm run build`

Expected: responsive structure tests pass and Vite builds without CSS warnings.

- [ ] **Step 5: Commit the accepted visual system**

```bash
git add src/styles src/main.tsx src/components
git commit -m "Redesign Heardle as a listening studio"
```

### Task 10: Browser QA, Migration Cleanup, And Documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md` only where commands and structure are stale
- Delete after verification: `public/views/`
- Delete after verification: `public/js/`
- Delete after verification: `public/css/`
- Retain: `public/icon.png`
- Modify: `graphify-out/*` through `graphify update .`

**Interfaces:**
- Produces: a clean repository, reproducible setup instructions, verified Vercel routes, and an updated code graph.

- [ ] **Step 1: Run the complete automated gate before deleting legacy code**

Run: `npm run check`

Expected: typecheck, API syntax, all Vitest tests, and production build pass.

- [ ] **Step 2: Start the production-like local server**

Run: `npx vercel dev --listen 3000`

Expected: `/`, `/game`, `/api/status`, and static Vite assets respond successfully. Missing credentials render the configuration screen in the app rather than a raw error page.

- [ ] **Step 3: Verify desktop and mobile browser states**

Use Browser/IAB first. If unavailable, record the failure and use installed Chromium Playwright. Capture 1440x900 and 390x844 screenshots for configuration, login, active game with mocked or live Spotify boundaries, and result state. Verify:

```text
PASS page identity and meaningful content
PASS no framework overlay
PASS no relevant console errors
PASS no horizontal overflow: document.documentElement.scrollWidth <= window.innerWidth
PASS seven source options and searchable keyboard flow
PASS play -> skip -> longer clip -> guess -> result -> play another
PASS source switching cancels the old load
PASS auth expiry exposes login and resumes the action
```

- [ ] **Step 4: Remove legacy code and rerun the same gate**

Delete only the verified legacy views, scripts, and CSS. Run: `npm run check`

Expected: no build or test references to deleted files and all checks still pass.

- [ ] **Step 5: Rewrite the setup and deployment documentation**

Document `cp .env.example .env.local`, Spotify dashboard callback configuration, `npm install`, `npx vercel dev`, `npm test`, `npm run check`, Vercel environment variables, Premium requirement, all seven sources, and the fact that live playback verification requires a configured Premium account.

- [ ] **Step 6: Update graphify and inspect repository changes**

Run: `graphify update .`

Run: `git status --short && git diff --check && git diff --stat`

Expected: graph update succeeds, no whitespace errors, no generated tokens or credentials, and only intended rewrite files remain.

- [ ] **Step 7: Commit migration cleanup**

```bash
git add README.md AGENTS.md public src api package.json package-lock.json index.html tsconfig.json tsconfig.app.json vite.config.ts vercel.json graphify-out
git commit -m "Complete reliable Heardle rewrite"
```

- [ ] **Step 8: Run the final verification gate from a clean process**

Run: `npm run check`

Run the same desktop and mobile browser smoke flow against a freshly started Vercel dev server.

Expected: all automated checks pass; browser screenshots show no clipping, overflow, console errors, or broken interactions; the only remaining unverified boundary, if credentials are absent, is live Spotify OAuth and Premium playback.
