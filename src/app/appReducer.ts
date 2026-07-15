import type { AuthStatus, ResumeAction, SourceDescriptor, Track } from '../spotify/types';
import type { AppError } from '../auth/authClient';

export type AppState =
  | { phase: 'checking-auth' }
  | { phase: 'needs-configuration'; status: AuthStatus }
  | { phase: 'needs-login'; status: AuthStatus; resumeAction?: ResumeAction }
  | { phase: 'choosing-source'; source?: SourceDescriptor }
  | { phase: 'loading-catalog'; source: SourceDescriptor; requestId: number }
  | { phase: 'preparing-player'; source: SourceDescriptor; tracks: Track[] }
  | { phase: 'ready'; source: SourceDescriptor; tracks: Track[] }
  | { phase: 'playing'; source: SourceDescriptor; tracks: Track[] }
  | { phase: 'round-complete'; source: SourceDescriptor; tracks: Track[]; outcome: 'won' | 'lost' }
  | { phase: 'error'; error: AppError; resumeAction?: ResumeAction };

export type AppAction =
  | { type: 'authChecked'; status: AuthStatus }
  | { type: 'chooseSource'; source?: SourceDescriptor }
  | { type: 'sourceSelected'; source: SourceDescriptor; requestId: number }
  | { type: 'catalogLoaded'; source: SourceDescriptor; requestId: number; tracks: Track[] }
  | { type: 'playerReady' }
  | { type: 'playbackStarted' }
  | { type: 'playbackPaused' }
  | { type: 'roundCompleted'; outcome: 'won' | 'lost' }
  | { type: 'roundRestarted' }
  | { type: 'resumeRound'; source: SourceDescriptor; tracks: Track[] }
  | { type: 'authExpired'; status: AuthStatus; resumeAction?: ResumeAction }
  | { type: 'failed'; error: AppError; resumeAction?: ResumeAction };

export const initialAppState: AppState = { phase: 'checking-auth' };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'authChecked':
      if (!action.status.configured) {
        return { phase: 'needs-configuration', status: action.status };
      }
      if (!action.status.authenticated) {
        return { phase: 'needs-login', status: action.status };
      }
      return { phase: 'choosing-source' };
    case 'chooseSource':
      return { phase: 'choosing-source', source: action.source };
    case 'sourceSelected':
      return {
        phase: 'loading-catalog',
        source: action.source,
        requestId: action.requestId,
      };
    case 'catalogLoaded':
      if (state.phase !== 'loading-catalog' || state.requestId !== action.requestId) {
        return state;
      }
      return {
        phase: 'preparing-player',
        source: action.source,
        tracks: action.tracks,
      };
    case 'playerReady':
      if (state.phase !== 'preparing-player') {
        return state;
      }
      return { phase: 'ready', source: state.source, tracks: state.tracks };
    case 'playbackStarted':
      if (state.phase !== 'ready') {
        return state;
      }
      return { ...state, phase: 'playing' };
    case 'playbackPaused':
      if (state.phase !== 'playing') {
        return state;
      }
      return { ...state, phase: 'ready' };
    case 'roundCompleted':
      if (state.phase !== 'ready' && state.phase !== 'playing') {
        return state;
      }
      return { ...state, phase: 'round-complete', outcome: action.outcome };
    case 'roundRestarted':
      if (state.phase !== 'round-complete') {
        return state;
      }
      return { phase: 'ready', source: state.source, tracks: state.tracks };
    case 'resumeRound':
      return { phase: 'ready', source: action.source, tracks: action.tracks };
    case 'authExpired':
      return {
        phase: 'needs-login',
        status: action.status,
        ...(action.resumeAction ? { resumeAction: action.resumeAction } : {}),
      };
    case 'failed':
      return {
        phase: 'error',
        error: action.error,
        ...(action.resumeAction ? { resumeAction: action.resumeAction } : {}),
      };
    default:
      return state;
  }
}
