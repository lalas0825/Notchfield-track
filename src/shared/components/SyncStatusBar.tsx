import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

type SyncState = 'connected' | 'connecting' | 'disconnected';

/**
 * Subtle bar at the top of the app showing sync status.
 * - Connected: hidden (no distraction)
 * - Connecting/syncing: amber bar
 * - Disconnected: muted bar (not alarming, just informative)
 *
 * Subscribes to PowerSync status on native, NetInfo-like on web.
 */
export function SyncStatusBar() {
  const [syncState, setSyncState] = useState<SyncState>('connected');

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
        const active = status.dataFlowStatus?.uploading || status.dataFlowStatus?.downloading;
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

      const subscription = powerSync.statusUpdates?.subscribe?.({
        next: () => applyState(),
      });

      unsubscribe = () => subscription?.unsubscribe?.();

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

  const config = syncState === 'connecting'
    ? { bg: 'bg-amber-600/90', icon: 'sync-outline' as const, text: t('sync.syncing'), color: '#FBBF24' }
    : { bg: 'bg-slate-700/90', icon: 'cloud-offline-outline' as const, text: t('sync.offline'), color: '#94A3B8' };

  return (
    <View className={`flex-row items-center justify-center px-4 py-1.5 ${config.bg}`}>
      <Ionicons name={config.icon} size={14} color={config.color} />
      <Text className="ml-2 text-xs font-medium" style={{ color: config.color }}>
        {config.text}
      </Text>
    </View>
  );
}
