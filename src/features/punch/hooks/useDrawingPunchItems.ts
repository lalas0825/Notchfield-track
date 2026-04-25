/**
 * Sprint 53B — Drawing-anchored punch items.
 *
 * Returns punch items pinned to a specific drawing (drawing_id matches), so
 * the plan viewer can render them as overlay markers. Filters out verified
 * items by default — they're "done" and clutter the view.
 *
 * Local-first via PowerSync. Reloads on focus (foreman pins one, supervisor
 * walks the floor, foreman comes back to plans tab to see updates).
 */

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localQuery } from '@/shared/lib/powersync/write';
import type { PunchItem } from '../services/punch-service';

type Options = {
  /** When true, exclude verified items from the result (default: true). */
  hideVerified?: boolean;
};

export function useDrawingPunchItems(
  drawingId: string | null,
  opts: Options = {},
) {
  const { hideVerified = true } = opts;
  const [items, setItems] = useState<PunchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!drawingId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const sql = hideVerified
        ? `SELECT * FROM punch_items
             WHERE drawing_id = ? AND status != 'verified'
             ORDER BY created_at DESC`
        : `SELECT * FROM punch_items
             WHERE drawing_id = ?
             ORDER BY created_at DESC`;

      const rows = await localQuery<Record<string, unknown>>(sql, [drawingId]);
      const parsed = (rows ?? []).map((r) => ({
        ...r,
        photos: parseJsonArray(r.photos),
        resolution_photos: parseJsonArray(r.resolution_photos),
      })) as unknown as PunchItem[];
      setItems(parsed);
    } finally {
      setLoading(false);
    }
  }, [drawingId, hideVerified]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { items, loading, reload };
}

function parseJsonArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Lightweight per-area open punch count. Used by Ready Board to badge
 * areas that have unresolved internal QC items.
 */
export function useAreaPunchActivity(areaId: string | null) {
  const [openCount, setOpenCount] = useState(0);

  const reload = useCallback(async () => {
    if (!areaId) {
      setOpenCount(0);
      return;
    }
    const rows = await localQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM punch_items
         WHERE area_id = ?
           AND status IN ('open', 'in_progress', 'rejected')`,
      [areaId],
    );
    setOpenCount((rows?.[0]?.n as number) ?? 0);
  }, [areaId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { openCount, reload };
}
