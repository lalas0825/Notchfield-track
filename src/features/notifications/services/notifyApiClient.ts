/**
 * Sprint 69 — Web API client for Notifications Hub.
 *
 * Track does NOT compute recipients or insert directly into `notifications`.
 * Pattern (from SPRINT_TRACK_NOTIFICATIONS.md):
 *
 *   1. Track action succeeds (e.g. foreman signs PTP)
 *   2. Track POSTs intent to /api/notifications/notify
 *   3. Web's recipient resolver decides who gets in_app + email + push
 *   4. Web inserts notification rows scoped per-recipient
 *   5. PowerSync replicates to Track (read-only via by_user bucket)
 *
 * Track ALWAYS wraps notify calls in `.catch()` — notifications are
 * auxiliary, never block the user action. If the API is down, the foreman
 * still signs the PTP; only the PM doesn't get notified that one time.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { WEB_API_URL } from '@/shared/config/urls';
import { logger } from '@/shared/lib/logger';
import type { NotificationEventType } from './eventRegistry';

export type NotifyPayload = {
  type: NotificationEventType;
  entity: { type: string; id: string };
  projectId?: string;
  organizationId: string;
  /**
   * Current user's profile ID. Web's recipient resolver excludes this
   * from the recipient list so the actor doesn't get a notification
   * about their own action.
   */
  actorId?: string;
};

export type NotifyResult = {
  ok: true;
  inAppCount: number;
  emailQueued: number;
};

/**
 * POST a notification intent to Web. Auto-resolves the bearer token
 * from the current Supabase session.
 *
 * Returns the result on 2xx; throws on network error or non-2xx.
 * Callers should `.catch()` and log — never block the user action.
 */
export async function notifyViaWeb(payload: NotifyPayload): Promise<NotifyResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('notifyViaWeb: no auth session');
  }

  const url = `${WEB_API_URL}/api/notifications/notify`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`notifyViaWeb ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Convenience wrapper: fire-and-forget. Logs failures but never throws.
 * Use this from action handlers so notification API errors don't block
 * the user (per the "auxiliary, not blocking" rule from the handoff).
 *
 *   await someAction();
 *   notifyAndForget({ type: 'ptp_signed_to_pm', ... });
 *   // user UI continues regardless of notify outcome
 */
export function notifyAndForget(payload: NotifyPayload): void {
  notifyViaWeb(payload).catch((err) => {
    logger.warn('[notifications] notify failed (non-fatal)', err);
  });
}

/**
 * Mark a notification as read. PowerSync Realtime replicates the read_at
 * update back to local state so the badge count auto-decrements without
 * manual cache mutation.
 *
 * Like notify, wraps errors and never blocks user navigation.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    logger.warn('[notifications] markRead: no auth session');
    return;
  }

  const url = `${WEB_API_URL}/api/notifications/${notificationId}/read`;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn(`[notifications] markRead ${res.status}: ${err}`);
    }
  } catch (e) {
    logger.warn('[notifications] markRead network error', e);
  }
}
