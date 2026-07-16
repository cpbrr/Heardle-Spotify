# Game Controls, Search Selection, Results, and Playlist Recovery

## Goal

Make a round easier to control and understand: players can abandon the current song immediately, see which search result they chose, receive a concise global result list, and always see the answer artwork. Playlist failures must distinguish recoverable authorization problems from Spotify's playlist-access restriction instead of incorrectly blaming playlist ownership.

## Round Controls

The existing `Skip +1s` control remains unchanged and consumes one attempt to unlock the next clip length. A separate `Skip song` control pauses playback, calls the existing immediate-loss game transition, and completes the round through the same callback used by a final incorrect guess or exhausted skip. The result screen therefore appears immediately, the streak resets through the existing completion path, and playback is stopped before the round is marked complete. If pausing fails because authentication expired, the existing recovery flow runs and the round is not completed prematurely.

## Track Search

Global track search remains independent of the chosen answer source. Spotify track queries return at most five suggestions for both the in-round guess search and the `Specific track` source search. Artist, album, and playlist source-result limits remain unchanged.

Choosing a track keeps its result row visibly selected with the green accent treatment. Keyboard focus/active-option styling remains distinguishable from the persistent chosen state, and the selected result exposes `aria-selected=true`. Editing the query clears the chosen track immediately, clears the parent guess, removes stale options, and retains the existing request-abort protection. Selecting a different result moves the persistent highlight to that result.

## Result Artwork

`ResultView` receives the answer track's `imageUrl` in addition to title and artist. It renders the album/song cover for both wins and losses with descriptive alternative text. If Spotify supplies no image, the existing square artwork placeholder remains so the result layout does not collapse. `App` passes `round.answer.imageUrl` into the result component.

## Playlist Authorization Recovery

The current client maps every playlist-items `403` to an ownership/collaboration error. That is too broad: a token issued before the playlist scopes were added can produce the same status for a playlist the user owns.

Playlist-items `403` errors will become reconnectable and explain both likely causes without falsely claiming ownership is the only cause. The message tells the user to reconnect Spotify to grant playlist access and notes that Spotify permits playlists the account owns or collaborates on. The error carries `/api/login` so the existing failed-state UI displays `Connect Spotify`. Reconnecting obtains the currently configured private and collaborative playlist scopes. Specialized `/me`, rate-limit, and ordinary upstream mappings remain unchanged.

## Testing

- Game-engine/component tests verify `Skip song` pauses, immediately loses, calls round completion, and preserves auth recovery on pause failure.
- Catalog tests verify track searches use a five-result Spotify limit while non-track source limits remain unchanged.
- Track-search tests verify persistent selected-row styling/ARIA, moving selection, and clearing selection on edit.
- Result tests verify artwork for wins and losses plus the no-image fallback.
- Spotify-client/App tests verify playlist `403` supplies the combined reconnect message and `/api/login` recovery path.
- Full verification runs typecheck, API syntax checks, all Vitest tests, the production build, Graphify update, and diff/remote-head checks.

## Out of Scope

- Changing the six Heardle clip lengths or the behavior of `Skip +1s`.
- Restricting guesses to the selected playlist or source.
- Attempting to bypass Spotify Development Mode, Premium, ownership, or collaboration requirements.
- Redesigning the broader game or result layout.
