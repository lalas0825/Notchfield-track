/**
 * Sprint 53C — Cost Engine.
 *
 * Computes the delay cost for a blocked area and writes to delay_cost_logs.
 * Track is the source of truth (Web team confirmed); Web will eventually
 * read our rows but not duplicate the computation.
 *
 * Algorithm:
 *   crew_size        = distinct worker_ids that logged time on this area
 *                      in the 14 days BEFORE blocked_at (the impacted crew)
 *   days_lost        = ceil((now - blocked_at) / 8h) — 8h workday
 *   total_cost_cents = Σ workers.daily_rate_cents × days_lost
 *   daily_rate_cents = avg of impacted workers (for display only)
 *
 * FK note: area_time_entries.worker_id → profiles.id (NOT workers.id).
 * To get daily_rate_cents we JOIN through workers.profile_id. Walk-ins
 * don't appear in time entries because they haven't been through the
 * traditional crew-store flow, so this v1 calc misses them. Good enough
 * for the pilot.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localQuery, generateUUID } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';

export type DelayCost = {
  crew_size: number;
  daily_rate_cents: number;   // average daily rate, used for display
  days_lost: number;
  total_cost_cents: number;   // Σ per-worker daily_rate × days_lost
};

export type DelayCostLog = DelayCost & {
  id: string;
  area_id: string;
};

const HOURS_PER_WORKDAY = 8;
const WINDOW_DAYS = 14; // look-back window for "who worked this area before the block"

/**
 * Compute (read-only) the delay cost for an area. Does NOT write to the DB.
 * Used for live preview in the NodSignModal.
 */
export async function computeDelayCost(params: {
  areaId: string;
  blockedAt: string; // ISO
}): Promise<DelayCost> {
  const blockedMs = new Date(params.blockedAt).getTime();
  const now = Date.now();
  const hoursBlocked = Math.max(0, (now - blockedMs) / 3600000);
  const days_lost = Math.max(1, Math.ceil(hoursBlocked / HOURS_PER_WORKDAY));

  // 1) Distinct worker profile_ids who logged time on this area in the
  //    window before the block. We look 14d back from blocked_at to capture
  //    the crew that was actively working before the obstruction.
  const windowStart = new Date(blockedMs - WINDOW_DAYS * 86400000).toISOString();
  const entries = await localQuery<{ worker_id: string }>(
    `SELECT DISTINCT worker_id FROM area_time_entries
       WHERE area_id = ?
         AND started_at >= ?
         AND started_at <= ?`,
    [params.areaId, windowStart, params.blockedAt],
  );

  let profileIds = (entries ?? [])
    .map((e) => e.worker_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  // Fallback — if local is empty or nothing recent, use Supabase
  if (profileIds.length === 0) {
    const { data } = await supabase
      .from('area_time_entries')
      .select('worker_id')
      .eq('area_id', params.areaId)
      .gte('started_at', windowStart)
      .lte('started_at', params.blockedAt);
    const fallback = (data ?? [])
      .map((r) => r.worker_id as string)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    profileIds = [...new Set(fallback)];
  } else {
    profileIds = [...new Set(profileIds)];
  }

  if (profileIds.length === 0) {
    return { crew_size: 0, daily_rate_cents: 0, days_lost, total_cost_cents: 0 };
  }

  // 2) Resolve workers.daily_rate_cents via workers.profile_id.
  const placeholders = profileIds.map(() => '?').join(',');
  let workerRates = await localQuery<{ daily_rate_cents: number | null }>(
    `SELECT daily_rate_cents FROM workers
       WHERE profile_id IN (${placeholders}) AND active = 1`,
    profileIds,
  );

  if (!workerRates || workerRates.length === 0) {
    const { data } = await supabase
      .from('workers')
      .select('daily_rate_cents')
      .in('profile_id', profileIds)
      .eq('active', true);
    workerRates = (data ?? []) as { daily_rate_cents: number | null }[];
  }

  const rates = (workerRates ?? [])
    .map((r) => Number(r.daily_rate_cents ?? 0))
    .filter((r) => r > 0);

  const crew_size = rates.length || profileIds.length; // fall back to count if no rates
  const ratesSum = rates.reduce((sum, r) => sum + r, 0);
  const daily_rate_cents = crew_size > 0 && ratesSum > 0
    ? Math.round(ratesSum / crew_size)
    : 0;

  // total = sum per-worker × days_lost. If no rates known, zero.
  const total_cost_cents = ratesSum * days_lost;

  return { crew_size, daily_rate_cents, days_lost, total_cost_cents };
}

/**
 * Persist a delay_cost_log row and return its id. Called at sign-and-send
 * time so the legal_documents row can FK to it via related_delay_log_id.
 * Local-first via PowerSync (offline-safe).
 */
export async function persistDelayCostLog(params: {
  organizationId: string;
  projectId: string;
  areaId: string;
  cost: DelayCost;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const id = generateUUID();
  const nowIso = new Date().toISOString();

  const result = await localInsert('delay_cost_logs', {
    id,
    organization_id: params.organizationId,
    project_id: params.projectId,
    area_id: params.areaId,
    delay_log_id: null,
    crew_size: params.cost.crew_size,
    daily_rate_cents: params.cost.daily_rate_cents,
    days_lost: params.cost.days_lost,
    total_cost_cents: params.cost.total_cost_cents,
    calculated_at: nowIso,
    created_at: nowIso,
  });

  if (!result.success) {
    logger.warn('[Legal] persistDelayCostLog failed', result.error);
    return { success: false, error: result.error };
  }
  return { success: true, id };
}

/** Pretty-format cents as USD string ($1,750.00). */
export function formatCentsUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
