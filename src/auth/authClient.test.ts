import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAccessToken, getAuthStatus, logout, resetAuthClientForTests } from './authClient';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  resetAuthClientForTests();
  vi.unstubAllGlobals();
});

describe('authClient', () => {
  it('loads the server configuration and session status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      configured: true,
      authenticated: false,
      redirectUri: 'http://localhost:3000/api/callback',
      missing: { clientId: false, clientSecret: false },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAuthStatus()).resolves.toMatchObject({
      configured: true,
      authenticated: false,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/status', expect.objectContaining({ signal: undefined }));
  });

  it('deduplicates concurrent token requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      accessToken: 'token',
      expiresAt: Date.now() + 3_600_000,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([getAccessToken(), getAccessToken()]);

    expect(first.accessToken).toBe('token');
    expect(second.accessToken).toBe('token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not keep a rejected token request cached', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, {
        code: 'not_authenticated',
        message: 'Connect Spotify to continue.',
        retryable: false,
        loginUrl: '/api/login',
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        accessToken: 'fresh',
        expiresAt: Date.now() + 3_600_000,
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAccessToken()).rejects.toMatchObject({ code: 'not_authenticated' });
    await expect(getAccessToken()).resolves.toMatchObject({ accessToken: 'fresh' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('propagates a forced refresh after Spotify rejects a cached token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      accessToken: 'fresh',
      expiresAt: Date.now() + 3_600_000,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await getAccessToken(undefined, true);

    expect(fetchMock).toHaveBeenCalledWith('/api/token?force=1', expect.objectContaining({ signal: undefined }));
  });

  it('preserves the reconnect URL when a forced refresh requires login', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {
      code: 'not_authenticated',
      message: 'Connect Spotify to continue.',
      retryable: false,
      loginUrl: '/api/login',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAccessToken(undefined, true)).rejects.toMatchObject({
      code: 'not_authenticated',
      loginUrl: '/api/login',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/token?force=1', expect.any(Object));
  });

  it('clears the token cache when logging out', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        accessToken: 'first',
        expiresAt: Date.now() + 3_600_000,
      }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(jsonResponse(200, {
        accessToken: 'second',
        expiresAt: Date.now() + 3_600_000,
      }));
    vi.stubGlobal('fetch', fetchMock);

    await getAccessToken();
    await logout();
    await expect(getAccessToken()).resolves.toMatchObject({ accessToken: 'second' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/logout', expect.objectContaining({ method: 'POST' }));
  });
});
