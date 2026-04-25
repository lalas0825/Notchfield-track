/**
 * Sprint 53A — Notification deep-link handler.
 *
 * Notification data shape (set by fanout-field-message Edge Function):
 *   {
 *     kind: 'field_message',
 *     message_id: uuid,
 *     area_id: uuid | null,
 *     project_id: uuid,
 *   }
 *
 * On tap:
 *   - field_message + area_id → navigate to /(tabs)/board/{area_id}
 *   - field_message + no area → navigate to /(tabs)/home (general channel
 *     surfaced there in a future sprint; for v1 just land on Home)
 *
 * Uses expo-router's `router` directly. If the app isn't ready yet (cold
 * start race), defer to next tick so the navigator has time to mount.
 */

import { router } from 'expo-router';
import type { NotificationResponse } from 'expo-notifications';
import { logger } from '@/shared/lib/logger';

type NotificationData = {
  kind?: string;
  message_id?: string;
  area_id?: string | null;
  project_id?: string;
};

export function handleNotificationResponse(response: NotificationResponse) {
  const data = (response.notification.request.content.data ?? {}) as NotificationData;
  if (!data.kind) return;

  if (data.kind === 'field_message') {
    if (data.area_id) {
      // Defer to next tick — gives expo-router time to mount on cold start
      setTimeout(() => {
        try {
          router.push(`/(tabs)/board/${data.area_id}` as any);
        } catch (e) {
          logger.warn('[Push] deep-link navigate failed', e);
        }
      }, 50);
    } else {
      setTimeout(() => router.push('/(tabs)/home' as any), 50);
    }
    return;
  }

  // Future: legal documents, punch items, delivery alerts, etc.
}
