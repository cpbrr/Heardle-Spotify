import { getStatus, goToLogin } from './auth.js';

let startupValue = '';
var startupID = '';
var newPage = false;
var button = document.getElementById('button');
var select = document.getElementById('select');
var textarea = document.querySelector('textarea');
var chosen = false;
var authReady = false;

function createSetupPanel(status) {
    var panel = document.createElement('section');
    panel.id = 'setup-panel';

    if(!status.configured) {
        panel.innerHTML = `
            <p class="setup-label">Spotify setup required</p>
            <p>Add these Vercel environment variables, then set this redirect URI in your Spotify app.</p>
            <div class="setup-grid">
                <code>SPOTIFY_CLIENT_ID</code>
                <code>SPOTIFY_CLIENT_SECRET</code>
                <code>${status.redirectUri}</code>
            </div>
        `;
    } else if(!status.authenticated) {
        panel.innerHTML = `
            <p class="setup-label">Spotify login required</p>
            <p>Connect a Spotify Premium account before choosing songs.</p>
            <button id="login-button" type="button">Connect Spotify</button>
        `;
    } else {
        panel.innerHTML = `
            <p class="setup-label">Spotify connected</p>
            <button id="logout-button" type="button">Switch account</button>
        `;
    }

    document.getElementById('content').appendChild(panel);

    var loginButton = document.getElementById('login-button');
    if(loginButton) {
        loginButton.addEventListener('click', goToLogin);
    }

    var logoutButton = document.getElementById('logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', async function() {
            await fetch('/api/logout', { method: 'POST' });
            window.location.reload();
        });
    }
}

getStatus()
    .then((status) => {
        authReady = status.configured && status.authenticated;
        createSetupPanel(status);
    })
    .catch((error) => {
        createSetupPanel({
            configured: false,
            authenticated: false,
            redirectUri: '/api/callback',
        });
        console.error(error);
    });

button.addEventListener('click', function() {
    if(!newPage) {
        if(!authReady) {
            goToLogin();
            return;
        }

        startupValue = parseInt(select.value);
        startupID = textarea.value;

        if((startupValue > 0 && startupID.length > 0) || startupValue == 6 || startupValue == 7) {
            newPage = true;
            localStorage.setItem('value', startupValue);
            localStorage.setItem('id', startupID);
            window.location.href = '/game';
        }
    }
});

select.addEventListener('change', function() {
    if(!newPage) {
        if(!chosen) {
            select.style.color = '#ddd';
            chosen = true;
        }

        textarea.value = '';
        textarea.disabled = false;

        if(select.value == 1) {
            textarea.placeholder = 'Enter artist by name';
        } else if(select.value == 2) {
            textarea.placeholder = 'Enter artist by id';
        } else if(select.value == 3) {
            textarea.placeholder = 'Enter the playlist id';
        } else if(select.value == 4) {
            textarea.placeholder = 'Enter the album id';
        } else if(select.value == 5) {
            textarea.placeholder = 'Enter the track id';
        } else {
            textarea.placeholder = '';
            textarea.disabled = true;
        }
    }
});

textarea.addEventListener('keydown', function(e) {
    if(e.key == 'Enter') {
        e.preventDefault();
        button.click();
    }
});
