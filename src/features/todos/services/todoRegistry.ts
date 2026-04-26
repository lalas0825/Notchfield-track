/**
 * Sprint 70 — Todo type registry.
 *
 * Web team owns the canonical TodoType union (DB CHECK constraint on
 * `todos.type`). Track keeps a registry of KNOWN types here for styling
 * (icon, default priority, role hint). When PowerSync delivers a todo
 * with an unknown type, the resolver falls back to a neutral default —
 * the row still renders, just with the generic clipboard icon.
 *
 * Track must coordinate with Web before adding a new entry to this map:
 * a Track-side type that doesn't exist on Web's enum can never be created
 * via /api/todos/create, and Web's auto-creation triggers won't write it
 * either. The registry is descriptive, not authoritative.
 *
 * This is the Track-known subset of Web Sprint 70 § 3 — full verbatim copy
 * pending Web team handoff. The 8 entries below cover the mock data set
 * and the cases the spec explicitly calls out (block_escalation_4h,
 * sst_expiring_crew, surface_progress_stale, etc).
 */

import type { TodoPriority } from '../types';

export type TodoRole = 'pm' | 'foreman' | 'supervisor' | 'any';

export type TodoTypeDefinition = {
  /** Stable string id — matches Web's TodoType union. */
  type: string;
  /** Lucide-style icon name. Mapped to Ionicons via iconMapper.ts. */
  icon: string;
  /** Default priority if none is set on the row (Web is authoritative). */
  defaultPriority: TodoPriority;
  /** Which role typically owns this todo. Used to filter the supervisor
   * Compliance screen vs the foreman Today screen. */
  role: TodoRole;
  /** i18n key for the title (Web translates server-side; Track only uses
   * the key as a hint when Web doesn't fill `title`). */
  titleKey: string;
};

/**
 * Default style for unknown todo types. Track never crashes on a type
 * Web added between sprints — the row renders with a neutral clipboard
 * icon and the row's own `priority` field (NOT the registry default).
 */
export const DEFAULT_TODO_DEFINITION: TodoTypeDefinition = {
  type: 'unknown',
  icon: 'check-square',
  defaultPriority: 'normal',
  role: 'any',
  titleKey: 'todoUnknownTitle',
};

export const TODO_TYPES: Record<string, TodoTypeDefinition> = {
  // —— Foreman ——
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
  daily_report_submit: {
    type: 'daily_report_submit',
    icon: 'file-text',
    defaultPriority: 'normal',
    role: 'foreman',
    titleKey: 'dailyReportSubmitTitle',
  },

  // —— Supervisor ——
  block_escalation_4h: {
    type: 'block_escalation_4h',
    icon: 'alert-octagon',
    defaultPriority: 'critical',
    role: 'supervisor',
    titleKey: 'blockEscalation4hTitle',
  },
  sst_expiring_crew: {
    type: 'sst_expiring_crew',
    icon: 'id-card',
    defaultPriority: 'high',
    role: 'supervisor',
    titleKey: 'sstExpiringCrewTitle',
  },
  foreman_missed_daily_report: {
    type: 'foreman_missed_daily_report',
    icon: 'clipboard-x',
    defaultPriority: 'high',
    role: 'supervisor',
    titleKey: 'foremanMissedDailyReportTitle',
  },
  worker_intake_pending: {
    type: 'worker_intake_pending',
    icon: 'user-plus',
    defaultPriority: 'normal',
    role: 'supervisor',
    titleKey: 'workerIntakePendingTitle',
  },

  // —— Manual (any role) ——
  manual: {
    type: 'manual',
    icon: 'sticky-note',
    defaultPriority: 'normal',
    role: 'any',
    titleKey: 'manualTodoTitle',
  },
};

/** Resolve a type to its definition, falling back to DEFAULT for unknowns. */
export function resolveTodoType(type: string): TodoTypeDefinition {
  return TODO_TYPES[type] ?? DEFAULT_TODO_DEFINITION;
}
