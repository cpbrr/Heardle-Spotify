import type { Round } from '../game/gameEngine';
import { skipAttempt, submitGuess } from '../game/gameEngine';
import { AppError } from '../auth/authClient';
import type { Track } from '../spotify/types';

type GamePlayer = { activate(): Promise<void>; playClip(uri: string, limitMs: number, onProgress: (positionMs: number) => void): Promise<void>; pause(): Promise<void> };
interface GameScreenProps { round?: Round; tracks?: Track[]; player?: GamePlayer; onRoundChange?: (round: Round) => void; onRoundComplete?: (round: Round) => void; onAuthExpired?: (error: unknown) => void }

function isAuthenticationError(error: unknown) { return error instanceof AppError && (error.status === 401 || error.code.includes('auth')); }

export function GameScreen({ round, tracks = [], player, onRoundChange, onRoundComplete, onAuthExpired }: GameScreenProps = {}) {
  if (!round || !player) return <main><h1>Heardle</h1><ol aria-label="Attempts">{Array.from({ length: 6 }, (_, index) => <li key={index}>Pending</li>)}</ol></main>;
  const recover = (error: unknown) => { if (isAuthenticationError(error)) onAuthExpired?.(error); };
  const play = async () => { try { await player.activate(); await player.playClip(round.answer.uri, round.clipLimitMs, () => undefined); } catch (error) { recover(error); } };
  const update = (next: Round) => { onRoundChange?.(next); if (next.status !== 'playing') onRoundComplete?.(next); };
  const skip = async () => { try { await player.pause(); update(skipAttempt(round)); } catch (error) { recover(error); } };
  const submit = (trackId: string) => { const track = tracks.find((item) => item.id === trackId); if (track) update(submitGuess(round, { trackId: track.id, label: `${track.title} - ${track.artistText}` })); };
  const seconds = Math.round(round.clipLimitMs / 1000);
  const disabled = round.status !== 'playing';
  return (
    <main className="game-screen"><h1>Heardle</h1>
      <ol aria-label="Attempts">{round.attempts.map((attempt, index) => <li key={index}>{attempt.kind === 'pending' ? 'Pending' : attempt.kind === 'skipped' ? 'Skipped' : attempt.label}</li>)}</ol>
      <form onSubmit={(event) => { event.preventDefault(); submit(String(new FormData(event.currentTarget).get('guess') || '')); }}>
        <label>Guess <select name="guess" defaultValue="" disabled={disabled}><option value="">Choose a song</option>{tracks.map((track) => <option key={track.id} value={track.id}>{track.title} - {track.artistText}</option>)}</select></label>
        <button type="submit" disabled={disabled}>Submit guess</button>
      </form>
      <button type="button" disabled={disabled} onClick={() => void play()} aria-label={`Play ${seconds} second clip`}>Play {seconds} second clip</button>
      <button type="button" disabled={disabled} onClick={() => void skip()}>Skip +1s</button>
    </main>
  );
}
