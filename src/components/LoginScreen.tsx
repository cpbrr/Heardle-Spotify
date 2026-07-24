import { Music } from 'lucide-react';

import mascotUrl from '../assets/mascot.png';
import { loginUrl } from '../auth/authClient';

export function LoginScreen() {
  return (
    <main className="setup-screen">
      <p className="wordmark">Heardle</p>
      <section className="setup-content login-content" aria-labelledby="login-title">
        <img src={mascotUrl} alt="" className="login-mascot" />
        <div className="login-copy">
          <h1 id="login-title">Listen. Guess. Reveal.</h1>
          <p>Connect your Spotify Premium account to play.</p>
          <a className="button button--primary" href={loginUrl}>
            <Music aria-hidden="true" size={18} />
            Connect Spotify
          </a>
        </div>
      </section>
    </main>
  );
}
