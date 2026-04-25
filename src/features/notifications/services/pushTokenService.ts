/**
 * Sprint 53A — Push notification token registration.
 *
 * Lifecycle:
 *   1. App foreground after auth ready  → registerDeviceToken()
 *      - Asks Expo for the device's push token (Android channel ensured)
 *      - Upserts into device_tokens (UNIQUE on user_id + token de-dupes)
 *   2. Sign out                          → unregisterDeviceToken()
 *      - Sets active=false on this device's tokens
 *   3. App foreground if token > 7d old  → refreshIfStale()
 *      - Re-registers in case Apple/Google rotated the token
 *
 * The fanout-field-message Edge Function reads from device_tokens directly
 * via service-role and ignores RLS, so we never need to expose tokens
 * cross-user.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';

const STALE_AFTER_MS = 7 * 24 * 3600 * 1000; // 7 days

/**
 * Ensure the Android default channel exists (no-op on iOS).
 * Must run before any notification is posted on Android.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F97316',
    enableVibrate: true,
    sound: 'default',
  });
}

/**
 * Get the Expo push token for this device. Returns null if not on a real
 * device, or if the user denied permissions.
 *
 * NOTE: This does NOT prompt for permission — call requestPushPermission()
 * first.
 */
async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    logger.info('[Push] not a real device, skipping token registration');
    return null;
  }

  await ensureAndroidChannel();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

  if (!projectId) {
    logger.warn('[Push] EAS projectId missing, cannot fetch Expo token');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (e) {
    logger.warn('[Push] failed to fetch Expo push token', e);
    return null;
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/**
 * Check current permission status without prompting.
 */
export async function getPushPermissionStatus(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

/**
 * Prompt for permission. Returns the resulting state.
 * On Android 13+ this is required; on older Android it auto-grants.
 * On iOS it shows the system alert exactly once per app lifetime.
 */
export async function requestPushPermission(): Promise<PermissionState> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return 'granted';
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

/**
 * Register or refresh the device token for the signed-in user.
 * Idempotent — safe to call on every app foreground when authed.
 */
export async function registerDeviceToken(params: {
  userId: string;
  organizationId: string;
}): Promise<{ registered: boolean; token?: string; reason?: string }> {
  const status = await getPushPermissionStatus();
  if (status !== 'granted') {
    return { registered: false, reason: `permission ${status}` };
  }

  const token = await getExpoPushToken();
  if (!token) return { registered: false, reason: 'token unavailable' };

  // Upsert via Supabase (NOT PowerSync — token writes need to hit server fast,
  // and the unique constraint resolves dupes server-side reliably).
  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id: params.userId,
        organization_id: params.organizationId,
        expo_push_token: token,
        device_id: Device.osInternalBuildId ?? null,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        app_version: Constants.expoConfig?.version ?? null,
        active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_push_token' },
    );

  if (error) {
    logger.warn('[Push] device_tokens upsert failed', error);
    return { registered: false, reason: error.message };
  }

  logger.info('[Push] device token registered');
  return { registered: true, token };
}

/**
 * On sign-out: deactivate all of this user's tokens for THIS device.
 * Other devices the user is signed into stay active (each device has its
 * own row).
 */
export async function unregisterDeviceToken(userId: string): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;

  const { error } = await supabase
    .from('device_tokens')
    .update({ active: false })
    .eq('user_id', userId)
    .eq('expo_push_token', token);

  if (error) logger.warn('[Push] unregister failed', error);
  else logger.info('[Push] device token deactivated');
}

/**
 * If the local token row is older than STALE_AFTER_MS, re-register.
 * Cheap call — uses local PowerSync read first so most app-foreground
 * checks return instantly with no network.
 */
export async function refreshIfStale(params: {
  userId: string;
  organizationId: string;
}): Promise<void> {
  const rows = await localQuery<{ last_seen_at: string }>(
    `SELECT last_seen_at FROM device_tokens
       WHERE user_id = ? AND active = 1
       ORDER BY last_seen_at DESC
       LIMIT 1`,
    [params.userId],
  );

  const lastSeen = rows?.[0]?.last_seen_at;
  if (lastSeen) {
    const ageMs = Date.now() - new Date(lastSeen).getTime();
    if (ageMs < STALE_AFTER_MS) return; // Fresh enough, skip
  }

  await registerDeviceToken(params);
}
