/**
 * Sprint 53A — usePushPermission hook.
 * Mounted once at the app root. Manages the lifecycle:
 *   - On auth ready: check permission status
 *   - If undetermined: prompt the system permission flow
 *   - If granted: register/refresh the device token
 *   - On sign-out: unregister
 *
 * Also installs the deep-link handler for notification taps.
 */

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  getPushPermissionStatus,
  requestPushPermission,
  registerDeviceToken,
  refreshIfStale,
  unregisterDeviceToken,
} from '../services/pushTokenService';
import { handleNotificationResponse } from '../handlers/messageNotificationHandler';
import { logger } from '@/shared/lib/logger';

// Foreground behavior — show banner + sound while app is active.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushPermission() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const lastUserIdRef = useRef<string | null>(null);

  // (1) Auth state change → register or unregister
  useEffect(() => {
    if (!user || !profile) {
      // Sign-out path — deactivate this device's token if we have one
      if (lastUserIdRef.current) {
        unregisterDeviceToken(lastUserIdRef.current).catch(() => undefined);
        lastUserIdRef.current = null;
      }
      return;
    }

    const authedUserId = user.id;
    lastUserIdRef.current = authedUserId;

    (async () => {
      const status = await getPushPermissionStatus();

      if (status === 'undetermined') {
        // First time — prompt. iOS shows the system alert; Android 13+ does too.
        const newStatus = await requestPushPermission();
        if (newStatus === 'granted') {
          await registerDeviceToken({ userId: authedUserId, organizationId: profile.organization_id });
        } else {
          logger.info('[Push] user did not grant permission');
        }
      } else if (status === 'granted') {
        await refreshIfStale({ userId: authedUserId, organizationId: profile.organization_id });
      }
      // 'denied' → do nothing; user can re-enable from system Settings
    })().catch((e) => logger.warn('[Push] permission flow failed', e));
  }, [user, profile]);

  // (2) AppState foreground → refresh if stale
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && user && profile) {
        refreshIfStale({ userId: user.id, organizationId: profile.organization_id }).catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [user, profile]);

  // (3) Deep link on notification tap
  useEffect(() => {
    // Cold start — was the app launched by tapping a notification?
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    // Warm tap — app already running
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });
    return () => sub.remove();
  }, []);
}
