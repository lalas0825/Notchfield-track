import { useCallback, useEffect, useState } from 'react';
import { getProjectWorkers } from '../services/workerService';
import type { Worker } from '../types';

/**
 * List of workers active on a project (project_workers JOIN workers, both
 * sides active=true). The PTP sign-off screen uses this to populate the
 * crew list — a worker appears as a signer candidate only if the PM has
 * added them to the project in Takeoff web's Manpower module.
 */
export function useProjectWorkers(projectId: string | null | undefined) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setWorkers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await getProjectWorkers(projectId);
      setWorkers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project workers');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { workers, loading, error, reload: load };
}
