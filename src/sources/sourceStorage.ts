import type { SourceDescriptor } from '../spotify/types';

const SOURCE_KEY = 'heardle:source';
const STREAK_KEY = 'heardle:streak';
const RECENT_PREFIX = 'heardle:recent:';
const MAX_RECENT_TRACKS = 20;

function storageOrDefault(storage?: Storage) {
  return storage || window.localStorage;
}

export function saveSource(source: SourceDescriptor, storage?: Storage) {
  storageOrDefault(storage).setItem(SOURCE_KEY, JSON.stringify(source));
}

export function loadStreak(storage?: Storage) {
  try {
    const value = JSON.parse(storageOrDefault(storage).getItem(STREAK_KEY) || '0') as unknown;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveStreak(streak: number, storage?: Storage) {
  const safeStreak = Number.isInteger(streak) && streak >= 0 ? streak : 0;
  storageOrDefault(storage).setItem(STREAK_KEY, JSON.stringify(safeStreak));
}

export function loadRecentTrackIds(sourceKey: string, storage?: Storage): string[] {
  try {
    const value = JSON.parse(storageOrDefault(storage).getItem(`${RECENT_PREFIX}${sourceKey}`) || '[]') as unknown;
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      return [];
    }
    return value.slice(-MAX_RECENT_TRACKS);
  } catch {
    return [];
  }
}

export function saveRecentTrackIds(sourceKey: string, trackIds: string[], storage?: Storage) {
  const recent = trackIds.filter((id) => typeof id === 'string').slice(-MAX_RECENT_TRACKS);
  storageOrDefault(storage).setItem(`${RECENT_PREFIX}${sourceKey}`, JSON.stringify(recent));
  return recent;
}

export function sourceKey(source: SourceDescriptor) {
  return 'id' in source ? `${source.kind}:${source.id}` : source.kind;
}
