import { Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type React from 'react';

import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { searchTracks } from '../sources/catalog';
import type { Track } from '../spotify/types';
import { StatusMessage } from './StatusMessage';

export type TrackSearchFunction = (query: string, signal: AbortSignal) => Promise<Track[]>;

export interface TrackSearchProps {
  disabled?: boolean;
  onClear?(): void;
  onSelect(track: Track): void;
  search?: TrackSearchFunction;
}

type SearchState = 'idle' | 'loading' | 'ready' | 'error';

export function TrackSearch({
  disabled = false,
  onClear,
  onSelect,
  search = searchTracks,
}: TrackSearchProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);
  const listboxId = useId();

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
    if (disabled || normalizedQuery.length < 2) {
      setResults([]);
      setState('idle');
      setError('');
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setState('loading');
    setError('');
    setActiveIndex(-1);
    void search(normalizedQuery, controller.signal)
      .then((tracks) => {
        if (controller.signal.aborted) return;
        setResults(tracks);
        setState('ready');
      })
      .catch((searchError: unknown) => {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : 'Search unavailable');
        setState('error');
      });

    return () => controller.abort();
  }, [debouncedQuery, disabled, retryNonce, search]);

  function selectTrack(track: Track) {
    setSelectedTrack(track);
    onSelect(track);
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setResults([]);
    setState('idle');
    setError('');
    setActiveIndex(-1);
    if (selectedTrack) {
      setSelectedTrack(null);
      onClear?.();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }
    if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectTrack(results[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      setResults([]);
      setActiveIndex(-1);
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <section className="track-search" aria-label="Search Spotify tracks">
      <label className="search-field">
        <Search aria-hidden="true" size={19} />
        <input
          role="combobox"
          aria-label="Guess"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          disabled={disabled}
          placeholder="Search Spotify for your guess"
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </label>

      {state === 'loading' ? <StatusMessage>Searching Spotify...</StatusMessage> : null}
      {state === 'error' ? (
        <div className="track-search__feedback">
          <StatusMessage tone="error">{error}</StatusMessage>
          <button
            type="button"
            className="button button--secondary"
            disabled={disabled}
            onClick={() => setRetryNonce((value) => value + 1)}
          >
            Retry search
          </button>
        </div>
      ) : null}
      {state === 'ready' && results.length === 0 ? <StatusMessage>No matching tracks found.</StatusMessage> : null}

      {results.length > 0 ? (
        <div id={listboxId} className="search-results track-search__results" role="listbox" aria-label="Track search results">
          {results.map((track, index) => (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              id={`${listboxId}-option-${index}`}
              className="search-result track-search__result"
              key={track.id}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectTrack(track)}
            >
              {track.imageUrl ? (
                <img src={track.imageUrl} alt="" width="48" height="48" />
              ) : (
                <span className="artwork-placeholder" aria-hidden="true" />
              )}
              <span className="track-search__metadata">
                <strong>{track.title}</strong>
                <small>{track.artistText}{track.album ? ` · ${track.album}` : ''}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedTrack ? (
        <div className="track-search__selection" aria-live="polite">
          <span className="eyebrow">Selected guess</span>
          <strong>{selectedTrack.title}</strong>
          <span className="muted">{selectedTrack.artistText}</span>
        </div>
      ) : null}
    </section>
  );
}
