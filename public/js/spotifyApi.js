async function getJson(fetchImpl, url, headers) {
    const response = await fetchImpl(url, { headers });
    const payload = await response.json().catch(() => ({}));

    if(!response.ok) {
        const message = payload?.error?.message || payload.message || payload.error || `Spotify request failed (${response.status})`;
        throw new Error(message);
    }

    return payload;
}

function getItems(payload) {
    return Array.isArray(payload?.items) ? payload.items : [];
}

function getSearchTracks(payload) {
    return Array.isArray(payload?.tracks?.items) ? payload.tracks.items : [];
}

export { getJson, getItems, getSearchTracks };
