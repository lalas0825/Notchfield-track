/**
 * Progress Calculation — sqft-weighted with binary phase support.
 * Uses phase_progress table (Sprint 23) with target_sf + completed_sf.
 */

export interface PhaseProgressRow {
  id: string;
  area_id: string;
  phase_id: string;
  status: string; // 'not_started' | 'in_progress' | 'blocked' | 'complete' | 'skipped'
  target_sf: number | null;
  completed_sf: number | null;
  started_at: string | null;
  completed_at: string | null;
  blocked_reason: string | null;
  verified_at: string | null;
  verified_by: string | null;
  completed_by: string | null;
  // Joined from production_template_phases
  phase_name?: string;
  sequence?: number;
  is_binary?: boolean;
  binary_weight?: number;
  requires_inspection?: boolean;
  depends_on_phase?: number | null;
}

/**
 * Calculate area progress from phase_progress rows.
 * Binary phases contribute binary_weight (default 20) to total.
 * Returns 0-1 ratio.
 */
export function calculateProgress(phases: PhaseProgressRow[]): number {
  let totalTarget = 0;
  let totalCompleted = 0;

  for (const p of phases) {
    if (p.is_binary) {
      const weight = p.binary_weight || 20;
      totalTarget += weight;
      totalCompleted += p.status === 'complete' ? weight : 0;
    } else {
      totalTarget += p.target_sf || 0;
      totalCompleted += p.completed_sf || 0;
    }
  }

  return totalTarget > 0 ? totalCompleted / totalTarget : 0;
}

/**
 * Determine if a phase is locked.
 * Locked when previous phase is not complete, or if previous phase
 * is a gate (requires_inspection) and not verified.
 */
export function isPhaseLockedFn(
  phase: PhaseProgressRow,
  allPhases: PhaseProgressRow[],
): boolean {
  if (!phase.sequence || phase.sequence <= 1) return false;
  if (phase.status === 'complete' || phase.status === 'skipped') return false;

  // Find previous phase by sequence
  const prevPhase = allPhases.find((p) => p.sequence === (phase.sequence! - 1));
  if (!prevPhase) return false;

  // Previous not complete → locked
  if (prevPhase.status !== 'complete' && prevPhase.status !== 'skipped') return true;

  // Previous is a gate and not verified → locked
  if (prevPhase.requires_inspection && !prevPhase.verified_at) return true;

  return false;
}

// ─── Surface-level progress (sqft-weighted) ───────────────

export interface SurfaceRow {
  id: string;
  status?: string;
  quantity_sf?: number | null;
  unit?: string | null;
}

/**
 * Calculate surface progress using sqft-weighted formula.
 * A 1,280 SF wall counts more than a 6 SF saddle.
 * PCS/EA items without sqft get a fixed weight of 20.
 */
export function calculateSurfaceProgress(surfaces: SurfaceRow[]): number {
  let totalSf = 0;
  let completedSf = 0;

  for (const s of surfaces) {
    const sf = s.quantity_sf ?? 0;
    if (sf > 0) {
      totalSf += sf;
      if (s.status === 'completed' || s.status === 'complete') {
        completedSf += sf;
      }
    }
  }

  // PCS/EA items without sqft get fixed weight
  const pcsItems = surfaces.filter((s) => !s.quantity_sf || s.quantity_sf <= 0);
  if (pcsItems.length > 0) {
    const PCS_WEIGHT = 20;
    totalSf += pcsItems.length * PCS_WEIGHT;
    completedSf += pcsItems.filter((s) => s.status === 'completed' || s.status === 'complete').length * PCS_WEIGHT;
  }

  return totalSf > 0 ? completedSf / totalSf : 0;
}

/**
 * Combined area progress: prefer phases, fallback to surfaces.
 * Returns 0-1 ratio.
 */
export function calculateAreaProgress(
  phases: PhaseProgressRow[],
  surfaces: SurfaceRow[],
): number {
  if (phases.length > 0) {
    return calculateProgress(phases);
  }
  return calculateSurfaceProgress(surfaces);
}
