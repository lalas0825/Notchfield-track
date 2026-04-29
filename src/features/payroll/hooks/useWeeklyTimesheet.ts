/**
 * Sprint 73 Payroll Ask #4 — useWeeklyTimesheet.
 *
 * Aggregates `area_time_entries` for the foreman's crew over a single
 * Saturday→Friday work week (per Web's pay_period definition) into a
 * worker × day-of-week grid.
 *
 * Output shape matches the `ForemanWeeklyHoursSummary` payload Web
 * expects — hours_summary in the POST body to /api/payroll/foreman-submissions.
 *
 * Default week = the current pay-period (Sat→Fri containing today).
 * Saturday morning pushes land the foreman on the JUST-FINISHED week
 * (last Sat → last Fri), since the Friday cutoff already passed.
 *
 * Scope: ONLY entries where `assigned_by = currentForemanUserId` show up.
 * Multi-foreman projects → each foreman submits only their own crew.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import type { ForemanWeeklyHoursSummary } from '../services/payrollApiClient';

type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
const DAY_KEYS: readonly DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type WeeklyRange = {
  fromISO: string;
  toISO: string;
  /** Friday calendar date (YYYY-MM-DD), Web's `week_ending` value. */
  weekEnding: string;
  /** "Sat Apr 25 → Fri May 1" */
  label: string;
};

/**
 * Compute the Saturday→Friday pay-period week containing `anchor` (default = now).
 * Pay period: Sat 00:00 → next Sat 00:00. `weekEnding` = the Friday inside it.
 */
export function weekRangeFor(anchor: Date = new Date()): WeeklyRange {
  // JS Date.getDay(): Sun=0, Mon=1, ..., Sat=6.
  // Days since Saturday: (day + 1) % 7  →  Sat=0, Sun=1, Mon=2, ..., Fri=6
  const day = anchor.getDay();
  const daysSinceSaturday = (day + 1) % 7;
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysSinceSaturday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const friday = new Date(end);
  friday.setDate(friday.getDate() - 1);
  const yyyy = friday.getFullYear();
  const mm = String(friday.getMonth() + 1).padStart(2, '0');
  const dd = String(friday.getDate()).padStart(2, '0');
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  return {
    fromISO: start.toISOString(),
    toISO: end.toISOString(),
    weekEnding: `${yyyy}-${mm}-${dd}`,
    label: `${fmt(start)} → ${fmt(friday)}`,
  };
}

function dayKeyFor(d: Date): DayKey {
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)[
    d.getDay()
  ] as DayKey;
}

type RawEntryRow = {
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  hours: number | null;
};

type RawWorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function workerName(w: RawWorkerRow): string {
  return `${w.first_name ?? ''} ${w.last_name ?? ''}`.trim() || 'Unknown';
}

function liveHours(startedAt: string, endedAt: string | null, hours: number | null): number {
  if (hours != null) return hours;
  if (endedAt) return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 3600000;
  return (Date.now() - new Date(startedAt).getTime()) / 3600000;
}

export type WorkerWeekRow = {
  worker_id: string;
  full_name: string;
  days: Record<DayKey, number>;
  total: number;
};

export function useWeeklyTimesheet(opts?: { anchor?: Date }) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const projectId = useProjectStore((s) => s.activeProject?.id ?? null);

  const range = useMemo(() => weekRangeFor(opts?.anchor), [opts?.anchor]);

  const [workers, setWorkers] = useState<WorkerWeekRow[]>([]);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!projectId || !userId) {
      if (mountedRef.current) {
        setWorkers([]);
        setLoading(false);
      }
      return;
    }

    // Pull THIS foreman's entries for the week. assigned_by ensures
    // multi-foreman projects don't cross-contaminate.
    const rows = await localQuery<RawEntryRow>(
      `SELECT worker_id, started_at, ended_at, hours
         FROM area_time_entries
        WHERE project_id = ?
          AND assigned_by = ?
          AND started_at >= ?
          AND started_at < ?
        ORDER BY started_at ASC`,
      [projectId, userId, range.fromISO, range.toISO],
    );
    const entries = rows ?? [];

    // Bucket by worker × day-of-week using the entry's started_at LOCAL date.
    const byWorker = new Map<string, WorkerWeekRow>();
    for (const e of entries) {
      const h = liveHours(e.started_at, e.ended_at, e.hours);
      const dKey = dayKeyFor(new Date(e.started_at));
      let row = byWorker.get(e.worker_id);
      if (!row) {
        row = {
          worker_id: e.worker_id,
          full_name: 'Unknown',
          days: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 },
          total: 0,
        };
        byWorker.set(e.worker_id, row);
      }
      row.days[dKey] += h;
      row.total += h;
    }

    // Resolve worker names (single IN-clause query against local workers table).
    const ids = Array.from(byWorker.keys());
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const wRows = await localQuery<RawWorkerRow>(
        `SELECT id, first_name, last_name FROM workers WHERE id IN (${placeholders})`,
        ids,
      );
      for (const w of wRows ?? []) {
        const row = byWorker.get(w.id);
        if (row) row.full_name = workerName(w);
      }
    }

    const ordered = [...byWorker.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name),
    );

    if (mountedRef.current) {
      setWorkers(ordered);
      setLoading(false);
    }
  }, [projectId, userId, range.fromISO, range.toISO]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  /** Snapshot in the shape Web's API expects. Recomputed on each workers change. */
  const hoursSummary = useMemo<ForemanWeeklyHoursSummary>(
    () => ({
      workers: workers.map((w) => ({
        worker_id: w.worker_id,
        full_name: w.full_name,
        days: { ...w.days },
        total: Number(w.total.toFixed(2)),
      })),
      grand_total: Number(
        workers.reduce((s, w) => s + w.total, 0).toFixed(2),
      ),
      generated_at: new Date().toISOString(),
      generated_from: 'area_time_entries',
    }),
    [workers],
  );

  return { range, workers, hoursSummary, loading, reload };
}

export const WEEK_DAYS = DAY_KEYS;
