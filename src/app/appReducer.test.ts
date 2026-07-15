import { describe, expect, it } from 'vitest';

import { appReducer, initialAppState } from './appReducer';
import type { AuthStatus, SourceDescriptor, Track } from '../spotify/types';

const configured: AuthStatus = {
  configured: true,
  authenticated: true,
  redirectUri: 'http://localhost:3000/api/callback',
  missing: { clientId: false, clientSecret: false },
};

const source: SourceDescriptor = {
  kind: 'playlist',
  id: 'playlist-1',
  name: 'Focus',
  imageUrl: null,
};

const tracks: Track[] = [{
  id: 'track-1',
  uri: 'spotify:track:track-1',
  title: 'First Track',
  artists: ['Artist'],
  artistText: 'Artist',
  durationMs: 180_000,
  album: 'Album',
  imageUrl: null,
}];

describe('appReducer', () => {
  it('moves configured authenticated users to source selection', () => {
    expect(appReducer(initialAppState, { type: 'authChecked', status: configured })).toEqual({
      phase: 'choosing-source',
    });
  });

  it('renders configuration before login when credentials are missing', () => {
    const status = {
      ...configured,
      configured: false,
      authenticated: false,
      missing: { clientId: true, clientSecret: true },
    };

    expect(appReducer(initialAppState, { type: 'authChecked', status })).toEqual({
      phase: 'needs-configuration',
      status,
    });
  });

  it('ignores catalog results from stale request ids', () => {
    const loading = { phase: 'loading-catalog' as const, source, requestId: 4 };

    expect(appReducer(loading, {
      type: 'catalogLoaded',
      source,
      requestId: 3,
      tracks,
    })).toEqual(loading);
  });

  it('moves current catalog results through player preparation to ready', () => {
    const loading = { phase: 'loading-catalog' as const, source, requestId: 4 };
    const preparing = appReducer(loading, {
      type: 'catalogLoaded',
      source,
      requestId: 4,
      tracks,
    });

    expect(preparing).toEqual({ phase: 'preparing-player', source, tracks });
    expect(appReducer(preparing, { type: 'playerReady' })).toEqual({
      phase: 'ready',
      source,
      tracks,
    });
  });

  it('preserves an interrupted action when authentication expires', () => {
    const ready = { phase: 'ready' as const, source, tracks };

    expect(appReducer(ready, {
      type: 'authExpired',
      status: { ...configured, authenticated: false },
      resumeAction: { type: 'play' },
    })).toMatchObject({
      phase: 'needs-login',
      resumeAction: { type: 'play' },
    });
  });
});
