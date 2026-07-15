import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../auth/authClient';
import { SpotifyClient } from './spotifyClient';

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('SpotifyClient', () => {
  it('authorizes Spotify Web API requests', async () => {
    const getToken = vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 });
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'me' }));
    const client = new SpotifyClient({ getToken, fetchImpl });

    await expect(client.request('/me')).resolves.toEqual({ id: 'me' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/me');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token');
  });

  it('refreshes the token and retries exactly once after a Spotify 401', async () => {
    const getToken = vi.fn()
      .mockResolvedValueOnce({ accessToken: 'expired', expiresAt: Date.now() + 60_000 })
      .mockResolvedValueOnce({ accessToken: 'fresh', expiresAt: Date.now() + 60_000 });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'me' }));
    const client = new SpotifyClient({ getToken, fetchImpl });

    await expect(client.request('/me')).resolves.toEqual({ id: 'me' });
    expect(getToken).toHaveBeenNthCalledWith(2, undefined, true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('exposes Spotify rate limits with a retry delay', async () => {
    const client = new SpotifyClient({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(429, {}, { 'Retry-After': '2' })),
    });

    await expect(client.request('/me')).rejects.toEqual(expect.objectContaining({
      code: 'spotify_rate_limited',
      retryable: true,
      retryAfterMs: 2_000,
    }));
  });

  it('converts Spotify failures to AppError instances', async () => {
    const client = new SpotifyClient({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: 'Premium required' } })),
    });

    await expect(client.request('/me/player')).rejects.toEqual(expect.objectContaining({
      code: 'spotify_forbidden',
      message: 'Premium required',
      status: 403,
    } satisfies Partial<AppError>));
  });
});
