import type { Track } from '../spotify/types';

export const CLIP_LIMITS = [1_000, 2_000, 4_000, 7_000, 11_000, 16_000] as const;

export type Attempt =
  | { kind: 'pending' }
  | { kind: 'skipped' }
  | { kind: 'incorrect'; label: string }
  | { kind: 'correct'; label: string };

export interface GuessChoice {
  trackId?: string;
  label: string;
}

export interface Round {
  answer: Track;
  attempts: Attempt[];
  attemptIndex: number;
  clipLimitMs: number;
  status: 'playing' | 'won' | 'lost';
}

export function createRound(answer: Track): Round {
  return {
    answer,
    attempts: Array.from({ length: CLIP_LIMITS.length }, () => ({ kind: 'pending' as const })),
    attemptIndex: 0,
    clipLimitMs: CLIP_LIMITS[0],
    status: 'playing',
  };
}

export function normalizeGuess(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function answerLabel(round: Round) {
  return `${round.answer.title} - ${round.answer.artistText}`;
}

function consumeAttempt(round: Round, attempt: Attempt): Round {
  const attempts = round.attempts.map((current, index) => (
    index === round.attemptIndex ? attempt : current
  ));
  const exhausted = round.attemptIndex >= CLIP_LIMITS.length - 1;
  const nextIndex = exhausted ? round.attemptIndex : round.attemptIndex + 1;

  return {
    ...round,
    attempts,
    attemptIndex: nextIndex,
    clipLimitMs: CLIP_LIMITS[nextIndex],
    status: exhausted ? 'lost' : 'playing',
  };
}

export function submitGuess(round: Round, guess: GuessChoice): Round {
  if (round.status !== 'playing') {
    return round;
  }

  const isCorrect = Boolean(guess.trackId && guess.trackId === round.answer.id)
    || normalizeGuess(guess.label) === normalizeGuess(answerLabel(round));
  if (!isCorrect) {
    return consumeAttempt(round, { kind: 'incorrect', label: guess.label });
  }

  return {
    ...round,
    attempts: round.attempts.map((attempt, index) => (
      index === round.attemptIndex ? { kind: 'correct' as const, label: guess.label } : attempt
    )),
    status: 'won',
  };
}

export function skipAttempt(round: Round): Round {
  if (round.status !== 'playing') {
    return round;
  }
  return consumeAttempt(round, { kind: 'skipped' });
}

export function giveUp(round: Round): Round {
  return round.status === 'playing' ? { ...round, status: 'lost' } : round;
}

export function completeRound(round: Round, currentStreak: number) {
  return {
    round,
    streak: round.status === 'won' ? Math.max(0, currentStreak) + 1 : 0,
  };
}

export function selectRoundTrack(
  tracks: Track[],
  recentTrackIds: string[],
  random: () => number = Math.random,
) {
  if (!tracks.length) {
    throw new Error('Cannot start a round without playable tracks.');
  }

  const recent = new Set(recentTrackIds);
  const eligible = tracks.filter((track) => !recent.has(track.id));
  const pool = eligible.length ? eligible : tracks;
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length));
  return pool[index];
}
