function createTrackItem(track) {
    if(!track || track.is_local || !track.uri || !track.name || !Array.isArray(track.artists) || track.artists.length === 0) {
        return null;
    }

    return {
        titel: track.name,
        artist: track.artists[0].name,
        uri: track.uri,
        duration: track.duration_ms,
    };
}

function createPlaylistTrackItem(item) {
    if(!item || item.is_local || !item.track) {
        return null;
    }

    return createTrackItem(item.track);
}

function appendUniqueTrack(tracks, trackItem) {
    if(!trackItem) {
        return false;
    }

    if(tracks.some((existingTrack) => existingTrack.titel === trackItem.titel)) {
        return false;
    }

    tracks.push(trackItem);
    return true;
}

export { createTrackItem, createPlaylistTrackItem, appendUniqueTrack };
