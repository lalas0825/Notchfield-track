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
  total_quantity_sf?: number | null;
  takeoff_quantity?: number | null; // joined from takeoff_objects.quantity
  unit?: string | null;
}

/**
 * Resolve the SF for a surface. Prefers production_area_objects.quantity_sf,
 * then total_quantity_sf, then the joined takeoff_objects.quantity.
 */
function surfaceSf(s: SurfaceRow): number {
  return (
    (s.quantity_sf && s.quantity_sf > 0 ? s.quantity_sf : 0) ||
    (s.total_quantity_sf && s.total_quantity_sf > 0 ? s.total_quantity_sf : 0) ||
    (s.takeoff_quantity && s.takeoff_quantity > 0 ? s.takeoff_quantity : 0)
  );
}

/**
 * Calculate surface progress using strict SF-weighted formula.
 * Only fully completed surfaces count — no partial credit for in_progress.
 * A 1,280 SF wall counts more than a 6 SF saddle.
 */
export function calculateSurfaceProgress(surfaces: SurfaceRow[]): number {
  const totalSf = surfaces.reduce((sum, s) => sum + surfaceSf(s), 0);
  if (totalSf === 0) return 0;

  const completedSf = surfaces
    .filter((s) => s.status === 'completed' || s.status === 'complete')
    .reduce((sum, s) => sum + surfaceSf(s), 0);
  return completedSf / totalSf;
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
