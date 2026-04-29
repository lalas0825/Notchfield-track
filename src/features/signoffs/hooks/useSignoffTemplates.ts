/**
 * Sprint 72 — useSignoffTemplates.
 *
 * Reads the sign-off template library — both org-scoped entries and the
 * 14 NotchField-seeded global templates (synced via signoff_templates_global
 * bucket). Filters by `org.primary_trades + 'general'` per Polish R2 spec
 * so e.g. Jantile (`primary_trades=['tile','marble']`) sees 11 of 14
 * templates instead of all of them. Templates are grouped by trade for
 * the picker UI.
 *
 * Local-first via PowerSync. No realtime subscription (the library
 * changes monthly at most; on-focus refetch is fine).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localQuery } from '@/shared/lib/powersync/write';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  filterTemplatesByPrimaryTrades,
  type SignoffEvidenceRule,
  type SignoffSignerRole,
  type SignoffStatusAfterSign,
  type SignoffTemplate,
} from '../types';

type RawRow = Record<string, unknown>;

function parseJsonArray<T>(raw: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function rowToTemplate(row: RawRow): SignoffTemplate {
  return {
    id: row.id as string,
    organization_id: (row.organization_id as string | null) ?? null,
    trade: (row.trade as string) ?? '',
    name: (row.name as string) ?? '',
    description: (row.description as string | null) ?? null,
    body_template: (row.body_template as string) ?? '',
    signer_role: (row.signer_role as SignoffSignerRole) ?? 'gc',
    required_evidence: parseJsonArray<SignoffEvidenceRule>(row.required_evidence),
    auto_spawn_on_surface_type: (row.auto_spawn_on_surface_type as string | null) ?? null,
    allows_multi_area: row.allows_multi_area === 1 || row.allows_multi_area === true,
    default_status_after_sign:
      (row.default_status_after_sign as SignoffStatusAfterSign) ?? 'archives',
    active: row.active === 1 || row.active === true,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/** Read primary_trades from organizations (PowerSync first, Supabase fallback). */
async function loadPrimaryTrades(orgId: string): Promise<string[]> {
  const local = await localQuery<{ primary_trades: unknown }>(
    `SELECT primary_trades FROM organizations WHERE id = ? LIMIT 1`,
    [orgId],
  );
  let raw: unknown = null;
  if (local && local.length > 0) {
    raw = local[0].primary_trades;
  } else {
    const { data } = await supabase
      .from('organizations')
      .select('primary_trades')
      .eq('id', orgId)
      .maybeSingle();
    raw = (data as { primary_trades: unknown } | null)?.primary_trades ?? null;
  }
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((t): t is string => typeof t === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

export type SignoffLibraryByTrade = Record<string, SignoffTemplate[]>;

export function useSignoffTemplates() {
  const orgId = useAuthStore((s) => s.profile?.organization_id ?? null);

  const [templates, setTemplates] = useState<SignoffTemplate[]>([]);
  const [primaryTrades, setPrimaryTrades] = useState<string[]>([]);
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
        setPrimaryTrades([]);
        setLoading(false);
      }
      return;
    }

    const [orgRows, globalRows, primary] = await Promise.all([
      localQuery<RawRow>(
        `SELECT * FROM signoff_templates
           WHERE organization_id = ?
             AND active = 1
           ORDER BY trade, name`,
        [orgId],
      ),
      localQuery<RawRow>(
        `SELECT * FROM signoff_templates
           WHERE organization_id IS NULL
             AND active = 1
           ORDER BY trade, name`,
        [],
      ),
      loadPrimaryTrades(orgId),
    ]);

    const byId = new Map<string, SignoffTemplate>();
    for (const row of orgRows ?? []) {
      const t = rowToTemplate(row);
      byId.set(t.id, t);
    }
    for (const row of globalRows ?? []) {
      const t = rowToTemplate(row);
      // Org-scoped takes precedence over global with same id (defensive).
      if (!byId.has(t.id)) byId.set(t.id, t);
    }

    // Fallback: if local SQLite has zero rows (PowerSync sync rules
    // for signoff_templates / signoff_templates_global may not be
    // deployed in this env yet, OR the user signed in for the first
    // time and the bucket hasn't downloaded), fetch direct from
    // Supabase. Pilot reported "library is empty" 2026-04-29 — most
    // likely cause was the Sprint 72 sync rules not deployed to Prod.
    if (byId.size === 0) {
      const { data, error } = await supabase
        .from('signoff_templates')
        .select('*')
        .eq('active', true)
        .or(`organization_id.eq.${orgId},organization_id.is.null`)
        .order('trade')
        .order('name');
      if (!error && data) {
        for (const row of data) {
          const t = rowToTemplate(row as RawRow);
          if (!byId.has(t.id)) byId.set(t.id, t);
        }
      }
    }

    if (mountedRef.current) {
      setTemplates([...byId.values()]);
      setPrimaryTrades(primary);
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

  /** Templates filtered by org.primary_trades + 'general'. Polish R2. */
  const filtered = useMemo(
    () => filterTemplatesByPrimaryTrades(templates, primaryTrades),
    [templates, primaryTrades],
  );

  /** Group filtered templates by trade for the picker. */
  const byTrade = useMemo<SignoffLibraryByTrade>(() => {
    const out: SignoffLibraryByTrade = {};
    for (const t of filtered) {
      const key = t.trade || 'other';
      if (!out[key]) out[key] = [];
      out[key].push(t);
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [filtered]);

  return {
    templates: filtered,
    allTemplates: templates,
    primaryTrades,
    byTrade,
    loading,
    reload,
  };
}
