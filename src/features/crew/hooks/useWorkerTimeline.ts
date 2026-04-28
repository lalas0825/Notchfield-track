/**
 * Sprint Crew P1 — useWorkerTimeline.
 *
 * "What did THIS worker do today?" — answers for the WorkerTimelineModal
 * opened from any list (AreaCrewTile, Crew screen, History view).
 *
 * Reads `area_time_entries` for one worker, scoped to a date range
 * (default = today). JOINs with `production_areas` for area labels so
 * the timeline reads "L3-E2 (7h) → L3-E4 (3h)" instead of UUIDs.
 *
 * Sorted started_at ASC so the timeline reads chronologically — first
 * area of the day at the top, current/last at the bottom.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localQuery } from '@/shared/lib/powersync/write';

export type TimelineSegment = {
  id: string;
  area_id: string;
  area_label: string;
  area_floor: string | null;
  started_at: string;
  ended_at: string | null;
  hours: number | null;
  /** Live computed elapsed for open entries; same as `hours` when closed. */
  elapsed_hours: number;
  worker_role: string;
};

type RawEntry = {
  id: string;
  area_id: string;
  worker_role: string;
  started_at: string;
  ended_at: string | null;
  hours: number | null;
};

type RawArea = {
  id: string;
  name: string;
  floor: string | null;
};

function liveHours(startedAt: string, endedAt: string | null, hours: number | null): number {
  if (hours != null) return hours;
  if (endedAt) return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 3600000;
  return (Date.now() - new Date(startedAt).getTime()) / 3600000;
}

/** Defaults to today: [00:00 today, 00:00 tomorrow). */
function defaultRange(): { fromISO: string; toISO: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromISO: start.toISOString(), toISO: end.toISOString() };
}

export function useWorkerTimeline(
  workerId: string | null | undefined,
  opts?: { fromISO?: string; toISO?: string },
) {
  const fromISO = opts?.fromISO ?? defaultRange().fromISO;
  const toISO = opts?.toISO ?? defaultRange().toISO;

  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!workerId) {
      if (mountedRef.current) {
        setSegments([]);
        setLoading(false);
      }
      return;
    }
    const rawEntries = await localQuery<RawEntry>(
      `SELECT id, area_id, worker_role, started_at, ended_at, hours
         FROM area_time_entries
        WHERE worker_id = ?
          AND started_at >= ?
          AND started_at < ?
        ORDER BY started_at ASC`,
      [workerId, fromISO, toISO],
    );
    const rows = rawEntries ?? [];

    const areaIds = Array.from(new Set(rows.map((r) => r.area_id)));
    let areasById: Record<string, RawArea> = {};
    if (areaIds.length > 0) {
      const placeholders = areaIds.map(() => '?').join(',');
      const aRows = await localQuery<RawArea>(
        `SELECT id, name, floor FROM production_areas WHERE id IN (${placeholders})`,
        areaIds,
      );
      areasById = (aRows ?? []).reduce<Record<string, RawArea>>((acc, a) => {
        acc[a.id] = a;
        return acc;
      }, {});
    }

    const merged: TimelineSegment[] = rows.map((r) => {
      const area = areasById[r.area_id];
      return {
        id: r.id,
        area_id: r.area_id,
        area_label: area?.name ?? r.area_id.slice(0, 8),
        area_floor: area?.floor ?? null,
        started_at: r.started_at,
        ended_at: r.ended_at,
        hours: r.hours,
        elapsed_hours: liveHours(r.started_at, r.ended_at, r.hours),
        worker_role: r.worker_role,
      };
    });

    if (mountedRef.current) {
      setSegments(merged);
      setLoading(false);
    }
  }, [workerId, fromISO, toISO]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Live tick for open segments
  useEffect(() => {
    const hasOpen = segments.some((s) => s.ended_at === null);
    if (!hasOpen) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, [segments]);

  const totalHours = useMemo(
    () =>
      segments.reduce(
        (sum, s) =>
          sum +
          (s.ended_at === null
            ? (Date.now() - new Date(s.started_at).getTime()) / 3600000
            : (s.hours ?? 0)),
        0,
      ),
    [segments],
  );

  return { segments, totalHours, loading, reload };
}
