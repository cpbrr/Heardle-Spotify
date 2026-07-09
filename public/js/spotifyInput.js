function normalizeSpotifyId(value, entityType) {
    const trimmed = String(value || '').trim();

    if(!trimmed) {
        return '';
    }

    const uriMatch = trimmed.match(/^spotify:([a-z]+):([A-Za-z0-9]+)$/i);
    if(uriMatch) {
        return uriMatch[1].toLowerCase() === entityType ? uriMatch[2] : trimmed;
    }

    try {
        const url = new URL(trimmed);
        const parts = url.pathname.split('/').filter(Boolean);
        const typeIndex = parts.findIndex((part) => part.toLowerCase() === entityType);

        if(typeIndex !== -1 && parts[typeIndex + 1]) {
            return parts[typeIndex + 1];
        }
    } catch (error) {
        // Not a URL; keep the raw value below.
    }

    return trimmed;
}

export { normalizeSpotifyId };
