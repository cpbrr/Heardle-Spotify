let tokenRequest = null;

async function requestJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if(!response.ok) {
        const error = new Error(payload.message || payload.error || 'Request failed');
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

async function getStatus() {
    return requestJson('/api/status');
}

async function getAccessToken() {
    if(!tokenRequest) {
        tokenRequest = requestJson('/api/token')
            .then((payload) => payload.accessToken)
            .catch((error) => {
                tokenRequest = null;
                throw error;
            });
    }

    return tokenRequest;
}

function goToLogin() {
    window.location.href = '/api/login';
}

function showBlockingAuthMessage(error) {
    document.body.innerHTML = `
        <main class="auth-message">
            <section>
                <h1>Hördel</h1>
                <p>${error.message || 'Spotify login is required.'}</p>
                <button id="login">Connect Spotify</button>
            </section>
        </main>
    `;

    const loginButton = document.getElementById('login');
    if(loginButton) {
        loginButton.addEventListener('click', goToLogin);
    }
}

export { getAccessToken, getStatus, goToLogin, showBlockingAuthMessage };
