import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getWorkerByProfileId } from '../services/workerService';
import type { Worker } from '../types';

/**
 * Resolve the current user's `workers` row via `workers.profile_id`.
 *
 * Foremen need a workers row to author PTPs (the signature's worker_id must
 * point at workers.id, not profiles.id). If the PM hasn't added this
 * foreman to Manpower yet, this returns `{ worker: null, loading: false,
 * needsOnboarding: true }` and callers should show a blocker.
 */
export function useMyWorker() {
  const { user } = useAuthStore();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setWorker(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getWorkerByProfileId(user.id);
      setWorker(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve worker');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    worker,
    loading,
    error,
    reload: load,
    needsOnboarding: !loading && !!user?.id && worker === null,
  };
}
