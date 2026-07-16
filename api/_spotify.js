const crypto = require('crypto');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = [
  'user-top-read',
  'user-read-private',
  'user-read-email',
  'app-remote-control',
  'user-modify-playback-state',
  'streaming',
  'user-read-playback-state',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
];

function getConfig(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  const origin = process.env.SPOTIFY_REDIRECT_ORIGIN || `${protocol}://${host}`;

  return {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${origin}/api/callback`,
    origin,
  };
}

function isConfigured(config) {
  return Boolean(config.clientId && config.clientSecret);
}

function parseCookies(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf('=');
      if (index === -1) {
        return cookies;
      }

      const key = decodeURIComponent(part.slice(0, index));
      const value = decodeURIComponent(part.slice(index + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`Path=${options.path || '/'}`);
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function setCookies(res, cookies) {
  const existing = res.getHeader('Set-Cookie');
  const values = Array.isArray(existing) ? existing.slice() : existing ? [existing] : [];
  res.setHeader('Set-Cookie', values.concat(cookies));
}

function clearAuthCookies(res) {
  setCookies(res, [
    serializeCookie('spotify_auth_state', '', { maxAge: 0 }),
    serializeCookie('spotify_access_token', '', { maxAge: 0 }),
    serializeCookie('spotify_refresh_token', '', { maxAge: 0 }),
    serializeCookie('spotify_token_expires_at', '', { maxAge: 0 }),
  ]);
}

function createState() {
  return crypto.randomBytes(16).toString('hex');
}

function createAuthHeader(config) {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
}

async function requestTokens(config, values) {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: createAuthHeader(config),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(values).toString(),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Spotify token request failed');
  }

  return payload;
}

function exchangeCodeForTokens(config, code) {
  return requestTokens(config, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  });
}

function refreshAccessToken(config, refreshToken) {
  return requestTokens(config, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

function setTokenCookies(res, tokenPayload, existingRefreshToken) {
  const expiresIn = Number(tokenPayload.expires_in || 3600);
  const expiresAt = Date.now() + expiresIn * 1000;
  const refreshToken = tokenPayload.refresh_token || existingRefreshToken;
  const cookies = [
    serializeCookie('spotify_access_token', tokenPayload.access_token, { maxAge: expiresIn }),
    serializeCookie('spotify_token_expires_at', String(expiresAt), { maxAge: 60 * 60 * 24 * 30 }),
  ];

  if (refreshToken) {
    cookies.push(serializeCookie('spotify_refresh_token', refreshToken, { maxAge: 60 * 60 * 24 * 30 }));
  }

  setCookies(res, cookies);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, code, message, options = {}) {
  sendJson(res, statusCode, {
    code,
    message,
    retryable: Boolean(options.retryable),
    ...(options.loginUrl ? { loginUrl: options.loginUrl } : {}),
    ...(options.redirectUri ? { redirectUri: options.redirectUri } : {}),
  });
}

module.exports = {
  SCOPES,
  SPOTIFY_AUTH_URL,
  clearAuthCookies,
  createState,
  exchangeCodeForTokens,
  getConfig,
  isConfigured,
  parseCookies,
  refreshAccessToken,
  sendError,
  sendJson,
  serializeCookie,
  setCookies,
  setTokenCookies,
};
