import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase/client';

export type ProductionArea = {
  id: string;
  project_id: string;
  organization_id: string;
  template_id: string | null;
  name: string;
  floor: string | null;
  zone: string | null;
  quantity: number;
  unit_type: string;
  status: string; // 'not_started' | 'in_progress' | 'blocked' | 'complete'
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
  blocked_by: string | null;
};

export type PhaseProgress = {
  id: string;
  area_id: string;
  phase_id: string;
  status: string;
  percent_complete: number;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
};

export type TemplatePhase = {
  id: string;
  template_id: string;
  name: string;
  sequence: number;
  requires_inspection: boolean;
  estimated_duration_hours: number | null;
  depends_on_phase: number | null;
};

export type FloorGroup = {
  floor: string;
  areas: ProductionArea[];
  progressPct: number;
  // Gate health metrics (computed per floor)
  totalGates: number;
  completedGates: number;
  gateHealthPct: number;
  blockedCount: number;
};

type ProductionState = {
  areas: ProductionArea[];
  phases: Map<string, PhaseProgress[]>;
  templatePhases: TemplatePhase[];
  floors: FloorGroup[];
  loading: boolean;
  totalAreas: number;
  completedAreas: number;
  blockedAreas: number;
  inProgressAreas: number;
  // Global gate health
  totalGates: number;
  completedGates: number;
};

type ProductionActions = {
  fetchAll: (projectId: string, organizationId: string) => Promise<void>;
  markAreaStatus: (areaId: string, status: string, blockedReason?: string) => Promise<{ success: boolean; error?: string }>;
  completePhase: (progressId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  blockPhase: (progressId: string, areaId: string, reason: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  canCompleteArea: (areaId: string) => { allowed: boolean; pendingGates: string[] };
  getAreaPhases: (areaId: string) => PhaseProgress[];
  recalcFloor: (floor: string) => void;
};

/**
 * Compute gate health for a set of areas.
 * Only counts phases where template requires_inspection = true (gate phases).
 */
function computeGateHealth(
  areas: ProductionArea[],
  phases: Map<string, PhaseProgress[]>,
  templatePhases: TemplatePhase[],
) {
  const gatePhaseIds = new Set(
    templatePhases.filter((tp) => tp.requires_inspection).map((tp) => tp.id),
  );

  let totalGates = 0;
  let completedGates = 0;

  for (const area of areas) {
    const areaPhases = phases.get(area.id) ?? [];
    for (const p of areaPhases) {
      if (gatePhaseIds.has(p.phase_id)) {
        totalGates++;
        if (p.status === 'complete') completedGates++;
      }
    }
  }

  return {
    totalGates,
    completedGates,
    gateHealthPct: totalGates > 0 ? Math.round((completedGates / totalGates) * 100) : 100,
  };
}

function buildFloors(
  areas: ProductionArea[],
  phases: Map<string, PhaseProgress[]>,
  templatePhases: TemplatePhase[],
): FloorGroup[] {
  const floorMap = new Map<string, ProductionArea[]>();
  for (const area of areas) {
    const floor = area.floor ?? 'Unassigned';
    if (!floorMap.has(floor)) floorMap.set(floor, []);
    floorMap.get(floor)!.push(area);
  }

  return [...floorMap.entries()].map(([floor, floorAreas]) => {
    const completed = floorAreas.filter((a) => a.status === 'complete').length;
    const progressPct = floorAreas.length > 0 ? Math.round((completed / floorAreas.length) * 100) : 0;
    const blockedCount = floorAreas.filter((a) => a.status === 'blocked').length;
    const gateHealth = computeGateHealth(floorAreas, phases, templatePhases);

    return {
      floor,
      areas: floorAreas,
      progressPct,
      blockedCount,
      ...gateHealth,
    };
  });
}

export const useProductionStore = create<ProductionState & ProductionActions>((set, get) => ({
  areas: [],
  phases: new Map(),
  templatePhases: [],
  floors: [],
  loading: false,
  totalAreas: 0,
  completedAreas: 0,
  blockedAreas: 0,
  inProgressAreas: 0,
  totalGates: 0,
  completedGates: 0,

  fetchAll: async (projectId: string, organizationId: string) => {
    set({ loading: true });

    const [areasRes, progressRes, templatePhasesRes] = await Promise.all([
      supabase.from('production_areas').select('*').eq('project_id', projectId).order('floor').order('name'),
      supabase.from('production_phase_progress').select('*').eq('organization_id', organizationId),
      supabase.from('production_template_phases').select('*').eq('organization_id', organizationId).order('sequence'),
    ]);

    const areas = (areasRes.data ?? []) as ProductionArea[];
    const allProgress = (progressRes.data ?? []) as PhaseProgress[];
    const templatePhases = (templatePhasesRes.data ?? []) as TemplatePhase[];

    const phaseMap = new Map<string, PhaseProgress[]>();
    for (const p of allProgress) {
      if (!phaseMap.has(p.area_id)) phaseMap.set(p.area_id, []);
      phaseMap.get(p.area_id)!.push(p);
    }

    const floors = buildFloors(areas, phaseMap, templatePhases);
    const globalGates = computeGateHealth(areas, phaseMap, templatePhases);

    set({
      areas,
      phases: phaseMap,
      templatePhases,
      floors,
      loading: false,
      totalAreas: areas.length,
      completedAreas: areas.filter((a) => a.status === 'complete').length,
      blockedAreas: areas.filter((a) => a.status === 'blocked').length,
      inProgressAreas: areas.filter((a) => a.status === 'in_progress').length,
      totalGates: globalGates.totalGates,
      completedGates: globalGates.completedGates,
    });
  },

  markAreaStatus: async (areaId: string, status: string, blockedReason?: string) => {
    // Gate validation: cannot complete if gates pending
    if (status === 'complete') {
      const { allowed, pendingGates } = get().canCompleteArea(areaId);
      if (!allowed) {
        return { success: false, error: `Cannot complete: ${pendingGates.length} gate(s) pending verification (${pendingGates.join(', ')})` };
      }
    }

    const updates: Record<string, unknown> = { status };

    if (status === 'blocked') {
      updates.blocked_reason = blockedReason ?? null;
      updates.blocked_at = new Date().toISOString();
    } else if (status === 'in_progress') {
      const area = get().areas.find((a) => a.id === areaId);
      if (!area?.started_at) updates.started_at = new Date().toISOString();
      updates.blocked_reason = null;
      updates.blocked_at = null;
      updates.blocked_resolved_at = new Date().toISOString();
    } else if (status === 'complete') {
      updates.completed_at = new Date().toISOString();
      updates.blocked_reason = null;
    }

    const { error } = await supabase.from('production_areas').update(updates).eq('id', areaId);
    if (error) return { success: false, error: error.message };

    // Optimistic update + recalc only the affected floor
    const area = get().areas.find((a) => a.id === areaId);
    set((s) => ({
      areas: s.areas.map((a) => (a.id === areaId ? { ...a, ...updates } as ProductionArea : a)),
    }));
    if (area?.floor) get().recalcFloor(area.floor);

    return { success: true };
  },

  completePhase: async (progressId: string, userId: string) => {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('production_phase_progress')
      .update({
        status: 'complete',
        percent_complete: 100,
        completed_at: now,
        completed_by: userId,
      })
      .eq('id', progressId);

    if (error) return { success: false, error: error.message };

    // Optimistic update in phase map
    set((s) => {
      const newPhases = new Map(s.phases);
      for (const [areaId, phaseList] of newPhases) {
        const idx = phaseList.findIndex((p) => p.id === progressId);
        if (idx >= 0) {
          phaseList[idx] = {
            ...phaseList[idx],
            status: 'complete',
            percent_complete: 100,
            completed_at: now,
            completed_by: userId,
          };
          // Recalc floor for this area
          const area = s.areas.find((a) => a.id === areaId);
          if (area?.floor) setTimeout(() => get().recalcFloor(area.floor!), 0);
          break;
        }
      }
      return { phases: newPhases };
    });

    return { success: true };
  },

  blockPhase: async (progressId: string, areaId: string, reason: string, userId: string) => {
    // Update phase status
    const { error } = await supabase
      .from('production_phase_progress')
      .update({ status: 'blocked', notes: reason })
      .eq('id', progressId);

    if (error) return { success: false, error: error.message };

    // Also block the area
    await get().markAreaStatus(areaId, 'blocked', reason);

    // Auto-create field_message for the block
    const area = get().areas.find((a) => a.id === areaId);
    if (area) {
      await supabase.from('field_messages').insert({
        organization_id: area.organization_id,
        project_id: area.project_id,
        area_id: areaId,
        sender_id: userId,
        message_type: 'blocker',
        message: `Gate blocked: ${reason}`,
      });
    }

    return { success: true };
  },

  canCompleteArea: (areaId: string) => {
    const { phases, templatePhases, areas } = get();
    const area = areas.find((a) => a.id === areaId);
    if (!area) return { allowed: true, pendingGates: [] };

    const areaPhases = phases.get(areaId) ?? [];
    const gateTemplates = templatePhases.filter(
      (tp) => tp.template_id === area.template_id && tp.requires_inspection,
    );

    const pendingGates: string[] = [];
    for (const gate of gateTemplates) {
      const progress = areaPhases.find((p) => p.phase_id === gate.id);
      if (!progress || progress.status !== 'complete') {
        pendingGates.push(gate.name);
      }
    }

    return { allowed: pendingGates.length === 0, pendingGates };
  },

  getAreaPhases: (areaId: string) => {
    return get().phases.get(areaId) ?? [];
  },

  // Recalc only one floor — O(areas_in_floor), not O(all_areas)
  recalcFloor: (floor: string) => {
    set((s) => {
      const floorAreas = s.areas.filter((a) => (a.floor ?? 'Unassigned') === floor);
      const completed = floorAreas.filter((a) => a.status === 'complete').length;
      const progressPct = floorAreas.length > 0 ? Math.round((completed / floorAreas.length) * 100) : 0;
      const blockedCount = floorAreas.filter((a) => a.status === 'blocked').length;
      const gateHealth = computeGateHealth(floorAreas, s.phases, s.templatePhases);

      const newFloors = s.floors.map((f) =>
        f.floor === floor
          ? { ...f, areas: floorAreas, progressPct, blockedCount, ...gateHealth }
          : f,
      );

      // Recalc global counts
      const allAreas = s.areas;
      return {
        floors: newFloors,
        totalAreas: allAreas.length,
        completedAreas: allAreas.filter((a) => a.status === 'complete').length,
        blockedAreas: allAreas.filter((a) => a.status === 'blocked').length,
        inProgressAreas: allAreas.filter((a) => a.status === 'in_progress').length,
      };
    });
  },
}));
