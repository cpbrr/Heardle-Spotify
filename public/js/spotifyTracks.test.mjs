import assert from 'node:assert/strict';
import { createTrackItem, createPlaylistTrackItem, appendUniqueTrack } from './spotifyTracks.js';

assert.deepEqual(createTrackItem({
    name: 'Song A',
    artists: [{ name: 'Artist A' }],
    uri: 'spotify:track:a',
    duration_ms: 1234,
}), {
    titel: 'Song A',
    artist: 'Artist A',
    uri: 'spotify:track:a',
    duration: 1234,
});

assert.equal(createTrackItem(null), null);
assert.equal(createTrackItem({ name: 'Local', artists: [{ name: 'Artist' }], is_local: true }), null);
assert.equal(createPlaylistTrackItem({ track: null }), null);
assert.equal(createPlaylistTrackItem({ is_local: true, track: { name: 'Local', artists: [{ name: 'Artist' }] } }), null);

const tracks = [];
appendUniqueTrack(tracks, { titel: 'Song A', artist: 'Artist A', uri: 'spotify:track:a', duration: 1234 });
appendUniqueTrack(tracks, { titel: 'Song A', artist: 'Different Artist', uri: 'spotify:track:b', duration: 5678 });
assert.equal(tracks.length, 1, 'duplicate song titles should be skipped like the existing UI behavior');
