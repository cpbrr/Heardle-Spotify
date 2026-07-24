import type { AuthStatus } from '../spotify/types';

export interface TokenResult {
  accessToken: string;
  expiresAt: number;
}

interface ErrorPayload {
  code?: string;
  message?: string;
  retryable?: boolean;
  loginUrl?: string;
  retryAfterMs?: number;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly loginUrl?: string;
  readonly retryAfterMs?: number;

  constructor(message: string, options: {
    code?: string;
    status?: number;
    retryable?: boolean;
    loginUrl?: string;
    retryAfterMs?: number;
  } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = options.code || 'request_failed';
    this.status = options.status || 0;
    this.retryable = Boolean(options.retryable);
    this.loginUrl = options.loginUrl;
    this.retryAfterMs = options.retryAfterMs;
  }
}

let tokenRequest: Promise<TokenResult> | null = null;
let cachedToken: TokenResult | null = null;

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({})) as T & ErrorPayload;

  if (!response.ok) {
    throw new AppError(payload.message || 'Request failed.', {
      code: payload.code,
      status: response.status,
      retryable: payload.retryable,
      loginUrl: payload.loginUrl,
      retryAfterMs: payload.retryAfterMs,
    });
  }

  return payload;
}

export function getAuthStatus(signal?: AbortSignal): Promise<AuthStatus> {
  return requestJson<AuthStatus>('/api/status', { signal });
}

export function getAccessToken(signal?: AbortSignal, forceRefresh = false): Promise<TokenResult> {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return Promise.resolve(cachedToken);
  }

  if (!tokenRequest) {
    const tokenUrl = forceRefresh ? '/api/token?force=1' : '/api/token';
    // Deliberately no `signal` here: this promise is shared across every concurrent
    // caller, so it must not be cancellable by whichever caller happens to start it.
    tokenRequest = requestJson<TokenResult>(tokenUrl)
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        tokenRequest = null;
      });
  }

  return tokenRequest;
}

export async function logout(): Promise<void> {
  try {
    await requestJson<{ ok: boolean }>('/api/logout', { method: 'POST' });
  } finally {
    cachedToken = null;
    tokenRequest = null;
  }
}

export function resetAuthClientForTests() {
  cachedToken = null;
  tokenRequest = null;
}

export const loginUrl = '/api/login';
