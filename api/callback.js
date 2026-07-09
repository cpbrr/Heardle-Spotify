const {
  clearAuthCookies,
  exchangeCodeForTokens,
  getConfig,
  isConfigured,
  parseCookies,
  sendJson,
  setTokenCookies,
} = require('./_spotify');

module.exports = async function handler(req, res) {
  const config = getConfig(req);

  if (!isConfigured(config)) {
    sendJson(res, 500, {
      error: 'missing_spotify_credentials',
      message: 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Vercel environment variables.',
    });
    return;
  }

  const url = new URL(req.url, config.origin);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(req);

  if (!code || !state || state !== cookies.spotify_auth_state) {
    clearAuthCookies(res);
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=state_mismatch');
    res.end();
    return;
  }

  try {
    const tokenPayload = await exchangeCodeForTokens(config, code);
    setTokenCookies(res, tokenPayload);
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=connected');
    res.end();
  } catch (error) {
    clearAuthCookies(res);
    res.statusCode = 302;
    res.setHeader('Location', `/?auth=${encodeURIComponent(error.message || 'invalid_token')}`);
    res.end();
  }
};
