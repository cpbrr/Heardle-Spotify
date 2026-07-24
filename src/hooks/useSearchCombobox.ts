import { useEffect, useRef, useState } from 'react';
import type React from 'react';

import { useDebouncedValue } from './useDebouncedValue';

export type ComboboxState = 'idle' | 'loading' | 'ready' | 'error';

interface UseSearchComboboxOptions<T> {
  query: string;
  enabled: boolean;
  search: (query: string, signal: AbortSignal) => Promise<T[]>;
  minLength?: number;
  debounceMs?: number;
}

export function useSearchCombobox<T>({
  query,
  enabled,
  search,
  minLength = 2,
  debounceMs = 250,
}: UseSearchComboboxOptions<T>) {
  const [results, setResults] = useState<T[]>([]);
  const [state, setState] = useState<ComboboxState>('idle');
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
    if (!enabled || normalizedQuery.length < minLength) {
      setResults([]);
      setState('idle');
      setError('');
      setActiveIndex(-1);
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState('loading');
    setError('');
    setActiveIndex(-1);
    void search(normalizedQuery, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setResults(items);
        setState('ready');
      })
      .catch((searchError: unknown) => {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : 'Search unavailable');
        setState('error');
      });

    return () => {
      controller.abort();
      if (activeRequest.current === controller) activeRequest.current = null;
    };
  }, [debouncedQuery, enabled, minLength, retryNonce, search]);

  function reset() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setResults([]);
    setState('idle');
    setError('');
    setActiveIndex(-1);
  }

  function retry() {
    setRetryNonce((value) => value + 1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, onEnter: (index: number) => void, onEscape?: () => void) {
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
      onEnter(activeIndex);
      return;
    }
    if (event.key === 'Escape') {
      if (onEscape) {
        event.preventDefault();
        onEscape();
      } else {
        setResults([]);
        setActiveIndex(-1);
      }
    }
  }

  return { results, state, error, activeIndex, setActiveIndex, reset, retry, handleKeyDown };
}
