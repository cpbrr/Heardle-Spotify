import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Disc3, Heart, Library, ListMusic, Music, Search, TrendingUp, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useSearchCombobox } from '../hooks/useSearchCombobox';
import { searchSources } from '../sources/catalog';
import type { SourceDescriptor } from '../spotify/types';
import { StatusMessage } from './StatusMessage';

type SearchableKind = Exclude<SourceDescriptor['kind'], 'top' | 'liked'>;

interface SourcePickerProps {
  onSelect(source: SourceDescriptor): void;
  onClose?: () => void;
  search?: (kind: SearchableKind, query: string, signal: AbortSignal) => Promise<SourceDescriptor[]>;
}

const SOURCE_ICONS: Record<SourceDescriptor['kind'], LucideIcon> = {
  'artist-mix': Users,
  'artist-discography': Library,
  playlist: ListMusic,
  album: Disc3,
  track: Music,
  top: TrendingUp,
  liked: Heart,
};

const QUICK_PICKS: Array<{ kind: 'top' | 'liked'; label: string }> = [
  { kind: 'top', label: 'My top tracks' },
  { kind: 'liked', label: 'My liked songs' },
];

const SOURCE_OPTIONS: Array<{
  kind: SearchableKind;
  label: string;
  description: string;
}> = [
  { kind: 'artist-mix', label: 'Artist mix', description: 'A focused mix from an artist search' },
  { kind: 'artist-discography', label: 'Artist discography', description: 'Playable tracks across an exact artist catalogue' },
  { kind: 'playlist', label: 'Playlist', description: 'Choose one of Spotify’s public or saved playlists' },
  { kind: 'album', label: 'Album', description: 'Play from one release' },
  { kind: 'track', label: 'Specific track', description: 'Start a round with one exact song' },
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
  const inputRef = useRef<HTMLInputElement>(null);

  const searchByKind = useCallback(
    (normalizedQuery: string, signal: AbortSignal) => search(activeKind as SearchableKind, normalizedQuery, signal),
    [activeKind, search],
  );
  const {
    results,
    state,
    error,
    activeIndex: selectedIndex,
    setActiveIndex: setSelectedIndex,
    reset,
    retry,
    handleKeyDown,
  } = useSearchCombobox<SourceDescriptor>({
    query,
    enabled: activeKind !== null,
    search: searchByKind,
  });

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
    reset();
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    handleKeyDown(event, (index) => onSelect(results[index]), () => setActiveKind(null));
  }

  return (
    <section className="source-picker" role="dialog" aria-modal="true" aria-labelledby="source-picker-title">
      <div className="source-picker__brand">
        <div className="app-header__brand">
          <img src="/mascot.png" alt="" />
          <span>Heardle</span>
        </div>
        {onClose ? (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close source picker" title="Close source picker">
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {!activeKind ? (
        <div className="source-home">
          <div className="source-picker__intro">
            <span className="eyebrow">Song source</span>
            <h1 id="source-picker-title">Choose what to play</h1>
            <p>Point tonight&rsquo;s round at an artist, a playlist, an album, or your own library.</p>
          </div>

          <div className="source-quick-picks">
            {QUICK_PICKS.map((option) => {
              const Icon = SOURCE_ICONS[option.kind];
              return (
                <button type="button" className="source-quick-pick" key={option.kind} onClick={() => chooseMode(option.kind)}>
                  <span className="source-quick-pick__icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="source-quick-pick__label">{option.label}</span>
                </button>
              );
            })}
          </div>

          <div>
            <span className="source-grid-label">Browse a source</span>
            <div className="source-grid">
              {SOURCE_OPTIONS.map((option) => {
                const Icon = SOURCE_ICONS[option.kind];
                return (
                  <button type="button" className="source-card" key={option.kind} onClick={() => chooseMode(option.kind)}>
                    <span className="source-card__badge" aria-hidden="true"><Search size={11} />Search</span>
                    <span className="source-card__icon" aria-hidden="true"><Icon size={26} /></span>
                    <span className="source-card__title">{option.label}</span>
                    <span className="source-card__description">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="source-search">
          <div className="source-search__header">
            <button type="button" className="icon-button" onClick={() => setActiveKind(null)} aria-label="Back to source types" title="Back to source types">
              <ArrowLeft aria-hidden="true" />
            </button>
            <div>
              <span className="eyebrow">{activeTitle}</span>
              <h1 id="source-picker-title">{searchLabel(activeKind)}</h1>
            </div>
          </div>

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
              <button type="button" className="button button--secondary" onClick={retry}>Retry search</button>
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
