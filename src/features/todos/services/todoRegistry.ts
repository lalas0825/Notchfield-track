/**
 * Sprint 70 — Todo type registry.
 *
 * Web team owns the canonical TodoType union. The DB CHECK constraint on
 * `todos.type` enforces alignment — any type Track invents that isn't in
 * Web's enum will fail to INSERT. Track keeps a registry here for STYLING
 * (icon, default priority, role hint). Unknown types fall back to a
 * neutral default so the row still renders with the generic clipboard
 * icon — never crashes.
 *
 * 17 Phase 1 types per Web's SPRINT_70_TODOS_HUB.md §3 (commit `bfdee08`):
 *   PM (8):
 *     rfi_response_due, submittal_review_due, co_approval_due,
 *     gate_verification_due, block_resolution_due, ptp_distribute_due,
 *     punch_item_due, bid_response_due
 *   Foreman (5):
 *     ptp_sign_today, crew_assign_today, surface_progress_stale,
 *     block_unresolved_self, daily_report_submit
 *   Supervisor (4):
 *     sst_expiring_crew, block_escalation_4h, worker_intake_pending,
 *     foreman_missed_report
 *   Manual: manual
 *
 * Icons / default priorities below are Track's best-fit pending verbatim
 * sync with Web's todoRegistry.ts:51-235 (commit `bfdee08`). DB-side
 * priority on each row is authoritative — defaultPriority here is only
 * the visual fallback if a row arrives with `priority` somehow null.
 */

import type { TodoPriority } from '../types';

export type TodoRole = 'pm' | 'foreman' | 'supervisor' | 'any';

export type TodoTypeDefinition = {
  /** Stable string id — matches Web's TodoType union exactly. */
  type: string;
  /** Lucide-style icon name. Mapped to Ionicons via iconMapper.ts. */
  icon: string;
  /** Default priority if the row arrives without one. Web's row.priority
   * is authoritative when present. */
  defaultPriority: TodoPriority;
  /** Which role typically owns this todo. Hint only — Web's recipient
   * resolver is the source of truth for who actually gets it. */
  role: TodoRole;
  /** i18n key for the title. Track uses Web's row.title verbatim; this
   * key is for fallback strings + future translation. */
  titleKey: string;
};

/**
 * Default style for unknown todo types. Track never crashes on a type
 * Web added between sprints — the row renders with a clipboard icon and
 * its own `priority` field (NOT the registry default).
 */
export const DEFAULT_TODO_DEFINITION: TodoTypeDefinition = {
  type: 'unknown',
  icon: 'check-square',
  defaultPriority: 'normal',
  role: 'any',
  titleKey: 'todoUnknownTitle',
};

export const TODO_TYPES: Record<string, TodoTypeDefinition> = {
  // ━━━ PM (8) ━━━
  rfi_response_due: {
    type: 'rfi_response_due',
    icon: 'help-circle',
    defaultPriority: 'high',
    role: 'pm',
    titleKey: 'rfiResponseDueTitle',
  },
  submittal_review_due: {
    type: 'submittal_review_due',
    icon: 'file-text',
    defaultPriority: 'high',
    role: 'pm',
    titleKey: 'submittalReviewDueTitle',
  },
  co_approval_due: {
    type: 'co_approval_due',
    icon: 'pen-tool',
    defaultPriority: 'high',
    role: 'pm',
    titleKey: 'coApprovalDueTitle',
  },
  gate_verification_due: {
    type: 'gate_verification_due',
    icon: 'shield-alert',
    defaultPriority: 'high',
    role: 'pm',
    titleKey: 'gateVerificationDueTitle',
  },
  block_resolution_due: {
    type: 'block_resolution_due',
    icon: 'alert-octagon',
    defaultPriority: 'critical',
    role: 'pm',
    titleKey: 'blockResolutionDueTitle',
  },
  ptp_distribute_due: {
    type: 'ptp_distribute_due',
    icon: 'shield-check',
    defaultPriority: 'high',
    role: 'pm',
    titleKey: 'ptpDistributeDueTitle',
  },
  punch_item_due: {
    type: 'punch_item_due',
    icon: 'clipboard-x',
    defaultPriority: 'normal',
    role: 'pm',
    titleKey: 'punchItemDueTitle',
  },
  bid_response_due: {
    type: 'bid_response_due',
    icon: 'message-square',
    defaultPriority: 'high',
    role: 'pm',
    titleKey: 'bidResponseDueTitle',
  },

  // ━━━ Foreman (5) ━━━
  ptp_sign_today: {
    type: 'ptp_sign_today',
    icon: 'shield-check',
    defaultPriority: 'critical',
    role: 'foreman',
    titleKey: 'ptpSignTodayTitle',
  },
  crew_assign_today: {
    type: 'crew_assign_today',
    icon: 'users',
    defaultPriority: 'high',
    role: 'foreman',
    titleKey: 'crewAssignTodayTitle',
  },
  surface_progress_stale: {
    type: 'surface_progress_stale',
    icon: 'clock',
    defaultPriority: 'normal',
    role: 'foreman',
    titleKey: 'surfaceProgressStaleTitle',
  },
  block_unresolved_self: {
    type: 'block_unresolved_self',
    icon: 'alert-triangle',
    defaultPriority: 'high',
    role: 'foreman',
    titleKey: 'blockUnresolvedSelfTitle',
  },
  daily_report_submit: {
    type: 'daily_report_submit',
    icon: 'file-text',
    defaultPriority: 'normal',
    role: 'foreman',
    titleKey: 'dailyReportSubmitTitle',
  },

  // ━━━ Supervisor (4) ━━━
  sst_expiring_crew: {
    type: 'sst_expiring_crew',
    icon: 'id-card',
    defaultPriority: 'high',
    role: 'supervisor',
    titleKey: 'sstExpiringCrewTitle',
  },
  block_escalation_4h: {
    type: 'block_escalation_4h',
    icon: 'alert-octagon',
    defaultPriority: 'critical',
    role: 'supervisor',
    titleKey: 'blockEscalation4hTitle',
  },
  worker_intake_pending: {
    type: 'worker_intake_pending',
    icon: 'user-plus',
    defaultPriority: 'normal',
    role: 'supervisor',
    titleKey: 'workerIntakePendingTitle',
  },
  // Renamed from foreman_missed_daily_report (pre-Sprint-70 mock name)
  // to match Web's verbatim spec.
  foreman_missed_report: {
    type: 'foreman_missed_report',
    icon: 'clipboard-x',
    defaultPriority: 'high',
    role: 'supervisor',
    titleKey: 'foremanMissedReportTitle',
  },

  // ━━━ Manual (any role) ━━━
  manual: {
    type: 'manual',
    icon: 'sticky-note',
    defaultPriority: 'normal',
    role: 'any',
    titleKey: 'manualTodoTitle',
  },

  // ━━━ Sprint 71 Phase 2 — Deficiency-driven todos ━━━
  // Web's create endpoint generates these when a deficiency is reported
  // with assignedTo set; verify endpoint cascade-completes them; reject
  // recreates resolution_due fresh with title prefix "Fix again: ...".
  // Severity bumps priority server-side: critical→critical, major→high,
  // minor/cosmetic→normal.
  deficiency_resolution_due: {
    type: 'deficiency_resolution_due',
    icon: 'wrench',
    defaultPriority: 'high',
    role: 'foreman',
    titleKey: 'deficiencyResolutionDueTitle',
  },
  deficiency_verification_due: {
    type: 'deficiency_verification_due',
    icon: 'clipboard-check',
    defaultPriority: 'normal',
    role: 'pm',
    titleKey: 'deficiencyVerificationDueTitle',
  },
};

/** Resolve a type to its definition, falling back to DEFAULT for unknowns. */
export function resolveTodoType(type: string): TodoTypeDefinition {
  return TODO_TYPES[type] ?? DEFAULT_TODO_DEFINITION;
}
