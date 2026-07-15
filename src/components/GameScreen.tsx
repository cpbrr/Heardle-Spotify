import type { Round } from '../game/gameEngine';
import { skipAttempt } from '../game/gameEngine';
import type { Track } from '../spotify/types';

type GamePlayer = { activate(): Promise<void>; playClip(uri: string, limitMs: number, onProgress: (positionMs: number) => void): Promise<void>; pause(): Promise<void> };
interface GameScreenProps { round?: Round; tracks?: Track[]; player?: GamePlayer; onRoundChange?: (round: Round) => void; onRoundComplete?: (round: Round) => void; onAuthExpired?: (error: unknown) => void }

export function GameScreen({ round, player, onRoundChange, onRoundComplete, onAuthExpired }: GameScreenProps = {}) {
  if (!round || !player) return <main><h1>Heardle</h1><ol aria-label="Attempts">{Array.from({ length: 6 }, (_, index) => <li key={index}>Pending</li>)}</ol></main>;
  const play = async () => { try { await player.activate(); await player.playClip(round.answer.uri, round.clipLimitMs, () => undefined); } catch (error) { onAuthExpired?.(error); } };
  const skip = async () => { try { await player.pause(); const next = skipAttempt(round); onRoundChange?.(next); if (next.status !== 'playing') onRoundComplete?.(next); } catch (error) { onAuthExpired?.(error); } };
  const seconds = Math.round(round.clipLimitMs / 1000);
  return (
    <main className="game-screen"><h1>Heardle</h1>
      <ol aria-label="Attempts">{round.attempts.map((attempt, index) => <li key={index}>{attempt.kind === 'pending' ? 'Pending' : attempt.kind === 'skipped' ? 'Skipped' : attempt.label}</li>)}</ol>
      <button type="button" onClick={() => void play()} aria-label={`Play ${seconds} second clip`}>Play {seconds} second clip</button>
      <button type="button" onClick={() => void skip()}>Skip +1s</button>
    </main>
  );
}
