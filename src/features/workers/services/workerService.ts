/**
 * Workers service — offline-first reads + walk-in write for Track.
 *
 * Writes from Track are intentionally limited: foremen only create walk-in
 * workers during PTP sign-off. Full HR management (certs, photos, trade)
 * happens in Takeoff web's Manpower module.
 */

import { supabase } from '@/shared/lib/supabase/client';
import {
  localInsert,
  localQuery,
  generateUUID,
} from '@/shared/lib/powersync/write';
import { Worker, type TradeLevel } from '../types';

type RawRow = Record<string, unknown>;

function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

function normalizeWorker(row: RawRow): Worker | null {
  try {
    return Worker.parse({
      id: row.id as string,
      organization_id: row.organization_id as string,
      profile_id: (row.profile_id as string | null) ?? null,
      first_name: row.first_name as string,
      last_name: row.last_name as string,
      phone: (row.phone as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      date_of_birth: (row.date_of_birth as string | null) ?? null,
      photo_url: (row.photo_url as string | null) ?? null,
      hire_date: (row.hire_date as string | null) ?? null,
      active: toBool(row.active),
      trade: (row.trade as string | null) ?? null,
      trade_level: (row.trade_level as TradeLevel | null) ?? null,
      years_experience: (row.years_experience as number | null) ?? null,
      daily_rate_cents: (row.daily_rate_cents as number | null) ?? null,
      sst_card_number: (row.sst_card_number as string | null) ?? null,
      sst_expires_at: (row.sst_expires_at as string | null) ?? null,
      osha_10_cert_number: (row.osha_10_cert_number as string | null) ?? null,
      osha_10_expires_at: (row.osha_10_expires_at as string | null) ?? null,
      osha_30_cert_number: (row.osha_30_cert_number as string | null) ?? null,
      osha_30_expires_at: (row.osha_30_expires_at as string | null) ?? null,
      swac_cert_number: (row.swac_cert_number as string | null) ?? null,
      swac_expires_at: (row.swac_expires_at as string | null) ?? null,
      silica_trained: toBool(row.silica_trained),
      silica_trained_at: (row.silica_trained_at as string | null) ?? null,
      i9_verified: toBool(row.i9_verified),
      i9_verified_at: (row.i9_verified_at as string | null) ?? null,
      emergency_contact_name: (row.emergency_contact_name as string | null) ?? null,
      emergency_contact_phone: (row.emergency_contact_phone as string | null) ?? null,
      emergency_contact_relation: (row.emergency_contact_relation as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    });
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[workers] dropped malformed row', row.id);
    return null;
  }
}

/**
 * Resolve the worker row for a given profile (the foreman logging into Track).
 * Returns null if the PM hasn't added this profile to Manpower yet — callers
 * should show the onboarding blocker in that case.
 */
export async function getWorkerByProfileId(
  profileId: string,
): Promise<Worker | null> {
  const local = await localQuery<RawRow>(
    `SELECT * FROM workers WHERE profile_id = ? AND active = 1 LIMIT 1`,
    [profileId],
  );
  if (local && local.length > 0) return normalizeWorker(local[0]);

  const { data } = await supabase
    .from('workers')
    .select('*')
    .eq('profile_id', profileId)
    .eq('active', true)
    .maybeSingle();
  return data ? normalizeWorker(data as RawRow) : null;
}

export async function getWorkerById(workerId: string): Promise<Worker | null> {
  const local = await localQuery<RawRow>(
    `SELECT * FROM workers WHERE id = ? LIMIT 1`,
    [workerId],
  );
  if (local && local.length > 0) return normalizeWorker(local[0]);

  const { data } = await supabase
    .from('workers')
    .select('*')
    .eq('id', workerId)
    .maybeSingle();
  return data ? normalizeWorker(data as RawRow) : null;
}

/**
 * List workers assigned to a project. Joins project_workers → workers. Only
 * returns rows where both sides are active.
 */
export async function getProjectWorkers(projectId: string): Promise<Worker[]> {
  // Offline path — two queries, JS-side join because PowerSync SQLite
  // doesn't support foreign joins inside a bucket's SELECT.
  const localAssignments = await localQuery<{ worker_id: string }>(
    `SELECT worker_id FROM project_workers WHERE project_id = ? AND active = 1`,
    [projectId],
  );

  if (localAssignments !== null) {
    if (localAssignments.length === 0) return [];
    const ids = localAssignments.map((r) => r.worker_id);
    const placeholders = ids.map(() => '?').join(',');
    const localWorkers = await localQuery<RawRow>(
      `SELECT * FROM workers WHERE id IN (${placeholders}) AND active = 1 ORDER BY first_name, last_name`,
      ids,
    );
    return (localWorkers ?? [])
      .map(normalizeWorker)
      .filter((w): w is Worker => w !== null);
  }

  // Web fallback — single Supabase select with nested relation.
  const { data } = await supabase
    .from('project_workers')
    .select('worker:workers(*)')
    .eq('project_id', projectId)
    .eq('active', true);

  if (!data) return [];
  // Supabase types nested selects as arrays. In practice this is a 1:1 FK
  // lookup so we flatten defensively.
  const rawWorkers: RawRow[] = (data as unknown as Array<{ worker: RawRow | RawRow[] | null }>).flatMap(
    (row) => {
      const w = row.worker;
      if (!w) return [];
      return Array.isArray(w) ? w : [w];
    },
  );
  return rawWorkers
    .map(normalizeWorker)
    .filter((w): w is Worker => w !== null && w.active);
}

/**
 * Walk-in worker — created during PTP sign-off when a worker isn't in the
 * project's manpower list yet. PM fills in SST/OSHA/trade later from
 * Takeoff web. The worker appears in Manpower on the next sync.
 */
export async function createWalkInWorker(params: {
  organizationId: string;
  firstName: string;
  lastName: string;
  sstCardNumber?: string | null;
  createdBy: string;
}): Promise<{ success: boolean; worker?: Worker; error?: string }> {
  const id = generateUUID();
  const now = new Date().toISOString();
  const note = `Walk-in added by foreman on ${now.slice(0, 10)}`;

  const result = await localInsert('workers', {
    id,
    organization_id: params.organizationId,
    profile_id: null,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    active: true,
    trade_level: 'other',
    sst_card_number: params.sstCardNumber ?? null,
    silica_trained: false,
    i9_verified: false,
    notes: note,
    created_by: params.createdBy,
    created_at: now,
    updated_at: now,
  });

  if (!result.success) return { success: false, error: result.error };

  // Return the normalized shape we just inserted.
  const worker = await getWorkerById(id);
  return worker
    ? { success: true, worker }
    : { success: false, error: 'Walk-in saved but readback failed' };
}
