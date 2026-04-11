/**
 * useGcPunchList — loads and groups gc_punch_items for the active project.
 * Groups by floor + unit, sorted: in_progress → open → ready_for_review → closed.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { fetchGcPunchItems, type GcPunchItem, type GcPunchStatus } from '../services/gc-punch-service';

export type GcPunchGroup = {
  key: string;   // "Floor 34 — Unit 3406"
  floor: string;
  unit: string;
  items: GcPunchItem[];
};

const STATUS_ORDER: Record<GcPunchStatus, number> = {
  in_progress: 1,
  open: 2,
  ready_for_review: 3,
  closed: 4,
};

export function useGcPunchList() {
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();

  const [items, setItems] = useState<GcPunchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeProject || !user || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchGcPunchItems({
        projectId: activeProject.id,
        userId: user.id,
        role: profile.role ?? 'worker',
      });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeProject, user, profile]);

  useEffect(() => {
    load();
  }, [load]);

  // Group by floor + unit
  const groupItems = (source: GcPunchItem[]): GcPunchGroup[] => {
    const map = new Map<string, GcPunchItem[]>();
    for (const item of source) {
      const floor = item.floor ?? 'Unlocated';
      const unit = item.unit ?? '';
      const key = unit ? `${floor} — ${unit}` : floor;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()].map(([key, groupItems]) => {
      const first = groupItems[0];
      return {
        key,
        floor: first.floor ?? 'Unlocated',
        unit: first.unit ?? '',
        items: [...groupItems].sort(
          (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5),
        ),
      };
    });
  };

  const activeItems = items.filter((i) => i.status !== 'closed');
  const closedItems = items.filter((i) => i.status === 'closed');

  const counts = {
    open: items.filter((i) => i.status === 'open').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    ready_for_review: items.filter((i) => i.status === 'ready_for_review').length,
    closed: closedItems.length,
    total: items.length,
  };

  return {
    groups: groupItems(activeItems),
    closedItems,
    loading,
    counts,
    reload: load,
  };
}
