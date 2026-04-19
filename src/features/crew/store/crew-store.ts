import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localUpdate, localDelete, localUpdateWhere, localDeleteWhere, generateUUID } from '@/shared/lib/powersync/write';
import { haptic } from '@/shared/lib/haptics';
import { logger } from '@/shared/lib/logger';

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
  fetchWorkers: async (organizationId, projectId) => {
    // 1) Active project_workers for this project
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

    // 2) Resolve workers HR rows (includes walk-ins now that FK points here)
    const { data } = await supabase
      .from('workers')
      .select('id, first_name, last_name, trade, trade_level, photo_url, active')
      .in('id', workerIds)
      .eq('active', true)
      .order('first_name');

    const workers: Worker[] = (data ?? []).map((w) => ({
      id: (w.id as string),
      full_name: `${w.first_name ?? ''} ${w.last_name ?? ''}`.trim() || 'Unknown',
      // Display trade_level (mechanic/helper/apprentice/foreman) — WorkerCard
      // already reads the role field; no UI refactor needed.
      role: (w.trade_level as string | null) ?? (w.trade as string | null) ?? 'worker',
      avatar_url: (w.photo_url as string | null) ?? null,
    }));

    set({ workers });
  },

  fetchAreas: async (projectId) => {
    const { data } = await supabase
      .from('production_areas')
      .select('id, name, floor, zone, status')
      .eq('project_id', projectId)
      .order('floor')
      .order('name');

    set({ areas: (data ?? []) as Area[] });
  },

  fetchAssignments: async (projectId, organizationId) => {
    const { data } = await supabase
      .from('crew_assignments')
      .select('id, worker_id, area_id, assigned_at')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId);

    set({ assignments: (data ?? []) as Assignment[] });
  },

  fetchTodayTimeEntries: async (projectId, organizationId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('area_time_entries')
      .select('id, worker_id, area_id, worker_role, started_at, ended_at, hours')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .gte('started_at', today.toISOString())
      .order('started_at', { ascending: false });

    set({ timeEntries: (data ?? []) as TimeEntry[] });
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
