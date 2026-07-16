import { AppError } from '../auth/authClient';
import { spotifyClient, type SpotifyApiClient } from './spotifyClient';

export const SPOTIFY_PREMIUM_REQUIRED_MESSAGE = 'Spotify Premium is required for playback.';

interface SpotifyProfile {
  product?: string;
}

export async function validateSpotifyAccount(
  signal?: AbortSignal,
  client: SpotifyApiClient = spotifyClient,
): Promise<void> {
  const profile = await client.request<SpotifyProfile>('/me', { signal });
  if (profile.product !== 'premium') {
    throw new AppError(SPOTIFY_PREMIUM_REQUIRED_MESSAGE, {
      code: 'spotify_premium_required',
      status: 403,
    });
  }
}
