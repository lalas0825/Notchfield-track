/**
 * useDrawings — Plans tab source of truth.
 *
 * Reads from `drawing_register` (Takeoff PM → Drawings tab → upload set
 * lands here). PowerSync-first so foremen see plans offline once synced.
 *
 * Why not `drawings` + `drawing_sets`: those tables back the Estimator
 * side (takeoff polygons) and are usually empty for field-only projects.
 * When we queried Jantile's DEMO PROJECT post-pilot-upload, all 9 sheets
 * were in `drawing_register` — `drawing_sets` was empty. That's the PM
 * path, and it's what the field needs to see.
 *
 * Shape returned to the UI stays compatible with the previous hook so
 * `plans/index.tsx` + `plans/[id].tsx` don't need changes — `file_path`
 * is just whatever the viewer passes to `getPdfUri`, and the service
 * now accepts both URLs and storage paths.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
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
  // Joined / derived
  set_name: string;
  file_path: string;       // URL or storage path — drawing-service handles both
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

type RegisterRow = {
  id: string;
  project_id: string;
  organization_id: string;
  number: string | null;
  title: string | null;
  discipline: string | null;
  status: string | null;
  current_revision: string | null;
  set_name: string | null;
  file_url: string | null;
  page_number: number | null;
  revision_date: string | null;
  created_at: string;
};

// Map raw DB row → UI shape expected by plans/index.tsx and the viewer.
function toDrawing(row: RegisterRow, cached: boolean): Drawing {
  return {
    id: row.id,
    // No parent set row in drawing_register — use the set_name as a stable
    // grouping key. Multiple sheets share the same set_name + same file_url
    // (different page_number).
    drawing_set_id: row.set_name ?? 'unknown',
    page_number: row.page_number ?? 1,
    label: row.number ?? row.title ?? null,
    scale_unit: null,
    created_at: row.created_at,
    set_name: row.set_name ?? 'Unknown',
    file_path: row.file_url ?? '',
    latest_revision: row.current_revision,
    revision_count: row.current_revision ? 1 : 0,
    has_new_revision: false,
    is_cached: cached,
  };
}

function normalizeDiscipline(raw: string | null | undefined): string {
  if (!raw) return 'Other';
  const s = raw.toLowerCase();
  switch (s) {
    case 'architectural':
    case 'arch':
      return 'Architectural';
    case 'structural':
    case 'struct':
      return 'Structural';
    case 'mechanical':
    case 'mech':
      return 'Mechanical';
    case 'plumbing':
      return 'Plumbing';
    case 'electrical':
      return 'Electrical';
    case 'fire':
    case 'fire_protection':
      return 'Fire Protection';
    case 'landscape':
      return 'Landscape';
    case 'civil':
      return 'Civil';
    case 'specialty':
      return 'Specialty';
    default:
      // Title-case unknown disciplines so they render nicely in the UI
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
}

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

    // Offline-first via PowerSync; Supabase fallback on cold start.
    const local = await localQuery<RegisterRow>(
      `SELECT id, project_id, organization_id, number, title, discipline,
              status, current_revision, set_name, file_url, page_number,
              revision_date, created_at
       FROM drawing_register
       WHERE project_id = ?
         AND organization_id = ?
       ORDER BY COALESCE(page_number, 0), number`,
      [activeProject.id, profile.organization_id],
    );

    let rows: RegisterRow[];
    if (local !== null) {
      rows = local;
    } else {
      const { data, error } = await supabase
        .from('drawing_register')
        .select(
          'id, project_id, organization_id, number, title, discipline, status, current_revision, set_name, file_url, page_number, revision_date, created_at',
        )
        .eq('project_id', activeProject.id)
        .eq('organization_id', profile.organization_id)
        .order('page_number', { ascending: true, nullsFirst: false })
        .order('number');
      if (error) {
        console.warn('[useDrawings] supabase fallback failed:', error.message);
        rows = [];
      } else {
        rows = (data ?? []) as RegisterRow[];
      }
    }

    // Build Drawing[] with cache status. Rows sharing the same file_url
    // all share the same local cache entry — cache check is file-level.
    const enriched: Drawing[] = await Promise.all(
      rows.map(async (r) => toDrawing(r, r.file_url ? await isPdfCached(r.file_url) : false)),
    );
    setDrawings(enriched);

    // Derive a DrawingSet[] shape for any downstream consumer that still
    // expects it. One entry per unique (set_name, file_url) pair.
    const setMap = new Map<string, DrawingSet>();
    for (const r of rows) {
      const key = `${r.set_name ?? ''}|${r.file_url ?? ''}`;
      if (!setMap.has(key)) {
        setMap.set(key, {
          id: key,
          name: r.set_name ?? 'Unknown',
          file_path: r.file_url ?? '',
          page_count: 0,
          created_at: r.created_at,
        });
      }
      const s = setMap.get(key)!;
      s.page_count += 1;
    }
    setSets([...setMap.values()]);

    // Group by discipline — drawing_register.discipline is authoritative
    // (no more prefix inference from label).
    const groups = new Map<string, Drawing[]>();
    for (let i = 0; i < enriched.length; i++) {
      const disciplineRaw = rows[i]?.discipline ?? null;
      const discipline = normalizeDiscipline(disciplineRaw);
      if (!groups.has(discipline)) groups.set(discipline, []);
      groups.get(discipline)!.push(enriched[i]);
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
