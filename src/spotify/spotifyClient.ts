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

export interface SpotifyApiClient {
  request<T = unknown>(path: string, options?: RequestInit): Promise<T>;
}

type SpotifyErrorPayload = {
  error?: { message?: string } | string;
  message?: string;
};

function parseResponseBody(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function spotifyErrorMessage(payload: unknown) {
  if (typeof payload === 'string') {
    const message = payload.trim();
    return message && !message.startsWith('<') ? message : undefined;
  }
  if (!payload || typeof payload !== 'object') return undefined;
  const errorPayload = payload as SpotifyErrorPayload;
  const nestedMessage = typeof errorPayload.error === 'object'
    ? errorPayload.error.message
    : errorPayload.error;
  return nestedMessage || errorPayload.message;
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

    const payload = parseResponseBody(await response.text());

    if (!response.ok) {
      if (response.status === 403 && path === '/me') {
        throw new AppError('This Spotify account is not authorized for this development app. Add its Spotify email in Developer Dashboard > Users Management, then reconnect.', {
          code: 'spotify_account_not_allowed',
          status: 403,
          loginUrl: '/api/login',
        });
      }
      if (response.status === 403 && /\/playlists\/[^/]+\/items/.test(path)) {
        throw new AppError('Spotify only allows playlists you own or collaborate on.', {
          code: 'spotify_playlist_inaccessible',
          status: 403,
        });
      }

      const message = spotifyErrorMessage(payload) || 'Spotify request failed.';
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After') || 1);
        throw new AppError(message, {
          code: 'spotify_rate_limited',
          status: 429,
          retryable: true,
          retryAfterMs: Math.max(1, retryAfter) * 1000,
        });
      }

      throw new AppError(message + ' (HTTP ' + response.status + ')', {
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
