/**
 * useOrganization — resolve org metadata (name + logo_url) for the current
 * foreman's org. Used by document detail screens to render the company
 * letterhead and by the PDF export to embed the logo + real company name
 * (instead of the UUID that leaked into older PDFs).
 *
 * Offline-first via PowerSync local SQLite; falls back to Supabase REST
 * when the local DB hasn't caught up yet.
 *
 * Cache-busting: logo_url values from Web's Settings upload include a
 * ?t=<timestamp> query param whenever the logo is replaced. RN's Image
 * component treats the full URL (including querystring) as the cache key,
 * so a new upload renders the new logo without explicit cache-clear.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';

export type OrganizationInfo = {
  id: string;
  name: string;
  logo_url: string | null;
};

export async function fetchOrganization(
  orgId: string,
): Promise<OrganizationInfo | null> {
  const local = await localQuery<OrganizationInfo>(
    `SELECT id, name, logo_url FROM organizations WHERE id = ? LIMIT 1`,
    [orgId],
  );
  if (local && local.length > 0) return local[0];

  const { data } = await supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', orgId)
    .maybeSingle();
  return (data as OrganizationInfo | null) ?? null;
}

export function useOrganization(orgId: string | null | undefined): {
  org: OrganizationInfo | null;
  loading: boolean;
} {
  const [org, setOrg] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(!!orgId);

  useEffect(() => {
    if (!orgId) {
      setOrg(null);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    fetchOrganization(orgId)
      .then((result) => {
        if (!cancel) {
          setOrg(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [orgId]);

  return { org, loading };
}
