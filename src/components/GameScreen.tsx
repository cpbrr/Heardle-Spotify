import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Round } from '../game/gameEngine';
import { CLIP_LIMITS, giveUp, skipAttempt, submitGuess } from '../game/gameEngine';
import { AppError } from '../auth/authClient';
import type { Track } from '../spotify/types';
import { TrackSearch } from './TrackSearch';
import type { TrackSearchFunction } from './TrackSearch';

type GamePlayer = {
  activate(): Promise<void>;
  playClip(uri: string, limitMs: number, onProgress: (positionMs: number) => void): Promise<void>;
  pause(): Promise<void>;
  prewarm?(): Promise<void>;
};

interface GameScreenProps {
  round?: Round;
  tracks?: Track[];
  searchTracks?: TrackSearchFunction;
  player?: GamePlayer;
  onRoundChange?: (round: Round) => void;
  onRoundComplete?: (round: Round) => void;
  onAuthExpired?: (error: unknown) => void;
}

const MAX_CLIP_MS = CLIP_LIMITS[CLIP_LIMITS.length - 1];
const WAVEFORM_BAR_HEIGHTS = [34, 58, 22, 71, 45, 63, 30, 82, 40, 26, 52, 36, 68, 24, 58, 32, 74, 20, 48, 30];
const WAVEFORM_PLAYED_BARS = 9;

function isAuthenticationError(error: unknown) {
  return error instanceof AppError && (error.status === 401 || error.code.includes('auth'));
}

export function GameScreen({ round, searchTracks, player, onRoundChange, onRoundComplete, onAuthExpired }: GameScreenProps = {}) {
  const [error, setError] = useState<string | null>(null);
  const [selectedGuess, setSelectedGuess] = useState<Track | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const isCompletingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [fillPct, setFillPct] = useState(0);
  const [fillTransition, setFillTransition] = useState('none');
  const fillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFillPct(0);
    setFillTransition('none');
    if (fillTimerRef.current) clearTimeout(fillTimerRef.current);
    return () => {
      if (fillTimerRef.current) clearTimeout(fillTimerRef.current);
    };
  }, [round?.attemptIndex]);

  useEffect(() => {
    void player?.prewarm?.().catch(() => undefined);
  }, [player]);

  if (!round || !player) {
    return (
      <main>
        <h1>Heardle</h1>
        <ol aria-label="Attempts">
          {Array.from({ length: CLIP_LIMITS.length }, (_, index) => <li key={index}>Pending</li>)}
        </ol>
      </main>
    );
  }

  const animateProgress = (clipMs: number) => {
    if (fillTimerRef.current) clearTimeout(fillTimerRef.current);
    const targetPct = (clipMs / MAX_CLIP_MS) * 100;
    setFillTransition('none');
    setFillPct(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFillTransition(`width ${clipMs}ms linear`);
        setFillPct(targetPct);
      });
    });
    fillTimerRef.current = setTimeout(() => {
      setFillTransition('none');
      setFillPct(0);
    }, clipMs + 80);
  };

  const recover = (failure: unknown) => {
    if (isAuthenticationError(failure)) {
      onAuthExpired?.(failure);
    } else {
      setError(failure instanceof Error ? failure.message : 'Playback failed.');
    }
  };

  const play = async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsPlaying(true);
    setError(null);
    try {
      await player.activate();
      await player.playClip(round.answer.uri, round.clipLimitMs, () => undefined);
      animateProgress(round.clipLimitMs);
    } catch (failure) {
      recover(failure);
    } finally {
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  };

  const update = (next: Round) => {
    onRoundChange?.(next);
    if (next.status !== 'playing') onRoundComplete?.(next);
  };

  const skip = async () => {
    setError(null);
    try {
      await player.pause();
      const next = skipAttempt(round);
      if (next.status === 'playing') setSelectedGuess(null);
      update(next);
    } catch (failure) {
      recover(failure);
    }
  };

  const skipSong = async () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    setIsCompleting(true);
    setError(null);
    try {
      await player.pause();
      update(giveUp(round));
    } catch (failure) {
      isCompletingRef.current = false;
      setIsCompleting(false);
      recover(failure);
    }
  };

  const submit = async () => {
    if (!selectedGuess) return;
    const next = submitGuess(round, { trackId: selectedGuess.id, label: `${selectedGuess.title} - ${selectedGuess.artistText}` });
    try {
      if (next.status !== 'playing') {
        await player.pause();
      } else {
        setSelectedGuess(null);
      }
      update(next);
    } catch (failure) {
      recover(failure);
    }
  };

  const seconds = round.clipLimitMs / 1000;
  const disabled = round.status !== 'playing' || isCompleting;

  return (
    <main className="game-screen">
      <div className="game-screen__primary">
        <div>
          <span className="eyebrow">Round · attempt {round.attemptIndex + 1} of {CLIP_LIMITS.length}</span>
          <h1>Listen closely</h1>
        </div>

        <ol aria-label="Attempts">
          {round.attempts.map((attempt, index) => (
            <li key={index}>
              {attempt.kind === 'pending' ? 'Pending' : attempt.kind === 'skipped' ? 'Skipped' : attempt.label}
            </li>
          ))}
        </ol>

        {error && <p role="alert">{error}</p>}

        <div className="play-control">
          <button
            type="button"
            className="play-button"
            disabled={disabled || isPlaying}
            onClick={() => void play()}
            aria-label={`Play ${seconds} second clip`}
          >
            <Play size={28} fill="currentColor" aria-hidden="true" />
          </button>
          <div className="waveform" aria-hidden="true">
            {WAVEFORM_BAR_HEIGHTS.map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} data-played={index < WAVEFORM_PLAYED_BARS} />
            ))}
          </div>
        </div>

        <div className="progress-track">
          <div className="progress-track__label">
            <span className="eyebrow">Progress</span>
            <strong>Clip: {seconds}s</strong>
          </div>
          <div className="progress-track__rail">
            <div className="progress-track__fill" style={{ width: `${fillPct}%`, transition: fillTransition }} />
            {CLIP_LIMITS.map((limitMs, index) => (
              <div
                key={limitMs}
                className="progress-track__dot"
                style={{ left: `${(limitMs / MAX_CLIP_MS) * 100}%` }}
                data-passed={index < round.attemptIndex}
                data-current={index === round.attemptIndex}
              />
            ))}
          </div>
          <div className="progress-track__ticks">
            {CLIP_LIMITS.map((limitMs, index) => (
              <span
                key={limitMs}
                className="progress-track__tick"
                style={{ left: `${(limitMs / MAX_CLIP_MS) * 100}%` }}
                data-current={index === round.attemptIndex}
              >
                {limitMs / 1000}s
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="guess-panel">
        <span className="eyebrow">Your guess</span>
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <TrackSearch key={round.attemptIndex} disabled={disabled} onClear={() => setSelectedGuess(null)} onSelect={setSelectedGuess} search={searchTracks} />
          <button type="submit" disabled={disabled || !selectedGuess}>Submit guess</button>
        </form>
        <div className="guess-panel__skip">
          <button type="button" disabled={disabled} onClick={() => void skip()}>Skip +1s</button>
          <button type="button" className="ghost" disabled={disabled} onClick={() => void skipSong()}>Skip song</button>
        </div>
      </div>
    </main>
  );
}
