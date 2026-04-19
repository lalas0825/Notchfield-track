import { useCallback, useEffect, useState } from 'react';
import { getJhaLibraryForTrade } from '../services/jhaLibraryService';
import type { JhaLibraryItem, Trade } from '../types';

/**
 * Load the JHA library for a foreman's trade. Filters to active=true on the
 * service side. Re-runs whenever orgId, projectId, or trade change.
 */
export function useJhaLibrary(
  orgId: string | null | undefined,
  projectId: string | null | undefined,
  trade: Trade | null | undefined,
) {
  const [items, setItems] = useState<JhaLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId || !projectId || !trade) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await getJhaLibraryForTrade(orgId, projectId, trade);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, trade]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
