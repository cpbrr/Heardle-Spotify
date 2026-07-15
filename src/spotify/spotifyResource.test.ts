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
