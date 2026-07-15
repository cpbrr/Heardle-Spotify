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
