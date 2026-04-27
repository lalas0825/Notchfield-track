/**
 * Sprint 71 Phase 2 — Compliance screen for supervisors / PMs.
 *
 * Lists deficiencies in status='resolved' awaiting verification across
 * the entire org, sorted critical → low + most-recent-first. Tap a row →
 * detail screen which surfaces Verify + Reject buttons.
 *
 * Role-gated at the route level — non-supervisors see an empty state
 * (the data is org-wide, so a foreman would see resolutions for OTHER
 * areas they don't own; we don't want that).
 *
 * Cascade behavior to be aware of: when supervisor A verifies a
 * deficiency, ALL supervisors in the org get their verification_due
 * todo auto-completed by Web's transaction. Realtime subscription fires
 * → this screen refreshes → row drops out of the list.
 */

import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { normalizeTrackRole } from '@/shared/lib/permissions/trackPermissions';
import { usePendingVerifications } from '../hooks/usePendingVerifications';
import { DeficiencyListItem } from './DeficiencyListItem';
import type { Deficiency } from '../types';

export default function ComplianceScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const isSupervisor = normalizeTrackRole(profile?.role) === 'supervisor';
  const { deficiencies, loading, reload } = usePendingVerifications();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const onPress = useCallback(
    (d: Deficiency) => {
      router.push(`/(tabs)/board/deficiency/${d.id}` as any);
    },
    [router],
  );

  const isEmpty = !loading && deficiencies.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title:
            deficiencies.length > 0
              ? `Compliance (${deficiencies.length})`
              : 'Compliance',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={{ paddingHorizontal: 8 }}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: '#0F172A' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 64 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
            colors={['#F97316']}
          />
        }
      >
        {!isSupervisor ? (
          <View style={EmptyStateStyle}>
            <Ionicons name="lock-closed-outline" size={48} color="#475569" />
            <Text style={EmptyTitleStyle}>Supervisor Only</Text>
            <Text style={EmptyBodyStyle}>
              Only supervisors can review and verify resolved deficiencies.
              Foremen see their own assignments via the Today screen.
            </Text>
          </View>
        ) : (
          <>
            <Text
              style={{
                color: '#94A3B8',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {deficiencies.length === 0 && !loading
                ? "You're all caught up — no resolutions waiting."
                : `${deficiencies.length} resolved · awaiting your verification`}
            </Text>

            {isEmpty ? (
              <View style={EmptyStateStyle}>
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={56}
                  color="#22C55E"
                />
                <Text style={EmptyTitleStyle}>All caught up</Text>
                <Text style={EmptyBodyStyle}>
                  Nothing pending verification. Foremen are either still
                  fixing things or you&apos;ve already verified them all.
                </Text>
              </View>
            ) : (
              deficiencies.map((d) => (
                <DeficiencyListItem
                  key={d.id}
                  deficiency={d}
                  onPress={onPress}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const EmptyStateStyle = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingVertical: 64,
  paddingHorizontal: 24,
};

const EmptyTitleStyle = {
  color: '#F8FAFC',
  fontSize: 18,
  fontWeight: '700' as const,
  marginTop: 12,
};

const EmptyBodyStyle = {
  color: '#94A3B8',
  fontSize: 14,
  marginTop: 6,
  textAlign: 'center' as const,
  lineHeight: 20,
};
