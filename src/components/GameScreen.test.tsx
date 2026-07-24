import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GameScreen } from './GameScreen';

describe('GameScreen', () => {
  it('renders seven stable attempt rows', () => {
    render(<GameScreen />);
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });
});

import { createRound } from '../game/gameEngine';
import type { Track } from '../spotify/types';

const tracks: Track[] = [
  { id: 'answer', uri: 'spotify:track:answer', title: 'Answer Song', artists: ['Artist'], artistText: 'Artist', durationMs: 180_000, album: 'Album', imageUrl: null },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('GameScreen clip controls', () => {
  it('plays the current clip and exposes the matching clip label', () => {
    const player = { activate: async () => undefined, playClip: async () => undefined, pause: async () => undefined };
    render(
      <GameScreen
        round={createRound(tracks[0])}
        tracks={tracks}
        player={player}
        onRoundChange={() => undefined}
        onRoundComplete={() => undefined}
        onAuthExpired={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Play 0.5 second clip' })).toBeVisible();
  });
});
import userEvent from '@testing-library/user-event';
async function chooseGuess(track: Track) {
  await userEvent.type(screen.getByRole('combobox', { name: 'Guess' }), track.title);
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(track.title, 'i') }));
}


describe('GameScreen interactions', () => {
  it('activates before playback and submits a globally searched track that is absent from the answer catalog', async () => {
    const calls: string[] = [];
    let changed: ReturnType<typeof createRound> | undefined;
    const outsideTrack = { ...tracks[0], id: 'outside', title: 'Outside Song' };
    const player = { activate: async () => { calls.push('activate'); }, playClip: async () => { calls.push('play'); }, pause: async () => undefined };
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} searchTracks={vi.fn().mockResolvedValue([outsideTrack])} player={player} onRoundChange={(round) => { changed = round; }} onRoundComplete={() => undefined} onAuthExpired={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Play 0.5 second clip' }));
    expect(calls).toEqual(['activate', 'play']);
    await chooseGuess(outsideTrack);
    await user.click(screen.getByRole('button', { name: 'Submit guess' }));
    expect(changed).toMatchObject({ attemptIndex: 1 });
    expect(changed?.attempts[0]).toEqual({ kind: 'incorrect', label: 'Outside Song - Artist' });
    expect(screen.getByRole('button', { name: 'Submit guess' })).toBeDisabled();
  });

  it('disables Submit immediately when the selected guess text is edited', async () => {
    const player = { activate: async () => undefined, playClip: async () => undefined, pause: async () => undefined };
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} searchTracks={vi.fn().mockResolvedValue(tracks)} player={player} onRoundChange={vi.fn()} onRoundComplete={() => undefined} onAuthExpired={() => undefined} />);

    await chooseGuess(tracks[0]);
    expect(screen.getByRole('button', { name: 'Submit guess' })).toBeEnabled();
    await user.type(screen.getByRole('combobox', { name: 'Guess' }), ' remix');

    expect(screen.getByRole('button', { name: 'Submit guess' })).toBeDisabled();
  });
});


describe('GameScreen playback failures', () => {
  it('renders an ordinary playback failure instead of requesting auth recovery', async () => {
    let recovered = 0;
    const player = { activate: async () => { throw new Error('Speaker unavailable'); }, playClip: async () => undefined, pause: async () => undefined };
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} player={player} onRoundChange={() => undefined} onRoundComplete={() => undefined} onAuthExpired={() => { recovered += 1; }} />);

    await user.click(screen.getByRole('button', { name: 'Play 0.5 second clip' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Speaker unavailable');
    expect(recovered).toBe(0);
  });
});


describe('GameScreen completion interactions', () => {
  it('ignores repeated Skip song activation while pause is pending', async () => {
    const pause = deferred<void>();
    const pausePlayback = vi.fn(() => pause.promise);
    const onRoundChange = vi.fn();
    const onRoundComplete = vi.fn();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} player={{ activate: async () => undefined, playClip: async () => undefined, pause: pausePlayback }} onRoundChange={onRoundChange} onRoundComplete={onRoundComplete} onAuthExpired={() => undefined} />);

    const skipSong = screen.getByRole('button', { name: 'Skip song' });
    fireEvent.click(skipSong);
    fireEvent.click(skipSong);

    expect(pausePlayback).toHaveBeenCalledTimes(1);
    expect(skipSong).toBeDisabled();

    pause.resolve();
    await vi.waitFor(() => expect(onRoundComplete).toHaveBeenCalledTimes(1));
    expect(onRoundChange).toHaveBeenCalledTimes(1);
  });

  it('pauses playback before Skip song immediately completes the round as a loss', async () => {
    const pause = deferred<void>();
    const pausePlayback = vi.fn(() => pause.promise);
    const onRoundChange = vi.fn();
    const onRoundComplete = vi.fn();
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} player={{ activate: async () => undefined, playClip: async () => undefined, pause: pausePlayback }} onRoundChange={onRoundChange} onRoundComplete={onRoundComplete} onAuthExpired={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Skip song' }));
    expect(pausePlayback).toHaveBeenCalledTimes(1);
    expect(onRoundChange).not.toHaveBeenCalled();
    expect(onRoundComplete).not.toHaveBeenCalled();

    pause.resolve();
    await vi.waitFor(() => expect(onRoundComplete).toHaveBeenCalledTimes(1));
    expect(onRoundChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'lost' }));
    expect(onRoundComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'lost' }));
  });
  it('clicks Skip and emits the next skipped attempt', async () => {
    let changed: ReturnType<typeof createRound> | undefined;
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} player={{ activate: async () => undefined, playClip: async () => undefined, pause: async () => undefined }} onRoundChange={(round) => { changed = round; }} onRoundComplete={() => undefined} onAuthExpired={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Skip +1s' }));
    expect(changed?.attemptIndex).toBe(1);
    expect(changed?.attempts[0]).toEqual({ kind: 'skipped' });
  });

  it('clears a selected guess when skipping to the next attempt', async () => {
    const player = { activate: async () => undefined, playClip: async () => undefined, pause: async () => undefined };
    const searchTracks = vi.fn().mockResolvedValue(tracks);
    const onRoundChange = vi.fn();
    const user = userEvent.setup();
    const view = render(<GameScreen round={createRound(tracks[0])} tracks={tracks} searchTracks={searchTracks} player={player} onRoundChange={onRoundChange} onRoundComplete={() => undefined} onAuthExpired={() => undefined} />);

    await chooseGuess(tracks[0]);
    expect(screen.getByRole('button', { name: 'Submit guess' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Skip +1s' }));
    expect(onRoundChange).toHaveBeenCalledTimes(1);
    const skippedRound = onRoundChange.mock.calls[0][0];
    view.rerender(<GameScreen round={skippedRound} tracks={tracks} searchTracks={searchTracks} player={player} onRoundChange={onRoundChange} onRoundComplete={() => undefined} onAuthExpired={() => undefined} />);

    expect(screen.getByRole('combobox', { name: 'Guess' })).toHaveValue('');
    const submit = screen.getByRole('button', { name: 'Submit guess' });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(onRoundChange).toHaveBeenCalledTimes(1);
  });

  it('clicks a correct global search result and completes the round', async () => {
    let completed = 0;
    let changed: ReturnType<typeof createRound> | undefined;
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} searchTracks={vi.fn().mockResolvedValue(tracks)} player={{ activate: async () => undefined, playClip: async () => undefined, pause: async () => undefined }} onRoundChange={(round) => { changed = round; }} onRoundComplete={() => { completed += 1; }} onAuthExpired={() => undefined} />);
    await chooseGuess(tracks[0]);
    await user.click(screen.getByRole('button', { name: 'Submit guess' }));
    expect(changed?.status).toBe('won');
    expect(completed).toBe(1);
  });

  it('pauses playback before emitting a terminal guess', async () => {
    const pause = deferred<void>();
    const pausePlayback = vi.fn(() => pause.promise);
    let completed = 0;
    let changed: ReturnType<typeof createRound> | undefined;
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} searchTracks={vi.fn().mockResolvedValue(tracks)} player={{ activate: async () => undefined, playClip: async () => undefined, pause: pausePlayback }} onRoundChange={(round) => { changed = round; }} onRoundComplete={() => { completed += 1; }} onAuthExpired={() => undefined} />);

    await chooseGuess(tracks[0]);
    await user.click(screen.getByRole('button', { name: 'Submit guess' }));
    expect(pausePlayback).toHaveBeenCalledTimes(1);
    expect(changed).toBeUndefined();
    expect(completed).toBe(0);

    pause.resolve();
    await vi.waitFor(() => expect(completed).toBe(1));
    expect(changed?.status).toBe('won');
  });

  it('completes a final skip as a loss and disables terminal controls', async () => {
    let completed = 0;
    let changed: ReturnType<typeof createRound> | undefined;
    const lastAttempt = { ...createRound(tracks[0]), attemptIndex: 6, clipLimitMs: 16_000 };
    const user = userEvent.setup();
    render(<GameScreen round={lastAttempt} tracks={tracks} player={{ activate: async () => undefined, playClip: async () => undefined, pause: async () => undefined }} onRoundChange={(round) => { changed = round; }} onRoundComplete={() => { completed += 1; }} onAuthExpired={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Skip +1s' }));
    expect(changed?.status).toBe('lost');
    expect(completed).toBe(1);
    render(<GameScreen round={{ ...lastAttempt, status: 'lost' }} tracks={tracks} player={{ activate: async () => undefined, playClip: async () => undefined, pause: async () => undefined }} onRoundChange={() => undefined} onRoundComplete={() => undefined} onAuthExpired={() => undefined} />);
    for (const button of screen.getAllByRole('button', { name: /play 16 second clip|skip \+1s|submit guess/i }).slice(-3)) {
      expect(button).toBeDisabled();
    }
  });
});


import { AppError } from '../auth/authClient';

describe('GameScreen auth failures', () => {
  it('clicks Play and requests auth recovery for typed auth errors', async () => {
    let recovered = 0;
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} player={{ activate: async () => { throw new AppError('Expired', { status: 401, code: 'spotify_authentication_error' }); }, playClip: async () => undefined, pause: async () => undefined }} onRoundChange={() => undefined} onRoundComplete={() => undefined} onAuthExpired={() => { recovered += 1; }} />);
    await user.click(screen.getByRole('button', { name: 'Play 0.5 second clip' }));
    expect(recovered).toBe(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('does not lose the round when Skip song pause fails with an authentication error', async () => {
    const authenticationError = new AppError('Expired', { status: 401, code: 'spotify_authentication_error' });
    const onRoundChange = vi.fn();
    const onRoundComplete = vi.fn();
    const onAuthExpired = vi.fn();
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} player={{ activate: async () => undefined, playClip: async () => undefined, pause: vi.fn().mockRejectedValue(authenticationError) }} onRoundChange={onRoundChange} onRoundComplete={onRoundComplete} onAuthExpired={onAuthExpired} />);

    await user.click(screen.getByRole('button', { name: 'Skip song' }));

    expect(onRoundChange).not.toHaveBeenCalled();
    expect(onRoundComplete).not.toHaveBeenCalled();
    expect(onAuthExpired).toHaveBeenCalledWith(authenticationError);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Skip song' })).toBeEnabled();
  });
});

