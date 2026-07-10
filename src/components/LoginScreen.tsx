import { loginUrl } from '../auth/authClient';

export function LoginScreen() {
  return (
    <main className="setup-screen">
      <p className="wordmark">Heardle</p>
      <section className="setup-content" aria-labelledby="login-title">
        <h1 id="login-title">Listen. Guess. Reveal.</h1>
        <p>Connect your Spotify Premium account to play.</p>
        <a className="button button--primary" href={loginUrl}>Connect Spotify</a>
      </section>
    </main>
  );
}
