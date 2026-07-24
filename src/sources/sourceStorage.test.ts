import { beforeEach, describe, expect, it } from 'vitest';

import {
  loadRecentTrackIds,
  loadStreak,
  saveRecentTrackIds,
  saveSource,
  saveStreak,
} from './sourceStorage';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

let storage: Storage;

beforeEach(() => {
  storage = new MemoryStorage();
});

describe('sourceStorage', () => {
  it('persists a source descriptor', () => {
    const source = { kind: 'album' as const, id: 'album-1', name: 'Album', imageUrl: null };

    saveSource(source, storage);

    expect(storage.getItem('heardle:source')).toBe(JSON.stringify(source));
  });

  it('falls back to zero for corrupt streak data', () => {
    storage.setItem('heardle:streak', 'not-json');

    expect(loadStreak(storage)).toBe(0);
    saveStreak(7, storage);
    expect(loadStreak(storage)).toBe(7);
  });

  it('stores at most twenty recent track ids per source', () => {
    const ids = Array.from({ length: 25 }, (_, index) => `track-${index}`);

    saveRecentTrackIds('playlist:playlist-1', ids, storage);

    expect(loadRecentTrackIds('playlist:playlist-1', storage)).toEqual(ids.slice(-20));
  });

  it('never accepts non-string recent track ids', () => {
    storage.setItem('heardle:recent:liked', JSON.stringify(['valid', 2, null]));

    expect(loadRecentTrackIds('liked', storage)).toEqual([]);
  });
});
