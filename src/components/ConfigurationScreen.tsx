import { Copy } from 'lucide-react';

import type { AuthStatus } from '../spotify/types';

interface ConfigurationScreenProps {
  status: AuthStatus;
}

async function copy(value: string) {
  await navigator.clipboard?.writeText(value);
}

function ConfigValue({ value }: { value: string }) {
  return (
    <div className="config-value">
      <code>{value}</code>
      <button type="button" className="icon-button" onClick={() => void copy(value)} title={`Copy ${value}`} aria-label={`Copy ${value}`}>
        <Copy aria-hidden="true" size={18} />
      </button>
    </div>
  );
}

export function ConfigurationScreen({ status }: ConfigurationScreenProps) {
  return (
    <main className="setup-screen">
      <p className="wordmark">Heardle</p>
      <section className="setup-content" aria-labelledby="setup-title">
        <h1 id="setup-title">Spotify setup</h1>
        <p>Add these environment variables, then register the callback URI in your Spotify app.</p>
        <div className="config-list">
          {status.missing.clientId && <ConfigValue value="SPOTIFY_CLIENT_ID" />}
          {status.missing.clientSecret && <ConfigValue value="SPOTIFY_CLIENT_SECRET" />}
          <ConfigValue value={status.redirectUri} />
        </div>
      </section>
    </main>
  );
}
