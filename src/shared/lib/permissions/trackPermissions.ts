/**
 * Track Permission Service — Sprint 40C
 * =======================================
 * Single source of truth for role-based access in the Track app.
 *
 * Three roles use Track:
 *   - supervisor:  ALL features, scope = all assigned projects
 *   - foreman:     ALL features, scope = 1 project
 *   - worker:      Limited features, scope = 1 project + assigned areas only
 *
 * All other roles (admin, pm, estimator, warehouse) are web-only and
 * blocked from Track entirely at the login gate.
 */

export type TrackRole = 'supervisor' | 'foreman' | 'worker';

export type TrackFeature =
  | 'check_in'
  | 'ready_board'
  | 'phase_progress'
  | 'qc_photos'
  | 'delivery_confirmation'
  | 'assign_crews'
  | 'work_tickets'
  | 'safety_docs'
  | 'daily_reports'
  | 'plans_drawings';

export type ProjectScope =
  | { kind: 'all_assigned' } // supervisor — multi-project
  | { kind: 'single' } // foreman / worker
  | { kind: 'none' };

const TRACK_ROLES: TrackRole[] = ['supervisor', 'foreman', 'worker'];

/** Roles that map to a Track scope. Treat legacy synonyms as supervisor. */
const ROLE_ALIASES: Record<string, TrackRole> = {
  supervisor: 'supervisor',
  superintendent: 'supervisor',
  owner: 'supervisor',
  foreman: 'foreman',
  worker: 'worker',
  laborer: 'worker',
  mechanic: 'worker',
  helper: 'worker',
};

/** Returns the canonical TrackRole for a profile.role string, or null if web-only. */
export function normalizeTrackRole(role: string | null | undefined): TrackRole | null {
  if (!role) return null;
  return ROLE_ALIASES[role.toLowerCase()] ?? null;
}

/** True if the given profile role is allowed to use the Track app at all. */
export function isTrackRole(role: string | null | undefined): boolean {
  return normalizeTrackRole(role) !== null;
}

/** Permission matrix: which features each Track role can use. */
const FEATURE_MATRIX: Record<TrackRole, Record<TrackFeature, boolean>> = {
  supervisor: {
    check_in: true,
    ready_board: true,
    phase_progress: true,
    qc_photos: true,
    delivery_confirmation: true,
    assign_crews: true,
    work_tickets: true,
    safety_docs: true,
    daily_reports: true,
    plans_drawings: true,
  },
  foreman: {
    check_in: true,
    ready_board: true,
    phase_progress: true,
    qc_photos: true,
    delivery_confirmation: true, // limited to assigned DTs (enforced by query)
    assign_crews: true,
    work_tickets: true,
    safety_docs: true,
    daily_reports: true,
    plans_drawings: true,
  },
  worker: {
    check_in: true,
    ready_board: true,
    phase_progress: true,
    qc_photos: true,
    delivery_confirmation: false,
    assign_crews: false,
    work_tickets: false,
    safety_docs: false,
    daily_reports: false,
    plans_drawings: true,
  },
};

/** Returns true if the given role can use the given feature. */
export function canUseFeature(
  role: string | null | undefined,
  feature: TrackFeature,
): boolean {
  const normalized = normalizeTrackRole(role);
  if (!normalized) return false;
  return FEATURE_MATRIX[normalized][feature] ?? false;
}

/** Returns the project scope for the given role. */
export function getProjectScope(role: string | null | undefined): ProjectScope {
  const normalized = normalizeTrackRole(role);
  if (!normalized) return { kind: 'none' };
  if (normalized === 'supervisor') return { kind: 'all_assigned' };
  return { kind: 'single' };
}

/** All Track roles (for tests / debugging). */
export const TRACK_ROLES_LIST: readonly TrackRole[] = TRACK_ROLES;
