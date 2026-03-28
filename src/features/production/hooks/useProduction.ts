import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useProductionStore } from '../store/production-store';

/**
 * Convenience hook — loads production areas, phases, template phases
 * for the active project.
 */
export function useProduction() {
  const { profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const store = useProductionStore();

  const reload = useCallback(async () => {
    if (!profile || !activeProject) return;
    await store.fetchAll(activeProject.id, profile.organization_id);
  }, [profile, activeProject, store]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    areas: store.areas,
    floors: store.floors,
    templatePhases: store.templatePhases,
    loading: store.loading,
    totalAreas: store.totalAreas,
    completedAreas: store.completedAreas,
    blockedAreas: store.blockedAreas,
    inProgressAreas: store.inProgressAreas,
    markAreaStatus: store.markAreaStatus,
    completePhase: store.completePhase,
    blockPhase: store.blockPhase,
    canCompleteArea: store.canCompleteArea,
    getAreaPhases: store.getAreaPhases,
    totalGates: store.totalGates,
    completedGates: store.completedGates,
    reload,
  };
}
