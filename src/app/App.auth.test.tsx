import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import * as authClient from '../auth/authClient';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App authentication states', () => {
  it('shows actionable configuration without navigating to a raw API error', async () => {
    vi.spyOn(authClient, 'getAuthStatus').mockResolvedValue({
      configured: false,
      authenticated: false,
      redirectUri: 'http://localhost:3000/api/callback',
      missing: { clientId: true, clientSecret: true },
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Spotify setup' })).toBeVisible();
    expect(screen.getByText('SPOTIFY_CLIENT_ID')).toBeVisible();
    expect(screen.getByText('SPOTIFY_CLIENT_SECRET')).toBeVisible();
    expect(screen.getByText('http://localhost:3000/api/callback')).toBeVisible();
  });

  it('explains Premium before presenting login', async () => {
    vi.spyOn(authClient, 'getAuthStatus').mockResolvedValue({
      configured: true,
      authenticated: false,
      redirectUri: 'http://localhost:3000/api/callback',
      missing: { clientId: false, clientSecret: false },
    });

    render(<App />);

    expect(await screen.findByText('Connect your Spotify Premium account to play.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Connect Spotify' })).toHaveAttribute('href', '/api/login');
  });
});
