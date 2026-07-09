import { getAccessToken } from './auth.js';

var play = false;
var tempPlay = false;
var hasRestarted = false;
var token = null;

async function ensureToken() {
    if(!token) {
        token = await getAccessToken();
    }

    return token;
}

window.onSpotifyWebPlaybackSDKReady = async () => {
    const currentToken = await ensureToken();
    const player = new Spotify.Player({
        name: 'Web Playback SDK Quick Start Player',
        getOAuthToken: cb => { cb(currentToken); },
        volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        fetch('https://api.spotify.com/v1/me/player', {
            headers: {
                'Authorization': 'Bearer ' + currentToken
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch data from API');
            }
            return response.json();
        })
        .then(data => {
            if (data.is_playing) {
                pauseSong();
            }
        })
        .catch(error => console.error('An error occurred while checking if the player is playing music:', error));
        printState();
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error(message);
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error(message);
    });

    player.addListener('account_error', ({ message }) => {
        console.error(message);
    });

    player.connect().then(success => {
        if (success) {
            console.log('The Web Playback SDK successfully connected to Spotify!');
        } else {
            console.log('The Web Playback SDK couldnt connect to Spotify');
        }
    });

    setInterval(run, 10);

    function run() {
        if(play && !tempPlay) {
            restart();
            player.togglePlay();
        } else if(!play && tempPlay) {
            pauseSong();
        }

        if(Number(localStorage.getItem('listened') || 1) > 6 && !hasRestarted) {
            restart();
            play = true;
            hasRestarted = true;
        }

        tempPlay = play;
    }

    function printState() {
        player.getCurrentState().then(state => {
            if (!state) {
              console.error('User is not playing music through the Web Playback SDK');
              return;
            }

            var current_track = state.track_window.current_track;
            var next_track = state.track_window.next_tracks[0];

            console.log('Currently Playing', current_track);
            console.log('Playing Next', next_track);
        });
    }

    const restart = async () => {
        fetch('https://api.spotify.com/v1/me/player/seek?position_ms=0', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${currentToken}`
        }
        })
        .then(response => {
            if (!response.ok) {
            throw new Error('Failed to restart song');
            }
        })
        .catch(error => {
            console.error(error);
        });
    };
};

function toggle(on) {
    play = on;
}

const playSong = async (uri) => {
    const currentToken = await ensureToken();
    fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uris: [uri],
            position_ms: 0
        })
    })
    .catch(error => console.error(error));
};

const pauseSong = async () => {
    const currentToken = await ensureToken();
    fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${currentToken}`
        }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to pause song');
            }
        })
        .catch(error => {
            console.error(error);
    });
};

const nextSong = async () => {
    const currentToken = await ensureToken();
    fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${currentToken}`
    }
    })
    .then(response => {
        if (!response.ok) {
        throw new Error('Failed to skip to next song');
        }
        console.log('Skipped to next song');
    })
    .catch(error => {
        console.error(error);
    });
};

export { toggle, playSong, nextSong };
