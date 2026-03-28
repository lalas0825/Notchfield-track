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

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { powerSync } = require('@/shared/lib/powersync/client');
      if (!powerSync) return;

      // PowerSync exposes a status stream
      const checkStatus = () => {
        const status = powerSync.currentStatus;
        if (!status) {
          setSyncState('disconnected');
          return;
        }

        if (status.connected) {
          setSyncState(status.dataFlowStatus?.uploading || status.dataFlowStatus?.downloading
            ? 'connecting'
            : 'connected');
        } else {
          setSyncState('disconnected');
        }
      };

      // Check immediately
      checkStatus();

      // Subscribe to changes
      const subscription = powerSync.statusUpdates?.subscribe?.({
        next: () => checkStatus(),
      });

      unsubscribe = () => subscription?.unsubscribe?.();

      // Also poll every 5s as fallback
      const interval = setInterval(checkStatus, 5000);
      return () => {
        unsubscribe?.();
        clearInterval(interval);
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
