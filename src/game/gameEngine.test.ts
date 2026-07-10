import { describe, expect, it } from 'vitest';

import {
  CLIP_LIMITS,
  completeRound,
  createRound,
  giveUp,
  normalizeGuess,
  selectRoundTrack,
  skipAttempt,
  submitGuess,
} from './gameEngine';
import type { Track } from '../spotify/types';

function track(id: string, title = `Track ${id}`, artist = 'Artist'): Track {
  return {
    id,
    uri: `spotify:track:${id}`,
    title,
    artists: [artist],
    artistText: artist,
    durationMs: 180_000,
    album: 'Album',
    imageUrl: null,
  };
}

describe('gameEngine', () => {
  it('uses the six Heardle clip limits', () => {
    expect(CLIP_LIMITS).toEqual([1_000, 2_000, 4_000, 7_000, 11_000, 16_000]);
  });

  it('advances from a wrong guess to the next clip', () => {
    const round = submitGuess(createRound(track('answer')), {
      trackId: 'wrong',
      label: 'Wrong - Artist',
    });

    expect(round.status).toBe('playing');
    expect(round.attemptIndex).toBe(1);
    expect(round.attempts[0]).toEqual({ kind: 'incorrect', label: 'Wrong - Artist' });
    expect(round.clipLimitMs).toBe(2_000);
  });

  it('wins when the selected track id matches the answer', () => {
    const round = submitGuess(createRound(track('answer')), {
      trackId: 'answer',
      label: 'Track answer - Artist',
    });

    expect(round.status).toBe('won');
    expect(round.attempts[0].kind).toBe('correct');
  });

  it('uses normalized title and artist text as a fallback', () => {
    const round = submitGuess(createRound(track('answer', 'Beyonce: Halo', 'Beyoncé')), {
      label: ' beyonce halo - BEYONCE ',
    });

    expect(round.status).toBe('won');
  });

  it('records skips and loses after the sixth consumed attempt', () => {
    let round = createRound(track('answer'));
    for (let index = 0; index < 6; index += 1) {
      round = skipAttempt(round);
    }

    expect(round.status).toBe('lost');
    expect(round.attempts.every((attempt) => attempt.kind === 'skipped')).toBe(true);
  });

  it('allows an immediate give up', () => {
    expect(giveUp(createRound(track('answer'))).status).toBe('lost');
  });

  it('increments a winning streak and resets a losing streak', () => {
    const won = submitGuess(createRound(track('answer')), { trackId: 'answer', label: 'Answer' });
    const lost = giveUp(createRound(track('answer')));

    expect(completeRound(won, 7).streak).toBe(8);
    expect(completeRound(lost, 7).streak).toBe(0);
  });

  it('avoids recently played tracks when alternatives exist', () => {
    const tracks = [track('one'), track('two'), track('three')];

    expect(selectRoundTrack(tracks, ['one', 'two'], () => 0).id).toBe('three');
    expect(selectRoundTrack([tracks[0]], ['one'], () => 0).id).toBe('one');
  });

  it('normalizes accents, punctuation, case, and whitespace', () => {
    expect(normalizeGuess('  Sigur Rós: Sæglópur  ')).toBe('sigur ros sæglopur');
  });
});
