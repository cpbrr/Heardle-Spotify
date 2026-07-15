import { AppError, getAccessToken } from '../auth/authClient';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

type TokenProvider = (signal?: AbortSignal, forceRefresh?: boolean) => Promise<{
  accessToken: string;
  expiresAt: number;
}>;

interface SpotifyClientDependencies {
  getToken?: TokenProvider;
  fetchImpl?: typeof fetch;
}

export class SpotifyClient {
  private readonly getToken: TokenProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(dependencies: SpotifyClientDependencies = {}) {
    this.getToken = dependencies.getToken || getAccessToken;
    this.fetchImpl = dependencies.fetchImpl || globalThis.fetch.bind(globalThis);
  }

  async request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    return this.requestWithRetry<T>(path, options, false);
  }

  private async requestWithRetry<T>(path: string, options: RequestInit, retried: boolean): Promise<T> {
    const token = await this.getToken(options.signal || undefined, retried);
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token.accessToken}`);
    headers.set('Accept', 'application/json');

    const response = await this.fetchImpl(
      path.startsWith('http') ? path : `${SPOTIFY_API_BASE}${path}`,
      { ...options, headers },
    );

    if (response.status === 401 && !retried) {
      return this.requestWithRetry<T>(path, options, true);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = await response.json().catch(() => ({})) as {
      error?: { message?: string } | string;
      message?: string;
    };

    if (!response.ok) {
      const nestedMessage = typeof payload.error === 'object' ? payload.error.message : payload.error;
      const message = nestedMessage || payload.message || 'Spotify request failed.';
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After') || 1);
        throw new AppError(message, {
          code: 'spotify_rate_limited',
          status: 429,
          retryable: true,
          retryAfterMs: Math.max(1, retryAfter) * 1000,
        });
      }

      throw new AppError(message, {
        code: response.status === 403 ? 'spotify_forbidden' : 'spotify_request_failed',
        status: response.status,
        retryable: response.status >= 500,
      });
    }

    return payload as T;
  }
}

export const spotifyClient = new SpotifyClient();

export function spotifyRequest<T>(path: string, options?: RequestInit) {
  return spotifyClient.request<T>(path, options);
}
