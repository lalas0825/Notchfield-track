/**
 * useSheetSiblings — Sprint 47B
 * ================================
 * Fetches the sibling drawings within the same drawing_set (ordered by
 * page_number) for prev/next navigation in the viewer. Direct Supabase
 * read — the viewer only needs this once per sheet load.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';

export interface SheetSibling {
  id: string;
  drawing_set_id: string;
  page_number: number;
  label: string | null;
  file_path: string;
}

export function useSheetSiblings(drawingId: string | null) {
  const [siblings, setSiblings] = useState<SheetSibling[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!drawingId) { setSiblings([]); setLoading(false); return; }
    setLoading(true);
    try {
      // Resolve drawing_set_id from the current drawing
      const { data: cur, error: curErr } = await supabase
        .from('drawings')
        .select('drawing_set_id')
        .eq('id', drawingId)
        .maybeSingle();
      if (curErr || !cur) { setSiblings([]); return; }

      // Fetch set for file_path
      const { data: set, error: setErr } = await supabase
        .from('drawing_sets')
        .select('file_path')
        .eq('id', cur.drawing_set_id)
        .maybeSingle();
      if (setErr || !set) { setSiblings([]); return; }

      // Fetch all drawings in the set
      const { data: rows, error: rowsErr } = await supabase
        .from('drawings')
        .select('id, drawing_set_id, page_number, label')
        .eq('drawing_set_id', cur.drawing_set_id)
        .order('page_number');
      if (rowsErr || !rows) { setSiblings([]); return; }

      setSiblings(
        rows.map((r) => ({
          id: r.id,
          drawing_set_id: r.drawing_set_id,
          page_number: r.page_number,
          label: r.label,
          file_path: set.file_path,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [drawingId]);

  useEffect(() => { load(); }, [load]);

  return { siblings, loading };
}
