/**
 * Sprint 71 Phase 2 — useAreaSurfaces.
 *
 * Reads `production_area_objects` rows for one area, used by the
 * surface picker dropdown in ReportDeficiencyModal. Sprint 43A confirmed
 * the column names (total_quantity_sf, name = surface position like
 * 'floor'/'wall'/'base'/'saddle', surface_type, material_code).
 *
 * Local-first via PowerSync (the table syncs via the by_org bucket).
 * No realtime needed — surfaces don't change mid-session.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { localQuery } from '@/shared/lib/powersync/write';

type RawRow = Record<string, unknown>;

export type AreaSurface = {
  id: string;
  name: string;            // 'floor' | 'wall' | 'base' | 'saddle' | etc
  surface_type: string | null;
  material_code: string | null;
  total_quantity_sf: number | null;
};

function rowToSurface(row: RawRow): AreaSurface {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    surface_type: (row.surface_type as string | null) ?? null,
    material_code: (row.material_code as string | null) ?? null,
    total_quantity_sf:
      typeof row.total_quantity_sf === 'number'
        ? (row.total_quantity_sf as number)
        : null,
  };
}

export function useAreaSurfaces(areaId: string | null | undefined) {
  const [surfaces, setSurfaces] = useState<AreaSurface[]>([]);
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
        setSurfaces([]);
        setLoading(false);
      }
      return;
    }
    const rows = await localQuery<RawRow>(
      `SELECT id, name, surface_type, material_code, total_quantity_sf
         FROM production_area_objects
         WHERE area_id = ?
         ORDER BY name`,
      [areaId],
    );
    if (mountedRef.current) {
      setSurfaces(rows ? rows.map(rowToSurface) : []);
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { surfaces, loading, reload };
}

/** Display label for a surface in the picker — e.g. "Floor (CT-04, 92 SF)". */
export function surfaceLabel(s: AreaSurface): string {
  const position = (s.name || 'surface').replace(/^./, (c) => c.toUpperCase());
  const code = s.material_code ? ` (${s.material_code}` : '';
  const sf = s.total_quantity_sf ? `, ${Math.round(s.total_quantity_sf)} SF)` : code ? ')' : '';
  return code ? `${position}${code}${sf}` : position;
}
