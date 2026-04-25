import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

type SyncState = 'connected' | 'connecting' | 'disconnected';

/**
 * Subtle bar at the top of the app showing sync status.
 * - Connected: hidden (no distraction)
 * - Connecting/syncing: amber bar
 * - Disconnected: muted bar — copy says "Reconnecting…" instead of "Offline"
 *   because the most common cause of this state is "device has WiFi but
 *   PowerSync's WebSocket needs to re-establish" rather than "no network
 *   at all". The AppState foreground listener in _layout.tsx already
 *   nudges a reconnect; this bar also offers a tap-to-retry as a manual
 *   override (in case the user is mid-screen and doesn't want to wait).
 */
export function SyncStatusBar() {
  const [syncState, setSyncState] = useState<SyncState>('connected');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let unsubscribe: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { powerSync } = require('@/shared/lib/powersync/client');
      if (!powerSync) return;

      const computeState = (): SyncState => {
        const status = powerSync.currentStatus;
        if (!status) return 'disconnected';
        if (!status.connected) return 'disconnected';
        // Bug fix 2026-04-25: PowerSync's API uses `dataFlow` (not
        // `dataFlowStatus`). Diagnostic screen confirmed currentStatus
        // looked like { connected: true, dataFlow: { uploading, downloading } }
        // so the old `status.dataFlowStatus?.uploading` always evaluated
        // to undefined → `active` was always falsy → would always return
        // 'connected'. But the BIGGER bug was that we never received status
        // updates at all (see below), so syncState got stuck at the initial
        // 'connecting' fallback set during the first applyState() call.
        const active = status.dataFlow?.uploading || status.dataFlow?.downloading;
        return active ? 'connecting' : 'connected';
      };

      // Debounce transitions INTO 'connecting' / 'disconnected' so brief sync
      // bursts (<600ms) don't flash the bar. Transitions to 'connected' apply
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
      };

      applyState();

      // Bug fix 2026-04-25: the subscription to statusUpdates.subscribe()
      // doesn't exist on the PowerSync DB instance — that was wrong API.
      // Correct one (per @powersync/common types): registerListener accepts
      // a partial PowerSyncDBListener, with `statusChanged` for status diffs.
      // It returns an unsubscribe function () => void directly.
      unsubscribe = powerSync.registerListener?.({
        statusChanged: () => applyState(),
      });

      return () => {
        unsubscribe?.();
        if (debounceTimer) clearTimeout(debounceTimer);
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
    syncState === 'connecting'
      ? { bg: 'bg-amber-600/90', icon: 'sync-outline' as const, text: t('sync.syncing'), color: '#FBBF24' }
      : {
          bg: 'bg-slate-700/90',
          icon: 'cloud-offline-outline' as const,
          // Copy says "Reconnecting" not "Offline" — see component header for rationale.
          text: retrying ? t('sync.syncing') : t('sync.reconnecting'),
          color: '#94A3B8',
        };

  // Tap-to-retry: only when actually disconnected (connecting state already shows progress)
  const handleRetry = async () => {
    if (syncState !== 'disconnected' || retrying) return;
    setRetrying(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { reconnectPowerSync } = require('@/shared/lib/powersync/client');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { supabase } = require('@/shared/lib/supabase/client');
      await supabase.auth.refreshSession().catch(() => undefined);
      await reconnectPowerSync();
    } finally {
      // After a brief flash of "Syncing…" wording, the status subscription
      // takes over and reflects the real outcome.
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
      {syncState === 'disconnected' && !retrying && (
        <Text className="ml-2 text-xs" style={{ color: config.color, opacity: 0.7 }}>
          · tap to retry
        </Text>
      )}
    </Pressable>
  );
}
