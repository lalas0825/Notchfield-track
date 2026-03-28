import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import {
  fetchPunchItems,
  fetchAreaPunchItems,
  getPunchCounts,
  type PunchItem,
} from '../services/punch-service';

export function usePunchList(areaId?: string) {
  const { profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [items, setItems] = useState<PunchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isSupervisor = ['superintendent', 'owner', 'admin', 'pm'].includes(profile?.role ?? '');

  const reload = useCallback(async () => {
    if (!activeProject || !profile) return;
    setLoading(true);

    const data = areaId
      ? await fetchAreaPunchItems(areaId)
      : await fetchPunchItems(activeProject.id, profile.organization_id);

    setItems(data);
    setLoading(false);
  }, [activeProject, profile, areaId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const counts = getPunchCounts(items);

  return {
    items,
    loading,
    reload,
    counts,
    isSupervisor,
  };
}
