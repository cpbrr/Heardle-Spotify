import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../auth/authClient';
import { SpotifyClient } from './spotifyClient';

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function clientReturning(makeResponse: () => Response) {
  return new SpotifyClient({
    getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
    fetchImpl: vi.fn().mockImplementation(async () => makeResponse()),
  });
}

describe('SpotifyClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calls the browser fetch implementation with the global receiver', async () => {
    const browserFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(jsonResponse(200, { id: 'me' }));
    });
    vi.stubGlobal('fetch', browserFetch);
    const client = new SpotifyClient({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
    });

    await expect(client.request('/me')).resolves.toEqual({ id: 'me' });
  });

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
      fetchImpl: vi.fn().mockImplementation(async () => jsonResponse(429, {}, { 'Retry-After': '2' })),
    });

    const pending = client.request('/me');
    const expectation = expect(pending).rejects.toEqual(expect.objectContaining({
      code: 'spotify_rate_limited',
      retryable: true,
      retryAfterMs: 2_000,
    }));
    await vi.advanceTimersByTimeAsync(2_000);
    await expectation;
  });

  it('converts Spotify failures to AppError instances', async () => {
    const client = new SpotifyClient({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: 'Premium required' } })),
    });

    await expect(client.request('/me/player')).rejects.toEqual(expect.objectContaining({
      code: 'spotify_forbidden',
      message: 'Premium required (HTTP 403)',
      status: 403,
    } satisfies Partial<AppError>));
  });

  it('explains an empty development-mode 403 from account validation', async () => {
    const client = clientReturning(() => new Response(null, { status: 403 }));

    await expect(client.request('/me')).rejects.toMatchObject({
      code: 'spotify_account_not_allowed',
      message: expect.stringContaining('Users Management'),
      loginUrl: '/api/login',
    });
  });

  it('reconnects Spotify for playlist authorization or ownership restrictions', async () => {
    const client = clientReturning(() => new Response(null, { status: 403 }));

    await expect(client.request('/playlists/id/items?limit=50')).rejects.toMatchObject({
      code: 'spotify_playlist_access_required',
      status: 403,
      loginUrl: '/api/login',
      message: 'Reconnect Spotify to grant playlist access. Spotify only allows playlists you own or collaborate on.',
    });
  });

  it('preserves a safe plain-text Spotify failure message', async () => {
    const client = clientReturning(() => new Response('Spotify is temporarily unavailable.', { status: 503 }));

    const pending = client.request('/me');
    const expectation = expect(pending).rejects.toMatchObject({
      code: 'spotify_request_failed',
      message: 'Spotify is temporarily unavailable. (HTTP 503)',
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(500);
    await expectation;
  });

  it.each([
    [500, '', 'Spotify request failed. (HTTP 500)'],
    [502, '<html>Bad gateway</html>', 'Spotify request failed. (HTTP 502)'],
    [400, JSON.stringify({ error: { message: 'Malformed request' } }), 'Malformed request (HTTP 400)'],
  ])('includes HTTP %s in ordinary Spotify failures', async (status, body, expectedMessage) => {
    const client = clientReturning(() => new Response(body, { status }));

    const pending = client.request('/search');
    const expectation = expect(pending).rejects.toMatchObject({
      status,
      message: expectedMessage,
    });
    await vi.advanceTimersByTimeAsync(500);
    await expectation;
  });
});
