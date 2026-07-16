import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Track } from '../spotify/types';
import { TrackSearch } from './TrackSearch';

function makeTrack(id: string, title = 'Dreams'): Track {
  return {
    id,
    uri: `spotify:track:${id}`,
    title,
    artists: ['Fleetwood Mac'],
    artistText: 'Fleetwood Mac',
    durationMs: 257_800,
    album: 'Rumours',
    imageUrl: 'cover.jpg',
  };
}

describe('TrackSearch', () => {
  it('debounces global search and selects a result outside the answer source', async () => {
    const track = makeTrack('global');
    const search = vi.fn().mockResolvedValue([track]);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TrackSearch onSelect={onSelect} search={search} />);

    await user.type(screen.getByRole('combobox', { name: 'Guess' }), 'dreams');

    expect(search).not.toHaveBeenCalled();
    expect(await screen.findByRole('option', { name: /dreams/i })).toBeVisible();
    expect(search).toHaveBeenCalledWith('dreams', expect.any(AbortSignal));
    await user.click(screen.getByRole('option', { name: /dreams/i }));

    expect(onSelect).toHaveBeenCalledWith(track);
    expect(screen.getByText('Selected guess')).toBeVisible();
  });

  it('aborts a stale request when a new query starts', async () => {
    const signals: AbortSignal[] = [];
    const search = vi.fn((query: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<Track[]>((resolve) => {
        if (query === 'dreams live') resolve([makeTrack('live', 'Dreams (Live)')]);
      });
    });
    const user = userEvent.setup();
    render(<TrackSearch onSelect={vi.fn()} search={search} />);
    const input = screen.getByRole('combobox', { name: 'Guess' });

    await user.type(input, 'dreams');
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    await user.type(input, ' live');
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));

    expect(signals[0].aborted).toBe(true);
    expect(await screen.findByRole('option', { name: /dreams \(live\)/i })).toBeVisible();
  });

  it('does not restore query A results while query B is waiting for debounce', async () => {
    let resolveFirst!: (tracks: Track[]) => void;
    const firstRequest = new Promise<Track[]>((resolve) => {
      resolveFirst = resolve;
    });
    const search = vi.fn().mockReturnValueOnce(firstRequest).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<TrackSearch onSelect={vi.fn()} search={search} />);
    const input = screen.getByRole('combobox', { name: 'Guess' });

    await user.type(input, 'dreams');
    await waitFor(() => expect(search).toHaveBeenCalledWith('dreams', expect.any(AbortSignal)));
    await user.type(input, ' live');
    await act(async () => resolveFirst([makeTrack('old', 'Dreams')]));

    expect(screen.queryByRole('option', { name: /^dreams/i })).not.toBeInTheDocument();
  });

  it('exposes retry after failure and announces an empty result', async () => {
    const search = vi.fn()
      .mockRejectedValueOnce(new Error('Search unavailable'))
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<TrackSearch onSelect={vi.fn()} search={search} />);

    await user.type(screen.getByRole('combobox', { name: 'Guess' }), 'dreams');
    expect(await screen.findByRole('alert')).toHaveTextContent('Search unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry search' }));

    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No matching tracks found.')).toBeVisible();
  });

  it('supports arrow-key navigation and explicit Enter selection', async () => {
    const first = makeTrack('one', 'Dreams');
    const second = makeTrack('two', 'Dreams Tonite');
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TrackSearch onSelect={onSelect} search={vi.fn().mockResolvedValue([first, second])} />);
    const input = screen.getByRole('combobox', { name: 'Guess' });

    await user.type(input, 'dreams');
    expect(await screen.findByRole('option', { name: /dreams tonite/i })).toBeVisible();
    expect(onSelect).not.toHaveBeenCalled();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(second);
    expect(input).toHaveAttribute('aria-activedescendant');
  });

  it('keeps the selected row independent from pointer activity and clears it when the query changes', async () => {
    const first = makeTrack('first', 'First Song');
    const second = makeTrack('second', 'Second Song');
    const onSelect = vi.fn();
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<TrackSearch onSelect={onSelect} onClear={onClear} search={vi.fn().mockResolvedValue([first, second])} />);
    const input = screen.getByRole('combobox', { name: 'Guess' });

    await user.type(input, 'dreams');
    await user.click(await screen.findByRole('option', { name: /second song/i }));
    expect(screen.getByRole('option', { name: /second song/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /first song/i })).toHaveAttribute('aria-selected', 'false');

    await user.hover(screen.getByRole('option', { name: /first song/i }));

    expect(screen.getByRole('option', { name: /second song/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /first song/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Selected guess')).toBeVisible();

    await user.type(input, ' live');

    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.queryByText('Selected guess')).not.toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { selected: true })).not.toBeInTheDocument();
  });

  it('does not search while disabled', async () => {
    const search = vi.fn();
    render(<TrackSearch disabled onSelect={vi.fn()} search={search} />);

    expect(screen.getByRole('combobox', { name: 'Guess' })).toBeDisabled();
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    expect(search).not.toHaveBeenCalled();
  });
});
