import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';

import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { searchSources } from '../sources/catalog';
import type { SourceDescriptor } from '../spotify/types';
import { StatusMessage } from './StatusMessage';

type SearchableKind = Exclude<SourceDescriptor['kind'], 'top' | 'liked'>;

interface SourcePickerProps {
  onSelect(source: SourceDescriptor): void;
  onClose?: () => void;
  search?: (kind: SearchableKind, query: string, signal: AbortSignal) => Promise<SourceDescriptor[]>;
}

const SOURCE_OPTIONS: Array<{
  kind: SourceDescriptor['kind'];
  label: string;
  description: string;
}> = [
  { kind: 'artist-mix', label: 'Artist mix', description: 'A focused mix from an artist search' },
  { kind: 'artist-discography', label: 'Artist discography', description: 'Playable tracks across an exact artist catalogue' },
  { kind: 'playlist', label: 'Playlist', description: 'Choose one of Spotify’s public or saved playlists' },
  { kind: 'album', label: 'Album', description: 'Play from one release' },
  { kind: 'track', label: 'Specific track', description: 'Start a round with one exact song' },
  { kind: 'top', label: 'My top tracks', description: 'Your current Spotify favourites' },
  { kind: 'liked', label: 'My liked songs', description: 'A mix from your saved library' },
];

const IMMEDIATE_SOURCES: Record<'top' | 'liked', SourceDescriptor> = {
  top: { kind: 'top', name: 'My top tracks', imageUrl: null },
  liked: { kind: 'liked', name: 'My liked songs', imageUrl: null },
};

function isSearchable(kind: SourceDescriptor['kind']): kind is SearchableKind {
  return kind !== 'top' && kind !== 'liked';
}

function searchLabel(kind: SearchableKind) {
  if (kind === 'artist-mix' || kind === 'artist-discography') return 'Search artists';
  if (kind === 'playlist') return 'Search playlists';
  if (kind === 'album') return 'Search albums';
  return 'Search tracks';
}

export function SourcePicker({ onSelect, onClose, search = searchSources }: SourcePickerProps) {
  const [activeKind, setActiveKind] = useState<SearchableKind | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SourceDescriptor[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 250);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeKind || debouncedQuery.trim().length < 2) {
      setResults([]);
      setState('idle');
      return;
    }

    const controller = new AbortController();
    setState('loading');
    setError('');
    setSelectedIndex(-1);
    void search(activeKind, debouncedQuery.trim(), controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setResults(items);
          setState('ready');
        }
      })
      .catch((searchError: unknown) => {
        if (!controller.signal.aborted) {
          setError(searchError instanceof Error ? searchError.message : 'Search unavailable');
          setState('error');
        }
      });
    return () => controller.abort();
  }, [activeKind, debouncedQuery, retryNonce, search]);

  useEffect(() => {
    if (activeKind) inputRef.current?.focus();
  }, [activeKind]);

  const activeTitle = useMemo(
    () => SOURCE_OPTIONS.find((option) => option.kind === activeKind)?.label,
    [activeKind],
  );

  function chooseMode(kind: SourceDescriptor['kind']) {
    if (!isSearchable(kind)) {
      onSelect(IMMEDIATE_SOURCES[kind]);
      return;
    }
    setActiveKind(kind);
    setQuery('');
    setResults([]);
    setState('idle');
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setSelectedIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
    } else if (event.key === 'Enter' && selectedIndex >= 0) {
      event.preventDefault();
      onSelect(results[selectedIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setActiveKind(null);
    }
  }

  return (
    <section className="source-picker" role="dialog" aria-modal="true" aria-labelledby="source-picker-title">
      <header className="source-picker__header">
        {activeKind ? (
          <button type="button" className="icon-button" onClick={() => setActiveKind(null)} aria-label="Back to source types" title="Back to source types">
            <ArrowLeft aria-hidden="true" />
          </button>
        ) : <span aria-hidden="true" />}
        <div>
          <p className="eyebrow">Song source</p>
          <h1 id="source-picker-title">{activeTitle || 'Choose what to play'}</h1>
        </div>
        {onClose ? (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close source picker" title="Close source picker">
            <X aria-hidden="true" />
          </button>
        ) : <span aria-hidden="true" />}
      </header>

      {!activeKind ? (
        <div className="source-list">
          {SOURCE_OPTIONS.map((option) => (
            <button type="button" className="source-row" key={option.kind} onClick={() => chooseMode(option.kind)}>
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="source-search">
          <label className="search-field">
            <Search aria-hidden="true" size={19} />
            <input
              ref={inputRef}
              role="combobox"
              aria-label={searchLabel(activeKind)}
              aria-expanded={results.length > 0}
              aria-controls="source-results"
              aria-activedescendant={selectedIndex >= 0 ? `source-result-${selectedIndex}` : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={searchLabel(activeKind)}
              autoComplete="off"
            />
          </label>

          {state === 'loading' && <StatusMessage>Searching Spotify...</StatusMessage>}
          {state === 'error' && (
            <div>
              <StatusMessage tone="error">{error}</StatusMessage>
              <button type="button" className="button button--secondary" onClick={() => setRetryNonce((value) => value + 1)}>Retry search</button>
            </div>
          )}
          {state === 'ready' && results.length === 0 && <StatusMessage>No matching sources found.</StatusMessage>}
          {results.length > 0 && (
            <div id="source-results" className="search-results" role="listbox" aria-label="Spotify search results">
              {results.map((result, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedIndex === index}
                  id={`source-result-${index}`}
                  className="search-result"
                  key={`${result.kind}-${'id' in result ? result.id : result.kind}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => onSelect(result)}
                >
                  {result.imageUrl ? <img src={result.imageUrl} alt="" width="48" height="48" /> : <span className="artwork-placeholder" aria-hidden="true" />}
                  <span>{result.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
