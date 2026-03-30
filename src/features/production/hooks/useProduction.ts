import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useProductionStore } from '../store/production-store';

/**
 * Convenience hook — loads production areas, phases, template phases
 * for the active project.
 */
export function useProduction() {
  const profile = useAuthStore((s) => s.profile);
  const activeProject = useProjectStore((s) => s.activeProject);
  const fetchAll = useProductionStore((s) => s.fetchAll);

  // Use selectors for stable references (no infinite loop)
  const areas = useProductionStore((s) => s.areas);
  const floors = useProductionStore((s) => s.floors);
  const templatePhases = useProductionStore((s) => s.templatePhases);
  const loading = useProductionStore((s) => s.loading);
  const totalAreas = useProductionStore((s) => s.totalAreas);
  const completedAreas = useProductionStore((s) => s.completedAreas);
  const blockedAreas = useProductionStore((s) => s.blockedAreas);
  const inProgressAreas = useProductionStore((s) => s.inProgressAreas);
  const markAreaStatus = useProductionStore((s) => s.markAreaStatus);
  const completePhase = useProductionStore((s) => s.completePhase);
  const blockPhase = useProductionStore((s) => s.blockPhase);
  const canCompleteArea = useProductionStore((s) => s.canCompleteArea);
  const getAreaPhases = useProductionStore((s) => s.getAreaPhases);
  const totalGates = useProductionStore((s) => s.totalGates);
  const completedGates = useProductionStore((s) => s.completedGates);

  const reload = useCallback(async () => {
    if (!profile || !activeProject) return;
    await fetchAll(activeProject.id, profile.organization_id);
  }, [profile?.organization_id, activeProject?.id, fetchAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    areas,
    floors,
    templatePhases,
    loading,
    totalAreas,
    completedAreas,
    blockedAreas,
    inProgressAreas,
    markAreaStatus,
    completePhase,
    blockPhase,
    canCompleteArea,
    getAreaPhases,
    totalGates,
    completedGates,
    reload,
  };
}
