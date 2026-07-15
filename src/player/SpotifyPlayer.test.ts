import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpotifyPlayer } from './SpotifyPlayer';
import type { SpotifyNamespace } from './spotify-sdk';

type Listener = (value: unknown) => void;

class SdkPlayerDouble {
  readonly listeners = new Map<string, Listener>();
  readonly activateElement = vi.fn(async () => undefined);
  readonly disconnect = vi.fn();
  readonly connect = vi.fn(async () => {
    this.listeners.get('ready')?.({ device_id: 'device-1' });
    return true;
  });

  addListener(name: string, listener: Listener) {
    this.listeners.set(name, listener);
    return true;
  }
}

function playerNamespace(sdkPlayer: SdkPlayerDouble): SpotifyNamespace {
  function Player() {
    return sdkPlayer;
  }
  return { Player: Player as unknown as SpotifyNamespace['Player'] };
}

function successfulResponse() {
  return new Response(null, { status: 204 });
}

describe('SpotifyPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calls the browser fetch implementation with the global receiver', async () => {
    const sdkPlayer = new SdkPlayerDouble();
    const browserFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(successfulResponse());
    });
    vi.stubGlobal('fetch', browserFetch);
    const player = new SpotifyPlayer({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
      loadSdk: vi.fn().mockResolvedValue(playerNamespace(sdkPlayer)),
    });

    await player.connect();
    await expect(player.playFullTrack('spotify:track:abc')).resolves.toBeUndefined();
  });

  it('activates the SDK before transferring and playing a clip', async () => {
    const sequence: string[] = [];
    const sdkPlayer = new SdkPlayerDouble();
    sdkPlayer.activateElement.mockImplementation(async () => {
      sequence.push('sdk.activate');
    });
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      sequence.push(String(url));
      return successfulResponse();
    });
    const player = new SpotifyPlayer({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
      fetchImpl,
      loadSdk: vi.fn().mockResolvedValue(playerNamespace(sdkPlayer)),
    });

    await player.connect();
    await player.activate();
    await player.playClip('spotify:track:abc', 2_000, vi.fn());

    expect(sequence).toEqual([
      'sdk.activate',
      'https://api.spotify.com/v1/me/player',
      'https://api.spotify.com/v1/me/player/seek?position_ms=0&device_id=device-1',
      'https://api.spotify.com/v1/me/player/play?device_id=device-1',
    ]);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://api.spotify.com/v1/me/player/pause?device_id=device-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('clears an old clip timer before starting full-track playback', async () => {
    const sdkPlayer = new SdkPlayerDouble();
    const fetchImpl = vi.fn().mockResolvedValue(successfulResponse());
    const player = new SpotifyPlayer({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
      fetchImpl,
      loadSdk: vi.fn().mockResolvedValue(playerNamespace(sdkPlayer)),
    });

    await player.connect();
    await player.playClip('spotify:track:first', 1_000, vi.fn());
    await player.playFullTrack('spotify:track:second');
    fetchImpl.mockClear();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('times out when Spotify never supplies a device id', async () => {
    const sdkPlayer = new SdkPlayerDouble();
    sdkPlayer.connect.mockResolvedValue(true);
    const player = new SpotifyPlayer({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
      fetchImpl: vi.fn(),
      loadSdk: vi.fn().mockResolvedValue(playerNamespace(sdkPlayer)),
    });

    const pending = player.connect();
    const expectation = expect(pending).rejects.toMatchObject({ code: 'spotify_device_timeout' });
    await vi.advanceTimersByTimeAsync(10_000);
    await expectation;
  });

  it('clears timers and disconnects the SDK on destroy', async () => {
    const sdkPlayer = new SdkPlayerDouble();
    const fetchImpl = vi.fn().mockResolvedValue(successfulResponse());
    const player = new SpotifyPlayer({
      getToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
      fetchImpl,
      loadSdk: vi.fn().mockResolvedValue(playerNamespace(sdkPlayer)),
    });

    await player.connect();
    await player.playClip('spotify:track:first', 1_000, vi.fn());
    player.destroy();
    fetchImpl.mockClear();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(sdkPlayer.disconnect).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
