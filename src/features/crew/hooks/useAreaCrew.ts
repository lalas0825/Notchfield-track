/**
 * Sprint Crew P1 — useAreaCrew.
 *
 * "Who is / has worked in THIS area today?" — answers for the AreaCrew
 * tile on the AreaDetail screen.
 *
 * Reads `area_time_entries` from PowerSync local (offline-first), joined
 * with `workers` for names + photos. Two derived lists:
 *   - currentWorkers: entries where ended_at IS NULL — actively logging time
 *   - todayWorkers:   entries with ended_at set, started today — closed today
 *
 * Running hours for currentWorkers are computed live from started_at and
 * `Date.now()` so the tile shows the elapsed time since assignment without
 * needing a refresh. Closed entries use the GENERATED `hours` column.
 *
 * Realtime subscription on area_time_entries for this area updates the
 * tile when other devices (e.g. the supervisor moves a worker on the
 * Crew screen) flip an entry's status.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';

export type AreaCrewWorker = {
  worker_id: string;
  full_name: string;
  trade: string | null;
  trade_level: string | null;
  photo_url: string | null;
};

export type AreaCrewEntry = {
  id: string;
  worker: AreaCrewWorker;
  started_at: string;
  ended_at: string | null;
  /** Closed entries: GENERATED column from DB. Live entries: undefined. */
  hours: number | null;
  /** Live computed for open entries; same as `hours` for closed. */
  elapsed_hours: number;
  worker_role: string;
};

type RawEntry = {
  id: string;
  worker_id: string;
  worker_role: string;
  started_at: string;
  ended_at: string | null;
  hours: number | null;
};

type RawWorker = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  trade: string | null;
  trade_level: string | null;
  photo_url: string | null;
};

function liveHours(startedAt: string, endedAt: string | null, hours: number | null): number {
  if (hours != null) return hours;
  if (endedAt) return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 3600000;
  return (Date.now() - new Date(startedAt).getTime()) / 3600000;
}

/** Today at midnight, local time, ISO format. */
function startOfTodayISO(): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString();
}

export function useAreaCrew(areaId: string | null | undefined) {
  const [entries, setEntries] = useState<AreaCrewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Tick for live elapsed-hours recomputation (open entries).
  const [, setTick] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!areaId) {
      if (mountedRef.current) {
        setEntries([]);
        setLoading(false);
      }
      return;
    }

    // Bug fix 2026-04-28: the previous filter `started_at >= todayStart`
    // dropped open entries that started yesterday in local time but are
    // still running. Construction shifts often cross midnight (afternoon
    // start, late-evening continuation) — a foreman opening AreaDetail
    // at 1am should still see the workers who are CURRENTLY there even
    // though their entries started 5 hours earlier "yesterday".
    //
    // New shape:
    //   - Always include OPEN entries (ended_at IS NULL) regardless of date
    //   - Include CLOSED entries that ENDED today (was the day's work)
    const todayStart = startOfTodayISO();
    const rawEntries = await localQuery<RawEntry>(
      `SELECT id, worker_id, worker_role, started_at, ended_at, hours
         FROM area_time_entries
        WHERE area_id = ?
          AND (
            ended_at IS NULL
            OR ended_at >= ?
          )
        ORDER BY started_at DESC
        LIMIT 200`,
      [areaId, todayStart],
    );
    const rows = rawEntries ?? [];

    // Resolve worker names — single IN-clause query against PowerSync
    // local `workers` table (already synced via by_org).
    const workerIds = Array.from(new Set(rows.map((r) => r.worker_id)));
    let workersById: Record<string, AreaCrewWorker> = {};
    if (workerIds.length > 0) {
      const placeholders = workerIds.map(() => '?').join(',');
      const wRows = await localQuery<RawWorker>(
        `SELECT id, first_name, last_name, trade, trade_level, photo_url
           FROM workers WHERE id IN (${placeholders})`,
        workerIds,
      );
      workersById = (wRows ?? []).reduce<Record<string, AreaCrewWorker>>((acc, w) => {
        acc[w.id] = {
          worker_id: w.id,
          full_name:
            `${w.first_name ?? ''} ${w.last_name ?? ''}`.trim() || 'Unknown',
          trade: w.trade ?? null,
          trade_level: w.trade_level ?? null,
          photo_url: w.photo_url ?? null,
        };
        return acc;
      }, {});
    }

    const merged: AreaCrewEntry[] = rows.map((r) => ({
      id: r.id,
      worker: workersById[r.worker_id] ?? {
        worker_id: r.worker_id,
        full_name: 'Unknown',
        trade: null,
        trade_level: null,
        photo_url: null,
      },
      started_at: r.started_at,
      ended_at: r.ended_at,
      hours: r.hours,
      elapsed_hours: liveHours(r.started_at, r.ended_at, r.hours),
      worker_role: r.worker_role,
    }));

    if (mountedRef.current) {
      setEntries(merged);
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Realtime — area_time_entries flips ended_at as foremen move workers.
  useEffect(() => {
    if (!areaId) return;
    const channel = supabase
      .channel(`area_crew_${areaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'area_time_entries',
          filter: `area_id=eq.${areaId}`,
        },
        () => {
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [areaId, reload]);

  // Live tick for open entries — recompute elapsed every 30s.
  useEffect(() => {
    const hasOpen = entries.some((e) => e.ended_at === null);
    if (!hasOpen) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, [entries]);

  // Derived buckets — recompute on each render (cheap, max 200 entries).
  const currentWorkers = useMemo(
    () => entries.filter((e) => e.ended_at === null),
    [entries],
  );
  const todayWorkers = useMemo(
    () => entries.filter((e) => e.ended_at !== null),
    [entries],
  );
  const totalHoursToday = useMemo(
    () =>
      entries.reduce((sum, e) => {
        if (e.ended_at === null) {
          return sum + (Date.now() - new Date(e.started_at).getTime()) / 3600000;
        }
        return sum + (e.hours ?? 0);
      }, 0),
    // Re-include open entries in the sum live, so include `entries` reference
    // (not just length). The tick effect above also forces a re-render.
    [entries],
  );

  return {
    entries,
    currentWorkers,
    todayWorkers,
    totalHoursToday,
    loading,
    reload,
  };
}
