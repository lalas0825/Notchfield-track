import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { isPdfCached } from '../services/drawing-service';

export type DrawingSet = {
  id: string;
  name: string;
  file_path: string;
  page_count: number;
  created_at: string;
};

export type Drawing = {
  id: string;
  drawing_set_id: string;
  page_number: number;
  label: string | null;
  scale_unit: string | null;
  created_at: string;
  // Joined fields
  set_name: string;
  file_path: string;
  // Revision info
  latest_revision: string | null;
  revision_count: number;
  has_new_revision: boolean;
  // Offline status
  is_cached: boolean;
};

type DisciplineGroup = {
  discipline: string;
  drawings: Drawing[];
};

export function useDrawings() {
  const { activeProject } = useProjectStore();
  const { profile } = useAuthStore();
  const [sets, setSets] = useState<DrawingSet[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [grouped, setGrouped] = useState<DisciplineGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrawings = useCallback(async () => {
    if (!activeProject || !profile) return;
    setLoading(true);

    // Fetch drawing sets
    const { data: setsData } = await supabase
      .from('drawing_sets')
      .select('id, name, file_path, page_count, created_at')
      .eq('project_id', activeProject.id)
      .eq('organization_id', profile.organization_id)
      .order('name');

    const fetchedSets = (setsData ?? []) as DrawingSet[];
    setSets(fetchedSets);

    // Fetch all drawings for these sets
    const setIds = fetchedSets.map((s) => s.id);
    if (setIds.length === 0) {
      setDrawings([]);
      setGrouped([]);
      setLoading(false);
      return;
    }

    const { data: drawingsData } = await supabase
      .from('drawings')
      .select('id, drawing_set_id, page_number, label, scale_unit, created_at')
      .in('drawing_set_id', setIds)
      .order('page_number');

    // Fetch latest revision per drawing
    const { data: revisionsData } = await supabase
      .from('drawing_revisions')
      .select('drawing_id, revision_code, created_at')
      .in('drawing_id', (drawingsData ?? []).map((d: any) => d.id))
      .order('created_at', { ascending: false });

    // Build revision map: drawing_id → latest revision_code + count
    const revisionMap = new Map<string, { code: string; count: number }>();
    for (const rev of (revisionsData ?? []) as any[]) {
      const existing = revisionMap.get(rev.drawing_id);
      if (!existing) {
        revisionMap.set(rev.drawing_id, { code: rev.revision_code, count: 1 });
      } else {
        existing.count += 1;
      }
    }

    // Build set lookup
    const setMap = new Map(fetchedSets.map((s) => [s.id, s]));

    // Build drawings with joined data + check cache status
    const enriched: Drawing[] = await Promise.all(
      ((drawingsData ?? []) as any[]).map(async (d) => {
        const set = setMap.get(d.drawing_set_id);
        const rev = revisionMap.get(d.id);
        const cached = set ? await isPdfCached(set.file_path) : false;

        return {
          id: d.id,
          drawing_set_id: d.drawing_set_id,
          page_number: d.page_number,
          label: d.label,
          scale_unit: d.scale_unit,
          created_at: d.created_at,
          set_name: set?.name ?? 'Unknown',
          file_path: set?.file_path ?? '',
          latest_revision: rev?.code ?? null,
          revision_count: rev?.count ?? 0,
          has_new_revision: (rev?.count ?? 0) > 1,
          is_cached: cached,
        };
      }),
    );

    setDrawings(enriched);

    // Group by discipline (infer from label prefix: A = Arch, S = Struct, M/P/E = MEP)
    const groups = new Map<string, Drawing[]>();
    for (const d of enriched) {
      const discipline = inferDiscipline(d.label);
      if (!groups.has(discipline)) groups.set(discipline, []);
      groups.get(discipline)!.push(d);
    }

    const sortedGroups: DisciplineGroup[] = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([discipline, drawings]) => ({ discipline, drawings }));

    setGrouped(sortedGroups);
    setLoading(false);
  }, [activeProject, profile]);

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  return { sets, drawings, grouped, loading, fetchDrawings };
}

/**
 * Infer discipline from sheet label.
 * A-201 → Architectural, S-101 → Structural, M/P/E → MEP, etc.
 */
function inferDiscipline(label: string | null): string {
  if (!label) return 'Other';
  const prefix = label.charAt(0).toUpperCase();
  switch (prefix) {
    case 'A': return 'Architectural';
    case 'S': return 'Structural';
    case 'M': return 'Mechanical';
    case 'P': return 'Plumbing';
    case 'E': return 'Electrical';
    case 'F': return 'Fire Protection';
    case 'L': return 'Landscape';
    case 'C': return 'Civil';
    default: return 'Other';
  }
}
