import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import type { ProductionArea } from '../store/production-store';

interface Unit {
  id: string;
  name: string;
  floor: string;
  unit_type: string;
  sort_order: number;
}

interface UnitGroup {
  unit: Unit;
  areas: ProductionArea[];
}

export interface GroupedFloor {
  floor: string;
  units: UnitGroup[];
  floorAreas: ProductionArea[]; // areas with unit_id = NULL (lobby, corridor)
  totalAreas: number;
  completedAreas: number;
  blockedAreas: number;
  progressPct: number;
}

export function useGroupedAreas(projectId: string | undefined, organizationId: string | undefined) {
  const [grouped, setGrouped] = useState<GroupedFloor[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!projectId || !organizationId) return;
    setLoading(true);

    const [unitsRes, areasRes] = await Promise.all([
      supabase.from('units').select('*').eq('project_id', projectId).order('floor').order('sort_order').order('name'),
      supabase.from('production_areas').select('*').eq('project_id', projectId).in('area_type', ['individual']).order('floor').order('name'),
    ]);

    // Also get areas where area_type is NULL (legacy data)
    const { data: legacyAreas } = await supabase.from('production_areas').select('*').eq('project_id', projectId).is('area_type', null).order('floor').order('name');

    const units = (unitsRes.data ?? []) as Unit[];
    const areas = [...(areasRes.data ?? []), ...(legacyAreas ?? [])] as ProductionArea[];

    const floorMap = new Map<string, GroupedFloor>();

    for (const area of areas) {
      const floor = area.floor || 'Unassigned';
      if (!floorMap.has(floor)) {
        floorMap.set(floor, { floor, units: [], floorAreas: [], totalAreas: 0, completedAreas: 0, blockedAreas: 0, progressPct: 0 });
      }
      const floorGroup = floorMap.get(floor)!;
      floorGroup.totalAreas++;
      if (area.status === 'completed') floorGroup.completedAreas++;
      if (area.status === 'blocked') floorGroup.blockedAreas++;

      const areaWithUnit = area as any;
      if (areaWithUnit.unit_id) {
        const unit = units.find(u => u.id === areaWithUnit.unit_id);
        if (unit) {
          let unitGroup = floorGroup.units.find(ug => ug.unit.id === unit.id);
          if (!unitGroup) {
            unitGroup = { unit, areas: [] };
            floorGroup.units.push(unitGroup);
          }
          unitGroup.areas.push(area);
        } else {
          floorGroup.floorAreas.push(area);
        }
      } else {
        floorGroup.floorAreas.push(area);
      }
    }

    // Calculate progress per floor
    for (const fg of floorMap.values()) {
      fg.progressPct = fg.totalAreas > 0 ? Math.round((fg.completedAreas / fg.totalAreas) * 100) : 0;
    }

    setGrouped(Array.from(floorMap.values()));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, organizationId]);

  useEffect(() => { reload(); }, [reload]);

  return { grouped, loading, reload };
}
