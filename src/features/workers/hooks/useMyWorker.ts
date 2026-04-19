import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { normalizeTrackRole } from '@/shared/lib/permissions/trackPermissions';
import { getWorkerByProfileId } from '../services/workerService';
import type { Worker } from '../types';

/**
 * Resolve the current user's `workers` row via `workers.profile_id`.
 *
 * Role-aware behaviour:
 *   - foreman / worker  → MUST have a workers row (their SST goes on the
 *     PTP PDF). If missing, flag `needsOnboarding` so the screen renders
 *     the PM-action blocker.
 *   - supervisor / owner / admin / pm → never blocked. They don't have
 *     an SST card and can author PTPs on behalf of crews. If no workers
 *     row exists we synthesize one from their profile so the wizard
 *     can proceed. `signature.worker_id` for them falls back to
 *     profile.id — not in workers table, but valid JSONB content.
 *
 * Returned `worker.id`:
 *   - real workers row → workers.id
 *   - synthesized      → profiles.id (so usage sites can still pass it
 *                        as foreman_id to createDraftPtp / Toolbox)
 */
export function useMyWorker() {
  const { user, profile } = useAuthStore();
  const [dbWorker, setDbWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setDbWorker(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDbWorker(await getWorkerByProfileId(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve worker');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const normalizedRole = normalizeTrackRole(profile?.role);
  const mustHaveWorkerRow = normalizedRole === 'foreman' || normalizedRole === 'worker';

  // Synthetic Worker — used when the signed-in user doesn't have a row
  // (supervisors/owners acting on behalf of crews). Minimal fields; null
  // certs because they don't carry an SST card themselves.
  const synthetic: Worker | null =
    !dbWorker && profile && user
      ? {
          id: user.id, // profile.id — accepted as uuid, no FK constraint on JSONB
          organization_id: profile.organization_id,
          profile_id: user.id,
          first_name: (profile.full_name ?? '').split(' ')[0] || 'Unknown',
          last_name: (profile.full_name ?? '').split(' ').slice(1).join(' ') || '',
          phone: null,
          email: null,
          date_of_birth: null,
          photo_url: profile.avatar_url ?? null,
          hire_date: null,
          active: true,
          trade: null,
          trade_level: null,
          years_experience: null,
          daily_rate_cents: null,
          sst_card_number: null,
          sst_expires_at: null,
          osha_10_cert_number: null,
          osha_10_expires_at: null,
          osha_30_cert_number: null,
          osha_30_expires_at: null,
          swac_cert_number: null,
          swac_expires_at: null,
          silica_trained: false,
          silica_trained_at: null,
          i9_verified: false,
          i9_verified_at: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          emergency_contact_relation: null,
          notes: null,
        }
      : null;

  const worker: Worker | null = dbWorker ?? (mustHaveWorkerRow ? null : synthetic);

  return {
    worker,
    loading,
    error,
    reload: load,
    // Only foremen and workers are blocked when no DB row exists.
    // Supervisors/owners/admins get a synthetic worker and proceed.
    needsOnboarding: !loading && !!user?.id && mustHaveWorkerRow && dbWorker === null,
  };
}
