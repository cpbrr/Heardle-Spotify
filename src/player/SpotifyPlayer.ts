import { AppError, getAccessToken } from '../auth/authClient';
import type { SpotifyNamespace, SpotifySdkPlayer } from './spotify-sdk';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const DEVICE_TIMEOUT_MS = 10_000;

type TokenProvider = (signal?: AbortSignal, forceRefresh?: boolean) => Promise<{
  accessToken: string;
  expiresAt: number;
}>;

interface PlayerDependencies {
  getToken?: TokenProvider;
  fetchImpl?: typeof fetch;
  loadSdk?: () => Promise<SpotifyNamespace>;
}

let sdkPromise: Promise<SpotifyNamespace> | null = null;

export function loadSpotifySdk(): Promise<SpotifyNamespace> {
  if (window.Spotify) {
    return Promise.resolve(window.Spotify);
  }
  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const script = existing || document.createElement('script');
    const previousReady = window.onSpotifyWebPlaybackSDKReady;

    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.();
      if (window.Spotify) {
        resolve(window.Spotify);
      } else {
        reject(new AppError('Spotify playback SDK did not initialize.', {
          code: 'spotify_sdk_failed',
          retryable: true,
        }));
      }
    };

    script.addEventListener('error', () => {
      sdkPromise = null;
      reject(new AppError('Unable to load Spotify playback.', {
        code: 'spotify_sdk_failed',
        retryable: true,
      }));
    }, { once: true });

    if (!existing) {
      script.src = SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return sdkPromise;
}

export class SpotifyPlayer {
  private readonly getToken: TokenProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly loadSdk: () => Promise<SpotifyNamespace>;
  private sdkPlayer: SpotifySdkPlayer | null = null;
  private deviceId: string | null = null;
  private connectPromise: Promise<string> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(dependencies: PlayerDependencies = {}) {
    this.getToken = dependencies.getToken || getAccessToken;
    this.fetchImpl = dependencies.fetchImpl || fetch;
    this.loadSdk = dependencies.loadSdk || loadSpotifySdk;
  }

  connect(): Promise<string> {
    if (this.deviceId) {
      return Promise.resolve(this.deviceId);
    }
    if (!this.connectPromise) {
      this.connectPromise = this.initialize().catch((error) => {
        this.connectPromise = null;
        throw error;
      });
    }
    return this.connectPromise;
  }

  private async initialize(): Promise<string> {
    const Spotify = await this.loadSdk();
    if (this.destroyed) {
      throw new AppError('Spotify player was closed.', { code: 'spotify_player_closed' });
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          callback();
        }
      };
      const timeout = setTimeout(() => {
        finish(() => reject(new AppError('Spotify did not provide a playback device.', {
          code: 'spotify_device_timeout',
          retryable: true,
        })));
      }, DEVICE_TIMEOUT_MS);

      const player = new Spotify.Player({
        name: 'Heardle Spotify Player',
        getOAuthToken: (callback) => {
          void this.getToken()
            .then(({ accessToken }) => callback(accessToken))
            .catch((error) => finish(() => reject(error)));
        },
        volume: 0.5,
      });
      this.sdkPlayer = player;

      player.addListener('ready', (value) => {
        const deviceId = (value as { device_id?: unknown })?.device_id;
        if (typeof deviceId === 'string' && deviceId) {
          this.deviceId = deviceId;
          finish(() => resolve(deviceId));
        }
      });
      player.addListener('authentication_error', (value) => {
        finish(() => reject(this.sdkError('Spotify authentication expired.', 'spotify_authentication_error', value)));
      });
      player.addListener('account_error', (value) => {
        finish(() => reject(this.sdkError('Spotify Premium is required for playback.', 'spotify_account_error', value)));
      });
      player.addListener('initialization_error', (value) => {
        finish(() => reject(this.sdkError('Spotify playback could not initialize.', 'spotify_initialization_error', value)));
      });

      void player.connect().then((connected) => {
        if (!connected) {
          finish(() => reject(new AppError('Spotify playback could not connect.', {
            code: 'spotify_connection_failed',
            retryable: true,
          })));
        }
      }).catch((error) => finish(() => reject(error)));
    });
  }

  private sdkError(fallback: string, code: string, value: unknown) {
    const message = (value as { message?: unknown })?.message;
    return new AppError(typeof message === 'string' ? message : fallback, {
      code,
      retryable: code !== 'spotify_account_error',
    });
  }

  async activate() {
    await this.connect();
    await this.sdkPlayer?.activateElement?.();
  }

  async playClip(uri: string, limitMs: number, onProgress: (positionMs: number) => void) {
    this.clearStopTimer();
    await this.startTrack(uri);
    onProgress(0);
    this.stopTimer = setTimeout(() => {
      void this.pause().catch(() => undefined);
    }, limitMs);
  }

  async playFullTrack(uri: string) {
    this.clearStopTimer();
    await this.startTrack(uri);
  }

  private async startTrack(uri: string) {
    const deviceId = await this.connect();
    await this.spotifyRequest('/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
    await this.seek(0);
    await this.spotifyRequest(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      body: JSON.stringify({ uris: [uri], position_ms: 0 }),
    });
  }

  async seek(positionMs: number) {
    const deviceId = await this.connect();
    const position = Math.max(0, Math.round(positionMs));
    await this.spotifyRequest(`/me/player/seek?position_ms=${position}&device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
    });
  }

  async pause() {
    this.clearStopTimer();
    if (!this.deviceId) {
      return;
    }
    await this.spotifyRequest(`/me/player/pause?device_id=${encodeURIComponent(this.deviceId)}`, {
      method: 'PUT',
    });
  }

  private async spotifyRequest(path: string, options: RequestInit) {
    const { accessToken } = await this.getToken();
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');
    const response = await this.fetchImpl(`${SPOTIFY_API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new AppError(payload.error?.message || 'Spotify playback command failed.', {
        code: response.status === 403 ? 'spotify_account_error' : 'spotify_playback_failed',
        status: response.status,
        retryable: response.status >= 500,
      });
    }
  }

  private clearStopTimer() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  destroy() {
    this.destroyed = true;
    this.clearStopTimer();
    this.sdkPlayer?.disconnect();
    this.sdkPlayer = null;
    this.deviceId = null;
    this.connectPromise = null;
  }
}
