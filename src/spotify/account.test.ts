import { describe, expect, it, vi } from 'vitest';

import { validateSpotifyAccount } from './account';

describe('validateSpotifyAccount', () => {
  it('accepts Premium accounts', async () => {
    const client = { request: vi.fn().mockResolvedValue({ product: 'premium' }) };

    await expect(validateSpotifyAccount(undefined, client)).resolves.toBeUndefined();
    expect(client.request).toHaveBeenCalledWith('/me', { signal: undefined });
  });

  it('rejects non-Premium accounts before player setup', async () => {
    const client = { request: vi.fn().mockResolvedValue({ product: 'free' }) };

    await expect(validateSpotifyAccount(undefined, client)).rejects.toMatchObject({
      code: 'spotify_premium_required',
      message: 'Spotify Premium is required for playback.',
    });
  });
});
