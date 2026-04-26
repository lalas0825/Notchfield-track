/**
 * Sprint 70 — Date / due-date helpers for todo rows.
 *
 * No date-fns in the project; these are the house helpers for todo
 * formatting. All times are LOCAL — pilot is one timezone (Jantile, NYC).
 * If we ever go multi-tz, swap to luxon and pass profile.timezone in.
 */

const MS_DAY = 24 * 3600 * 1000;

/**
 * Format a due_date string ("YYYY-MM-DD" or full ISO) for display.
 * Returns: "Due today" / "Due tomorrow" / "Overdue Nd" / "Due MM/DD".
 */
export function formatDueLabel(dueDate: string | null): string | null {
  if (!dueDate) return null;
  // Treat date-only inputs as midnight LOCAL (NOT UTC) so a same-day due
  // doesn't accidentally render as "tomorrow" in EST.
  const due = new Date(dueDate.length === 10 ? `${dueDate}T00:00:00` : dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / MS_DAY);

  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays === -1) return 'Overdue 1d';
  if (diffDays < -1) return `Overdue ${Math.abs(diffDays)}d`;
  if (diffDays < 7) return `Due in ${diffDays}d`;
  // Older — MM/DD US format (project memory project_jantile_pdf_format.md)
  const mm = String(dueMidnight.getMonth() + 1).padStart(2, '0');
  const dd = String(dueMidnight.getDate()).padStart(2, '0');
  return `Due ${mm}/${dd}`;
}

/** True when the date is today or in the past. */
export function isOverdueOrToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate.length === 10 ? `${dueDate}T00:00:00` : dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueMidnight.getTime() <= todayMidnight.getTime();
}

/** Snooze preset → ISO timestamp. */
export type SnoozePreset = '1h' | 'eod' | 'tomorrow_6am';

export function snoozePresetToIso(preset: SnoozePreset, now: Date = new Date()): string {
  const d = new Date(now.getTime());
  if (preset === '1h') {
    d.setHours(d.getHours() + 1);
    return d.toISOString();
  }
  if (preset === 'eod') {
    // 5 PM today, or 5 PM tomorrow if past 5
    d.setHours(17, 0, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  // tomorrow_6am
  d.setDate(d.getDate() + 1);
  d.setHours(6, 0, 0, 0);
  return d.toISOString();
}

/** Header date label: "Today · Wed Apr 26" — used by TodayScreen header. */
export function formatTodayHeader(now: Date = new Date()): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
}
