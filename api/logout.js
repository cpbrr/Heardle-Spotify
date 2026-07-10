const { clearAuthCookies, sendError, sendJson } = require('./_spotify');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    sendError(res, 405, 'method_not_allowed', 'Use POST to log out.');
    return;
  }

  clearAuthCookies(res);
  sendJson(res, 200, { ok: true });
};
