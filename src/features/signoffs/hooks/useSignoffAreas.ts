/**
 * Sprint 72 — useSignoffAreas.
 *
 * Fetches the M:N junction `signoff_areas` rows for a single signoff doc.
 * NOT in PowerSync (composite PK, no synthetic id) — direct Supabase
 * query with realtime subscription. Acceptable: detail view fetches a
 * handful of rows per signoff, not high-frequency.
 *
 * Returns the linked area_ids + surface_ids + label snapshots for
 * displaying "this signoff covers L3-E2, L3-E4" on the detail screen.
 *
 * Returns empty array while offline if the rows weren't pre-cached. The
 * detail screen should show a graceful "Areas loading..." state and not
 * gate critical actions (sign/decline) on this fetch.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { logger } from '@/shared/lib/logger';
import type { SignoffArea } from '../types';

type RawAreaRow = {
  signoff_id: string;
  area_id: string;
  surface_id: string | null;
  area_label_snapshot: string | null;
  created_at: string;
};

export function useSignoffAreas(signoffId: string | null | undefined) {
  const [areas, setAreas] = useState<SignoffArea[]>([]);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!signoffId) {
      if (mountedRef.current) {
        setAreas([]);
        setLoading(false);
      }
      return;
    }
    try {
      const { data, error } = await supabase
        .from('signoff_areas')
        .select('signoff_id, area_id, surface_id, area_label_snapshot, created_at')
        .eq('signoff_id', signoffId);
      if (error) {
        logger.warn('[useSignoffAreas] supabase error', error);
        if (mountedRef.current) {
          setAreas([]);
          setLoading(false);
        }
        return;
      }
      const rows = (data as RawAreaRow[] | null) ?? [];
      if (mountedRef.current) {
        setAreas(rows);
        setLoading(false);
      }
    } catch (e) {
      logger.warn('[useSignoffAreas] fetch exception', e);
      if (mountedRef.current) {
        setAreas([]);
        setLoading(false);
      }
    }
  }, [signoffId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime — refetch when areas change for this signoff (e.g. PM removes
  // an area from the doc on Web, or auto-spawn updates the snapshot).
  useEffect(() => {
    if (!signoffId) return;
    const channel = supabase
      .channel(`signoff_areas_${signoffId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'signoff_areas',
          filter: `signoff_id=eq.${signoffId}`,
        },
        () => {
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [signoffId, reload]);

  return { areas, loading, reload };
}
