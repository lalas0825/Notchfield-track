/**
 * Sprint 69 — Relative time helper for notification rows.
 *
 * Returns terse strings: "now", "5m", "3h", "Yesterday", "2d", "Mar 15".
 * Designed for the right-aligned timestamp on a notification row — fits in
 * ~50dp regardless of language.
 *
 * Track doesn't have date-fns; this file is the project's house helper for
 * notification timestamps. Bucketed thresholds (not minute-perfect) so the
 * UI doesn't churn on every render.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = now - t;

  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;

  // Older than a week — show MM/DD (US format, matches project memory
  // project_jantile_pdf_format.md)
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * Group key for the notifications list ("Today" / "Yesterday" / "This week"
 * / "Older"). Used by the NotificationsScreen section grouping.
 */
export function groupBucket(iso: string, now: number = Date.now()): 'today' | 'yesterday' | 'week' | 'older' {
  const t = new Date(iso).getTime();
  const diff = now - t;
  if (diff < DAY) return 'today';
  if (diff < 2 * DAY) return 'yesterday';
  if (diff < 7 * DAY) return 'week';
  return 'older';
}
