import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const login = require('./login.js');
const callback = require('./callback.js');
const logout = require('./logout.js');
const token = require('./token.js');
const { serializeCookie } = require('./_spotify.js');

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function request(overrides = {}) {
  return {
    method: 'GET',
    url: '/',
    headers: { host: 'localhost:3000' },
    ...overrides,
  };
}

function response() {
  const headers = new Map();

  return {
    statusCode: 200,
    body: '',
    ended: false,
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end(value = '') {
      this.body = value;
      this.ended = true;
    },
  };
}

function jsonBody(res) {
  return JSON.parse(res.body);
}

function clearSpotifyConfig() {
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  delete process.env.CLIENT_ID;
  delete process.env.CLIENT_SECRET;
}

describe('Spotify API contracts', () => {
  it('returns an actionable 503 when login credentials are missing', () => {
    clearSpotifyConfig();
    const res = response();

    login(request({ url: '/api/login' }), res);

    assert.equal(res.statusCode, 503);
    assert.deepEqual(jsonBody(res), {
      code: 'missing_spotify_credentials',
      message: 'Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to continue.',
      retryable: false,
      redirectUri: 'http://localhost:3000/api/callback',
    });
  });

  it('returns a consistent login-required token error', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'client';
    process.env.SPOTIFY_CLIENT_SECRET = 'secret';
    const res = response();

    await token(request({ url: '/api/token' }), res);

    assert.equal(res.statusCode, 401);
    assert.deepEqual(jsonBody(res), {
      code: 'not_authenticated',
      message: 'Connect Spotify to continue.',
      retryable: false,
      loginUrl: '/api/login',
    });
  });

  it('rejects unsupported logout methods without clearing cookies', () => {
    const res = response();

    logout(request({ method: 'GET', url: '/api/logout' }), res);

    assert.equal(res.statusCode, 405);
    assert.equal(res.getHeader('set-cookie'), undefined);
    assert.deepEqual(jsonBody(res), {
      code: 'method_not_allowed',
      message: 'Use POST to log out.',
      retryable: false,
    });
  });

  it('clears cookies on a POST logout', () => {
    const res = response();

    logout(request({ method: 'POST', url: '/api/logout' }), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(jsonBody(res), { ok: true });
    assert.equal(res.getHeader('set-cookie').length, 4);
  });

  it('rejects an invalid callback state and clears auth cookies', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'client';
    process.env.SPOTIFY_CLIENT_SECRET = 'secret';
    const res = response();

    await callback(request({
      url: '/api/callback?code=code&state=wrong',
      headers: { host: 'localhost:3000', cookie: 'spotify_auth_state=expected' },
    }), res);

    assert.equal(res.statusCode, 302);
    assert.equal(res.getHeader('location'), '/?auth=state_mismatch');
    assert.equal(res.getHeader('set-cookie').length, 4);
  });

  it('marks production cookies secure', () => {
    process.env.NODE_ENV = 'production';

    const cookie = serializeCookie('name', 'value', { maxAge: 60 });

    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Secure/);
  });
});
