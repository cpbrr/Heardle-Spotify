import { describe, expect, it } from 'vitest';
import { parseSpotifyResource } from './spotifyResource';

describe('parseSpotifyResource', () => {
  it.each([
    ['https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh', 'track', '4iV5W9uYEdYUVa79Axb7Rh'],
    ['https://open.spotify.com/intl-th/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x#top', 'playlist', '37i9dQZF1DXcBWIGoYBM5M'],
    ['spotify:track:4iV5W9uYEdYUVa79Axb7Rh', 'track', '4iV5W9uYEdYUVa79Axb7Rh'],
  ])('parses %s', (input, resourceType, id) => {
    expect(parseSpotifyResource(input)).toMatchObject({ kind: 'resource', resourceType, id });
  });

  it.each(['https://evil.example/track/abc', 'https://spotify.link/abc', 'spotify:album:abc'])('rejects unsupported resource %s', (input) => {
    expect(parseSpotifyResource(input)).toMatchObject({ kind: 'invalid' });
  });

  it('leaves ordinary search text alone', () => {
    expect(parseSpotifyResource('Dreams Fleetwood Mac')).toEqual({ kind: 'text' });
  });
});
