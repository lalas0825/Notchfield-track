import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

type SyncState = 'connected' | 'syncing' | 'reconnecting' | 'offline';

/**
 * Subtle bar at the top of the app showing sync status.
 *
 *   connected (hidden)         everything OK, nothing to show
 *   syncing (amber)            connected AND uploading/downloading data
 *   reconnecting (slate)       briefly disconnected — still in retry window
 *                              (first 5s of disconnect)
 *   offline (slate, "Offline") sustained disconnect (>5s) — likely no network
 *
 * The reconnecting → offline transition is time-based: PowerSync's
 * `connecting` flag oscillates during retry backoff and isn't a reliable
 * "actually offline vs briefly dropped" signal on its own. A 5s threshold
 * gives transient drops (network handover, brief WiFi outage) the
 * "Reconnecting…" label without flicker, while sustained outages get the
 * honest "Offline" label users expect.
 *
 * Tap-to-retry (visible in both reconnecting + offline states) forces a
 * session refresh + PowerSync reconnect — useful for users who don't
 * want to wait for the next AppState foreground tick.
 */
export function SyncStatusBar() {
  const [syncState, setSyncState] = useState<SyncState>('connected');
  const [retrying, setRetrying] = useState(false);

  // Tracks when we transitioned INTO a disconnected state. Used to flip
  // 'reconnecting' → 'offline' after a sustained outage threshold.
  const disconnectedSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let unsubscribe: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    const OFFLINE_THRESHOLD_MS = 5000;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { powerSync } = require('@/shared/lib/powersync/client');
      if (!powerSync) return;

      const computeState = (): SyncState => {
        const status = powerSync.currentStatus;
        if (!status || !status.connected) {
          // Disconnected: figure out if it's a brief drop (reconnecting)
          // or a sustained outage (offline) via timing.
          const now = Date.now();
          const since = disconnectedSinceRef.current ?? now;
          if (disconnectedSinceRef.current === null) {
            disconnectedSinceRef.current = now;
          }
          const elapsedMs = now - since;
          return elapsedMs >= OFFLINE_THRESHOLD_MS ? 'offline' : 'reconnecting';
        }
        // Connected — clear the disconnect timestamp
        disconnectedSinceRef.current = null;
        const active = status.dataFlow?.uploading || status.dataFlow?.downloading;
        return active ? 'syncing' : 'connected';
      };

      // Debounce transitions away from 'connected' so brief sync bursts
      // (<600ms) don't flash the bar. Transitions to 'connected' apply
      // immediately so the bar hides as soon as sync finishes.
      const applyState = () => {
        const next = computeState();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        if (next === 'connected') {
          setSyncState(next);
        } else {
          debounceTimer = setTimeout(() => {
            setSyncState(next);
            debounceTimer = null;
          }, 600);
        }

        // Schedule a re-evaluation at the offline threshold so the
        // "reconnecting → offline" transition fires even if PowerSync
        // doesn't emit a status update during the 5s window (it usually
        // doesn't if it's still backing off internally).
        if (offlineTimer) {
          clearTimeout(offlineTimer);
          offlineTimer = null;
        }
        if (next === 'reconnecting') {
          const since = disconnectedSinceRef.current ?? Date.now();
          const remaining = Math.max(0, OFFLINE_THRESHOLD_MS - (Date.now() - since));
          offlineTimer = setTimeout(() => {
            applyState();
          }, remaining + 100);
        }
      };

      applyState();

      // Per @powersync/common, AbstractPowerSyncDatabase extends
      // BaseObserver<PowerSyncDBListener>. registerListener returns the
      // unsubscribe function directly.
      unsubscribe = powerSync.registerListener?.({
        statusChanged: () => applyState(),
      });

      return () => {
        unsubscribe?.();
        if (debounceTimer) clearTimeout(debounceTimer);
        if (offlineTimer) clearTimeout(offlineTimer);
      };
    } catch {
      // PowerSync not initialized yet
      return;
    }
  }, []);

  const { t } = useTranslation();

  // Connected = hidden
  if (syncState === 'connected') return null;

  const config =
    syncState === 'syncing'
      ? { bg: 'bg-amber-600/90', icon: 'sync-outline' as const, text: t('sync.syncing'), color: '#FBBF24' }
      : syncState === 'reconnecting'
        ? {
            bg: 'bg-slate-700/90',
            icon: 'cloud-offline-outline' as const,
            text: retrying ? t('sync.syncing') : t('sync.reconnecting'),
            color: '#94A3B8',
          }
        : {
            // offline (sustained disconnect)
            bg: 'bg-slate-700/90',
            icon: 'cloud-offline-outline' as const,
            text: retrying ? t('sync.syncing') : t('sync.offline'),
            color: '#94A3B8',
          };

  const isDisconnectedState = syncState === 'reconnecting' || syncState === 'offline';

  const handleRetry = async () => {
    if (!isDisconnectedState || retrying) return;
    setRetrying(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { reconnectPowerSync } = require('@/shared/lib/powersync/client');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { supabase } = require('@/shared/lib/supabase/client');
      await supabase.auth.refreshSession().catch(() => undefined);
      await reconnectPowerSync();
    } finally {
      setTimeout(() => setRetrying(false), 1200);
    }
  };

  return (
    <Pressable
      onPress={handleRetry}
      accessibilityRole="button"
      accessibilityLabel="Tap to retry sync"
      className={`flex-row items-center justify-center px-4 py-1.5 ${config.bg} active:opacity-70`}
    >
      <Ionicons name={config.icon} size={14} color={config.color} />
      <Text className="ml-2 text-xs font-medium" style={{ color: config.color }}>
        {config.text}
      </Text>
      {isDisconnectedState && !retrying && (
        <Text className="ml-2 text-xs" style={{ color: config.color, opacity: 0.7 }}>
          · tap to retry
        </Text>
      )}
    </Pressable>
  );
}
