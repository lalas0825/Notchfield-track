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
  /** Sprint 69 / 71 — generic entity link for routing notification taps
   * to the right screen. Web's notify() pipeline sets these alongside
   * `kind` so Track can deep-link without bespoke fields per type. */
  entity_type?: string;
  entity_id?: string;
};

export function handleNotificationResponse(response: NotificationResponse) {
  const data = (response.notification.request.content.data ?? {}) as NotificationData;
  if (!data.kind) return;

  if (data.kind === 'field_message') {
    if (data.area_id) {
      // Per-area message → deep-link to that area's Board detail.
      // Defer to next tick to give expo-router time to mount on cold start.
      setTimeout(() => {
        try {
          router.push(`/(tabs)/board/${data.area_id}` as any);
        } catch (e) {
          logger.warn('[Push] deep-link navigate failed', e);
        }
      }, 50);
    } else {
      // Sprint 53A.1 — Project-level General channel message.
      // Previously routed to /home which left the user wondering "where's
      // the message?" since Home has no thread surface. Now lands directly
      // on the Messages tab (rooted at /messages = General channel screen
      // since the route file is messages/index.tsx).
      setTimeout(() => {
        try {
          router.push('/(tabs)/messages' as any);
        } catch (e) {
          logger.warn('[Push] deep-link navigate failed', e);
        }
      }, 50);
    }
    return;
  }

  // Sprint 71 Phase 2 — Deficiency notifications (deficiency_critical
  // sent to PMs when severity=critical; deficiency_resolved sent to PMs
  // when foreman resolves). Both deep-link to the deficiency detail
  // screen which surfaces Verify/Reject for supervisors automatically.
  if (data.kind === 'deficiency_critical' || data.kind === 'deficiency_resolved') {
    const id = data.entity_id;
    if (id) {
      setTimeout(() => {
        try {
          router.push(`/(tabs)/board/deficiency/${id}` as any);
        } catch (e) {
          logger.warn('[Push] deficiency deep-link navigate failed', e);
        }
      }, 50);
    }
    return;
  }

  // Sprint 69 generic fallback — if the push has entity_type='deficiency'
  // but the kind doesn't match the explicit cases above (e.g. Web adds a
  // new deficiency-related notification type later), still route to the
  // detail screen rather than dropping the tap on the floor.
  if (data.entity_type === 'deficiency' && data.entity_id) {
    setTimeout(() => {
      try {
        router.push(`/(tabs)/board/deficiency/${data.entity_id}` as any);
      } catch (e) {
        logger.warn('[Push] deficiency entity deep-link failed', e);
      }
    }, 50);
    return;
  }

  // Sprint 72 — sign-off lifecycle pushes (signoff_signed, signoff_declined).
  // Both default to push:true. Tap routes to the detail screen which
  // surfaces appropriate actions per status (View PDF if signed, re-create
  // if declined). The signature_due todo path is handled via the Today
  // tab tap handler — push for that one only fires for non-internal
  // recipients which Track wouldn't receive anyway.
  if (
    data.kind === 'signoff_signed' ||
    data.kind === 'signoff_declined' ||
    data.kind === 'signoff_request_sent'
  ) {
    const id = data.entity_id;
    if (id) {
      setTimeout(() => {
        try {
          router.push(`/(tabs)/board/signoff/${id}` as any);
        } catch (e) {
          logger.warn('[Push] signoff deep-link navigate failed', e);
        }
      }, 50);
    }
    return;
  }

  // Generic entity fallback (mirrors deficiency case above).
  if (data.entity_type === 'signoff' && data.entity_id) {
    setTimeout(() => {
      try {
        router.push(`/(tabs)/board/signoff/${data.entity_id}` as any);
      } catch (e) {
        logger.warn('[Push] signoff entity deep-link failed', e);
      }
    }, 50);
    return;
  }

  // Future: legal documents, punch items, delivery alerts, etc.
}
