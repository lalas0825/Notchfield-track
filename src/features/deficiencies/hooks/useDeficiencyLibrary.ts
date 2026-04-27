/**
 * Sprint 71 — useDeficiencyLibrary.
 *
 * Reads the deficiency template library — both org-scoped entries and
 * the global ~40-template seed (synced via deficiency_library_global
 * bucket). Templates are grouped by trade for the picker UI.
 *
 * Filters:
 *   - Always `active = true` (sync rule already filters, defensive client-side)
 *   - Optionally pin to current user's org's primary_trades (Sprint 52
 *     project memory — only show trades relevant to the org)
 *
 * Local-first via PowerSync. No realtime subscription (the library
 * changes monthly at most; on-focus refetch is fine).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type { DeficiencyLibrary, DeficiencySeverity } from '../types';

type RawRow = Record<string, unknown>;

function rowToTemplate(row: RawRow): DeficiencyLibrary {
  return {
    id: row.id as string,
    organization_id: (row.organization_id as string | null) ?? null,
    trade: (row.trade as string) ?? '',
    category: (row.category as string) ?? '',
    default_title: (row.default_title as string) ?? '',
    default_severity: (row.default_severity as DeficiencySeverity) ?? 'minor',
    description: (row.description as string | null) ?? null,
    acceptance_criteria: (row.acceptance_criteria as string | null) ?? null,
    typical_resolution: (row.typical_resolution as string | null) ?? null,
    active: row.active === 1 || row.active === true,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export type LibraryByTrade = Record<string, DeficiencyLibrary[]>;

export function useDeficiencyLibrary() {
  const orgId = useAuthStore((s) => s.profile?.organization_id ?? null);

  const [templates, setTemplates] = useState<DeficiencyLibrary[]>([]);
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
        setTemplates([]);
        setLoading(false);
      }
      return;
    }

    // Two queries via PowerSync local — org-scoped + global. Union and
    // dedupe by id (defensive — a row shouldn't appear in both).
    const [orgRows, globalRows] = await Promise.all([
      localQuery<RawRow>(
        `SELECT * FROM deficiency_library
           WHERE organization_id = ?
             AND active = 1
           ORDER BY trade, category`,
        [orgId],
      ),
      localQuery<RawRow>(
        `SELECT * FROM deficiency_library
           WHERE organization_id IS NULL
             AND active = 1
           ORDER BY trade, category`,
        [],
      ),
    ]);

    const byId = new Map<string, DeficiencyLibrary>();
    for (const row of orgRows ?? []) {
      const t = rowToTemplate(row);
      byId.set(t.id, t);
    }
    for (const row of globalRows ?? []) {
      const t = rowToTemplate(row);
      // Org-scoped entries take precedence over global with same id.
      if (!byId.has(t.id)) byId.set(t.id, t);
    }

    if (mountedRef.current) {
      setTemplates([...byId.values()]);
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

  /** Group templates by trade for the picker — { 'tile': [...], 'paint': [...] }. */
  const byTrade = useMemo<LibraryByTrade>(() => {
    const out: LibraryByTrade = {};
    for (const t of templates) {
      const key = t.trade || 'other';
      if (!out[key]) out[key] = [];
      out[key].push(t);
    }
    // Sort entries within each trade alphabetically
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => a.default_title.localeCompare(b.default_title));
    }
    return out;
  }, [templates]);

  return { templates, byTrade, loading, reload };
}
