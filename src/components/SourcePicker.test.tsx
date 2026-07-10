import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourcePicker } from './SourcePicker';
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
