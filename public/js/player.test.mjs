import assert from 'node:assert/strict';

const calls = [];
const listeners = {};

global.window = {};
global.localStorage = {
    getItem() {
        return '1';
    },
};
global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if(String(url) === '/api/token') {
        return {
            ok: true,
            json: async () => ({ accessToken: 'test-token' }),
        };
    }

    if(String(url) === 'https://api.spotify.com/v1/me/player') {
        return {
            ok: true,
            json: async () => ({ is_playing: false }),
        };
    }

    return {
        ok: true,
        json: async () => ({}),
    };
};
global.Spotify = {
    Player: class {
        addListener(eventName, listener) {
            listeners[eventName] = listener;
        }

        connect() {
            return Promise.resolve(true);
        }

        getCurrentState() {
            return Promise.resolve({
                track_window: {
                    current_track: { name: 'Current' },
                    next_tracks: [{ name: 'Next' }],
                },
            });
        }

        togglePlay() {
            calls.push({ url: 'sdk:togglePlay', options: {} });
            return Promise.resolve();
        }
    },
};

const { playSong } = await import('./player.js');

await window.onSpotifyWebPlaybackSDKReady();
listeners.ready({ device_id: 'browser-device' });
await playSong('spotify:track:abc');

const playbackCall = calls.find((call) => call.url.startsWith('https://api.spotify.com/v1/me/player/play'));

assert.ok(playbackCall, 'playSong should call Spotify start playback');
assert.equal(
    playbackCall.url,
    'https://api.spotify.com/v1/me/player/play?device_id=browser-device',
    'playSong should target the Web Playback SDK device',
);
assert.deepEqual(JSON.parse(playbackCall.options.body), {
    uris: ['spotify:track:abc'],
    position_ms: 0,
});
