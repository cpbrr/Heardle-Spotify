import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import * as authClient from '../auth/authClient';
import * as spotifyAccount from '../spotify/account';

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

  it('validates an authenticated account before entering the app', async () => {
    vi.spyOn(authClient, 'getAuthStatus').mockResolvedValue({
      configured: true,
      authenticated: true,
      redirectUri: 'http://localhost:3000/api/callback',
      missing: { clientId: false, clientSecret: false },
    });
    let finishValidation!: () => void;
    const pendingValidation = new Promise<void>((resolve) => {
      finishValidation = resolve;
    });
    const validateAccount = vi.spyOn(spotifyAccount, 'validateSpotifyAccount')
      .mockReturnValue(pendingValidation);

    render(<App />);

    await waitFor(() => expect(validateAccount).toHaveBeenCalledOnce());
    expect(screen.getByText('Checking Spotify connection...')).toBeVisible();
    finishValidation();
    await waitFor(() => expect(screen.queryByText('Checking Spotify connection...')).not.toBeInTheDocument());
  });

  it('shows the actionable friend-account error during startup', async () => {
    vi.spyOn(authClient, 'getAuthStatus').mockResolvedValue({
      configured: true,
      authenticated: true,
      redirectUri: 'http://localhost:3000/api/callback',
      missing: { clientId: false, clientSecret: false },
    });
    vi.spyOn(spotifyAccount, 'validateSpotifyAccount').mockRejectedValue(new authClient.AppError(
      'This Spotify account is not authorized for this development app. Add its Spotify email in Developer Dashboard > Users Management, then reconnect.',
      { code: 'spotify_account_not_allowed', status: 403 },
    ));

    render(<App />);

    expect(await screen.findByText(/Users Management/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Connect Spotify' })).toHaveAttribute('href', '/api/login');
    expect(screen.queryByText('Spotify request failed.')).not.toBeInTheDocument();
  });

  it('offers reconnection when startup authentication fails with a login URL', async () => {
    vi.spyOn(authClient, 'getAuthStatus').mockRejectedValue(new authClient.AppError(
      'Your Spotify session expired. Reconnect to continue.',
      { code: 'not_authenticated', status: 401, loginUrl: '/api/login' },
    ));

    render(<App />);

    expect(await screen.findByText(/session expired/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Connect Spotify' })).toHaveAttribute('href', '/api/login');
  });
});
