import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localUpdate, localUpdateWhere, generateUUID } from '@/shared/lib/powersync/write';
import { haptic } from '@/shared/lib/haptics';

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
  status: string;
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
  totalGates: number;
  completedGates: number;
};

type ProductionActions = {
  fetchAll: (
    projectId: string,
    organizationId: string,
    workerUserId?: string | null,
  ) => Promise<void>;
  markAreaStatus: (areaId: string, status: string, blockedReason?: string, userId?: string) => Promise<{ success: boolean; error?: string }>;
  completePhase: (progressId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  blockPhase: (progressId: string, areaId: string, reason: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  canCompleteArea: (areaId: string) => { allowed: boolean; pendingGates: string[] };
  getAreaPhases: (areaId: string) => PhaseProgress[];
  recalcFloor: (floor: string) => void;
};

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
        if (p.status === 'completed') completedGates++;
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
    const completed = floorAreas.filter((a) => a.status === 'completed').length;
    const progressPct = floorAreas.length > 0 ? Math.round((completed / floorAreas.length) * 100) : 0;
    const blockedCount = floorAreas.filter((a) => a.status === 'blocked').length;
    const gateHealth = computeGateHealth(floorAreas, phases, templatePhases);
    return { floor, areas: floorAreas, progressPct, blockedCount, ...gateHealth };
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

  fetchAll: async (
    projectId: string,
    organizationId: string,
    workerUserId?: string | null,
  ) => {
    set({ loading: true });
    const [areasRes, progressRes, templatePhasesRes] = await Promise.all([
      supabase.from('production_areas').select('*').eq('project_id', projectId).order('floor').order('name'),
      supabase.from('production_phase_progress').select('*').eq('organization_id', organizationId),
      supabase.from('production_template_phases').select('*').eq('organization_id', organizationId).order('sequence'),
    ]);

    let areas = (areasRes.data ?? []) as ProductionArea[];

    // Sprint 40C: workers see only areas where they are currently assigned
    // via crew_assignments. If they have no assignments, fall back to showing
    // an empty list (rather than the whole project, to avoid leaking scope).
    if (workerUserId) {
      const { data: crewRows } = await supabase
        .from('crew_assignments')
        .select('area_id')
        .eq('worker_id', workerUserId)
        .eq('project_id', projectId);
      const allowedAreaIds = new Set(((crewRows ?? []) as { area_id: string }[]).map((r) => r.area_id));
      areas = areas.filter((a) => allowedAreaIds.has(a.id));
    }
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
      completedAreas: areas.filter((a) => a.status === 'completed').length,
      blockedAreas: areas.filter((a) => a.status === 'blocked').length,
      inProgressAreas: areas.filter((a) => a.status === 'in_progress').length,
      totalGates: globalGates.totalGates,
      completedGates: globalGates.completedGates,
    });
  },

  markAreaStatus: async (areaId: string, status: string, blockedReason?: string, userId?: string) => {
    if (status === 'completed') {
      const { allowed, pendingGates } = get().canCompleteArea(areaId);
      if (!allowed) {
        return { success: false, error: `Cannot complete: ${pendingGates.length} gate(s) pending verification (${pendingGates.join(', ')})` };
      }
    }

    const area = get().areas.find((a) => a.id === areaId);
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status };

    if (status === 'blocked') {
      updates.blocked_reason = blockedReason ?? null;
      updates.blocked_at = now;

      // FIX 2: Write to production_block_logs for Takeoff Block Analysis
      if (area && blockedReason) {
        await localInsert('production_block_logs', {
          id: generateUUID(),
          organization_id: area.organization_id,
          project_id: area.project_id,
          area_id: areaId,
          blocked_reason: blockedReason,
          blocked_at: now,
          reported_by: userId ?? null,
          created_at: now,
        });
      }
    } else if (status === 'in_progress') {
      if (!area?.started_at) updates.started_at = now;
      updates.blocked_reason = null;
      updates.blocked_at = null;
      updates.blocked_resolved_at = now;

      // FIX 2: Close open block log when unblocking
      if (area?.blocked_reason) {
        await localUpdateWhere(
          'production_block_logs',
          { resolved_at: now, resolved_by: userId ?? null },
          'area_id', areaId,
          { column: 'resolved_at', isNull: true },
        );
      }
    } else if (status === 'completed') {
      updates.completed_at = now;
      updates.blocked_reason = null;
    }

    // FIX 1: Local-first write via PowerSync
    const result = await localUpdate('production_areas', areaId, updates);
    if (!result.success) return result;

    // Haptic feedback based on status
    if (status === 'completed') haptic.success();
    else if (status === 'blocked') haptic.error();

    // Optimistic update + recalc floor
    set((s) => ({
      areas: s.areas.map((a) => (a.id === areaId ? { ...a, ...updates } as ProductionArea : a)),
    }));
    if (area?.floor) get().recalcFloor(area.floor);

    return { success: true };
  },

  completePhase: async (progressId: string, userId: string) => {
    const now = new Date().toISOString();

    // FIX 1: Local-first write
    const result = await localUpdate('production_phase_progress', progressId, {
      status: 'completed',
      percent_complete: 100,
      completed_at: now,
      completed_by: userId,
    });

    if (!result.success) return result;

    // Optimistic update in phase map
    set((s) => {
      const newPhases = new Map(s.phases);
      for (const [areaId, phaseList] of newPhases) {
        const idx = phaseList.findIndex((p) => p.id === progressId);
        if (idx >= 0) {
          phaseList[idx] = {
            ...phaseList[idx],
            status: 'completed',
            percent_complete: 100,
            completed_at: now,
            completed_by: userId,
          };
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
    // FIX 1: Local-first write
    const result = await localUpdate('production_phase_progress', progressId, {
      status: 'blocked',
      notes: reason,
    });
    if (!result.success) return result;

    // Block the area too
    await get().markAreaStatus(areaId, 'blocked', reason, userId);

    // Auto-create field_message
    const area = get().areas.find((a) => a.id === areaId);
    if (area) {
      await localInsert('field_messages', {
        id: generateUUID(),
        organization_id: area.organization_id,
        project_id: area.project_id,
        area_id: areaId,
        sender_id: userId,
        message_type: 'blocker',
        message: `Gate blocked: ${reason}`,
        created_at: new Date().toISOString(),
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
      if (!progress || progress.status !== 'completed') {
        pendingGates.push(gate.name);
      }
    }

    return { allowed: pendingGates.length === 0, pendingGates };
  },

  getAreaPhases: (areaId: string) => {
    return get().phases.get(areaId) ?? [];
  },

  recalcFloor: (floor: string) => {
    set((s) => {
      const floorAreas = s.areas.filter((a) => (a.floor ?? 'Unassigned') === floor);
      const completed = floorAreas.filter((a) => a.status === 'completed').length;
      const progressPct = floorAreas.length > 0 ? Math.round((completed / floorAreas.length) * 100) : 0;
      const blockedCount = floorAreas.filter((a) => a.status === 'blocked').length;
      const gateHealth = computeGateHealth(floorAreas, s.phases, s.templatePhases);

      const newFloors = s.floors.map((f) =>
        f.floor === floor ? { ...f, areas: floorAreas, progressPct, blockedCount, ...gateHealth } : f,
      );

      const allAreas = s.areas;
      return {
        floors: newFloors,
        totalAreas: allAreas.length,
        completedAreas: allAreas.filter((a) => a.status === 'completed').length,
        blockedAreas: allAreas.filter((a) => a.status === 'blocked').length,
        inProgressAreas: allAreas.filter((a) => a.status === 'in_progress').length,
      };
    });
  },
}));
