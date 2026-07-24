import { Search, X } from 'lucide-react';
import { useId, useState } from 'react';
import type React from 'react';

import { useSearchCombobox } from '../hooks/useSearchCombobox';
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

export function TrackSearch({
  disabled = false,
  onClear,
  onSelect,
  search = searchTracks,
}: TrackSearchProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const listboxId = useId();

  const { results, state, error, activeIndex, setActiveIndex, reset, retry, handleKeyDown } = useSearchCombobox<Track>({
    query,
    enabled: !disabled,
    search,
  });

  function selectTrack(track: Track) {
    setSelectedTrack(track);
    onSelect(track);
  }

  function clearSelection() {
    if (!selectedTrack) return;
    setSelectedTrack(null);
    onClear?.();
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    reset();
    if (selectedTrack) {
      setSelectedTrack(null);
      onClear?.();
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
          onKeyDown={(event) => handleKeyDown(event, (index) => selectTrack(results[index]))}
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
            onClick={retry}
          >
            Retry search
          </button>
        </div>
      ) : null}
      {state === 'ready' && results.length === 0 ? <StatusMessage>No matching tracks found.</StatusMessage> : null}

      {results.length > 0 ? (
        <div id={listboxId} className="search-results track-search__results" role="listbox" aria-label="Track search results">
          {results.map((track, index) => {
            const isSelected = selectedTrack?.id === track.id;
            const isActive = activeIndex === index;

            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                data-active={isActive ? 'true' : undefined}
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
            );
          })}
        </div>
      ) : null}

      {selectedTrack ? (
        <div className="track-search__selection" aria-live="polite">
          <div>
            <span className="eyebrow">Selected guess</span>
            <strong>{selectedTrack.title}</strong>
            <span className="muted">{selectedTrack.artistText}</span>
          </div>
          <button
            type="button"
            className="icon-button track-search__selection-clear"
            onClick={clearSelection}
            aria-label="Clear selected guess"
            title="Clear selected guess"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}
    </section>
  );
}
