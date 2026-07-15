import { useEffect, useReducer, useRef, useState } from 'react';

import { AppError, getAuthStatus } from '../auth/authClient';
import { GameScreen } from '../components/GameScreen';
import { LoginScreen } from '../components/LoginScreen';
import { ConfigurationScreen } from '../components/ConfigurationScreen';
import { ResultView } from '../components/ResultView';
import { SourcePicker } from '../components/SourcePicker';
import { StatusMessage } from '../components/StatusMessage';
import { createRound, type Round } from '../game/gameEngine';
import { SpotifyPlayer } from '../player/SpotifyPlayer';
import { loadCatalog } from '../sources/catalog';
import type { SourceDescriptor } from '../spotify/types';
import { appReducer, initialAppState } from './appReducer';

function isAuthenticationError(error: unknown) {
  return error instanceof AppError && (error.status === 401 || error.code.includes('auth'));
}

function createPlayer() {
  try {
    return new SpotifyPlayer();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('not a constructor')) {
      return (SpotifyPlayer as unknown as () => SpotifyPlayer)();
    }
    throw error;
  }
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [round, setRound] = useState<Round | null>(null);
  const requestId = useRef(0);
  const catalogController = useRef<AbortController | null>(null);
  const player = useRef<SpotifyPlayer | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getAuthStatus(controller.signal)
      .then((status) => {
        if (status.configured && status.authenticated && !player.current) {
          player.current = createPlayer();
        }
        dispatch({ type: 'authChecked', status });
      })
      .catch((error) => {
        if (!controller.signal.aborted) dispatch({ type: 'failed', error });
      });
    return () => {
      controller.abort();
      catalogController.current?.abort();
      player.current?.destroy();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    if (state.phase !== 'loading-catalog') return;
    const controller = new AbortController();
    catalogController.current?.abort();
    catalogController.current = controller;
    const { source, requestId: currentRequestId } = state;
    void loadCatalog(source, controller.signal)
      .then(({ tracks }) => {
        if (!controller.signal.aborted) {
          if (tracks.length) dispatch({ type: 'catalogLoaded', source, requestId: currentRequestId, tracks });
          else dispatch({ type: 'failed', error: new AppError('No playable tracks were found for this source.') });
        }
      })
      .catch(async (error: unknown) => {
        if (controller.signal.aborted) return;
        if (isAuthenticationError(error)) {
          try {
            const status = await getAuthStatus();
            if (!controller.signal.aborted) dispatch({ type: 'authExpired', status, resumeAction: { type: 'load-source', source } });
          } catch (statusError) {
            if (!controller.signal.aborted) dispatch({ type: 'failed', error: statusError as AppError });
          }
          return;
        }
        dispatch({ type: 'failed', error: error as AppError });
      });
    return () => controller.abort();
  }, [state]);

  useEffect(() => {
    if (state.phase !== 'preparing-player') return;
    setRound(createRound(state.tracks[0]));
    void player.current?.connect()
      .then(() => dispatch({ type: 'playerReady' }))
      .catch(async (error: unknown) => {
        if (isAuthenticationError(error)) {
          const status = await getAuthStatus();
          dispatch({ type: 'authExpired', status, resumeAction: { type: 'play' } });
        } else {
          dispatch({ type: 'failed', error: error as AppError });
        }
      });
  }, [state]);

  function selectSource(source: SourceDescriptor) {
    setRound(null);
    dispatch({ type: 'sourceSelected', source, requestId: ++requestId.current });
  }

  async function changeSource() {
    catalogController.current?.abort();
    await player.current?.pause().catch(() => undefined);
    setRound(null);
    dispatch({ type: 'chooseSource' });
  }

  async function recoverPlayback(error: unknown) {
    if (!isAuthenticationError(error)) {
      dispatch({ type: 'failed', error: error as AppError });
      return;
    }
    const status = await getAuthStatus();
    dispatch({ type: 'authExpired', status, resumeAction: { type: 'play' } });
  }

  if (state.phase === 'needs-configuration') return <ConfigurationScreen status={state.status} />;
  if (state.phase === 'needs-login') return <LoginScreen />;
  if (state.phase === 'choosing-source') {
    return <main className="app-shell app-shell--picker"><SourcePicker onSelect={selectSource} /></main>;
  }
  if (state.phase === 'loading-catalog') {
    return <main className="loading-screen"><p className="wordmark">Heardle</p><StatusMessage>Loading {state.source.name}...</StatusMessage><button type="button" onClick={() => void changeSource()}>Change source</button></main>;
  }
  if (state.phase === 'error') {
    return <main className="setup-screen"><p className="wordmark">Heardle</p><StatusMessage tone="error">{state.error.message}</StatusMessage></main>;
  }
  if ((state.phase === 'ready' || state.phase === 'playing') && round && player.current) {
    return <GameScreen round={round} tracks={state.tracks} player={player.current} onRoundChange={setRound} onRoundComplete={(completed) => dispatch({ type: 'roundCompleted', outcome: completed.status === 'won' ? 'won' : 'lost' })} onAuthExpired={(error) => void recoverPlayback(error)} />;
  }
  if (state.phase === 'round-complete' && round && player.current) {
    return <main className="game-screen"><ResultView outcome={state.outcome} title={round.answer.title} artist={round.answer.artistText} onPlayFullTrack={() => void player.current?.playFullTrack(round.answer.uri).catch(recoverPlayback)} onPlayAnother={() => { setRound(createRound(state.tracks[0])); dispatch({ type: 'playerReady' }); }} /></main>;
  }
  return <main className="loading-screen"><h1>Heardle</h1><p>Checking Spotify connection...</p></main>;
}
