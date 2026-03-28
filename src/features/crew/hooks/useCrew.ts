import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useCrewStore } from '../store/crew-store';

/**
 * Convenience hook — loads workers, areas, assignments, and today's time entries
 * for the active project. Used by crew management screens.
 */
export function useCrew() {
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const store = useCrewStore();

  const reload = useCallback(async () => {
    if (!profile || !activeProject) return;
    await Promise.all([
      store.fetchWorkers(profile.organization_id),
      store.fetchAreas(activeProject.id),
      store.fetchAssignments(activeProject.id, profile.organization_id),
      store.fetchTodayTimeEntries(activeProject.id, profile.organization_id),
    ]);
  }, [profile?.organization_id, activeProject?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const assignWorker = useCallback(
    async (workerId: string, areaId: string, workerRole?: string) => {
      if (!user || !profile || !activeProject) {
        return { success: false, error: 'Not authenticated' };
      }
      return store.assignWorker({
        workerId,
        areaId,
        projectId: activeProject.id,
        organizationId: profile.organization_id,
        assignedBy: user.id,
        workerRole,
      });
    },
    [user, profile, activeProject],
  );

  const endDay = useCallback(async () => {
    if (!user || !profile || !activeProject) return;
    await store.endDay(activeProject.id, profile.organization_id, user.id);
  }, [user, profile, activeProject]);

  // Calculate today's total hours
  const todayHours = store.timeEntries.reduce((sum, e) => {
    if (e.hours) return sum + e.hours;
    if (!e.ended_at) {
      // Still open — calculate live
      const elapsed = (Date.now() - new Date(e.started_at).getTime()) / 3600000;
      return sum + elapsed;
    }
    return sum;
  }, 0);

  return {
    workers: store.workers,
    areas: store.areas,
    assignments: store.assignments,
    timeEntries: store.timeEntries,
    loading: store.loading,
    assignWorker,
    endDay,
    reload,
    todayHours,
    getWorkerAssignment: store.getWorkerAssignment,
    getAreaWorkers: store.getAreaWorkers,
  };
}
