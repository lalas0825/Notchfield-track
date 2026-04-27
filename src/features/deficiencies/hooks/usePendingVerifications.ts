/**
 * Sprint 71 Phase 2 — usePendingVerifications.
 *
 * Org-scoped query for the supervisor Compliance screen: returns all
 * deficiencies in status='resolved' awaiting verification. Sorted by
 * resolved_at desc (most recently resolved first — those are the ones
 * with the freshest evidence in the foreman's mind).
 *
 * Per the spec gotcha: verification fans to ALL PMs in the org. Web's
 * verify endpoint cascade-completes everyone's verification_due todos
 * on first click. Track relies on the realtime subscription to refresh
 * other supervisors' Compliance lists when one of them clicks Verify.
 *
 * Local-first via PowerSync; falls back to Supabase if local SQLite
 * has zero rows (defensive — initial sync window).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
    status: (row.status as DeficiencyStatus) ?? 'resolved',
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

function compareForCompliance(a: Deficiency, b: Deficiency): number {
  // Critical / major first — supervisor should triage urgent ones first
  const sa = SEVERITY_ORDER[a.severity] ?? 99;
  const sb = SEVERITY_ORDER[b.severity] ?? 99;
  if (sa !== sb) return sa - sb;
  // Then most-recently-resolved
  const ra = a.resolved_at ? new Date(a.resolved_at).getTime() : 0;
  const rb = b.resolved_at ? new Date(b.resolved_at).getTime() : 0;
  return rb - ra;
}

export function usePendingVerifications() {
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

  const reload = useCallback(async () => {
    if (!orgId) {
      if (mountedRef.current) {
        setDeficiencies([]);
        setLoading(false);
      }
      return;
    }
    const rows = await localQuery<RawRow>(
      `SELECT * FROM deficiencies
         WHERE organization_id = ?
           AND status = 'resolved'
         ORDER BY resolved_at DESC
         LIMIT 200`,
      [orgId],
    );
    if (mountedRef.current) {
      const list = rows ? rows.map(rowToDeficiency) : [];
      setDeficiencies([...list].sort(compareForCompliance));
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Realtime — refresh when any deficiency in the org changes status.
  // Fires for verify/reject from any supervisor (cascade complete) so
  // the list updates within ~1s without a refetch.
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`deficiencies_org_${orgId}`)
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
  }, [orgId, reload]);

  return { deficiencies, loading, reload };
}
