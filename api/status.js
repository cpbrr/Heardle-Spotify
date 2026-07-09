const { getConfig, isConfigured, parseCookies, sendJson } = require('./_spotify');

module.exports = function handler(req, res) {
  const config = getConfig(req);
  const cookies = parseCookies(req);

  sendJson(res, 200, {
    configured: isConfigured(config),
    authenticated: Boolean(cookies.spotify_access_token || cookies.spotify_refresh_token),
    redirectUri: config.redirectUri,
    missing: {
      clientId: !config.clientId,
      clientSecret: !config.clientSecret,
    },
    env: {
      clientId: 'SPOTIFY_CLIENT_ID',
      clientSecret: 'SPOTIFY_CLIENT_SECRET',
      redirectUri: 'SPOTIFY_REDIRECT_URI',
    },
  });
};
