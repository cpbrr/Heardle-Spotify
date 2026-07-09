# Heardle Spotify

A Spotify Heardle-style game hosted as static files plus Vercel Serverless Functions.

## What You Need

- A Spotify Premium account for playback through Spotify's Web Playback SDK.
- A Spotify Developer app from https://developer.spotify.com/dashboard.
- Vercel environment variables for the Spotify app credentials.

## Spotify App Setup

Create a Spotify app, then add a redirect URI that matches where the app runs:

- Local Vercel dev: `http://localhost:3000/api/callback`
- Production: `https://YOUR-VERCEL-DOMAIN.vercel.app/api/callback`
- Custom domain: `https://YOUR-DOMAIN/api/callback`

The app shows the exact redirect URI on the first screen when credentials are missing.

## Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Optional override:

```env
SPOTIFY_REDIRECT_URI=https://your-domain/api/callback
```

For local development, copy `.env.example` to `.env.local` and fill in the values. Vercel CLI loads `.env.local` during `vercel dev`.

## Run Locally

```sh
npm install`r`nnpx vercel dev
```

Open `http://localhost:3000`. The app will either show the missing Spotify setup values or a Connect Spotify button. After connecting, choose a song source and play.

## Deploy To Vercel

1. Import this repo into Vercel.
2. Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in project environment variables.
3. Add the production callback URL in the Spotify Dashboard.
4. Deploy.

## How Auth Works

- `/api/login` redirects to Spotify OAuth.
- `/api/callback` exchanges the code for tokens and stores them in HTTP-only cookies.
- `/api/token` returns a fresh access token to the browser for Spotify Web API and Web Playback SDK calls.
- `/api/status` powers the setup/login panel.
- `/api/logout` clears the token cookies.

No client secret is exposed to browser JavaScript. The old local flow wrote tokens into `public/views/index.html`; the Vercel flow does not mutate files at runtime.
