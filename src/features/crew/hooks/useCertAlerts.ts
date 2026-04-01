/**
 * Cert Alerts Hook
 * =================
 * Computes certification status for workers on load (not on render).
 * 100% offline — reads from Supabase (cached by PowerSync).
 *
 * Status logic:
 *   - expires_at < today → 'expired' (red)
 *   - expires_at < today + 30 days → 'pending_renewal' (amber)
 *   - otherwise → 'active' (no badge)
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';

export type CertStatus = 'active' | 'pending_renewal' | 'expired';

export type WorkerCert = {
  id: string;
  worker_id: string;
  cert_type: string;
  cert_number: string | null;
  expires_at: string;
  issuing_authority: string | null;
  status: CertStatus;
  days_until_expiry: number;
};

export type WorkerCertSummary = {
  workerId: string;
  worstStatus: CertStatus; // worst across all certs
  expiredCount: number;
  pendingCount: number;
  certs: WorkerCert[];
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function computeCertStatus(expiresAt: string): { status: CertStatus; daysUntil: number } {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const daysUntil = Math.floor((expiry - now) / (24 * 60 * 60 * 1000));

  if (expiry < now) return { status: 'expired', daysUntil };
  if (expiry - now < THIRTY_DAYS_MS) return { status: 'pending_renewal', daysUntil };
  return { status: 'active', daysUntil };
}

/**
 * Load cert alerts for all workers in an org.
 * Returns a Map<workerId, WorkerCertSummary> for O(1) lookup.
 */
export function useCertAlerts(organizationId: string | undefined) {
  const [certMap, setCertMap] = useState<Map<string, WorkerCertSummary>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('worker_certifications')
      .select('id, worker_id, cert_type, cert_number, expires_at, issuing_authority, status')
      .eq('organization_id', organizationId)
      .neq('status', 'revoked');

    const map = new Map<string, WorkerCertSummary>();

    for (const cert of (data ?? []) as any[]) {
      const { status, daysUntil } = computeCertStatus(cert.expires_at);

      const enriched: WorkerCert = {
        id: cert.id,
        worker_id: cert.worker_id,
        cert_type: cert.cert_type,
        cert_number: cert.cert_number,
        expires_at: cert.expires_at,
        issuing_authority: cert.issuing_authority,
        status,
        days_until_expiry: daysUntil,
      };

      if (!map.has(cert.worker_id)) {
        map.set(cert.worker_id, {
          workerId: cert.worker_id,
          worstStatus: 'active',
          expiredCount: 0,
          pendingCount: 0,
          certs: [],
        });
      }

      const summary = map.get(cert.worker_id)!;
      summary.certs.push(enriched);

      if (status === 'expired') {
        summary.expiredCount++;
        summary.worstStatus = 'expired';
      } else if (status === 'pending_renewal' && summary.worstStatus !== 'expired') {
        summary.pendingCount++;
        summary.worstStatus = 'pending_renewal';
      }
    }

    setCertMap(map);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const getCertSummary = useCallback(
    (workerId: string): WorkerCertSummary | null => {
      return certMap.get(workerId) ?? null;
    },
    [certMap],
  );

  const hasExpiredCerts = useCallback(
    (workerId: string): boolean => {
      const summary = certMap.get(workerId);
      return summary?.worstStatus === 'expired';
    },
    [certMap],
  );

  // Global alerts (for Home dashboard)
  const totalExpired = [...certMap.values()].reduce((sum, s) => sum + s.expiredCount, 0);
  const totalPending = [...certMap.values()].reduce((sum, s) => sum + s.pendingCount, 0);

  return {
    certMap,
    loading,
    reload,
    getCertSummary,
    hasExpiredCerts,
    totalExpired,
    totalPending,
  };
}
