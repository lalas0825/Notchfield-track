/**
 * Sprint Crew P2 — useCrewHistory.
 *
 * Aggregates `area_time_entries` over a date range, scoped to a project,
 * and produces two pivots:
 *   - byArea:   each area → list of workers + their hours, plus area total
 *   - byWorker: each worker → list of areas + their hours, plus worker total
 *
 * Reads PowerSync local for offline-first reporting. Open entries (still
 * running) are included with elapsed time computed live so the totals
 * stay accurate while the day is in progress.
 *
 * Sort: byArea → highest total first; byWorker → highest total first.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localQuery } from '@/shared/lib/powersync/write';

export type WorkerHoursLine = {
  worker_id: string;
  full_name: string;
  trade: string | null;
  trade_level: string | null;
  hours: number;
  segments: number;
};

export type ByAreaRow = {
  area_id: string;
  area_label: string;
  area_floor: string | null;
  total_hours: number;
  workers: WorkerHoursLine[];
};

export type AreaHoursLine = {
  area_id: string;
  area_label: string;
  area_floor: string | null;
  hours: number;
  segments: number;
};

export type ByWorkerRow = {
  worker_id: string;
  full_name: string;
  trade: string | null;
  trade_level: string | null;
  total_hours: number;
  areas: AreaHoursLine[];
};

type RawEntry = {
  area_id: string;
  worker_id: string;
  worker_role: string | null;
  started_at: string;
  ended_at: string | null;
  hours: number | null;
};

type RawArea = {
  id: string;
  name: string;
  floor: string | null;
};

type RawWorker = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  trade: string | null;
  trade_level: string | null;
};

function liveHours(startedAt: string, endedAt: string | null, hours: number | null): number {
  if (hours != null) return hours;
  if (endedAt) return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 3600000;
  return (Date.now() - new Date(startedAt).getTime()) / 3600000;
}

function workerName(w: RawWorker): string {
  return `${w.first_name ?? ''} ${w.last_name ?? ''}`.trim() || 'Unknown';
}

export type UseCrewHistoryOpts = {
  projectId: string | null | undefined;
  /** Inclusive start, ISO. */
  fromISO: string;
  /** Exclusive end, ISO. */
  toISO: string;
};

export function useCrewHistory({ projectId, fromISO, toISO }: UseCrewHistoryOpts) {
  const [rawEntries, setRawEntries] = useState<RawEntry[]>([]);
  const [areasById, setAreasById] = useState<Record<string, RawArea>>({});
  const [workersById, setWorkersById] = useState<Record<string, RawWorker>>({});
  const [loading, setLoading] = useState(true);

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
        setRawEntries([]);
        setAreasById({});
        setWorkersById({});
        setLoading(false);
      }
      return;
    }

    const entries = await localQuery<RawEntry>(
      `SELECT area_id, worker_id, worker_role, started_at, ended_at, hours
         FROM area_time_entries
        WHERE project_id = ?
          AND started_at >= ?
          AND started_at < ?
        ORDER BY started_at ASC`,
      [projectId, fromISO, toISO],
    );
    const rows = entries ?? [];

    const areaIds = Array.from(new Set(rows.map((r) => r.area_id)));
    const workerIds = Array.from(new Set(rows.map((r) => r.worker_id)));

    const [aRows, wRows] = await Promise.all([
      areaIds.length > 0
        ? localQuery<RawArea>(
            `SELECT id, name, floor FROM production_areas WHERE id IN (${areaIds.map(() => '?').join(',')})`,
            areaIds,
          )
        : Promise.resolve([] as RawArea[]),
      workerIds.length > 0
        ? localQuery<RawWorker>(
            `SELECT id, first_name, last_name, trade, trade_level FROM workers WHERE id IN (${workerIds.map(() => '?').join(',')})`,
            workerIds,
          )
        : Promise.resolve([] as RawWorker[]),
    ]);

    const aMap = (aRows ?? []).reduce<Record<string, RawArea>>((acc, a) => {
      acc[a.id] = a;
      return acc;
    }, {});
    const wMap = (wRows ?? []).reduce<Record<string, RawWorker>>((acc, w) => {
      acc[w.id] = w;
      return acc;
    }, {});

    if (mountedRef.current) {
      setRawEntries(rows);
      setAreasById(aMap);
      setWorkersById(wMap);
      setLoading(false);
    }
  }, [projectId, fromISO, toISO]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Pivot 1: by area — { area, totalHours, workers: [{ worker, hours }] }
  const byArea = useMemo<ByAreaRow[]>(() => {
    const map = new Map<
      string,
      { area_id: string; area_label: string; area_floor: string | null; total: number; perWorker: Map<string, { hours: number; segments: number }> }
    >();
    for (const e of rawEntries) {
      const h = liveHours(e.started_at, e.ended_at, e.hours);
      const area = areasById[e.area_id];
      const key = e.area_id;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          area_id: e.area_id,
          area_label: area?.name ?? e.area_id.slice(0, 8),
          area_floor: area?.floor ?? null,
          total: 0,
          perWorker: new Map(),
        };
        map.set(key, bucket);
      }
      bucket.total += h;
      const wb = bucket.perWorker.get(e.worker_id);
      if (wb) {
        wb.hours += h;
        wb.segments += 1;
      } else {
        bucket.perWorker.set(e.worker_id, { hours: h, segments: 1 });
      }
    }
    return [...map.values()]
      .map((b) => ({
        area_id: b.area_id,
        area_label: b.area_label,
        area_floor: b.area_floor,
        total_hours: b.total,
        workers: [...b.perWorker.entries()]
          .map(([wId, { hours, segments }]) => {
            const w = workersById[wId];
            return {
              worker_id: wId,
              full_name: w ? workerName(w) : 'Unknown',
              trade: w?.trade ?? null,
              trade_level: w?.trade_level ?? null,
              hours,
              segments,
            };
          })
          .sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.total_hours - a.total_hours);
  }, [rawEntries, areasById, workersById]);

  // Pivot 2: by worker — { worker, totalHours, areas: [{ area, hours }] }
  const byWorker = useMemo<ByWorkerRow[]>(() => {
    const map = new Map<
      string,
      { worker_id: string; total: number; perArea: Map<string, { hours: number; segments: number }> }
    >();
    for (const e of rawEntries) {
      const h = liveHours(e.started_at, e.ended_at, e.hours);
      let bucket = map.get(e.worker_id);
      if (!bucket) {
        bucket = { worker_id: e.worker_id, total: 0, perArea: new Map() };
        map.set(e.worker_id, bucket);
      }
      bucket.total += h;
      const ab = bucket.perArea.get(e.area_id);
      if (ab) {
        ab.hours += h;
        ab.segments += 1;
      } else {
        bucket.perArea.set(e.area_id, { hours: h, segments: 1 });
      }
    }
    return [...map.values()]
      .map((b) => {
        const w = workersById[b.worker_id];
        return {
          worker_id: b.worker_id,
          full_name: w ? workerName(w) : 'Unknown',
          trade: w?.trade ?? null,
          trade_level: w?.trade_level ?? null,
          total_hours: b.total,
          areas: [...b.perArea.entries()]
            .map(([aId, { hours, segments }]) => {
              const a = areasById[aId];
              return {
                area_id: aId,
                area_label: a?.name ?? aId.slice(0, 8),
                area_floor: a?.floor ?? null,
                hours,
                segments,
              };
            })
            .sort((x, y) => y.hours - x.hours),
        };
      })
      .sort((a, b) => b.total_hours - a.total_hours);
  }, [rawEntries, areasById, workersById]);

  const grandTotal = useMemo(
    () => byArea.reduce((sum, r) => sum + r.total_hours, 0),
    [byArea],
  );

  return {
    byArea,
    byWorker,
    grandTotal,
    loading,
    reload,
    entryCount: rawEntries.length,
  };
}
