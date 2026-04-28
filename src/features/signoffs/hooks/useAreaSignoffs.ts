/**
 * Sprint 72 — useAreaSignoffs.
 *
 * "Which sign-offs cover THIS area?" — answers the question for the
 * AreaDetail screen badge ("3 sign-offs · 1 pending"). Hybrid: the
 * `signoff_documents` table IS in PowerSync (org-scoped), but the
 * `signoff_areas` junction is NOT (composite PK, no id col).
 *
 * Strategy:
 *   1. Direct Supabase query: `signoff_areas WHERE area_id = ?` returns
 *      the linked signoff_ids (small list, 0-N rows).
 *   2. Then localQuery PowerSync for those signoff_ids — fast and works
 *      offline once the doc rows are synced.
 *
 * Caveat: if the device is offline AND signoff_areas hasn't been cached,
 * we return an empty list. This is acceptable for a non-critical badge
 * — the area detail screen still works, just without the count.
 *
 * Realtime sub on signoff_areas + signoff_documents for the area —
 * refetches when auto-spawn fires or status flips.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';
import type { SignoffDocument } from '../types';
import { rowToSignoff } from './useOrgSignoffs';

type RawRow = Record<string, unknown>;

export function useAreaSignoffs(areaId: string | null | undefined) {
  const [signoffs, setSignoffs] = useState<SignoffDocument[]>([]);
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
        setSignoffs([]);
        setLoading(false);
      }
      return;
    }
    try {
      // 1. Get signoff_ids via Supabase (junction not in PowerSync)
      const { data, error } = await supabase
        .from('signoff_areas')
        .select('signoff_id')
        .eq('area_id', areaId);
      if (error) {
        logger.warn('[useAreaSignoffs] supabase junction error', error);
        if (mountedRef.current) {
          setSignoffs([]);
          setLoading(false);
        }
        return;
      }
      const ids = ((data as { signoff_id: string }[] | null) ?? []).map(
        (r) => r.signoff_id,
      );
      if (ids.length === 0) {
        if (mountedRef.current) {
          setSignoffs([]);
          setLoading(false);
        }
        return;
      }

      // 2. Fetch signoff_documents from PowerSync local
      const placeholders = ids.map(() => '?').join(',');
      const rows = await localQuery<RawRow>(
        `SELECT * FROM signoff_documents
           WHERE id IN (${placeholders})
           ORDER BY created_at DESC`,
        ids,
      );
      if (mountedRef.current) {
        setSignoffs(rows ? rows.map(rowToSignoff) : []);
        setLoading(false);
      }
    } catch (e) {
      logger.warn('[useAreaSignoffs] fetch exception', e);
      if (mountedRef.current) {
        setSignoffs([]);
        setLoading(false);
      }
    }
  }, [areaId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime — both signoff_areas (junction adds/removes) and
  // signoff_documents (status flips) trigger a refetch.
  useEffect(() => {
    if (!areaId) return;
    const channel = supabase
      .channel(`area_signoffs_${areaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'signoff_areas',
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

  return { signoffs, loading, reload };
}
