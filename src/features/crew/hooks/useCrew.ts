import { useCallback, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useCrewStore } from '../store/crew-store';

/**
 * Convenience hook — loads workers, areas, assignments, and today's time entries
 * for the active project. Used by crew management screens.
 *
 * 2026-04-28 — Refactored to use Zustand selectors so each value/action
 * subscribes individually instead of through a single `useCrewStore()`
 * call. The previous shape (`const store = useCrewStore();`) returned
 * the entire state object, which changed identity on every `set({...})`
 * inside the fetchers. That made `store` unstable in the `reload`
 * useCallback dep array, triggering an infinite render loop on screen
 * mount: reload → set → re-render → new store ref → new reload identity
 * → useEffect re-fires reload → loop. Pilot saw 25+ "[localQuery]
 * timeout" warnings stacking because each loop iteration spawned 4-5
 * pending queries.
 *
 * Selectors return stable function refs (Zustand never replaces actions
 * unless you explicitly redefine the store), so reload is now stable
 * across renders.
 */
export function useCrew() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const activeProject = useProjectStore((s) => s.activeProject);

  // State slices — each selector is its own subscription, only re-renders
  // when the specific slice changes.
  const workers = useCrewStore((s) => s.workers);
  const areas = useCrewStore((s) => s.areas);
  const assignments = useCrewStore((s) => s.assignments);
  const timeEntries = useCrewStore((s) => s.timeEntries);
  const loading = useCrewStore((s) => s.loading);

  // Actions — pulled individually. Zustand action refs are stable across
  // store updates, so these are safe to put in dep arrays.
  const fetchWorkers = useCrewStore((s) => s.fetchWorkers);
  const fetchAreas = useCrewStore((s) => s.fetchAreas);
  const fetchAssignments = useCrewStore((s) => s.fetchAssignments);
  const fetchTodayTimeEntries = useCrewStore((s) => s.fetchTodayTimeEntries);
  const storeAssignWorker = useCrewStore((s) => s.assignWorker);
  const storeEndDay = useCrewStore((s) => s.endDay);
  const getWorkerAssignment = useCrewStore((s) => s.getWorkerAssignment);
  const getAreaWorkers = useCrewStore((s) => s.getAreaWorkers);

  const reload = useCallback(async () => {
    if (!profile || !activeProject) return;
    await Promise.all([
      fetchWorkers(profile.organization_id, activeProject.id),
      fetchAreas(activeProject.id),
      fetchAssignments(activeProject.id, profile.organization_id),
      fetchTodayTimeEntries(activeProject.id, profile.organization_id),
    ]);
  }, [
    profile,
    activeProject,
    fetchWorkers,
    fetchAreas,
    fetchAssignments,
    fetchTodayTimeEntries,
  ]);

  useEffect(() => {
    reload();
  }, [reload]);

  const assignWorker = useCallback(
    async (workerId: string, areaId: string, workerRole?: string) => {
      if (!user || !profile || !activeProject) {
        return { success: false, error: 'Not authenticated' };
      }
      return storeAssignWorker({
        workerId,
        areaId,
        projectId: activeProject.id,
        organizationId: profile.organization_id,
        assignedBy: user.id,
        workerRole,
      });
    },
    [user, profile, activeProject, storeAssignWorker],
  );

  const endDay = useCallback(async () => {
    if (!user || !profile || !activeProject) return;
    await storeEndDay(activeProject.id, profile.organization_id, user.id);
  }, [user, profile, activeProject, storeEndDay]);

  // Calculate today's total hours — memoized so it doesn't recompute on
  // unrelated re-renders. Recalc when timeEntries changes.
  const todayHours = useMemo(
    () =>
      timeEntries.reduce((sum, e) => {
        if (e.hours) return sum + e.hours;
        if (!e.ended_at) {
          const elapsed =
            (Date.now() - new Date(e.started_at).getTime()) / 3600000;
          return sum + elapsed;
        }
        return sum;
      }, 0),
    [timeEntries],
  );

  return {
    workers,
    areas,
    assignments,
    timeEntries,
    loading,
    assignWorker,
    endDay,
    reload,
    todayHours,
    getWorkerAssignment,
    getAreaWorkers,
  };
}
