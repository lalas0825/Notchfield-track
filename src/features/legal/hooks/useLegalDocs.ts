import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { normalizeTrackRole } from '@/shared/lib/permissions/trackPermissions';
import {
  fetchLegalDocs,
  detectBlockedAreas,
  getLegalCounts,
  type LegalDoc,
} from '../services/legal-service';

export function useLegalDocs() {
  const { profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [pendingNods, setPendingNods] = useState<{ id: string; name: string; hours_blocked: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Bug fix 2026-04-25: previously hardcoded ['superintendent', 'owner', 'admin', 'pm']
  // which excluded the canonical 'supervisor' role (Sprint 40C cleanup migrated
  // legacy 'superintendent' to 'supervisor'). 3 of 5 supervisors in prod were
  // silently locked out of Legal. Now uses the single source of truth from
  // trackPermissions.normalizeTrackRole.
  const isSupervisor = normalizeTrackRole(profile?.role) === 'supervisor';

  const reload = useCallback(async () => {
    if (!activeProject || !profile || !isSupervisor) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [legalDocs, blocked] = await Promise.all([
      fetchLegalDocs(activeProject.id, profile.organization_id),
      detectBlockedAreas(activeProject.id),
    ]);

    setDocs(legalDocs);

    // Filter: only show areas that don't already have a NOD
    const existingAreaIds = new Set(legalDocs.filter((d) => d.document_type === 'nod').map((d) => d.related_area_id));
    setPendingNods(blocked.filter((a) => !existingAreaIds.has(a.id)));

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, profile?.organization_id, isSupervisor]);

  useEffect(() => {
    reload();
  }, [reload]);

  const counts = getLegalCounts(docs);

  return { docs, pendingNods, loading, reload, counts, isSupervisor };
}
