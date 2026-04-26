/**
 * Sprint 70 — Todos Hub row shape.
 *
 * Mirrors Web's `todos` table (created in Web Sprint 70 W1). Track only
 * READS rows scoped to the current user (owner_profile_id = me) via the
 * by_user PowerSync bucket; status filter excludes done/dismissed so the
 * local SQLite payload stays small.
 *
 * The `type` field is loosely typed as a string (not `TodoType`) because
 * Web may add new types between sprints. Track's todoRegistry.ts maps
 * KNOWN types to icon + default priority; unknown types fall back to a
 * neutral default style. The DB CHECK constraint lives on Web's side.
 */

export type TodoStatus =
  | 'pending'
  | 'in_progress'
  | 'snoozed'
  | 'done'         // sync rule excludes — kept for completeness
  | 'dismissed';   // sync rule excludes — kept for completeness

export type TodoPriority = 'critical' | 'high' | 'normal' | 'low';

export type TodoSource = 'auto_event' | 'auto_cron' | 'manual';

/** Web team's canonical TodoType union. Track keeps a registry of known
 * types in services/todoRegistry but accepts any string from PowerSync —
 * the DB enforces the set, not Track. */
export type TodoType = string;

export type Todo = {
  id: string;
  organization_id: string;
  owner_profile_id: string;
  type: TodoType;
  entity_type: string | null;
  entity_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  link_url: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  /** YYYY-MM-DD or full ISO. Track's UI shows date-only when no time. */
  due_date: string | null;
  snooze_until: string | null;
  done_at: string | null;
  done_by: string | null;
  dismissed_at: string | null;
  source: TodoSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Numeric priority order (smaller = more urgent) for sorting. */
export const PRIORITY_ORDER: Record<TodoPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};
