# Repository Guidelines

## Project structure

This repository is a Vite + React TypeScript app. The browser entry point is `src/main.tsx`; UI components live in `src/components/`, game logic in `src/game/`, Spotify integration in `src/spotify/` and `src/auth/`, playback in `src/player/`, and shared styling in `src/styles/`. Vercel Functions live in `api/`. The production bundle is generated in `dist/`; keep `public/icon.png` as the static app icon.

## Commands

Run from the repository root:

```sh
npm install
npx vercel dev --listen 3000
npm test
npm run check
npm run build
```

`npm run check` performs TypeScript checks, API syntax checks, the Vitest suite, and a production build.

## Style and testing

Use TypeScript/React conventions already present: functional components, hooks, `const`/`let`, semicolons, and camelCase names. Add tests beside source files as `*.test.ts`/`*.test.tsx`. Preserve stable DOM labels and accessibility roles used by tests.

## Configuration and security

Copy `.env.example` to `.env.local` for local work. Configure `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and optionally `SPOTIFY_REDIRECT_URI`; never commit real credentials or tokens. Live playback requires Spotify Premium.

## Graphify

`graphify-out/` contains the code knowledge graph. For codebase questions, query it first when available. After source changes, run `graphify update .` and inspect `git diff --check`.
