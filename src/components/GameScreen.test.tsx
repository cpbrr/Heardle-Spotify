import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GameScreen } from './GameScreen';

describe('GameScreen', () => {
  it('renders six stable attempt rows', () => {
    render(<GameScreen />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
});

import { createRound } from '../game/gameEngine';
import type { Track } from '../spotify/types';

const tracks: Track[] = [
  { id: 'answer', uri: 'spotify:track:answer', title: 'Answer Song', artists: ['Artist'], artistText: 'Artist', durationMs: 180_000, album: 'Album', imageUrl: null },
];

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

    expect(screen.getByRole('button', { name: 'Play 1 second clip' })).toBeVisible();
  });
});
import userEvent from '@testing-library/user-event';

describe('GameScreen interactions', () => {
  it('activates before playback and submits a catalog-derived wrong guess', async () => {
    const calls: string[] = [];
    let changed: ReturnType<typeof createRound> | undefined;
    const player = { activate: async () => { calls.push('activate'); }, playClip: async () => { calls.push('play'); }, pause: async () => undefined };
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={[...tracks, { ...tracks[0], id: 'other', title: 'Other Song' }]} player={player} onRoundChange={(round) => { changed = round; }} onRoundComplete={() => undefined} onAuthExpired={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Play 1 second clip' }));
    expect(calls).toEqual(['activate', 'play']);
    await user.selectOptions(screen.getByLabelText('Guess'), 'other');
    await user.click(screen.getByRole('button', { name: 'Submit guess' }));
    expect(changed).toMatchObject({ attemptIndex: 1 });
    expect(changed?.attempts[0]).toEqual({ kind: 'incorrect', label: 'Other Song - Artist' });
  });
});


describe('GameScreen playback failures', () => {
  it('renders an ordinary playback failure instead of requesting auth recovery', async () => {
    let recovered = 0;
    const player = { activate: async () => { throw new Error('Speaker unavailable'); }, playClip: async () => undefined, pause: async () => undefined };
    const user = userEvent.setup();
    render(<GameScreen round={createRound(tracks[0])} tracks={tracks} player={player} onRoundChange={() => undefined} onRoundComplete={() => undefined} onAuthExpired={() => { recovered += 1; }} />);

    await user.click(screen.getByRole('button', { name: 'Play 1 second clip' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Speaker unavailable');
    expect(recovered).toBe(0);
  });
});

