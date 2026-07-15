# Global Song Search, Spotify URLs, and Account Errors

## Goal

Make every song-guess interaction search Spotify's global track catalog, accept pasted Spotify track and playlist resources wherever relevant, and replace generic account-specific Spotify failures with accurate recovery instructions.

The selected source remains the answer pool. Global search only broadens the set of valid guesses.

## Resource Input

Add one pure Spotify resource parser shared by source selection and guessing. It accepts:

- `https://open.spotify.com/track/{id}`
- `https://open.spotify.com/playlist/{id}`
- localized URLs such as `https://open.spotify.com/intl-th/track/{id}`
- the same URLs with query strings or fragments
- `spotify:track:{id}` and `spotify:playlist:{id}` URIs

Only the `open.spotify.com` host and Spotify track/playlist URIs are trusted. Short redirect links such as `spotify.link` are not resolved because that would require a new server-side redirect service.

Pasted resource types override the active search mode:

- A playlist resource selects that playlist as the source.
- A track resource selects the exact track as a source or guess, depending on context.
- Unsupported or malformed resources produce a specific inline error.

## Global Track Search

Add a reusable debounced track combobox backed by Spotify `GET /search?type=track&limit=10`. It displays normalized track title, artists, album artwork, and supports keyboard selection, cancellation, loading, empty, retry, and disabled states.

`GameScreen` will use this combobox instead of rendering `state.tracks` in a `<select>`. Submission passes the chosen global `Track` directly to the game engine. Correctness continues to use Spotify track ID, with the existing normalized label fallback. The chosen game source remains unchanged and continues to supply only possible answers.

The source picker keeps its existing global search behavior. Its input gains resource parsing before normal text search so track and playlist URLs are resolved directly even when the active mode differs.

## Current Spotify API Compatibility

Update catalog requests to the current Development Mode API:

- Use `GET /playlists/{id}/items?limit=50` instead of `/tracks?limit=100`.
- Continue reading playlist wrapper objects defensively, accepting current and transitional item shapes where needed.
- Reduce artist-mix track search from 50 to 10 results.
- Add `playlist-read-private` and `playlist-read-collaborative` OAuth scopes, requiring existing users to reconnect once.

Spotify currently permits playlist-item access only when the authenticated user owns or collaborates on the playlist. Public playlists that do not meet that rule can be identified by URL but cannot be used as answer pools. The UI must state this limitation on a 403 instead of implying the URL is invalid.

## Account Validation and Error Handling

After OAuth authentication, validate the token with `GET /me` before loading sources or preparing playback.

- A generic 403 from `/me` means the account is not authorized for this Development Mode app. Show instructions to add the Spotify email in Developer Dashboard > App > Settings > Users Management, then reconnect.
- A non-Premium product value or Web Playback SDK `account_error` shows that Spotify Premium is required.
- A 403 from playlist items after account validation explains that the playlist must be owned by or collaborative with the current user.
- A 429 retains retry timing.
- Other Spotify failures include the HTTP status and any safe Spotify message instead of collapsing to `Spotify request failed.`

The application cannot modify Spotify's allowlist itself. The owner must add each tester manually; Development Mode currently supports up to five authorized users.

## Token Refresh

When Spotify returns 401, the client retries exactly once with a forced refresh. The force flag must propagate to `/api/token`, and the server must bypass a nominally fresh access-token cookie and exchange the refresh token. A failed refresh clears auth cookies and returns the existing reconnect action.

## Components and Boundaries

- `spotifyResource`: pure parsing and validation only.
- `catalog`: global track search, exact resource resolution, and answer-pool loading.
- `TrackSearch`: accessible reusable combobox and async UI state.
- `GameScreen`: round interaction and submission of a selected track.
- `SourcePicker`: source-mode UI plus mode-independent pasted resource handling.
- `spotifyClient`: HTTP response normalization and one-time 401 retry.
- auth API/client: forced refresh propagation and account validation orchestration.

No unrelated game-state or visual redesign is included.

## Testing

Use test-driven implementation with these regression groups:

- Parser matrix for valid localized URLs, query strings, fragments, URIs, malformed IDs, wrong hosts, and unsupported resource types.
- Catalog tests for global track search normalization, exact track/playlist resolution, `/items?limit=50` pagination, and search limit 10.
- Track combobox tests for debounce, stale-request cancellation, keyboard/mouse selection, paste resolution, retry, and disabled state.
- Game tests proving a guess outside the answer source can be submitted and scored.
- Source-picker tests proving pasted track/playlist resources override active mode and surface type/access errors.
- Spotify-client tests for allowlist 403, inaccessible-playlist 403, Premium messaging, preserved upstream messages, and single forced 401 refresh.
- API tests proving forced refresh bypasses the fresh cookie and required OAuth scopes are requested.
- Integration coverage from authenticated startup through account validation, source loading, global guessing, and playback.

Final verification runs `graphify update .` and `npm run check`, followed by a scoped commit and push.
