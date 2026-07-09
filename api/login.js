const {
  SCOPES,
  SPOTIFY_AUTH_URL,
  createState,
  getConfig,
  isConfigured,
  sendJson,
  serializeCookie,
  setCookies,
} = require('./_spotify');

module.exports = function handler(req, res) {
  const config = getConfig(req);

  if (!isConfigured(config)) {
    sendJson(res, 500, {
      error: 'missing_spotify_credentials',
      message: 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Vercel environment variables.',
      redirectUri: config.redirectUri,
    });
    return;
  }

  const state = createState();
  setCookies(res, [serializeCookie('spotify_auth_state', state, { maxAge: 60 * 10 })]);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    scope: SCOPES.join(' '),
    redirect_uri: config.redirectUri,
    state,
  });

  res.statusCode = 302;
  res.setHeader('Location', `${SPOTIFY_AUTH_URL}?${params.toString()}`);
  res.end();
};
