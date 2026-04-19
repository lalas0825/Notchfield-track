/**
 * JHA Library service — read-only access to the `jha_library` table.
 *
 * The PM in Takeoff web curates `jha_library`. Track foremen consume it to
 * auto-populate hazards/controls/PPE when building a PTP.
 *
 * Offline-first: reads from PowerSync local SQLite, falls back to direct
 * Supabase query only when PowerSync isn't available (web or cold start).
 */

import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { JhaLibraryItem, type Trade } from '../types';

type RawJhaRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  trade: string;
  category: string | null;
  task_name: string;
  task_description: string | null;
  typical_scenarios: string | null;
  hazards: string | unknown; // JSON string (SQLite) or array (web)
  controls: string | unknown;
  ppe_required: string | unknown;
  notes: string | null;
  active: number | boolean;
};

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeJhaRow(row: RawJhaRow): JhaLibraryItem | null {
  try {
    const parsed = JhaLibraryItem.parse({
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      trade: row.trade,
      category: row.category,
      task_name: row.task_name,
      task_description: row.task_description,
      typical_scenarios: row.typical_scenarios,
      hazards: parseJsonColumn(row.hazards, []),
      controls: parseJsonColumn(row.controls, []),
      ppe_required: parseJsonColumn(row.ppe_required, []),
      notes: row.notes,
      active: row.active === 1 || row.active === true,
    });
    return parsed;
  } catch {
    // Silently drop rows that don't match the schema — surface in logs only
    // eslint-disable-next-line no-console
    console.warn('[jhaLibrary] dropped malformed row', row.id);
    return null;
  }
}

/**
 * Fetch all library tasks for the foreman's trade, either org-wide (project_id
 * null) or specific to the given project. Filtered to active=true.
 */
export async function getJhaLibraryForTrade(
  orgId: string,
  projectId: string,
  trade: Trade,
): Promise<JhaLibraryItem[]> {
  // Offline-first — read from PowerSync local SQLite.
  const local = await localQuery<RawJhaRow>(
    `SELECT * FROM jha_library
     WHERE organization_id = ?
       AND trade = ?
       AND active = 1
       AND (project_id IS NULL OR project_id = ?)
     ORDER BY category, task_name`,
    [orgId, trade, projectId],
  );

  if (local !== null) {
    return local.map(normalizeJhaRow).filter((x): x is JhaLibraryItem => x !== null);
  }

  // Web / fallback — direct Supabase query.
  const { data, error } = await supabase
    .from('jha_library')
    .select('*')
    .eq('organization_id', orgId)
    .eq('trade', trade)
    .eq('active', true)
    .or(`project_id.is.null,project_id.eq.${projectId}`)
    .order('category')
    .order('task_name');

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[jhaLibrary] supabase fetch failed:', error);
    return [];
  }

  return (data ?? [])
    .map((r) => normalizeJhaRow(r as RawJhaRow))
    .filter((x): x is JhaLibraryItem => x !== null);
}

/**
 * List the distinct trades available to a foreman's org. Used when a
 * foreman's profile has no `trade` and the org has multiple `primary_trades`.
 */
export async function getAvailableTradesForOrg(orgId: string): Promise<Trade[]> {
  const local = await localQuery<{ trade: string }>(
    `SELECT DISTINCT trade FROM jha_library WHERE organization_id = ? AND active = 1`,
    [orgId],
  );
  const rows =
    local ??
    ((
      await supabase
        .from('jha_library')
        .select('trade')
        .eq('organization_id', orgId)
        .eq('active', true)
    ).data ?? []);

  const trades = new Set<string>();
  for (const r of rows as { trade: string }[]) trades.add(r.trade);
  return [...trades].filter((t): t is Trade => {
    return ['tile','marble','flooring','drywall','paint','roofing','concrete','hvac','electrical','plumbing'].includes(t);
  });
}
