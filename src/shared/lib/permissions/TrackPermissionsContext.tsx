/**
 * TrackPermissionsContext — Sprint 40C
 * =====================================
 * Centralizes role + project assignment data so screens don't have to
 * re-query or re-derive scope on their own.
 *
 * Reads:
 *   - profile.role from useAuthStore (already loaded by auth-store)
 *   - project_assignments from Supabase (filtered by user_id, is_active)
 *
 * Exposes:
 *   - role            : normalized TrackRole | null
 *   - rawRole         : original profile.role string
 *   - isTrackRole     : boolean — false for web-only roles (admin/pm/etc.)
 *   - assignedProjectIds : string[] — project ids the user is assigned to
 *   - canUseFeature(f): convenience wrapper
 *   - loading         : true while assignments are being fetched
 *   - reload()        : re-fetches assignments
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import {
  canUseFeature as canUseFeatureRaw,
  isTrackRole as isTrackRoleRaw,
  normalizeTrackRole,
  type TrackFeature,
  type TrackRole,
} from './trackPermissions';

type TrackPermissionsValue = {
  role: TrackRole | null;
  rawRole: string | null;
  isTrackRole: boolean;
  assignedProjectIds: string[];
  loading: boolean;
  canUseFeature: (feature: TrackFeature) => boolean;
  reload: () => Promise<void>;
};

const TrackPermissionsContext = createContext<TrackPermissionsValue | null>(null);

export function TrackPermissionsProvider({ children }: { children: ReactNode }) {
  const profile = useAuthStore((s) => s.profile);
  const userId = profile?.id ?? null;
  const organizationId = profile?.organization_id ?? null;
  const rawRole = profile?.role ?? null;
  const role = normalizeTrackRole(rawRole);
  const allowed = isTrackRoleRaw(rawRole);

  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const reload = useCallback(async () => {
    if (!userId || !organizationId || !rawRole) {
      // Don't update state if already empty (avoids new array ref on every render)
      setAssignedProjectIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('project_assignments')
        .select('project_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      const ids = ((data ?? []) as { project_id: string }[]).map((r) => r.project_id);
      setAssignedProjectIds(ids);
      // Push the scoped project list into the project store so the rest of the
      // app sees only assigned projects.
      if (allowed) {
        await useProjectStore.getState().fetchProjects(organizationId, rawRole, ids);
      }
    } catch (err) {
      console.warn('[TrackPermissions] reload error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, organizationId, rawRole, allowed]);

  useEffect(() => {
    reload();
  }, [reload]);

  const canUseFeature = useCallback(
    (feature: TrackFeature) => canUseFeatureRaw(rawRole, feature),
    [rawRole],
  );

  const value = useMemo<TrackPermissionsValue>(
    () => ({
      role,
      rawRole,
      isTrackRole: allowed,
      assignedProjectIds,
      loading,
      canUseFeature,
      reload,
    }),
    [role, rawRole, allowed, assignedProjectIds, loading, canUseFeature, reload],
  );

  return (
    <TrackPermissionsContext.Provider value={value}>
      {children}
    </TrackPermissionsContext.Provider>
  );
}

export function useTrackPermissions(): TrackPermissionsValue {
  const ctx = useContext(TrackPermissionsContext);
  if (!ctx) {
    throw new Error('useTrackPermissions must be used inside TrackPermissionsProvider');
  }
  return ctx;
}
