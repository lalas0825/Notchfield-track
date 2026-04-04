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
