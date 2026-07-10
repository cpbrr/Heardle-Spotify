const {
  SCOPES,
  SPOTIFY_AUTH_URL,
  createState,
  getConfig,
  isConfigured,
  sendError,
  serializeCookie,
  setCookies,
} = require('./_spotify');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    sendError(res, 405, 'method_not_allowed', 'Use GET to connect Spotify.');
    return;
  }

  const config = getConfig(req);
  if (!isConfigured(config)) {
    sendError(res, 503, 'missing_spotify_credentials', 'Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to continue.', {
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
