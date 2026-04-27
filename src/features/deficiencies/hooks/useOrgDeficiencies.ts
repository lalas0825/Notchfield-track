/**
 * Sprint 71 Phase 2 — useOrgDeficiencies (refactored from usePendingVerifications).
 *
 * Generic org-scoped query for the Compliance screen sub-tabs:
 *   - Open    → statuses: ['open', 'in_progress']
 *   - To Verify → statuses: ['resolved']
 *   - Verified  → statuses: ['verified']
 *
 * Sort order varies by intent:
 *   - Open / To Verify: severity asc → created/resolved desc (urgent first)
 *   - Verified:         verified_at desc (most recent first; history view)
 *
 * Realtime subscribed at the org level; one supervisor's verify cascades
 * to all others' Compliance screens within ~1s.
 *
 * Sync rule excludes 'closed' so this hook never sees fully-closed rows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type {
  Deficiency,
  DeficiencyResponsibility,
  DeficiencySeverity,
  DeficiencyStage,
  DeficiencyStatus,
} from '../types';
import { SEVERITY_ORDER } from '../types';

type RawRow = Record<string, unknown>;

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToDeficiency(row: RawRow): Deficiency {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    project_id: row.project_id as string,
    area_id: row.area_id as string,
    surface_id: (row.surface_id as string | null) ?? null,
    title: (row.title as string) ?? '',
    description: (row.description as string | null) ?? null,
    severity: (row.severity as DeficiencySeverity) ?? 'minor',
    stage: (row.stage as DeficiencyStage) ?? 'internal_qc',
    responsibility:
      (row.responsibility as DeficiencyResponsibility) ?? 'unknown',
    trade: (row.trade as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    library_id: (row.library_id as string | null) ?? null,
    status: (row.status as DeficiencyStatus) ?? 'open',
    photos: parseJsonArray(row.photos),
    resolution_photos: parseJsonArray(row.resolution_photos),
    assigned_to: (row.assigned_to as string | null) ?? null,
    created_by: row.created_by as string,
    resolved_at: (row.resolved_at as string | null) ?? null,
    resolved_by: (row.resolved_by as string | null) ?? null,
    verified_at: (row.verified_at as string | null) ?? null,
    verified_by: (row.verified_by as string | null) ?? null,
    rejected_reason: (row.rejected_reason as string | null) ?? null,
    closed_at: (row.closed_at as string | null) ?? null,
    estimated_cost_cents:
      typeof row.estimated_cost_cents === 'number'
        ? (row.estimated_cost_cents as number)
        : null,
    billed_amount_cents:
      typeof row.billed_amount_cents === 'number'
        ? (row.billed_amount_cents as number)
        : null,
    plan_x: typeof row.plan_x === 'number' ? (row.plan_x as number) : null,
    plan_y: typeof row.plan_y === 'number' ? (row.plan_y as number) : null,
    drawing_id: (row.drawing_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  };
}

/** PowerSync's IN(...) limitation forces us to chain `=` clauses with OR.
 * We build the WHERE clause dynamically based on the requested statuses.
 * Same pattern used in sync-rules.yaml when filtering by status. */
function buildStatusClause(statuses: DeficiencyStatus[]): string {
  if (statuses.length === 0) return '1 = 1';
  return statuses.map(() => 'status = ?').join(' OR ');
}

export type UseOrgDeficienciesOptions = {
  statuses: DeficiencyStatus[];
  /** 'severity' (urgency-first) or 'recent' (newest-first by relevant timestamp). */
  sort?: 'severity' | 'recent';
  limit?: number;
};

export function useOrgDeficiencies({
  statuses,
  sort = 'severity',
  limit = 200,
}: UseOrgDeficienciesOptions) {
  const orgId = useAuthStore((s) => s.profile?.organization_id ?? null);

  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Memoize the statuses tuple as a string key so the effect doesn't
  // re-fire on every render due to array identity changing.
  const statusesKey = statuses.join(',');

  const reload = useCallback(async () => {
    if (!orgId) {
      if (mountedRef.current) {
        setDeficiencies([]);
        setLoading(false);
      }
      return;
    }
    const statusesArr = statusesKey.split(',').filter(Boolean) as DeficiencyStatus[];
    const statusClause = buildStatusClause(statusesArr);
    const params: unknown[] = [orgId, ...statusesArr, limit];

    // Pick ORDER BY based on the relevant timestamp for the tab:
    // - severity-sort: created_at DESC tiebreaker (urgent recent first)
    // - recent-sort:   resolved_at/verified_at/created_at DESC depending on
    //                  what's available; we sort client-side after fetch
    //                  for simplicity since SQLite COALESCE is verbose.
    const rows = await localQuery<RawRow>(
      `SELECT * FROM deficiencies
         WHERE organization_id = ?
           AND (${statusClause})
         ORDER BY created_at DESC
         LIMIT ?`,
      params,
    );

    if (mountedRef.current) {
      const parsed = rows ? rows.map(rowToDeficiency) : [];
      const sorted = sortDeficiencies(parsed, sort);
      setDeficiencies(sorted);
      setLoading(false);
    }
  }, [orgId, statusesKey, sort, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Realtime — refresh whenever any deficiency in the org changes.
  // Cascade verify (Web closes ALL PMs' verification_due todos) fires
  // here too, so other supervisors' tabs update without manual refresh.
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`deficiencies_org_${orgId}_${statusesKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deficiencies',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, statusesKey, reload]);

  return { deficiencies, loading, reload };
}

function sortDeficiencies(
  list: Deficiency[],
  mode: 'severity' | 'recent',
): Deficiency[] {
  const copy = [...list];
  if (mode === 'severity') {
    copy.sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity] ?? 99;
      const sb = SEVERITY_ORDER[b.severity] ?? 99;
      if (sa !== sb) return sa - sb;
      // Tie-break by most-recent timestamp relevant to current state
      const ta = relevantTimestamp(a);
      const tb = relevantTimestamp(b);
      return tb - ta;
    });
  } else {
    copy.sort((a, b) => relevantTimestamp(b) - relevantTimestamp(a));
  }
  return copy;
}

function relevantTimestamp(d: Deficiency): number {
  // Verified rows: verified_at; resolved: resolved_at; else created_at.
  const iso =
    d.verified_at ?? d.resolved_at ?? d.created_at;
  return iso ? new Date(iso).getTime() : 0;
}
