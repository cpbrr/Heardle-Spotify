import { describe, expect, it, vi } from 'vitest';

import { loadCatalog, normalizeTrack, searchSources, searchTracks } from './catalog';
import type { SpotifyApiClient } from './catalog';
import type { SourceDescriptor } from '../spotify/types';

function spotifyTrack(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    uri: `spotify:track:${id}`,
    name: `Track ${id}`,
    type: 'track',
    is_local: false,
    is_playable: true,
    duration_ms: 180_000,
    artists: [{ name: 'Artist' }],
    album: {
      name: 'Album',
      images: [{ url: `https://images.test/${id}.jpg` }],
    },
    ...overrides,
  };
}

function fakeClient(responses: Record<string, unknown>): SpotifyApiClient {
  const request = vi.fn(async (path: string) => {
    if (!(path in responses)) {
      throw new Error(`Unexpected Spotify path: ${path}`);
    }
    return responses[path];
  });
  return { request: request as unknown as SpotifyApiClient['request'] };
}

describe('normalizeTrack', () => {
  it('creates one internal track shape', () => {
    expect(normalizeTrack(spotifyTrack('one'))).toEqual({
      id: 'one',
      uri: 'spotify:track:one',
      title: 'Track one',
      artists: ['Artist'],
      artistText: 'Artist',
      durationMs: 180_000,
      album: 'Album',
      imageUrl: 'https://images.test/one.jpg',
    });
  });

  it.each([
    [spotifyTrack('local', { is_local: true })],
    [spotifyTrack('episode', { type: 'episode' })],
    [spotifyTrack('unavailable', { is_playable: false })],
    [spotifyTrack('missing-uri', { uri: null })],
    [null],
  ])('rejects unsupported or unavailable values', (value) => {
    expect(normalizeTrack(value)).toBeNull();
  });
});

describe('loadCatalog', () => {
  it('follows playlist pagination, ignores nulls, and deduplicates tracks', async () => {
    const client = fakeClient({
      '/playlists/playlist-1/items?limit=50': {
        items: [{ item: spotifyTrack('one') }, { item: null }],
        next: 'https://api.spotify.com/v1/next-page',
      },
      'https://api.spotify.com/v1/next-page': {
        items: [{ track: spotifyTrack('one') }, { track: spotifyTrack('two') }],
        next: null,
      },
    });

    const result = await loadCatalog(
      { kind: 'playlist', id: 'playlist-1', name: 'Playlist', imageUrl: null },
      undefined,
      client,
    );

    expect(result.tracks.map((track) => track.id)).toEqual(['one', 'two']);
    expect(result.exclusions).toEqual({ duplicates: 1, unavailable: 1, unsupported: 0 });
  });

  it.each([
    [{ kind: 'artist-mix', id: 'artist-1', name: 'Artist', imageUrl: null }, '/search?q=artist%3AArtist&type=track&limit=10', { tracks: { items: [spotifyTrack('mix')], next: null } }, 'mix'],
    [{ kind: 'album', id: 'album-1', name: 'Album', imageUrl: null }, '/albums/album-1', { tracks: { items: [spotifyTrack('album')], next: null } }, 'album'],
    [{ kind: 'track', id: 'track-1', name: 'Track', imageUrl: null }, '/tracks/track-1', spotifyTrack('single'), 'single'],
    [{ kind: 'top', name: 'My top tracks', imageUrl: null }, '/me/top/tracks?limit=50', { items: [spotifyTrack('top')], next: null }, 'top'],
    [{ kind: 'liked', name: 'My liked songs', imageUrl: null }, '/me/tracks?limit=50', { items: [{ track: spotifyTrack('liked') }], next: null }, 'liked'],
  ] as const)('loads a supported source', async (source, path, payload, expectedId) => {
    const result = await loadCatalog(
      source as SourceDescriptor,
      undefined,
      fakeClient({ [path]: payload }),
    );

    expect(result.tracks.map((track) => track.id)).toEqual([expectedId]);
  });

  it('loads playable tracks across an exact artist discography', async () => {
    const client = fakeClient({
      '/artists/artist-1/albums?include_groups=album%2Csingle&limit=50': {
        items: [{ id: 'album-1', name: 'Album', images: [{ url: 'cover.jpg' }] }],
        next: null,
      },
      '/albums/album-1/tracks?limit=50': {
        items: [spotifyTrack('discography', { album: undefined })],
        next: null,
      },
    });

    const result = await loadCatalog(
      { kind: 'artist-discography', id: 'artist-1', name: 'Artist', imageUrl: null },
      undefined,
      client,
    );

    expect(result.tracks).toEqual([expect.objectContaining({
      id: 'discography',
      album: 'Album',
      imageUrl: 'cover.jpg',
    })]);
  });
});

describe('searchTracks', () => {
  it('searches the global track catalog with a five-result limit', async () => {
    const client = fakeClient({
      '/search?q=dreams&type=track&limit=5': { tracks: { items: [spotifyTrack('global')] } },
    });

    await expect(searchTracks('dreams', undefined, client)).resolves.toMatchObject([{ id: 'global' }]);
    expect(client.request).toHaveBeenCalledWith(
      '/search?q=dreams&type=track&limit=5',
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('resolves a pasted track URL exactly', async () => {
    const id = '4iV5W9uYEdYUVa79Axb7Rh';
    const client = fakeClient({ [`/tracks/${id}`]: spotifyTrack(id) });

    await expect(searchTracks(`https://open.spotify.com/track/${id}`, undefined, client)).resolves.toMatchObject([{ id }]);
  });
});

describe('searchSources', () => {
  it('uses five results for track searches', async () => {
    const client = fakeClient({
      '/search?q=dreams&type=track&limit=5': { tracks: { items: [spotifyTrack('global')] } },
    });

    await searchSources('track', 'dreams', undefined, client);

    expect(client.request).toHaveBeenCalledWith(
      '/search?q=dreams&type=track&limit=5',
      expect.anything(),
    );
  });

  it('retains eight results for album searches', async () => {
    const client = fakeClient({
      '/search?q=dreams&type=album&limit=8': { albums: { items: [] } },
    });

    await searchSources('album', 'dreams', undefined, client);

    expect(client.request).toHaveBeenCalledWith(
      '/search?q=dreams&type=album&limit=8',
      expect.anything(),
    );
  });

  it.each([
    ['playlist', 'track', '4iV5W9uYEdYUVa79Axb7Rh', spotifyTrack('4iV5W9uYEdYUVa79Axb7Rh')],
    ['track', 'playlist', 'playlist123', {
      id: 'playlist123',
      name: 'Exact playlist',
      images: [{ url: 'https://images.test/playlist.jpg' }],
    }],
  ] as const)('resolves a pasted %s-mode URL as its actual %s kind', async (activeKind, resourceKind, id, payload) => {
    const client = fakeClient({ [`/${resourceKind}s/${id}`]: payload });

    await expect(searchSources(
      activeKind,
      `https://open.spotify.com/${resourceKind}/${id}`,
      undefined,
      client,
    )).resolves.toEqual([expect.objectContaining({ kind: resourceKind, id })]);
  });
});
