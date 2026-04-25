/**
 * Sync Debug Screen — Sprint 53A debugging
 * ==========================================
 * Shows the raw PowerSync state + auth state so we can diagnose why
 * the "Reconnecting…" banner gets stuck. Includes recovery buttons:
 *
 *   - Refresh session: calls supabase.auth.refreshSession + reconnect
 *     (same as banner tap-to-retry, but explicit)
 *   - Force reconnect: just reconnectPowerSync (no auth touch)
 *   - Clear local DB + resync: NUCLEAR — disconnectAndClear() wipes the
 *     local SQLite state, then reconnect. All offline-pending writes
 *     are LOST. Use only when stuck and nothing else works.
 *
 * Reachable from More tab → Sync Diagnostics.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { reconnectPowerSync } from '@/shared/lib/powersync/client';

type SyncStatus = {
  connected: boolean | null;
  connecting: boolean | null;
  lastSyncedAt: string | null;
  uploading: boolean | null;
  downloading: boolean | null;
  hasSynced: boolean | null;
  raw: string;
};

type AuthStatus = {
  hasSession: boolean;
  userId: string | null;
  email: string | null;
  expiresAt: string | null;
  expiresInSeconds: number | null;
  refreshTokenExists: boolean;
};

export default function SyncDebugScreen() {
  const router = useRouter();
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    // PowerSync state
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { powerSync } = require('@/shared/lib/powersync/client');
      const status = powerSync?.currentStatus ?? null;
      setSync({
        connected: status?.connected ?? null,
        connecting: status?.connecting ?? null,
        lastSyncedAt: status?.lastSyncedAt
          ? new Date(status.lastSyncedAt).toISOString()
          : null,
        uploading: status?.dataFlowStatus?.uploading ?? null,
        downloading: status?.dataFlowStatus?.downloading ?? null,
        hasSynced: status?.hasSynced ?? null,
        raw: JSON.stringify(status, null, 2),
      });
    } catch (e) {
      setError(`PowerSync read failed: ${(e as Error).message}`);
    }

    // Auth state
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      const session = data.session;
      const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
      setAuth({
        hasSession: !!session,
        userId: session?.user.id ?? null,
        email: session?.user.email ?? null,
        expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
        expiresInSeconds: expiresAtMs ? Math.round((expiresAtMs - Date.now()) / 1000) : null,
        refreshTokenExists: !!session?.refresh_token,
      });
    } catch (e) {
      setError(`Auth read failed: ${(e as Error).message}`);
    }
  };

  useEffect(() => {
    refresh();
    // Re-poll every 2s while screen is open so user sees state changes
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const onRefreshSession = async () => {
    setBusy('refresh');
    try {
      const result = await supabase.auth.refreshSession();
      if (result.error) {
        Alert.alert('Refresh failed', result.error.message);
      } else {
        await reconnectPowerSync();
        Alert.alert('Done', 'Session refreshed + reconnect triggered.');
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const onForceReconnect = async () => {
    setBusy('reconnect');
    try {
      await reconnectPowerSync();
      Alert.alert('Done', 'Reconnect attempted. Watch the status above.');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const onNuclearResync = async () => {
    Alert.alert(
      'Clear local data?',
      'This wipes the local PowerSync database and re-syncs from scratch. Any offline-pending writes are LOST. Use only if stuck and nothing else works.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear and resync',
          style: 'destructive',
          onPress: async () => {
            setBusy('nuclear');
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { powerSync } = require('@/shared/lib/powersync/client');
              if (!powerSync) throw new Error('PowerSync not available');
              await powerSync.disconnectAndClear();
              await reconnectPowerSync();
              Alert.alert('Done', 'Local DB cleared. Resync in progress.');
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            } finally {
              setBusy(null);
              refresh();
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Sync Diagnostics', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />
      <ScrollView className="flex-1 bg-background px-4 pt-4">
        {/* PowerSync Status Card */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="mb-3 text-base font-bold text-white">PowerSync Status</Text>
          <Row label="Connected" value={renderBool(sync?.connected)} />
          <Row label="Connecting" value={renderBool(sync?.connecting)} />
          <Row label="Has synced" value={renderBool(sync?.hasSynced)} />
          <Row label="Uploading" value={renderBool(sync?.uploading)} />
          <Row label="Downloading" value={renderBool(sync?.downloading)} />
          <Row label="Last synced at" value={sync?.lastSyncedAt ?? 'never'} />
        </View>

        {/* Auth Status Card */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="mb-3 text-base font-bold text-white">Auth Session</Text>
          <Row label="Has session" value={renderBool(auth?.hasSession)} />
          <Row label="User ID" value={auth?.userId ?? '—'} mono />
          <Row label="Email" value={auth?.email ?? '—'} />
          <Row label="Refresh token" value={renderBool(auth?.refreshTokenExists)} />
          <Row
            label="Expires at"
            value={auth?.expiresAt ?? '—'}
          />
          <Row
            label="Expires in"
            value={
              auth?.expiresInSeconds == null
                ? '—'
                : auth.expiresInSeconds < 0
                  ? `EXPIRED (${Math.abs(auth.expiresInSeconds)}s ago)`
                  : `${Math.floor(auth.expiresInSeconds / 60)}m ${auth.expiresInSeconds % 60}s`
            }
          />
        </View>

        {/* Error display */}
        {error && (
          <View className="mb-4 rounded-2xl border border-danger bg-danger/10 p-4">
            <Text className="mb-1 text-sm font-bold text-danger">Read error</Text>
            <Text className="text-xs text-slate-300" style={{ fontFamily: 'monospace' }}>
              {error}
            </Text>
          </View>
        )}

        {/* Recovery actions */}
        <View className="mb-4 gap-2">
          <ActionButton
            label="Refresh session + reconnect"
            subtitle="Force a new JWT then retry PowerSync"
            icon="refresh"
            color="#F97316"
            onPress={onRefreshSession}
            busy={busy === 'refresh'}
          />
          <ActionButton
            label="Force reconnect (no auth touch)"
            subtitle="Just retry PowerSync handshake"
            icon="wifi"
            color="#3B82F6"
            onPress={onForceReconnect}
            busy={busy === 'reconnect'}
          />
          <ActionButton
            label="Clear local DB + resync"
            subtitle="NUCLEAR — wipes local SQLite, re-syncs from scratch. Offline-pending writes lost."
            icon="warning"
            color="#EF4444"
            onPress={onNuclearResync}
            busy={busy === 'nuclear'}
          />
        </View>

        {/* Raw status JSON for deeper debug */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="mb-2 text-xs font-bold uppercase text-slate-400">Raw status JSON</Text>
          <Text className="text-xs text-slate-300" style={{ fontFamily: 'monospace' }} selectable>
            {sync?.raw ?? '(none)'}
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
          className="mb-12 h-12 items-center justify-center rounded-xl border border-border active:opacity-80"
        >
          <Text className="text-base text-slate-300">Back</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function renderBool(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v ? 'true' : 'false';
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="mb-1.5 flex-row items-start justify-between">
      <Text className="mr-3 text-sm text-slate-400" style={{ flex: 0.4 }}>{label}</Text>
      <Text
        className="text-sm text-white"
        style={{ flex: 0.6, textAlign: 'right', fontFamily: mono ? 'monospace' : undefined }}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  subtitle,
  icon,
  color,
  onPress,
  busy,
}: {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="flex-row items-center rounded-xl border border-border bg-card px-4 py-3.5 active:opacity-80"
      style={{ opacity: busy ? 0.5 : 1 }}
    >
      <View
        className="mr-3 h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20` }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-white">{label}</Text>
        <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {busy && <Text className="text-xs text-slate-500">running…</Text>}
    </Pressable>
  );
}
