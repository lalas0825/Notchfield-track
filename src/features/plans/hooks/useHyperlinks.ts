/**
 * useHyperlinks — Sprint 47B
 * ============================
 * Fetch drawing_hyperlinks for a given source drawing. Local-first via
 * PowerSync, falls back to Supabase. Also exposes a helper to resolve
 * a target sheet number to a drawing id within the current project.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';

export interface DrawingHyperlink {
  id: string;
  organization_id: string;
  source_drawing_id: string;
  target_sheet_number: string;
  target_drawing_id: string | null;
  position_x: number | null;
  position_y: number | null;
  width: number | null;
  height: number | null;
  reference_text: string | null;
  detection_type: string | null;
  created_at: string;
}

export function useHyperlinks(drawingId: string | null) {
  const [links, setLinks] = useState<DrawingHyperlink[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!drawingId) {
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const local = await localQuery<DrawingHyperlink>(
        `SELECT * FROM drawing_hyperlinks WHERE source_drawing_id = ?`,
        [drawingId],
      );
      if (local !== null) {
        setLinks(local);
      } else {
        const { data, error } = await supabase
          .from('drawing_hyperlinks')
          .select('*')
          .eq('source_drawing_id', drawingId);
        if (error) throw error;
        setLinks((data ?? []) as DrawingHyperlink[]);
      }
    } catch (err) {
      console.warn('[useHyperlinks] load failed', err);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [drawingId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { links, loading, reload };
}
