export type SpotifyResourceType = 'track' | 'playlist';
export type SpotifyResourceParseResult =
  | { kind: 'text' }
  | { kind: 'invalid'; message: string }
  | { kind: 'resource'; resourceType: SpotifyResourceType; id: string };

const ID_PATTERN = /^[A-Za-z0-9]{10,64}$/;

export function parseSpotifyResource(input: string): SpotifyResourceParseResult {
  const value = input.trim();
  if (!value) return { kind: 'text' };
  const uri = value.match(/^spotify:([^:]+):([^:]+)$/i);
  if (uri) return parseParts(uri[1], uri[2]);
  if (!/^https?:\/\//i.test(value)) return { kind: 'text' };
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  if (url.hostname !== 'open.spotify.com') return invalid();
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0]?.startsWith('intl-')) parts.shift();
  return parseParts(parts[0], parts[1]);
}

function parseParts(type: string | undefined, id: string | undefined): SpotifyResourceParseResult {
  if ((type !== 'track' && type !== 'playlist') || !id || !ID_PATTERN.test(id)) return invalid();
  return { kind: 'resource', resourceType: type, id };
}

function invalid(): SpotifyResourceParseResult {
  return { kind: 'invalid', message: 'Paste a valid Spotify track or playlist link.' };
}
