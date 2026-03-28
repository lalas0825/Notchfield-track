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
  requires_inspection: boolean;
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

type FloorGroup = {
  floor: string;
  areas: ProductionArea[];
  progressPct: number;
};

type ProductionState = {
  areas: ProductionArea[];
  phases: Map<string, PhaseProgress[]>; // area_id → phases
  templatePhases: TemplatePhase[];
  floors: FloorGroup[];
  loading: boolean;
  // Counts
  totalAreas: number;
  completedAreas: number;
  blockedAreas: number;
  inProgressAreas: number;
};

type ProductionActions = {
  fetchAll: (projectId: string, organizationId: string) => Promise<void>;
  markAreaStatus: (areaId: string, status: string, blockedReason?: string) => Promise<{ success: boolean; error?: string }>;
  updatePhaseProgress: (progressId: string, updates: Partial<PhaseProgress>) => Promise<{ success: boolean; error?: string }>;
  getAreaPhases: (areaId: string) => PhaseProgress[];
};

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

  fetchAll: async (projectId: string, organizationId: string) => {
    set({ loading: true });

    // Batch: areas + phase progress + template phases
    const [areasRes, progressRes, templatePhasesRes] = await Promise.all([
      supabase
        .from('production_areas')
        .select('*')
        .eq('project_id', projectId)
        .order('floor')
        .order('name'),
      supabase
        .from('production_phase_progress')
        .select('*')
        .eq('organization_id', organizationId),
      supabase
        .from('production_template_phases')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sequence'),
    ]);

    const areas = (areasRes.data ?? []) as ProductionArea[];
    const allProgress = (progressRes.data ?? []) as PhaseProgress[];
    const templatePhases = (templatePhasesRes.data ?? []) as TemplatePhase[];

    // Build phase map: area_id → PhaseProgress[]
    const phaseMap = new Map<string, PhaseProgress[]>();
    for (const p of allProgress) {
      if (!phaseMap.has(p.area_id)) phaseMap.set(p.area_id, []);
      phaseMap.get(p.area_id)!.push(p);
    }

    // Group by floor
    const floorMap = new Map<string, ProductionArea[]>();
    for (const area of areas) {
      const floor = area.floor ?? 'Unassigned';
      if (!floorMap.has(floor)) floorMap.set(floor, []);
      floorMap.get(floor)!.push(area);
    }

    const floors: FloorGroup[] = [...floorMap.entries()].map(([floor, floorAreas]) => {
      const completed = floorAreas.filter((a) => a.status === 'complete').length;
      const progressPct = floorAreas.length > 0 ? Math.round((completed / floorAreas.length) * 100) : 0;
      return { floor, areas: floorAreas, progressPct };
    });

    // Counts
    const totalAreas = areas.length;
    const completedAreas = areas.filter((a) => a.status === 'complete').length;
    const blockedAreas = areas.filter((a) => a.status === 'blocked').length;
    const inProgressAreas = areas.filter((a) => a.status === 'in_progress').length;

    set({
      areas,
      phases: phaseMap,
      templatePhases,
      floors,
      loading: false,
      totalAreas,
      completedAreas,
      blockedAreas,
      inProgressAreas,
    });
  },

  markAreaStatus: async (areaId: string, status: string, blockedReason?: string) => {
    const updates: Record<string, unknown> = { status };

    if (status === 'blocked') {
      updates.blocked_reason = blockedReason ?? null;
      updates.blocked_at = new Date().toISOString();
    } else if (status === 'in_progress' && !get().areas.find((a) => a.id === areaId)?.started_at) {
      updates.started_at = new Date().toISOString();
      updates.blocked_reason = null;
      updates.blocked_at = null;
      updates.blocked_resolved_at = new Date().toISOString();
    } else if (status === 'complete') {
      updates.completed_at = new Date().toISOString();
      updates.blocked_reason = null;
    }

    const { error } = await supabase
      .from('production_areas')
      .update(updates)
      .eq('id', areaId);

    if (error) return { success: false, error: error.message };

    // Optimistic update
    set((s) => ({
      areas: s.areas.map((a) =>
        a.id === areaId ? { ...a, ...updates } as ProductionArea : a,
      ),
    }));

    return { success: true };
  },

  updatePhaseProgress: async (progressId: string, updates: Partial<PhaseProgress>) => {
    const { error } = await supabase
      .from('production_phase_progress')
      .update(updates)
      .eq('id', progressId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getAreaPhases: (areaId: string) => {
    return get().phases.get(areaId) ?? [];
  },
}));
