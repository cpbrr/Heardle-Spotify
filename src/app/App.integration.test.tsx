import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../auth/authClient';
import type { SourceDescriptor, Track } from '../spotify/types';
import { App } from './App';

const mocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  loadCatalog: vi.fn(),
  searchTracks: vi.fn(),
  player: {
    connect: vi.fn(),
    activate: vi.fn(),
    playClip: vi.fn(),
    playFullTrack: vi.fn(),
    pause: vi.fn(),
    destroy: vi.fn(),
  },
  loadStreak: vi.fn(),
  saveStreak: vi.fn(),
  saveSource: vi.fn(),
  loadRecentTrackIds: vi.fn(() => []),
  saveRecentTrackIds: vi.fn(),
  sourceKey: vi.fn(() => 'top'),
  SpotifyPlayer: vi.fn(),
}));

vi.mock('../auth/authClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../auth/authClient')>(),
  getAuthStatus: mocks.getAuthStatus,
}));
vi.mock('../sources/catalog', async (importOriginal) => ({
  ...await importOriginal<typeof import('../sources/catalog')>(),
  loadCatalog: mocks.loadCatalog,
  searchTracks: mocks.searchTracks,
}));
vi.mock('../sources/sourceStorage', async (importOriginal) => ({
  ...await importOriginal<typeof import('../sources/sourceStorage')>(),
  loadStreak: mocks.loadStreak,
  saveStreak: mocks.saveStreak,
  saveSource: mocks.saveSource,
  loadRecentTrackIds: mocks.loadRecentTrackIds,
  saveRecentTrackIds: mocks.saveRecentTrackIds,
  sourceKey: mocks.sourceKey,
}));
vi.mock('../player/SpotifyPlayer', () => ({
  SpotifyPlayer: mocks.SpotifyPlayer,
}));

const authStatus = {
  configured: true,
  authenticated: true,
  redirectUri: 'http://localhost:3000/api/callback',
  missing: { clientId: false, clientSecret: false },
};
const source: SourceDescriptor = { kind: 'top', name: 'My top tracks', imageUrl: null };
const tracks: Track[] = [{
  id: 'track-1', uri: 'spotify:track:track-1', title: 'One Song', artists: ['One Artist'],
  artistText: 'One Artist', durationMs: 180000, album: 'One Album', imageUrl: null,
}];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function chooseTopTracks() {
  await userEvent.click(await screen.findByRole('button', { name: /My top tracks/ }));
}

async function chooseLikedSongs() {
  await userEvent.click(await screen.findByRole('button', { name: /My liked songs/ }));
}
async function chooseGuess(track: Track) {
  await userEvent.type(screen.getByRole('combobox', { name: 'Guess' }), track.title);
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(track.title, 'i') }));
}


describe('App game workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthStatus.mockResolvedValue(authStatus);
    mocks.SpotifyPlayer.mockImplementation(function PlayerDouble() { return mocks.player; });
    mocks.searchTracks.mockResolvedValue(tracks);
    mocks.player.connect.mockResolvedValue('device-1');
    mocks.player.activate.mockResolvedValue(undefined);
    mocks.player.playClip.mockResolvedValue(undefined);
    mocks.player.pause.mockResolvedValue(undefined);
    mocks.player.playFullTrack.mockResolvedValue(undefined);
    mocks.loadStreak.mockReturnValue(0);
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads a selected catalog and starts a playable round', async () => {
    mocks.loadCatalog.mockResolvedValue({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    render(<App />);

    await chooseTopTracks();

    expect(await screen.findByRole('button', { name: 'Play 1 second clip' })).toBeVisible();
    expect(mocks.loadCatalog).toHaveBeenCalledWith(source, expect.any(AbortSignal));
    expect(mocks.player.connect).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale catalog when the user switches sources', async () => {
    const first = deferred<{ tracks: Track[]; exclusions: { duplicates: number; unavailable: number; unsupported: number } }>();
    const second = deferred<{ tracks: Track[]; exclusions: { duplicates: number; unavailable: number; unsupported: number } }>();
    mocks.loadCatalog.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<App />);

    await chooseTopTracks();
    await userEvent.click(await screen.findByRole('button', { name: 'Change source' }));
    await chooseLikedSongs();
    expect(mocks.loadCatalog.mock.calls[0][1].aborted).toBe(true);

    await act(async () => first.resolve({ tracks: [], exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } }));
    expect(screen.getByText('Loading My liked songs...')).toBeVisible();
    await act(async () => second.resolve({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } }));
    expect(await screen.findByRole('button', { name: 'Play 1 second clip' })).toBeVisible();
  });

  it('returns to login with a source resume intent when catalog auth expires', async () => {
    mocks.loadCatalog.mockRejectedValue(new AppError('Session expired.', { status: 401, code: 'spotify_authentication_error' }));
    mocks.getAuthStatus.mockResolvedValueOnce(authStatus).mockResolvedValueOnce({ ...authStatus, authenticated: false });
    render(<App />);

    await chooseTopTracks();

    expect(await screen.findByRole('link', { name: 'Connect Spotify' })).toBeVisible();
    expect(mocks.getAuthStatus).toHaveBeenCalledTimes(2);
  });

  it('destroys its single player instance when the app unmounts', async () => {
    mocks.loadCatalog.mockReturnValue(deferred<never>().promise);
    const view = render(<App />);
    await screen.findByRole('button', { name: /My top tracks/ });

    view.unmount();

    expect(mocks.player.destroy).toHaveBeenCalledTimes(1);
  });

  it('rechecks authentication and resumes the interrupted catalog request after login', async () => {
    mocks.loadCatalog.mockRejectedValueOnce(new AppError('Session expired.', { status: 401, code: 'spotify_authentication_error' })).mockResolvedValueOnce({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    mocks.getAuthStatus.mockResolvedValueOnce(authStatus).mockResolvedValueOnce({ ...authStatus, authenticated: false }).mockResolvedValueOnce(authStatus);
    render(<App />);

    await chooseTopTracks();
    await screen.findByRole('link', { name: 'Connect Spotify' });
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByRole('button', { name: 'Play 1 second clip' })).toBeVisible();
    expect(mocks.loadCatalog).toHaveBeenCalledTimes(2);
    expect(mocks.loadCatalog.mock.calls[1][0]).toEqual(source);
  });

  it('does not reset an active game when focus changes without an interrupted action', async () => {
    mocks.loadCatalog.mockResolvedValue({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    render(<App />);

    await chooseTopTracks();
    await screen.findByRole('button', { name: 'Play 1 second clip' });
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByRole('button', { name: 'Play 1 second clip' })).toBeVisible();
    expect(mocks.loadCatalog).toHaveBeenCalledTimes(1);
    expect(mocks.getAuthStatus).toHaveBeenCalledTimes(1);
  });

  it('aborts pending focus authentication and does not replay after unmount', async () => {
    const focusAuth = deferred<typeof authStatus>();
    mocks.loadCatalog.mockResolvedValue({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    mocks.player.activate.mockRejectedValueOnce(new AppError('Session expired.', { status: 401, code: 'spotify_authentication_error' }));
    mocks.getAuthStatus
      .mockResolvedValueOnce(authStatus)
      .mockResolvedValueOnce({ ...authStatus, authenticated: false })
      .mockReturnValueOnce(focusAuth.promise);
    const view = render(<App />);

    await chooseTopTracks();
    await userEvent.click(await screen.findByRole('button', { name: 'Play 1 second clip' }));
    await screen.findByRole('link', { name: 'Connect Spotify' });
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(mocks.getAuthStatus).toHaveBeenCalledTimes(3));
    const focusSignal = mocks.getAuthStatus.mock.calls[2][0] as AbortSignal;
    expect(focusSignal).toBeInstanceOf(AbortSignal);

    view.unmount();
    expect(focusSignal.aborted).toBe(true);
    await act(async () => focusAuth.resolve(authStatus));

    expect(mocks.SpotifyPlayer).toHaveBeenCalledTimes(1);
    expect(mocks.player.playClip).not.toHaveBeenCalled();
  });

  it('resumes a playable round after playback authentication is restored', async () => {
    mocks.loadCatalog.mockResolvedValue({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    mocks.player.activate.mockRejectedValueOnce(new AppError('Session expired.', { status: 401, code: 'spotify_authentication_error' }));
    mocks.getAuthStatus.mockResolvedValueOnce(authStatus).mockResolvedValueOnce({ ...authStatus, authenticated: false }).mockResolvedValueOnce(authStatus);
    const user = userEvent.setup();
    render(<App />);

    await chooseTopTracks();
    await user.click(await screen.findByRole('button', { name: 'Play 1 second clip' }));
    await screen.findByRole('link', { name: 'Connect Spotify' });
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByRole('button', { name: 'Play 1 second clip' })).toBeVisible();
    expect(mocks.loadCatalog).toHaveBeenCalledTimes(1);
    expect(mocks.player.activate).toHaveBeenCalledTimes(2);
    expect(mocks.player.playClip).toHaveBeenCalledWith('spotify:track:track-1', 1000, expect.any(Function));
  });

  it('replays the full result track after authentication is restored', async () => {
    mocks.loadCatalog.mockResolvedValue({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    mocks.player.playFullTrack.mockRejectedValueOnce(new AppError('Session expired.', { status: 401, code: 'spotify_authentication_error' }));
    mocks.getAuthStatus.mockResolvedValueOnce(authStatus).mockResolvedValueOnce({ ...authStatus, authenticated: false }).mockResolvedValueOnce(authStatus);
    const user = userEvent.setup();
    render(<App />);

    await chooseTopTracks();
    await chooseGuess(tracks[0]);
    await user.click(screen.getByRole('button', { name: 'Submit guess' }));
    await user.click(await screen.findByRole('button', { name: 'Play full track' }));
    await screen.findByRole('link', { name: 'Connect Spotify' });
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByRole('button', { name: 'Play full track' })).toBeVisible();
    expect(mocks.player.playFullTrack).toHaveBeenCalledTimes(2);
  });

  it('does not arm a stale source auth resume after switching sources', async () => {
    const authCheck = deferred<typeof authStatus>();
    mocks.loadCatalog.mockRejectedValueOnce(new AppError('Expired A', { status: 401, code: 'spotify_authentication_error' })).mockResolvedValueOnce({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    mocks.getAuthStatus.mockResolvedValueOnce(authStatus).mockReturnValueOnce(authCheck.promise);
    render(<App />);

    await chooseTopTracks();
    await userEvent.click(await screen.findByRole('button', { name: 'Change source' }));
    await chooseLikedSongs();
    await screen.findByRole('button', { name: 'Play 1 second clip' });
    await act(async () => authCheck.resolve({ ...authStatus, authenticated: false }));
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByRole('button', { name: 'Play 1 second clip' })).toBeVisible();
    expect(mocks.loadCatalog).toHaveBeenCalledTimes(2);
  });

  it('keeps a Change source action available during gameplay and results', async () => {
    mocks.loadCatalog.mockResolvedValue({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    const user = userEvent.setup();
    render(<App />);

    await chooseTopTracks();
    expect(await screen.findByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Change source' }),
    );

    await chooseGuess(tracks[0]);
    await user.click(screen.getByRole('button', { name: 'Submit guess' }));
    expect(await screen.findByRole('button', { name: 'Play full track' })).toBeVisible();
    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Change source' }),
    );
  });

  it('persists a winning streak and pauses before starting another round from results', async () => {
    mocks.loadCatalog.mockResolvedValue({ tracks, exclusions: { duplicates: 0, unavailable: 0, unsupported: 0 } });
    mocks.loadStreak.mockReturnValue(4);
    const user = userEvent.setup();
    render(<App />);

    await chooseTopTracks();
    await chooseGuess(tracks[0]);
    await user.click(screen.getByRole('button', { name: 'Submit guess' }));
    expect(await screen.findByRole('button', { name: 'Play full track' })).toBeVisible();
    expect(mocks.saveStreak).toHaveBeenCalledWith(5);

    await user.click(screen.getByRole('button', { name: 'Play full track' }));
    expect(mocks.player.playFullTrack).toHaveBeenCalledWith('spotify:track:track-1');
    const pause = deferred<void>();
    mocks.player.pause.mockReturnValueOnce(pause.promise);
    await user.click(screen.getByRole('button', { name: 'Play another' }));
    expect(mocks.player.pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play another' })).toBeVisible();
    await act(async () => pause.resolve());
    expect(await screen.findByRole('button', { name: 'Play 1 second clip' })).toBeVisible();
  });
});
