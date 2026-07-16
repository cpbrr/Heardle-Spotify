import { useState } from 'react';
import type { Round } from '../game/gameEngine';
import { skipAttempt, submitGuess } from '../game/gameEngine';
import { AppError } from '../auth/authClient';
import type { Track } from '../spotify/types';
import { TrackSearch } from './TrackSearch';
import type { TrackSearchFunction } from './TrackSearch';

type GamePlayer = { activate(): Promise<void>; playClip(uri: string, limitMs: number, onProgress: (positionMs: number) => void): Promise<void>; pause(): Promise<void> };
interface GameScreenProps { round?: Round; tracks?: Track[]; searchTracks?: TrackSearchFunction; player?: GamePlayer; onRoundChange?: (round: Round) => void; onRoundComplete?: (round: Round) => void; onAuthExpired?: (error: unknown) => void }

function isAuthenticationError(error: unknown) { return error instanceof AppError && (error.status === 401 || error.code.includes('auth')); }

export function GameScreen({ round, searchTracks, player, onRoundChange, onRoundComplete, onAuthExpired }: GameScreenProps = {}) {
  const [error, setError] = useState<string | null>(null);
  const [selectedGuess, setSelectedGuess] = useState<Track | null>(null);
  if (!round || !player) return <main><h1>Heardle</h1><ol aria-label="Attempts">{Array.from({ length: 6 }, (_, index) => <li key={index}>Pending</li>)}</ol></main>;
  const recover = (failure: unknown) => { if (isAuthenticationError(failure)) onAuthExpired?.(failure); else setError(failure instanceof Error ? failure.message : 'Playback failed.'); };
  const play = async () => { setError(null); try { await player.activate(); await player.playClip(round.answer.uri, round.clipLimitMs, () => undefined); } catch (failure) { recover(failure); } };
  const update = (next: Round) => { onRoundChange?.(next); if (next.status !== 'playing') onRoundComplete?.(next); };
  const skip = async () => { setError(null); try { await player.pause(); const next = skipAttempt(round); if (next.status === 'playing') setSelectedGuess(null); update(next); } catch (failure) { recover(failure); } };
  const submit = async () => { if (!selectedGuess) return; const next = submitGuess(round, { trackId: selectedGuess.id, label: `${selectedGuess.title} - ${selectedGuess.artistText}` }); try { if (next.status !== 'playing') await player.pause(); else setSelectedGuess(null); update(next); } catch (failure) { recover(failure); } };
  const seconds = Math.round(round.clipLimitMs / 1000);
  const disabled = round.status !== 'playing';
  return (
    <main className="game-screen"><h1>Heardle</h1>
      <ol aria-label="Attempts">{round.attempts.map((attempt, index) => <li key={index}>{attempt.kind === 'pending' ? 'Pending' : attempt.kind === 'skipped' ? 'Skipped' : attempt.label}</li>)}</ol>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <TrackSearch key={round.attemptIndex} disabled={disabled} onSelect={setSelectedGuess} search={searchTracks} />
        <button type="submit" disabled={disabled || !selectedGuess}>Submit guess</button>
      </form>
      <button type="button" disabled={disabled} onClick={() => void play()} aria-label={`Play ${seconds} second clip`}>Play {seconds} second clip</button>
      <button type="button" disabled={disabled} onClick={() => void skip()}>Skip +1s</button>
    </main>
  );
}
