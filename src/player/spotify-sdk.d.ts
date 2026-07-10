export {};

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export interface SpotifyNamespace {
  Player: new (options: SpotifyPlayerOptions) => SpotifySdkPlayer;
}

export interface SpotifyPlayerOptions {
  name: string;
  getOAuthToken(callback: (token: string) => void): void;
  volume: number;
}

export interface SpotifySdkPlayer {
  addListener(name: string, callback: (value: unknown) => void): boolean;
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement?(): Promise<void>;
}
