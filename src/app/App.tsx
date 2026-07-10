import { useEffect, useReducer, useRef } from 'react';

import { getAuthStatus } from '../auth/authClient';
import { ConfigurationScreen } from '../components/ConfigurationScreen';
import { LoginScreen } from '../components/LoginScreen';
import { SourcePicker } from '../components/SourcePicker';
import { StatusMessage } from '../components/StatusMessage';
import { appReducer, initialAppState } from './appReducer';

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const requestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    void getAuthStatus(controller.signal)
      .then((status) => dispatch({ type: 'authChecked', status }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          dispatch({ type: 'failed', error });
        }
      });
    return () => controller.abort();
  }, []);

  if (state.phase === 'needs-configuration') {
    return <ConfigurationScreen status={state.status} />;
  }
  if (state.phase === 'needs-login') {
    return <LoginScreen />;
  }
  if (state.phase === 'choosing-source') {
    return (
      <main className="app-shell app-shell--picker">
        <SourcePicker onSelect={(source) => dispatch({
          type: 'sourceSelected',
          source,
          requestId: ++requestId.current,
        })} />
      </main>
    );
  }
  if (state.phase === 'loading-catalog') {
    return (
      <main className="loading-screen">
        <p className="wordmark">Heardle</p>
        <StatusMessage>Loading {state.source.name}...</StatusMessage>
      </main>
    );
  }
  if (state.phase === 'error') {
    return (
      <main className="setup-screen">
        <p className="wordmark">Heardle</p>
        <StatusMessage tone="error">{state.error.message}</StatusMessage>
      </main>
    );
  }

  return (
    <main className="loading-screen">
      <h1>Heardle</h1>
      <p>Checking Spotify connection...</p>
    </main>
  );
}
