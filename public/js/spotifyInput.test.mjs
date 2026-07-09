import assert from 'node:assert/strict';
import { normalizeSpotifyId } from './spotifyInput.js';

assert.equal(normalizeSpotifyId('abc123', 'track'), 'abc123');
assert.equal(normalizeSpotifyId(' spotify:track:4iV5W9uYEdYUVa79Axb7Rh ', 'track'), '4iV5W9uYEdYUVa79Axb7Rh');
assert.equal(normalizeSpotifyId('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=test', 'track'), '4iV5W9uYEdYUVa79Axb7Rh');
assert.equal(normalizeSpotifyId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', 'playlist'), '37i9dQZF1DXcBWIGoYBM5M');
assert.equal(normalizeSpotifyId('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', 'playlist'), '37i9dQZF1DXcBWIGoYBM5M');
assert.equal(normalizeSpotifyId('spotify:album:abc123', 'track'), 'spotify:album:abc123');
