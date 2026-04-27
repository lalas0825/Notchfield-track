/**
 * Sprint 71 — useAreaDeficiencies.
 *
 * Reads active deficiencies for a specific area, sorted severity asc
 * (critical first) then created_at desc (newest first). Fully offline
 * via PowerSync local; realtime subscription updates as Web's verify/
 * reject endpoints flip statuses on other devices.
 *
 * Sync rule excludes status='closed' so the local table doesn't grow
 * indefinitely; this hook returns whatever's there.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import type {
  Deficiency,
  DeficiencySeverity,
  DeficiencyStage,
  DeficiencyResponsibility,
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

function compareDeficiencies(a: Deficiency, b: Deficiency): number {
  const sa = SEVERITY_ORDER[a.severity] ?? 99;
  const sb = SEVERITY_ORDER[b.severity] ?? 99;
  if (sa !== sb) return sa - sb;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function useAreaDeficiencies(areaId: string | null | undefined) {
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
    if (!areaId) {
      if (mountedRef.current) {
        setDeficiencies([]);
        setLoading(false);
      }
      return;
    }
    const rows = await localQuery<RawRow>(
      `SELECT * FROM deficiencies
         WHERE area_id = ?
         ORDER BY created_at DESC
         LIMIT 200`,
      [areaId],
    );
    if (mountedRef.current) {
      const list = rows ? rows.map(rowToDeficiency) : [];
      setDeficiencies(list);
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Realtime — refetch when this area's deficiencies change cross-device
  useEffect(() => {
    if (!areaId) return;
    const channel = supabase
      .channel(`deficiencies_area_${areaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deficiencies',
          filter: `area_id=eq.${areaId}`,
        },
        () => {
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [areaId, reload]);

  const sorted = useMemo(
    () => [...deficiencies].sort(compareDeficiencies),
    [deficiencies],
  );

  const counts = useMemo(() => {
    const out = { critical: 0, major: 0, minor: 0, cosmetic: 0, openTotal: 0 };
    for (const d of sorted) {
      if (d.status !== 'verified') out.openTotal += 1;
      out[d.severity] = (out[d.severity] ?? 0) + 1;
    }
    return out;
  }, [sorted]);

  return { deficiencies: sorted, counts, loading, reload };
}
