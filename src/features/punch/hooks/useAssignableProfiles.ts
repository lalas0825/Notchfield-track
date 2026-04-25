/**
 * Sprint 53B — Assignable profiles for punch_items.
 *
 * `punch_items.assigned_to` FK → `profiles.id` (verified via information_schema).
 * Workers from crewStore have workers.id (Sprint MANPOWER), NOT profiles.id, so
 * the prior PunchItemForm flow had a latent FK violation when assigning.
 *
 * This hook returns profiles eligible to OWN a punch item resolution: anyone
 * with foreman / supervisor / superintendent / pm / admin / owner role.
 * Local-first via PowerSync, Supabase fallback when local empty.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';

export type AssignableProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
};

const ASSIGNABLE_ROLES = ['foreman', 'supervisor', 'superintendent', 'pm', 'admin', 'owner'];

export function useAssignableProfiles(organizationId: string | null) {
  const [profiles, setProfiles] = useState<AssignableProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    try {
      const placeholders = ASSIGNABLE_ROLES.map(() => '?').join(',');
      const local = await localQuery<AssignableProfile>(
        `SELECT id, full_name, role, avatar_url
           FROM profiles
           WHERE organization_id = ?
             AND role IN (${placeholders})
           ORDER BY full_name ASC`,
        [organizationId, ...ASSIGNABLE_ROLES],
      );

      if (local && local.length > 0) {
        setProfiles(local);
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url')
          .eq('organization_id', organizationId)
          .in('role', ASSIGNABLE_ROLES)
          .order('full_name', { ascending: true });
        setProfiles((data ?? []) as AssignableProfile[]);
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { profiles, loading, reload };
}
