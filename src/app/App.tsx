import { useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import mascotUrl from '../assets/mascot.png';
import { AppError, getAuthStatus, loginUrl } from '../auth/authClient';
import { GameScreen } from '../components/GameScreen';
import { LoginScreen } from '../components/LoginScreen';
import { ConfigurationScreen } from '../components/ConfigurationScreen';
import { ResultView } from '../components/ResultView';
import { SourcePicker } from '../components/SourcePicker';
import { StatusMessage } from '../components/StatusMessage';
import { completeRound, createRound, selectRoundTrack, type Round } from '../game/gameEngine';
import { SpotifyPlayer } from '../player/SpotifyPlayer';
import { loadCatalog } from '../sources/catalog';
import { loadRecentTrackIds, loadStreak, saveRecentTrackIds, saveSource, saveStreak, sourceKey } from '../sources/sourceStorage';
import { validateSpotifyAccount } from '../spotify/account';
import type { ResumeAction, SourceDescriptor, Track } from '../spotify/types';
import { appReducer, initialAppState } from './appReducer';

function isAuthenticationError(error: unknown) {
  return error instanceof AppError && (error.status === 401 || error.code.includes('auth'));
}

type ResumeContext =
  | { type: 'load-source'; source: SourceDescriptor }
  | { type: 'play-clip'; source: SourceDescriptor; tracks: Track[]; round: Round }
  | { type: 'full-track'; source: SourceDescriptor; tracks: Track[]; round: Round; outcome: 'won' | 'lost' };

function AppHeader({ onChangeSource }: { onChangeSource(): void }) {
  return (
    <header className="app-header">
      <button type="button" className="app-header__brand" onClick={onChangeSource}>
        <img src={mascotUrl} alt="" />
        <span>Heardle</span>
      </button>
      <button type="button" onClick={onChangeSource}>Change source</button>
    </header>
  );
}

function LoadingBody({ title, subtitle, action }: { title: ReactNode; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="loading-screen__body">
      <div className="spinner" aria-hidden="true" />
      <div className="loading-screen__text">
        {title}
        {subtitle ? <p className="loading-screen__subtitle">{subtitle}</p> : null}
      </div>
      {action ?? null}
    </div>
  );
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [round, setRound] = useState<Round | null>(null);
  const [streak, setStreak] = useState(() => loadStreak());
  const requestId = useRef(0);
  const catalogController = useRef<AbortController | null>(null);
  const player = useRef<SpotifyPlayer | null>(null);
  const resumeContext = useRef<ResumeContext | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    mounted.current = true;
    void getAuthStatus(controller.signal)
      .then(async (status) => {
        if (status.configured && status.authenticated && !player.current) {
          await validateSpotifyAccount(controller.signal);
          if (controller.signal.aborted || !mounted.current) return;
          player.current = new SpotifyPlayer();
        }
        if (controller.signal.aborted || !mounted.current) return;
        dispatch({ type: 'authChecked', status });
      })
      .catch((error) => {
        if (!controller.signal.aborted) dispatch({ type: 'failed', error });
      });
    return () => {
      mounted.current = false;
      controller.abort();
      catalogController.current?.abort();
      player.current?.destroy();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    let focusController: AbortController | null = null;
    const resumeAfterLogin = () => {
      const resume = resumeContext.current;
      if (!resume) return;
      focusController?.abort();
      const controller = new AbortController();
      focusController = controller;
      void (async () => {
        const status = await getAuthStatus(controller.signal);
        if (controller.signal.aborted || !mounted.current) return;
        if (!status.configured || !status.authenticated) return;
        await validateSpotifyAccount(controller.signal);
        if (controller.signal.aborted || !mounted.current || resumeContext.current !== resume) return;
        if (!player.current) player.current = new SpotifyPlayer();
        resumeContext.current = null;
        if (resume.type === 'load-source') {
          setRound(null);
          dispatch({ type: 'sourceSelected', source: resume.source, requestId: ++requestId.current });
          return;
        }
        if (resume.type === 'play-clip') {
          setRound(resume.round);
          dispatch({ type: 'resumeRound', source: resume.source, tracks: resume.tracks });
          void player.current.activate().then(() => player.current?.playClip(resume.round.answer.uri, resume.round.clipLimitMs, () => undefined)).catch(() => undefined);
          return;
        }
        setRound(resume.round);
        dispatch({ type: 'resumeResult', source: resume.source, tracks: resume.tracks, outcome: resume.outcome });
        void player.current.playFullTrack(resume.round.answer.uri).catch(() => undefined);
      })().catch((error: unknown) => {
        if (controller.signal.aborted || !mounted.current || resumeContext.current !== resume) return;
        dispatch({
          type: 'failed',
          error: error instanceof AppError ? error : new AppError('Spotify account validation failed. Reconnect and try again.'),
        });
      });
    };
    window.addEventListener('focus', resumeAfterLogin);
    return () => {
      focusController?.abort();
      window.removeEventListener('focus', resumeAfterLogin);
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
            if (controller.signal.aborted || catalogController.current !== controller) return;
            resumeContext.current = { type: 'load-source', source };
            dispatch({ type: 'authExpired', status, resumeAction: { type: 'load-source', source } });
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
    const preparedRound = nextRound(state.source, state.tracks);
    setRound(preparedRound);
    void player.current?.connect()
      .then(() => dispatch({ type: 'playerReady' }))
      .catch((error: unknown) => recoverWithResume(
        error,
        () => ({ type: 'play-clip', source: state.source, tracks: state.tracks, round: preparedRound }),
        { type: 'play' },
      ));
  }, [state]);

  async function recoverWithResume(error: unknown, buildResumeContext: () => ResumeContext | null, resumeAction: ResumeAction) {
    if (!isAuthenticationError(error)) {
      dispatch({ type: 'failed', error: error as AppError });
      return;
    }
    const status = await getAuthStatus();
    const context = buildResumeContext();
    if (context) resumeContext.current = context;
    dispatch({ type: 'authExpired', status, resumeAction });
  }

  function selectSource(source: SourceDescriptor) {
    setRound(null);
    saveSource(source);
    dispatch({ type: 'sourceSelected', source, requestId: ++requestId.current });
  }

  async function changeSource() {
    catalogController.current?.abort();
    await player.current?.pause().catch(() => undefined);
    setRound(null);
    dispatch({ type: 'chooseSource' });
  }

  async function recoverPlayback(error: unknown) {
    await recoverWithResume(
      error,
      () => (((state.phase === 'ready' || state.phase === 'playing') && round)
        ? { type: 'play-clip', source: state.source, tracks: state.tracks, round }
        : null),
      { type: 'play' },
    );
  }

  function nextRound(source: SourceDescriptor, catalog: Track[]) {
    const key = sourceKey(source);
    const recentTrackIds = loadRecentTrackIds(key);
    const answer = selectRoundTrack(catalog, recentTrackIds);
    saveRecentTrackIds(key, [...recentTrackIds, answer.id]);
    return createRound(answer);
  }

  async function recoverResultPlayback(error: unknown, source: SourceDescriptor, tracks: Track[], completedRound: Round, outcome: 'won' | 'lost') {
    await recoverWithResume(
      error,
      () => ({ type: 'full-track', source, tracks, round: completedRound, outcome }),
      { type: 'play' },
    );
  }

  if (state.phase === 'needs-configuration') return <ConfigurationScreen status={state.status} />;
  if (state.phase === 'needs-login') return <LoginScreen />;

  if (state.phase === 'choosing-source') {
    return (
      <main className="app-shell app-shell--picker">
        <SourcePicker onSelect={selectSource} />
      </main>
    );
  }

  if (state.phase === 'loading-catalog') {
    return (
      <main className="loading-screen">
        <button type="button" className="app-header__brand" onClick={() => void changeSource()}>
          <img src={mascotUrl} alt="" />
          <span>Heardle</span>
        </button>
        <LoadingBody
          title={<StatusMessage>{`Loading ${state.source.name}...`}</StatusMessage>}
          subtitle="Fetching playable tracks from Spotify"
          action={<button type="button" onClick={() => void changeSource()}>Change source</button>}
        />
      </main>
    );
  }

  if (state.phase === 'error') {
    const reconnectUrl = state.error.loginUrl || (state.error.code === 'spotify_account_not_allowed' ? loginUrl : undefined);
    return (
      <main className="setup-screen">
        <p className="wordmark">Heardle</p>
        <StatusMessage tone="error">{state.error.message}</StatusMessage>
        {reconnectUrl ? <a className="button button--primary" href={reconnectUrl}>Connect Spotify</a> : null}
      </main>
    );
  }

  if ((state.phase === 'ready' || state.phase === 'playing') && round && player.current) {
    const handleRoundComplete = (completed: Round) => {
      const { streak: nextStreak } = completeRound(completed, streak);
      setStreak(nextStreak);
      saveStreak(nextStreak);
      dispatch({ type: 'roundCompleted', outcome: completed.status === 'won' ? 'won' : 'lost' });
    };

    return (
      <>
        <AppHeader onChangeSource={() => void changeSource()} />
        <GameScreen
          round={round}
          tracks={state.tracks}
          player={player.current}
          onRoundChange={setRound}
          onRoundComplete={handleRoundComplete}
          onAuthExpired={(error) => void recoverPlayback(error)}
        />
      </>
    );
  }

  if (state.phase === 'round-complete' && round && player.current) {
    const { source, tracks, outcome } = state;

    const playFullTrackFromResult = async () => {
      try {
        await player.current?.playFullTrack(round.answer.uri);
      } catch (error) {
        await recoverResultPlayback(error, source, tracks, round, outcome);
      }
    };

    const playAnotherRound = async () => {
      await player.current?.pause().catch(() => undefined);
      setRound(nextRound(source, tracks));
      dispatch({ type: 'roundRestarted' });
    };

    return (
      <>
        <AppHeader onChangeSource={() => void changeSource()} />
        <main className="game-screen">
          <ResultView
            outcome={outcome}
            title={round.answer.title}
            artist={round.answer.artistText}
            imageUrl={round.answer.imageUrl}
            onPlayFullTrack={() => void playFullTrackFromResult()}
            onPlayAnother={() => void playAnotherRound()}
          />
          <div className="result-mascot" aria-hidden="true">
            <img src={mascotUrl} alt="" />
          </div>
        </main>
      </>
    );
  }

  return (
    <main className="loading-screen">
      <div className="app-header__brand">
        <img src={mascotUrl} alt="" />
        <h1>Heardle</h1>
      </div>
      <LoadingBody title={<StatusMessage>Checking Spotify connection...</StatusMessage>} />
    </main>
  );
}
