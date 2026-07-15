# Heardle Spotify

A Vite + React Spotify Heardle game with Vercel Functions for OAuth and Spotify API access.

## Requirements

- Node.js 24.x and npm
- A Spotify Developer application
- A Spotify Premium account for live playback through the Web Playback SDK

## Configure Spotify

Copy the local template and fill in your app credentials:

```sh
cp .env.example .env.local
```

Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. You may set `SPOTIFY_REDIRECT_URI` when the callback cannot be inferred from the request host.

In the Spotify Developer Dashboard, add these callback URLs:

- Local: `http://localhost:3000/api/callback`
- Vercel: `https://YOUR-VERCEL-DOMAIN.vercel.app/api/callback`
- Custom domain: `https://YOUR-DOMAIN/api/callback`

## Local development

```sh
npm install
npx vercel dev --listen 3000
```

Open `http://localhost:3000`. Without credentials, the configuration screen explains what is missing. With credentials, connect Spotify and choose a source.

Useful commands:

```sh
npm test       # watch mode
npm run check  # typecheck, API syntax, tests, and production build
npm run build  # production Vite build
```

The game supports seven source options: Spotify recommendations, top tracks, saved tracks, playlists, albums, followed artists, and search. Live playback verification requires a configured Spotify Premium account and an active browser session.

## Deploy to Vercel

Import the repository into Vercel, add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and (if needed) `SPOTIFY_REDIRECT_URI` to the project environment variables, then deploy. Add the production callback URL to the Spotify Dashboard before testing OAuth. Vercel rewrites `/` and `/game` to the Vite app while `/api/*` is handled by serverless functions.

The client never receives the Spotify client secret. OAuth tokens are stored in HTTP-only cookies; no source file is mutated at runtime.
