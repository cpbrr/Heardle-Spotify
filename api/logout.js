const { clearAuthCookies, sendJson } = require('./_spotify');

module.exports = function handler(req, res) {
  clearAuthCookies(res);
  sendJson(res, 200, { ok: true });
};
