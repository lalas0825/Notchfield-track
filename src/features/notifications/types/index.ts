/**
 * Sprint 69 — Notification row shape.
 *
 * Matches the `notifications` table schema Web is shipping. Track only
 * READS rows scoped to the current user (recipient_id = me) via the
 * by_user PowerSync bucket.
 */

import type { NotificationEventType } from '../services/eventRegistry';

export type Severity = 'info' | 'warning' | 'critical';

export type Notification = {
  id: string;
  organization_id: string;
  recipient_id: string;
  type: NotificationEventType;
  entity_type: string | null;
  entity_id: string | null;
  project_id: string | null;
  title: string;
  body: string | null;
  /** Lucide-style icon name. Mapped to Ionicons via iconMapper. */
  icon: string;
  severity: Severity;
  /**
   * Web URL the notification points at, e.g.
   * `/projects/abc/pm/ready-board?area=xyz`. Track parses and converts
   * to a local route in the tap handler.
   */
  link_url: string | null;
  read_at: string | null;
  archived_at: string | null;
  email_sent_at: string | null;
  push_sent_at: string | null;
  created_at: string;
};
