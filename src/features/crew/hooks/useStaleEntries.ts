/**
 * Sprint Crew P3 — useStaleEntries.
 *
 * Detects open `area_time_entries` rows from BEFORE today midnight (i.e.
 * the foreman forgot to End Day, or moved devices, or whatever). Surfaces
 * them on the Crew screen as a warning banner with a one-tap "Close all"
 * action so the historical hours don't keep accumulating overnight.
 *
 * Close-all strategy: each stale entry is capped at 8pm LOCAL TIME of the
 * day it was started. That's a reasonable end-of-shift default for
 * construction (sunset + dinner). If the foreman wants something
 * different they can edit in Web — Track is conservative here.
 *
 * The proper fix is a server-side cron (Web team): documented in CLAUDE.md
 * under the Crew P3 entry. Track-side guard is the immediate UX fix.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localQuery, localUpdate } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';

export type StaleEntry = {
  id: string;
  worker_id: string;
  area_id: string;
  started_at: string;
  worker_name: string;
  area_label: string;
};

type RawEntry = {
  id: string;
  worker_id: string;
  area_id: string;
  started_at: string;
};

type RawWorker = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type RawArea = {
  id: string;
  name: string;
};

/** Cap an open entry at 8pm of the day it was started (local time). */
function capAt8pm(startedAtISO: string): string {
  const start = new Date(startedAtISO);
  const cap = new Date(start);
  cap.setHours(20, 0, 0, 0);
  // Defensive: if start is somehow already past 8pm, end immediately at start time
  // (zero-hour entry) instead of a NEGATIVE duration.
  if (cap.getTime() < start.getTime()) return start.toISOString();
  return cap.toISOString();
}

export function useStaleEntries(projectId: string | null | undefined) {
  const [entries, setEntries] = useState<StaleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!projectId) {
      if (mountedRef.current) {
        setEntries([]);
        setLoading(false);
      }
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const raw = await localQuery<RawEntry>(
      `SELECT id, worker_id, area_id, started_at
         FROM area_time_entries
        WHERE project_id = ?
          AND ended_at IS NULL
          AND started_at < ?
        ORDER BY started_at ASC
        LIMIT 100`,
      [projectId, todayStart.toISOString()],
    );
    const rows = raw ?? [];

    if (rows.length === 0) {
      if (mountedRef.current) {
        setEntries([]);
        setLoading(false);
      }
      return;
    }

    const workerIds = Array.from(new Set(rows.map((r) => r.worker_id)));
    const areaIds = Array.from(new Set(rows.map((r) => r.area_id)));

    const [wRows, aRows] = await Promise.all([
      localQuery<RawWorker>(
        `SELECT id, first_name, last_name FROM workers WHERE id IN (${workerIds.map(() => '?').join(',')})`,
        workerIds,
      ),
      localQuery<RawArea>(
        `SELECT id, name FROM production_areas WHERE id IN (${areaIds.map(() => '?').join(',')})`,
        areaIds,
      ),
    ]);

    const workersById = (wRows ?? []).reduce<Record<string, RawWorker>>((acc, w) => {
      acc[w.id] = w;
      return acc;
    }, {});
    const areasById = (aRows ?? []).reduce<Record<string, RawArea>>((acc, a) => {
      acc[a.id] = a;
      return acc;
    }, {});

    const merged: StaleEntry[] = rows.map((r) => {
      const w = workersById[r.worker_id];
      const a = areasById[r.area_id];
      return {
        id: r.id,
        worker_id: r.worker_id,
        area_id: r.area_id,
        started_at: r.started_at,
        worker_name: w
          ? `${w.first_name ?? ''} ${w.last_name ?? ''}`.trim() || 'Unknown'
          : 'Unknown',
        area_label: a?.name ?? r.area_id.slice(0, 8),
      };
    });

    if (mountedRef.current) {
      setEntries(merged);
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const closeAll = useCallback(async () => {
    if (entries.length === 0) return;
    setClosing(true);
    try {
      for (const e of entries) {
        const endedAt = capAt8pm(e.started_at);
        const res = await localUpdate('area_time_entries', e.id, {
          ended_at: endedAt,
        });
        if (!res.success) {
          logger.warn('[stale-entries] close failed', {
            id: e.id,
            error: res.error,
          });
        }
      }
      await reload();
    } finally {
      setClosing(false);
    }
  }, [entries, reload]);

  /** Days the stale entries span — useful for the banner copy. */
  const dayCount = useMemo(() => {
    const days = new Set<string>();
    for (const e of entries) {
      const d = new Date(e.started_at);
      d.setHours(0, 0, 0, 0);
      days.add(d.toDateString());
    }
    return days.size;
  }, [entries]);

  return {
    entries,
    count: entries.length,
    dayCount,
    loading,
    closing,
    closeAll,
    reload,
  };
}
