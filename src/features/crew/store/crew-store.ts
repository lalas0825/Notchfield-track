import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localUpdate, localDelete, localUpdateWhere, localDeleteWhere, localQuery, generateUUID } from '@/shared/lib/powersync/write';
import { haptic } from '@/shared/lib/haptics';
import { logger } from '@/shared/lib/logger';
import { autoCompleteAndForget } from '@/features/todos/services/todoApiClient';

export type Worker = {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
};

export type Area = {
  id: string;
  name: string;
  floor: string | null;
  zone: string | null;
  status: string;
};

export type Assignment = {
  id: string;
  worker_id: string;
  area_id: string;
  assigned_at: string;
};

export type TimeEntry = {
  id: string;
  worker_id: string;
  area_id: string;
  worker_role: string;
  started_at: string;
  ended_at: string | null;
  hours: number | null;
};

type CrewState = {
  workers: Worker[];
  areas: Area[];
  assignments: Assignment[];
  timeEntries: TimeEntry[]; // today's entries
  loading: boolean;
};

type CrewActions = {
  fetchWorkers: (organizationId: string, projectId: string) => Promise<void>;
  fetchAreas: (projectId: string) => Promise<void>;
  fetchAssignments: (projectId: string, organizationId: string) => Promise<void>;
  fetchTodayTimeEntries: (projectId: string, organizationId: string) => Promise<void>;
  assignWorker: (params: {
    workerId: string;
    areaId: string;
    projectId: string;
    organizationId: string;
    assignedBy: string;
    workerRole?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  endDay: (projectId: string, organizationId: string, closedBy: string) => Promise<void>;
  getWorkerAssignment: (workerId: string) => Assignment | undefined;
  getAreaWorkers: (areaId: string) => Worker[];
};

export const useCrewStore = create<CrewState & CrewActions>((set, get) => ({
  workers: [],
  areas: [],
  assignments: [],
  timeEntries: [],
  loading: false,

  /**
   * Crew Management is a Manpower feature — only workers assigned to the
   * active project should appear, never software users (owner/supervisor/
   * admin/pm/estimator). Source of truth is the Sprint MANPOWER schema:
   *   project_workers (M:N) JOIN workers (HR roster)
   *
   * After the `crew_assignments_fk_to_workers` migration, `crew_assignments
   * .worker_id` now references `workers.id` directly, so walk-in workers
   * (profile_id NULL) are fully assignable. Worker.id in this store is the
   * `workers.id` UUID.
   */
  /**
   * Reads switched to PowerSync local-first on 2026-04-28 to fix slow
   * Crew screen mount (5 sequential Supabase calls = several seconds on
   * cold start). All four tables (workers, project_workers,
   * production_areas, crew_assignments, area_time_entries) are in the
   * by_org PowerSync bucket, so localQuery serves them instantly.
   *
   * Supabase fallback fires ONLY if local returns empty AND we have no
   * synced data yet — handles the fresh-install window before PowerSync
   * has caught up. After that, everything stays local.
   */
  fetchWorkers: async (organizationId, projectId) => {
    // SQLite JOIN locally — fastest path. project_workers is M:N filtered
    // to active=1 by the sync rule, but we double-check defensively.
    const local = await localQuery<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      trade: string | null;
      trade_level: string | null;
      photo_url: string | null;
    }>(
      `SELECT w.id, w.first_name, w.last_name, w.trade, w.trade_level, w.photo_url
         FROM project_workers pw
         JOIN workers w ON w.id = pw.worker_id
        WHERE pw.project_id = ?
          AND pw.organization_id = ?
          AND pw.active = 1
          AND w.active = 1
        ORDER BY w.first_name`,
      [projectId, organizationId],
    );

    if (local && local.length > 0) {
      set({
        workers: local.map((w) => ({
          id: w.id,
          full_name:
            `${w.first_name ?? ''} ${w.last_name ?? ''}`.trim() || 'Unknown',
          role: w.trade_level ?? w.trade ?? 'worker',
          avatar_url: w.photo_url ?? null,
        })),
      });
      return;
    }

    // Fallback: Supabase (fresh install, PowerSync hasn't synced yet)
    const { data: pwRows } = await supabase
      .from('project_workers')
      .select('worker_id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .eq('active', true);
    const workerIds = (pwRows ?? []).map((r) => r.worker_id as string);
    if (workerIds.length === 0) {
      set({ workers: [] });
      return;
    }
    const { data } = await supabase
      .from('workers')
      .select('id, first_name, last_name, trade, trade_level, photo_url, active')
      .in('id', workerIds)
      .eq('active', true)
      .order('first_name');
    set({
      workers: (data ?? []).map((w) => ({
        id: w.id as string,
        full_name:
          `${w.first_name ?? ''} ${w.last_name ?? ''}`.trim() || 'Unknown',
        role:
          (w.trade_level as string | null) ??
          (w.trade as string | null) ??
          'worker',
        avatar_url: (w.photo_url as string | null) ?? null,
      })),
    });
  },

  fetchAreas: async (projectId) => {
    const local = await localQuery<Area>(
      `SELECT id, name, floor, zone, status
         FROM production_areas
        WHERE project_id = ?
        ORDER BY floor, name`,
      [projectId],
    );
    if (local && local.length > 0) {
      set({ areas: local });
      return;
    }
    const { data } = await supabase
      .from('production_areas')
      .select('id, name, floor, zone, status')
      .eq('project_id', projectId)
      .order('floor')
      .order('name');
    set({ areas: (data ?? []) as Area[] });
  },

  fetchAssignments: async (projectId, organizationId) => {
    const local = await localQuery<Assignment>(
      `SELECT id, worker_id, area_id, assigned_at
         FROM crew_assignments
        WHERE project_id = ?
          AND organization_id = ?`,
      [projectId, organizationId],
    );
    // Always set — empty list is valid (start-of-day, nobody assigned yet).
    // Don't fall through to Supabase here; assignments mutate constantly
    // and PowerSync writes round-trip in milliseconds.
    set({ assignments: local ?? [] });
  },

  fetchTodayTimeEntries: async (projectId, organizationId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const local = await localQuery<TimeEntry>(
      `SELECT id, worker_id, area_id, worker_role, started_at, ended_at, hours
         FROM area_time_entries
        WHERE project_id = ?
          AND organization_id = ?
          AND started_at >= ?
        ORDER BY started_at DESC`,
      [projectId, organizationId, todayISO],
    );
    // Same as assignments — local is authoritative for today's writes;
    // PowerSync round-trips in ms.
    set({ timeEntries: local ?? [] });
  },

  assignWorker: async ({ workerId, areaId, projectId, organizationId, assignedBy, workerRole }) => {
    const { assignments } = get();
    const existing = assignments.find((a) => a.worker_id === workerId);
    const now = new Date().toISOString();

    // If already assigned somewhere, close the old time entry and remove old assignment
    if (existing) {
      await localUpdateWhere('area_time_entries', { ended_at: now }, 'worker_id', workerId, { column: 'ended_at', isNull: true });
      await localDelete('crew_assignments', existing.id);
    }

    // Create new assignment (local-first via PowerSync)
    const assignResult = await localInsert('crew_assignments', {
      id: generateUUID(),
      organization_id: organizationId,
      project_id: projectId,
      area_id: areaId,
      worker_id: workerId,
      assigned_by: assignedBy,
      assigned_at: now,
      created_at: now,
    });

    if (!assignResult.success) {
      return { success: false, error: assignResult.error };
    }

    // Create new time entry (local-first)
    await localInsert('area_time_entries', {
      id: generateUUID(),
      organization_id: organizationId,
      project_id: projectId,
      area_id: areaId,
      worker_id: workerId,
      worker_role: workerRole ?? 'mechanic',
      started_at: now,
      assigned_by: assignedBy,
      created_at: now,
    });

    // Refresh state
    await get().fetchAssignments(projectId, organizationId);
    await get().fetchTodayTimeEntries(projectId, organizationId);

    // Sprint 70 — fire crew_assign_today auto-complete. Cron creates this
    // todo daily at 6 AM for foremen with areas needing crew; first
    // assignment of the day clears it. Web matches by entity_type='project'
    // + entity_id (one project-scoped todo, not per-area). Fire-and-forget.
    autoCompleteAndForget(
      { type: 'project', id: projectId },
      'crew_assign_today',
    );

    haptic.medium();
    return { success: true };
  },

  endDay: async (projectId, organizationId, _closedBy) => {
    const now = new Date().toISOString();

    // Close all open time entries (local-first)
    await localUpdateWhere('area_time_entries', { ended_at: now }, 'project_id', projectId, { column: 'ended_at', isNull: true });

    // Delete all assignments (local-first)
    await localDeleteWhere('crew_assignments', 'project_id', projectId);

    set({ assignments: [] });
    await get().fetchTodayTimeEntries(projectId, organizationId);

    haptic.heavy();
    logger.info('[Crew] Day ended — all entries closed');
  },

  getWorkerAssignment: (workerId) => {
    return get().assignments.find((a) => a.worker_id === workerId);
  },

  getAreaWorkers: (areaId) => {
    const { assignments, workers } = get();
    const workerIds = assignments
      .filter((a) => a.area_id === areaId)
      .map((a) => a.worker_id);
    return workers.filter((w) => workerIds.includes(w.id));
  },
}));
