import { getAccessToken } from './auth.js';

let play = false;
let token = null;
let player = null;
let deviceId = null;
let resolveDeviceReady;
let deviceReady = new Promise((resolve) => {
    resolveDeviceReady = resolve;
});

async function ensureToken() {
    if(!token) {
        token = await getAccessToken();
    }

    return token;
}

async function spotifyRequest(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if(!response.ok) {
        const message = payload?.error?.message || payload.message || payload.error || 'Spotify playback request failed';
        throw new Error(message);
    }

    return payload;
}

function playbackUrl(path, targetDeviceId) {
    const url = new URL(`https://api.spotify.com/v1/me/player/${path}`);

    if(targetDeviceId) {
        url.searchParams.set('device_id', targetDeviceId);
    }

    return url.toString();
}

async function waitForDeviceId() {
    if(deviceId) {
        return deviceId;
    }

    return Promise.race([
        deviceReady,
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
}

window.onSpotifyWebPlaybackSDKReady = async () => {
    const currentToken = await ensureToken();
    player = new Spotify.Player({
        name: 'Heardle Spotify Player',
        getOAuthToken: async (cb) => { cb(await ensureToken()); },
        volume: 0.5,
    });

    player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        resolveDeviceReady(device_id);
        console.log('Ready with Device ID', device_id);

        spotifyRequest('https://api.spotify.com/v1/me/player', {
            headers: {
                Authorization: `Bearer ${currentToken}`,
            },
        })
            .then((data) => {
                if(data.is_playing) {
                    pauseSong();
                }
            })
            .catch((error) => console.error('An error occurred while checking if the player is playing music:', error));
    });

    player.addListener('not_ready', ({ device_id }) => {
        if(deviceId === device_id) {
            deviceId = null;
            deviceReady = new Promise((resolve) => {
                resolveDeviceReady = resolve;
            });
        }

        console.log('Device ID has gone offline', device_id);
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error(message);
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error(message);
        token = null;
    });

    player.addListener('account_error', ({ message }) => {
        console.error(message);
    });

    player.addListener('playback_error', ({ message }) => {
        console.error(message);
    });

    player.connect().then((success) => {
        if(success) {
            console.log('The Web Playback SDK successfully connected to Spotify!');
        } else {
            console.log('The Web Playback SDK couldnt connect to Spotify');
        }
    });
};

function activatePlayer() {
    if(player && typeof player.activateElement === 'function') {
        player.activateElement();
    }
}

function toggle(on) {
    play = on;

    if(!on) {
        pauseSong();
    }
}

const playSong = async (uri) => {
    if(!uri) {
        throw new Error('No Spotify track URI is loaded.');
    }

    const currentToken = await ensureToken();
    const targetDeviceId = await waitForDeviceId();

    if(player && typeof player.activateElement === 'function') {
        player.activateElement();
    }

    await spotifyRequest(playbackUrl('play', targetDeviceId), {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            uris: [uri],
            position_ms: 0,
        }),
    });

    play = true;
};

const pauseSong = async () => {
    const currentToken = await ensureToken();
    const targetDeviceId = deviceId;

    await spotifyRequest(playbackUrl('pause', targetDeviceId), {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${currentToken}`,
        },
    }).catch((error) => {
        console.error(error);
    });

    play = false;
};

const nextSong = async () => {
    const currentToken = await ensureToken();

    await spotifyRequest(playbackUrl('next', deviceId), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${currentToken}`,
        },
    });

    console.log('Skipped to next song');
};

export { activatePlayer, toggle, playSong, nextSong };
