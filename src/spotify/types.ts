export interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
  redirectUri: string;
  missing: {
    clientId: boolean;
    clientSecret: boolean;
  };
}

export interface Track {
  id: string;
  uri: string;
  title: string;
  artists: string[];
  artistText: string;
  durationMs: number;
  album: string;
  imageUrl: string | null;
}

type SearchableSourceKind =
  | 'artist-mix'
  | 'artist-discography'
  | 'playlist'
  | 'album'
  | 'track';

export type SourceDescriptor =
  | {
      kind: SearchableSourceKind;
      id: string;
      name: string;
      imageUrl: string | null;
    }
  | {
      kind: 'top' | 'liked';
      name: string;
      imageUrl: null;
    };

export type ResumeAction =
  | { type: 'play' }
  | { type: 'load-source'; source: SourceDescriptor }
  | { type: 'search'; query: string };
