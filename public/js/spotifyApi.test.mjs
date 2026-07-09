import assert from 'node:assert/strict';
import { getJson, getItems, getSearchTracks } from './spotifyApi.js';

const okPayload = { items: [{ id: '1' }] };
const okFetch = async () => ({
    ok: true,
    json: async () => okPayload,
});

assert.equal(await getJson(okFetch, 'https://example.test', {}), okPayload);

const errorFetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: { message: 'Not found' } }),
});
await assert.rejects(
    () => getJson(errorFetch, 'https://example.test', {}),
    /Not found/,
);

const malformedErrorFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('bad json'); },
});
await assert.rejects(
    () => getJson(malformedErrorFetch, 'https://example.test', {}),
    /Spotify request failed \(500\)/,
);

assert.deepEqual(getItems({ items: [1, 2] }), [1, 2]);
assert.deepEqual(getItems({ items: null }), []);
assert.deepEqual(getItems(null), []);
assert.deepEqual(getSearchTracks({ tracks: { items: ['a'] } }), ['a']);
assert.deepEqual(getSearchTracks({ tracks: {} }), []);
