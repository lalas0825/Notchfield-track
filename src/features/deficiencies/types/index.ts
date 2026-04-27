/**
 * Sprint 71 — Deficiency row + library row shape.
 *
 * Mirrors Web's `deficiencies` and `deficiency_library` tables verbatim
 * (Web Sprint 71 spec, src/features/pm/types.ts). Track only READS rows
 * scoped to the current org via the by_org PowerSync bucket; sync filter
 * excludes status='closed' to keep the local payload small.
 *
 * The DB CHECK constraints on `severity`, `stage`, `responsibility`, and
 * `status` reject any value not in the union below — Track must NOT
 * invent new enum values; coordinate with Web before adding.
 */

export type DeficiencyStage =
  | 'internal_qc'        // foreman-driven QC during work
  | 'gc_inspection'      // GC walk
  | 'punch_list'         // formal punch list at substantial completion
  | 'warranty_callback'; // post-handover

export type DeficiencySeverity = 'cosmetic' | 'minor' | 'major' | 'critical';

export type DeficiencyResponsibility =
  | 'own'           // we caused it
  | 'other_trade'   // another trade caused it
  | 'gc'            // GC-attributable (e.g. damage post-installation)
  | 'unknown';      // foreman can't tell — PM updates later

export type DeficiencyStatus =
  | 'open'         // newly reported, awaiting foreman action
  | 'in_progress'  // foreman started fixing
  | 'resolved'     // foreman uploaded after-photos; awaiting PM verification
  | 'verified'     // PM verified the resolution
  | 'closed';      // closed (filtered out of Track's sync)

export type Deficiency = {
  id: string;
  organization_id: string;
  project_id: string;
  area_id: string;
  /** production_area_objects.id, nullable — Phase 1 doesn't set this. */
  surface_id: string | null;
  title: string;
  description: string | null;
  severity: DeficiencySeverity;
  stage: DeficiencyStage;
  responsibility: DeficiencyResponsibility;
  trade: string | null;
  category: string | null;
  library_id: string | null;
  status: DeficiencyStatus;
  photos: string[];
  resolution_photos: string[];
  assigned_to: string | null;
  created_by: string;
  resolved_at: string | null;
  resolved_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejected_reason: string | null;
  closed_at: string | null;
  estimated_cost_cents: number | null;
  billed_amount_cents: number | null;
  /** Drawing pin coords (PDF points). Phase 1 leaves null; drawing viewer
   * integration is a Phase 2 task per the spec. */
  plan_x: number | null;
  plan_y: number | null;
  drawing_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DeficiencyLibrary = {
  id: string;
  /** null = global template (shared across orgs). */
  organization_id: string | null;
  trade: string;
  category: string;
  default_title: string;
  default_severity: DeficiencySeverity;
  description: string | null;
  acceptance_criteria: string | null;
  typical_resolution: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Numeric severity order for sorting (smaller = more urgent). */
export const SEVERITY_ORDER: Record<DeficiencySeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  cosmetic: 3,
};

/** UI tints per severity — used by the row component + header chips. */
export const SEVERITY_COLOR: Record<DeficiencySeverity, string> = {
  critical: '#EF4444',
  major: '#F59E0B',
  minor: '#3B82F6',
  cosmetic: '#94A3B8',
};

export const SEVERITY_LABEL: Record<DeficiencySeverity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  cosmetic: 'Cosmetic',
};

export const STATUS_LABEL: Record<DeficiencyStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved · Awaiting Verification',
  verified: 'Verified',
  closed: 'Closed',
};

export const RESPONSIBILITY_LABEL: Record<DeficiencyResponsibility, string> = {
  own: 'Our work',
  other_trade: 'Other trade',
  gc: 'GC-caused',
  unknown: 'Unknown',
};
