const {
  clearAuthCookies,
  getConfig,
  isConfigured,
  parseCookies,
  refreshAccessToken,
  sendError,
  sendJson,
  setTokenCookies,
} = require('./_spotify');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    sendError(res, 405, 'method_not_allowed', 'Use GET to request a Spotify token.');
    return;
  }

  const config = getConfig(req);
  if (!isConfigured(config)) {
    sendError(res, 503, 'missing_spotify_credentials', 'Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to continue.', {
      redirectUri: config.redirectUri,
    });
    return;
  }

  const force = new URL(req.url, config.origin).searchParams.get('force') === '1';
  const cookies = parseCookies(req);
  const accessToken = cookies.spotify_access_token;
  const refreshToken = cookies.spotify_refresh_token;
  const expiresAt = Number(cookies.spotify_token_expires_at || 0);
  const stillFresh = !force && accessToken && expiresAt && Date.now() < expiresAt - 60 * 1000;

  if (stillFresh) {
    sendJson(res, 200, { accessToken, expiresAt });
    return;
  }

  if (!refreshToken) {
    sendError(res, 401, 'not_authenticated', 'Connect Spotify to continue.', {
      loginUrl: '/api/login',
    });
    return;
  }

  try {
    const tokenPayload = await refreshAccessToken(config, refreshToken);
    const refreshedExpiresAt = Date.now() + Number(tokenPayload.expires_in || 3600) * 1000;
    setTokenCookies(res, tokenPayload, refreshToken);
    sendJson(res, 200, {
      accessToken: tokenPayload.access_token,
      expiresAt: refreshedExpiresAt,
    });
  } catch (error) {
    clearAuthCookies(res);
    sendError(res, 401, 'refresh_failed', error.message || 'Spotify token refresh failed.', {
      loginUrl: '/api/login',
    });
  }
};
