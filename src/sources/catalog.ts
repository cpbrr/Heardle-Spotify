import { AppError } from '../auth/authClient';
import { parseSpotifyResource } from '../spotify/spotifyResource';
import type { SourceDescriptor, Track } from '../spotify/types';
import { spotifyClient } from '../spotify/spotifyClient';

const MAX_TRACKS = 500;
const MAX_ARTIST_RELEASES = 100;

export interface CatalogExclusions {
  duplicates: number;
  unavailable: number;
  unsupported: number;
}

export interface CatalogResult {
  tracks: Track[];
  exclusions: CatalogExclusions;
}

export interface SpotifyApiClient {
  request<T = unknown>(path: string, options?: RequestInit): Promise<T>;
}

interface AlbumContext {
  name: string;
  imageUrl: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function firstImage(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const image = record(value[0]);
  return typeof image?.url === 'string' ? image.url : null;
}

export function normalizeTrack(value: unknown, albumContext?: AlbumContext): Track | null {
  const track = record(value);
  if (!track || track.type !== 'track' || track.is_local === true || track.is_playable === false) {
    return null;
  }
  if (typeof track.id !== 'string' || typeof track.uri !== 'string' || typeof track.name !== 'string') {
    return null;
  }
  if (!track.uri.startsWith('spotify:track:') || !Array.isArray(track.artists)) {
    return null;
  }

  const artists = track.artists
    .map((artist) => record(artist)?.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
  if (!artists.length) {
    return null;
  }

  const album = record(track.album);
  const durationMs = Number(track.duration_ms);
  return {
    id: track.id,
    uri: track.uri,
    title: track.name,
    artists,
    artistText: artists.join(', '),
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0,
    album: typeof album?.name === 'string' ? album.name : albumContext?.name || '',
    imageUrl: firstImage(album?.images) || albumContext?.imageUrl || null,
  };
}

function exclusionReason(value: unknown): 'unavailable' | 'unsupported' {
  const track = record(value);
  if (!track || track.is_playable === false || typeof track.id !== 'string' || typeof track.uri !== 'string') {
    return 'unavailable';
  }
  return 'unsupported';
}

function collectTrack(
  value: unknown,
  tracks: Map<string, Track>,
  exclusions: CatalogExclusions,
  albumContext?: AlbumContext,
) {
  const normalized = normalizeTrack(value, albumContext);
  if (!normalized) {
    exclusions[exclusionReason(value)] += 1;
    return;
  }
  if (tracks.has(normalized.id)) {
    exclusions.duplicates += 1;
    return;
  }
  if (tracks.size < MAX_TRACKS) {
    tracks.set(normalized.id, normalized);
  }
}

async function collectPages(
  firstPath: string,
  unwrap: (item: unknown) => unknown,
  tracks: Map<string, Track>,
  exclusions: CatalogExclusions,
  signal: AbortSignal | undefined,
  client: SpotifyApiClient,
  albumContext?: AlbumContext,
) {
  let path: string | null = firstPath;
  while (path && tracks.size < MAX_TRACKS) {
    const page: { items?: unknown[]; next?: string | null } = await client.request(path, { signal });
    for (const item of page.items || []) {
      collectTrack(unwrap(item), tracks, exclusions, albumContext);
      if (tracks.size >= MAX_TRACKS) {
        break;
      }
    }
    path = page.next || null;
  }
}

export async function loadCatalog(
  source: SourceDescriptor,
  signal?: AbortSignal,
  client: SpotifyApiClient = spotifyClient,
): Promise<CatalogResult> {
  const tracks = new Map<string, Track>();
  const exclusions: CatalogExclusions = { duplicates: 0, unavailable: 0, unsupported: 0 };

  switch (source.kind) {
    case 'artist-mix': {
      const query = encodeURIComponent(`artist:${source.name}`);
      const response: { tracks?: { items?: unknown[]; next?: string | null } } = await client.request(
        `/search?q=${query}&type=track&limit=10`,
        { signal },
      );
      for (const item of response.tracks?.items || []) {
        collectTrack(item, tracks, exclusions);
      }
      break;
    }
    case 'artist-discography': {
      let releasesPath: string | null = `/artists/${source.id}/albums?include_groups=album%2Csingle&limit=50`;
      let releaseCount = 0;
      while (releasesPath && releaseCount < MAX_ARTIST_RELEASES && tracks.size < MAX_TRACKS) {
        const releases: { items?: unknown[]; next?: string | null } = await client.request(releasesPath, { signal });
        for (const value of releases.items || []) {
          const album = record(value);
          if (typeof album?.id !== 'string') {
            continue;
          }
          releaseCount += 1;
          await collectPages(
            `/albums/${album.id}/tracks?limit=50`,
            (item) => item,
            tracks,
            exclusions,
            signal,
            client,
            {
              name: typeof album.name === 'string' ? album.name : '',
              imageUrl: firstImage(album.images),
            },
          );
          if (releaseCount >= MAX_ARTIST_RELEASES || tracks.size >= MAX_TRACKS) {
            break;
          }
        }
        releasesPath = releases.next || null;
      }
      break;
    }
    case 'playlist':
      await collectPages(
        `/playlists/${source.id}/items?limit=50`,
        (item) => record(item)?.item || record(item)?.track,
        tracks,
        exclusions,
        signal,
        client,
      );
      break;
    case 'album': {
      const album: Record<string, unknown> = await client.request(`/albums/${source.id}`, { signal });
      const albumTracks = record(album.tracks);
      const context = {
        name: typeof album.name === 'string' ? album.name : source.name,
        imageUrl: firstImage(album.images) || source.imageUrl,
      };
      for (const item of Array.isArray(albumTracks?.items) ? albumTracks.items : []) {
        collectTrack(item, tracks, exclusions, context);
      }
      let next = typeof albumTracks?.next === 'string' ? albumTracks.next : null;
      if (next) {
        await collectPages(next, (item) => item, tracks, exclusions, signal, client, context);
      }
      break;
    }
    case 'track': {
      const value = await client.request(`/tracks/${source.id}`, { signal });
      collectTrack(value, tracks, exclusions);
      break;
    }
    case 'top':
      await collectPages('/me/top/tracks?limit=50', (item) => item, tracks, exclusions, signal, client);
      break;
    case 'liked':
      await collectPages('/me/tracks?limit=50', (item) => record(item)?.track, tracks, exclusions, signal, client);
      break;
  }

  return { tracks: Array.from(tracks.values()), exclusions };
}

export async function searchTracks(
  query: string,
  signal?: AbortSignal,
  client: SpotifyApiClient = spotifyClient,
): Promise<Track[]> {
  const parsed = parseSpotifyResource(query);
  if (parsed.kind === 'invalid') {
    throw new AppError(parsed.message, { code: 'invalid_spotify_resource' });
  }
  if (parsed.kind === 'resource') {
    if (parsed.resourceType !== 'track') {
      throw new AppError('Paste playlist links in the source picker.', { code: 'wrong_spotify_resource_type' });
    }
    const exact = normalizeTrack(await client.request(`/tracks/${parsed.id}`, { signal }));
    return exact ? [exact] : [];
  }
  if (query.trim().length < 2) {
    return [];
  }

  const response = await client.request<{ tracks?: { items?: unknown[] } }>(
    `/search?q=${encodeURIComponent(query.trim())}&type=track&limit=10`,
    { signal },
  );
  return (response.tracks?.items || []).flatMap((item) => {
    const track = normalizeTrack(item);
    return track ? [track] : [];
  });
}
export async function searchSources(
  kind: SourceDescriptor['kind'],
  query: string,
  signal?: AbortSignal,
  client: SpotifyApiClient = spotifyClient,
): Promise<SourceDescriptor[]> {
  const parsed = parseSpotifyResource(query);
  if (parsed.kind === 'invalid') {
    throw new AppError(parsed.message, { code: 'invalid_spotify_resource' });
  }
  if (parsed.kind === 'resource') {
    const value = record(await client.request(`/${parsed.resourceType}s/${parsed.id}`, { signal }));
    if (!value || typeof value.id !== 'string' || typeof value.name !== 'string') {
      return [];
    }
    const album = record(value.album);
    return [{
      kind: parsed.resourceType,
      id: value.id,
      name: value.name,
      imageUrl: firstImage(value.images) || firstImage(album?.images),
    }];
  }
  if (kind === 'top' || kind === 'liked' || query.trim().length < 2) {
    return [];
  }

  const type = kind.startsWith('artist') ? 'artist' : kind;
  const response: Record<string, unknown> = await client.request(
    `/search?q=${encodeURIComponent(query.trim())}&type=${type}&limit=8`,
    { signal },
  );
  const bucket = record(response[`${type}s`]);
  const items = Array.isArray(bucket?.items) ? bucket.items : [];

  return items.flatMap((value) => {
    const item = record(value);
    if (typeof item?.id !== 'string' || typeof item.name !== 'string') {
      return [];
    }
    const album = record(item.album);
    return [{
      kind,
      id: item.id,
      name: item.name,
      imageUrl: firstImage(item.images) || firstImage(album?.images),
    } as SourceDescriptor];
  });
}
