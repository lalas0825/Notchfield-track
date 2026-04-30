/**
 * History persistence — last 10 calculations stored in AsyncStorage.
 *
 * Bootstraps from storage on mount, batches writes, and exposes a clear API.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistorySchema, type HistoryEntry } from '../types/schemas';

const STORAGE_KEY = '@calculator/history';
const MAX_ENTRIES = 10;

let inMemoryCache: HistoryEntry[] | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

async function loadFromDisk(): Promise<HistoryEntry[]> {
  if (inMemoryCache) return inMemoryCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      inMemoryCache = [];
      return inMemoryCache;
    }
    const parsed = HistorySchema.safeParse(JSON.parse(raw));
    inMemoryCache = parsed.success ? parsed.data : [];
    return inMemoryCache;
  } catch {
    inMemoryCache = [];
    return inMemoryCache;
  }
}

async function persist(entries: HistoryEntry[]): Promise<void> {
  inMemoryCache = entries;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Persisting history is best-effort; in-memory cache covers the session
  }
  notify();
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(inMemoryCache ?? []);

  useEffect(() => {
    let mounted = true;
    void loadFromDisk().then((data) => {
      if (mounted) setEntries(data);
    });
    const cb = () => {
      if (mounted && inMemoryCache) setEntries([...inMemoryCache]);
    };
    subscribers.add(cb);
    return () => {
      mounted = false;
      subscribers.delete(cb);
    };
  }, []);

  const add = useCallback(async (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => {
    const current = (await loadFromDisk()).slice();
    const newEntry: HistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    const next = [newEntry, ...current].slice(0, MAX_ENTRIES);
    await persist(next);
  }, []);

  const clear = useCallback(async () => {
    await persist([]);
  }, []);

  const remove = useCallback(async (id: string) => {
    const current = (await loadFromDisk()).slice();
    const next = current.filter((e) => e.id !== id);
    await persist(next);
  }, []);

  return { entries, add, clear, remove };
}
