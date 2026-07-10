# Heardle Spotify Rewrite Design

**Date:** 2026-07-10
**Status:** Approved

## Objective

Replace the current partially migrated Heardle application with a reliable, responsive Spotify Premium game that works in Vercel production and local development. Preserve all seven song-source modes, replace raw identifier entry with searchable selection where Spotify supports it, and keep unlimited rounds with a locally persisted streak.

## Confirmed Product Decisions

- Deploy to Vercel and support the same flow through `vercel dev` locally.
- Require Spotify Premium and explain that requirement before login.
- Retain artist name, artist, playlist, album, specific track, top tracks, and liked tracks sources.
- Use searchable selectors for artists, playlists, albums, and tracks rather than requiring Spotify IDs.
- Let players switch the active source from the game header.
- Use unlimited rounds and persist the current streak locally.
- Use a modern listening-studio visual direction: near-black surfaces, crisp typography, waveform-led playback, restrained Spotify green, and album artwork as the primary color moment.

## Technical Architecture

### Frontend

Build a React, Vite, and TypeScript single-page application. Vercel rewrites `/` and `/game` to the generated app entry so authenticated redirects and bookmarked game URLs work consistently.

The frontend is divided into focused domains:

- `auth`: load configuration and session status, request tokens, start login, log out, and recover from expired authentication.
- `sources`: define the seven source types, manage searchable source selection, and persist the active source.
- `spotify`: perform typed Spotify Web API requests, follow pagination safely, normalize responses, deduplicate tracks, and reject unplayable items.
- `player`: own Spotify Web Playback SDK loading, device readiness, activation, playback, pause, seek, and recoverable device errors.
- `game`: select a round track, manage six attempts and progressive clip lengths, compare guesses, complete rounds, and update the streak.
- `ui`: provide reusable buttons, dialogs, comboboxes, status messages, attempt rows, artwork, and playback controls.

A central reducer controls the application states:

1. `checking-auth`
2. `needs-configuration` or `needs-login`
3. `choosing-source`
4. `loading-catalog`
5. `preparing-player`
6. `ready`
7. `playing`
8. `round-complete`
9. a typed recoverable error state that records the interrupted action

State transitions are explicit. Network requests use `AbortController` and monotonically increasing request IDs so old requests cannot overwrite a newer source or round. React components render state but do not issue raw Spotify commands directly.

### Backend

Keep Spotify OAuth and token refresh in Vercel Functions under `api/`.

- `/api/status` reports credential configuration and whether refreshable authentication exists.
- `/api/login` creates a state value and redirects to Spotify authorization.
- `/api/callback` validates state, exchanges the code, sets secure HTTP-only cookies, and redirects to the app.
- `/api/token` returns a current access token, refreshing it when necessary.
- `/api/logout` clears all auth cookies.

The backend accepts the root environment variables `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and optional `SPOTIFY_REDIRECT_URI`. A checked-in `.env.example` documents the local setup. Legacy `public/.env` and runtime HTML mutation are removed from the supported architecture.

Cookies use `HttpOnly`, `SameSite=Lax`, `Secure` in production, explicit paths, and bounded lifetimes. Backend errors return a consistent JSON shape with `code`, `message`, `retryable`, and optional `loginUrl`.

## Data Flow

### Startup And Authentication

1. The app requests `/api/status`.
2. Missing server credentials render an actionable configuration screen with the exact callback URI.
3. A configured but unauthenticated session renders `Connect Spotify` and the Premium requirement.
4. After OAuth callback, the app resumes source selection or the last interrupted action.
5. Token requests are deduplicated while in flight but are not cached indefinitely. A 401 clears the cached promise, opens the login state, and records the action to resume.

### Source Selection And Catalog Loading

The source picker lists seven modes:

- Artist search
- Artist catalog
- Playlist
- Album
- Specific track
- My top tracks
- My liked songs

Search inputs debounce requests, cancel stale searches, show artwork and useful metadata, and support keyboard navigation. Playlist and library endpoints follow Spotify pagination until a configurable safe limit. Track normalization produces one internal shape with ID, URI, title, artists, duration, artwork, album, and playability. Null tracks, local files, unavailable market items, episodes, and duplicates are excluded with counts retained for an informative empty state.

The active source descriptor is persisted in local storage. Switching sources cancels loading and playback, loads the new catalog, and begins a fresh round only after usable tracks exist.

### Round And Playback

Each round selects a track without immediately repeating recently played track IDs. The recent-history window is bounded and stored locally per source.

The six clip limits are 1, 2, 4, 7, 11, and 16 seconds. Play always seeks to the beginning and stops at the active limit. Skip consumes the current attempt and unlocks the next clip. A wrong guess consumes an attempt. A correct guess completes the round. Giving up records a loss.

Guess suggestions come from the already loaded catalog, so typing does not trigger a Spotify request. Comparison uses normalized track IDs where available and normalized title/artist text as a fallback. The UI never exposes the answer before the round completes.

The player activates from the user's click before sending the Spotify play request. Device creation, transfer, seek, play, pause, and end-of-clip timers live behind one player service. Timers are cleared on pause, source changes, unmount, auth expiry, and round completion.

## Interface Design

### Application Shell

Use a compact header with the Heardle wordmark, active source switcher, and streak. Avoid marketing navigation, stats widgets, decorative badges, and icon clutter. The app content remains a narrow readable column on desktop and uses the full safe viewport width on mobile.

### Setup States

The disconnected screen contains:

- Heardle
- `Connect your Spotify Premium account to play.`
- `Connect Spotify`
- configuration guidance only when credentials are missing

Configuration details wrap within the viewport and provide copy controls for environment variable names and the redirect URI.

### Source Picker

Use an accessible dialog on desktop and a full-width drawer on mobile. Present source types as a concise list, not a decorative card grid. Searchable modes reveal a combobox with debounced results, artwork, title, secondary metadata, loading, empty, and failure states. Top and liked tracks can be selected immediately.

### Game Screen

The stable vertical composition is:

1. compact header
2. six attempt rows with fixed dimensions
3. progressive clip timeline or waveform
4. current and maximum time
5. centered play/pause control
6. searchable guess combobox
7. `Skip +Ns` and `Submit` actions
8. a quiet `Give up` action

Attempt rows show incorrect guesses, skipped attempts, and the correct attempt without resizing. The timeline segments reflect the six clip lengths and remain seek-disabled until the round ends.

### Result State

After a win or loss, reveal album artwork, title, artist, outcome, and streak. Keep playback available for the full track and present `Play another` as the primary action. Source switching remains available.

### Visual System

- Background: near-black, not tinted navy.
- Text: off-white with neutral gray secondary text.
- Accent: Spotify green only for primary actions, focus, progress, and correct outcomes.
- Error: restrained red for incorrect attempts and failures.
- Borders: subtle neutral gray.
- Radius: no more than 8px for panels and repeated items.
- Typography: clean sans-serif UI with a restrained display treatment for the product name; no viewport-scaled type or negative letter spacing.
- Imagery: real Spotify album artwork with stable square dimensions and meaningful alt text.
- Motion: short state transitions and progress movement, disabled by `prefers-reduced-motion`.

All controls fit at 390 by 844 pixels without horizontal scrolling. Buttons and icon controls have stable touch targets, visible focus states, and tooltips where the icon meaning is not obvious.

## Reliability And Error Recovery

Every asynchronous boundary produces an explicit state and recovery action:

- Missing credentials: show variables and callback URI; do not send the user to a raw 500 response.
- Login required or expired: show login, preserve the interrupted source or playback action, and resume after callback.
- Spotify rate limit: honor `Retry-After`, show a retry countdown, and avoid parallel retry storms.
- Search failure: preserve the query and allow retry.
- Empty source: report why items were excluded and return to source selection.
- SDK load failure: retry SDK loading without reloading the whole page.
- Premium or account restriction: explain the requirement and allow account switching.
- Device not ready: wait with a bounded timeout, then offer retry.
- Playback command failure: restore the correct paused UI and expose a retry action.
- Offline state: disable network-dependent actions and retry when connectivity returns.

No expected failure is represented only by a console log. Diagnostic logs avoid tokens, secrets, cookies, and complete Spotify payloads.

## Performance

- Vite produces hashed, cacheable assets and code splits the source picker and game screen.
- Spotify SDK loading begins only after authentication and is reused for the session.
- Source searches are debounced and cancellable.
- Catalog pagination is bounded and concurrent requests are limited.
- Normalized catalog indexes provide constant-time deduplication and fast local guess filtering.
- React state is scoped so playback progress does not rerender the full app.
- Artwork uses fixed dimensions, lazy loading outside the first viewport, and Spotify-provided image sizes.

## Testing Strategy

### Unit Tests

- source validation and persistence
- Spotify input normalization
- catalog normalization, deduplication, pagination, and playable filtering
- guess comparison
- recent-track selection
- reducer transitions
- clip timing and timer cleanup
- OAuth cookie serialization and configuration
- token refresh, concurrent token requests, and 401 recovery

### Component Tests

- setup and login states
- searchable source picker keyboard flow
- attempt progression and result reveal
- recoverable error actions
- responsive control labels and accessible names

### Integration Tests

Mock Spotify HTTP and Web Playback SDK boundaries to verify:

- login status to source selection
- searchable source to catalog loading
- player readiness to a playable round
- wrong guess, skip, correct guess, and loss
- source switching during an in-flight request
- expired authentication and action resumption

### Browser Verification

Run the production-like Vercel dev server and verify desktop at 1440 by 900 and mobile at 390 by 844. Check page identity, meaningful content, console errors, setup state, source selection, six-attempt game flow, playback state changes, result state, source switching, token expiry recovery, and absence of horizontal overflow. Capture screenshots for the disconnected, active game, result, and mobile states.

Live Spotify verification requires configured credentials and a Spotify Premium account. Automated tests cover the same boundaries with deterministic mocks so CI does not depend on Spotify availability.

## Migration And Cleanup

- Replace the existing static views and direct DOM scripts with the Vite application.
- Preserve only the icon and any reusable brand assets that pass visual review.
- Replace legacy CSS with a tokenized responsive stylesheet.
- Retain the Vercel OAuth endpoints after rewriting them to the consistent error contract and adding tests.
- Remove obsolete `public/views`, legacy game scripts, stale Font Awesome emulation, and old environment instructions after the new route is verified.
- Update `README.md`, `AGENTS.md` where necessary, Vercel configuration, package scripts, and graphify output.

## Acceptance Criteria

- A new clone can run after creating `.env.local` from `.env.example` and executing the documented commands.
- Missing configuration renders an actionable in-app state rather than a raw HTTP error.
- OAuth secrets and refresh tokens never enter browser-readable storage.
- All seven source modes work through searchable or direct selection.
- Playback starts from a user gesture, stops at the current clip limit, and recovers from device and token failures.
- Six attempts, skipping, guessing, win/loss, full-track reveal, replay, source switching, and persistent streak work without a page reload.
- Desktop and 390px mobile layouts have no overlap, clipping, or horizontal scrolling.
- Unit, component, integration, syntax, build, and browser smoke checks pass.
- `graphify update .` completes after the rewrite.
