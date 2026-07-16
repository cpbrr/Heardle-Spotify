import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourcePicker } from './SourcePicker';
import { AppError } from '../auth/authClient';
import type { SourceDescriptor } from '../spotify/types';

describe('SourcePicker', () => {
  it('offers all seven supported source modes', () => {
    render(<SourcePicker onSelect={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /artist mix|artist discography|playlist|album|specific track|my top tracks|my liked songs/i })).toHaveLength(7);
  });

  it('selects a library source without an extra input', async () => {
    const onSelect = vi.fn();
    render(<SourcePicker onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /^My liked songs/ }));

    expect(onSelect).toHaveBeenCalledWith({
      kind: 'liked',
      name: 'My liked songs',
      imageUrl: null,
    });
  });

  it('debounces search and supports keyboard result selection', async () => {
    const result: SourceDescriptor = {
      kind: 'playlist',
      id: 'playlist-1',
      name: 'Focus Flow',
      imageUrl: 'cover.jpg',
    };
    const search = vi.fn().mockResolvedValue([result]);
    const onSelect = vi.fn();
    render(<SourcePicker onSelect={onSelect} search={search} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^Playlist/ }));
    await user.type(screen.getByRole('combobox', { name: 'Search playlists' }), 'focus');

    await waitFor(() => expect(search).toHaveBeenCalledWith('playlist', 'focus', expect.any(AbortSignal)));
    expect(await screen.findByRole('option', { name: /Focus Flow/ })).toBeVisible();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(result);
  });

  it('accepts a playlist URL while the track mode is active', async () => {
    const playlist = { kind: 'playlist', id: 'playlist123', name: 'Shared', imageUrl: null } as const;
    const search = vi.fn().mockResolvedValue([playlist]);
    const onSelect = vi.fn();
    render(<SourcePicker onSelect={onSelect} search={search} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /specific track/i }));
    await user.type(screen.getByRole('combobox'), 'https://open.spotify.com/playlist/playlist123');
    await user.click(await screen.findByRole('option', { name: 'Shared' }));

    expect(search).toHaveBeenCalledWith('track', 'https://open.spotify.com/playlist/playlist123', expect.any(AbortSignal));
    expect(onSelect).toHaveBeenCalledWith(playlist);
  });

  it('accepts a track URL while the playlist mode is active', async () => {
    const track = { kind: 'track', id: 'track123', name: 'Exact song', imageUrl: null } as const;
    const search = vi.fn().mockResolvedValue([track]);
    const onSelect = vi.fn();
    render(<SourcePicker onSelect={onSelect} search={search} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^Playlist/ }));
    await user.type(screen.getByRole('combobox'), 'spotify:track:track123');
    await user.click(await screen.findByRole('option', { name: 'Exact song' }));

    expect(search).toHaveBeenCalledWith('playlist', 'spotify:track:track123', expect.any(AbortSignal));
    expect(onSelect).toHaveBeenCalledWith(track);
  });

  it.each([
    ['invalid_spotify_resource', 'That Spotify URL is not a supported track or playlist.'],
    ['spotify_playlist_inaccessible', 'Spotify only allows playlists you own or collaborate on.'],
  ])('surfaces %s errors and removes stale results', async (code, message) => {
    const result = { kind: 'playlist', id: 'playlist-1', name: 'Old result', imageUrl: null } as const;
    const search = vi.fn()
      .mockResolvedValueOnce([result])
      .mockRejectedValueOnce(new AppError(message, { code }));
    render(<SourcePicker onSelect={vi.fn()} search={search} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^Playlist/ }));
    const input = screen.getByRole('combobox');
    await user.type(input, 'old');
    expect(await screen.findByRole('option', { name: 'Old result' })).toBeVisible();

    await user.clear(input);
    await user.type(input, 'invalid resource');

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry search' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Old result' })).not.toBeInTheDocument();
  });

  it('keeps the query and exposes retry after a search failure', async () => {
    const search = vi.fn().mockRejectedValueOnce(new Error('Search unavailable')).mockResolvedValueOnce([]);
    render(<SourcePicker onSelect={vi.fn()} search={search} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^Album/ }));
    const input = screen.getByRole('combobox', { name: 'Search albums' });
    await user.type(input, 'kind of blue');

    expect(await screen.findByText('Search unavailable')).toBeVisible();
    expect(input).toHaveValue('kind of blue');
    await user.click(screen.getByRole('button', { name: 'Retry search' }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  });
});
