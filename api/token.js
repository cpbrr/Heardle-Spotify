const {
  clearAuthCookies,
  getConfig,
  isConfigured,
  parseCookies,
  refreshAccessToken,
  sendJson,
  setTokenCookies,
} = require('./_spotify');

module.exports = async function handler(req, res) {
  const config = getConfig(req);

  if (!isConfigured(config)) {
    sendJson(res, 500, {
      error: 'missing_spotify_credentials',
      message: 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Vercel environment variables.',
      redirectUri: config.redirectUri,
    });
    return;
  }

  const cookies = parseCookies(req);
  const accessToken = cookies.spotify_access_token;
  const refreshToken = cookies.spotify_refresh_token;
  const expiresAt = Number(cookies.spotify_token_expires_at || 0);
  const stillFresh = accessToken && expiresAt && Date.now() < expiresAt - 60 * 1000;

  if (stillFresh) {
    sendJson(res, 200, {
      accessToken,
      expiresAt,
    });
    return;
  }

  if (!refreshToken) {
    sendJson(res, 401, {
      error: 'not_authenticated',
      loginUrl: '/api/login',
    });
    return;
  }

  try {
    const tokenPayload = await refreshAccessToken(config, refreshToken);
    setTokenCookies(res, tokenPayload, refreshToken);
    sendJson(res, 200, {
      accessToken: tokenPayload.access_token,
      expiresAt: Date.now() + (tokenPayload.expires_in || 3600) * 1000,
    });
  } catch (error) {
    clearAuthCookies(res);
    sendJson(res, 401, {
      error: 'refresh_failed',
      message: error.message || 'Spotify token refresh failed',
      loginUrl: '/api/login',
    });
  }
};
