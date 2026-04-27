/**
 * Sprint 69 — Notifications full-screen list.
 *
 * Grouped by relative bucket: Today / Yesterday / This week / Older. Tapping
 * a row marks it as read locally (optimistic — the row state recomputes
 * immediately) and fires markNotificationRead() to the Web API. PowerSync
 * realtime then echoes the read_at update back so the unread badge on the
 * Home bell auto-decrements without any cache mutation.
 *
 * Tap target routing: Phase 1 keeps it simple — tap → mark read. The
 * notification's `link_url` is a Web URL (e.g. `/projects/x/pm/...`) and
 * Track-side route conversion is a Phase 2 task. The user gets immediate
 * read feedback and the in-app entity can be reached via the regular tabs.
 *
 * Refresh:
 *   - Pull-to-refresh → reload()
 *   - Realtime channel inside useNotifications auto-reloads on Web inserts
 *   - useFocusEffect inside useNotifications reloads on tab return
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../hooks/useNotifications';
import { useLocalReadStore } from '../state/localReadStore';
import { groupBucket } from '../services/relativeTime';
import { markNotificationRead } from '../services/notifyApiClient';
import { NotificationItem } from './NotificationItem';
import type { Notification } from '../types';

const SECTION_LABELS: Record<ReturnType<typeof groupBucket>, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  older: 'Older',
};
const SECTION_ORDER: ReadonlyArray<ReturnType<typeof groupBucket>> = [
  'today',
  'yesterday',
  'week',
  'older',
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, unreadCount, loading, reload, localRead } = useNotifications();
  const markLocalRead = useLocalReadStore((s) => s.markRead);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const onPressItem = useCallback(
    (n: Notification) => {
      // Optimistic remove — adds the id to the shared localRead store, which
      // BOTH this screen's displayList AND the bell's unreadCount filter
      // against. The row drops from the list and the badge decrements in
      // the same render tick, no server roundtrip required.
      if (!n.read_at) {
        markLocalRead(n.id);
        // Fire-and-forget — `.catch` inside markNotificationRead already
        // logs failures and doesn't throw.
        markNotificationRead(n.id);
      }

      // Sprint 71 Phase 2 — entity-based deep-link routing. The
      // notifications row carries entity_type + entity_id; Track routes
      // to the right detail screen. Mirrors the push tap handler in
      // messageNotificationHandler.ts so in-app + push behave the same.
      if (n.entity_type === 'deficiency' && n.entity_id) {
        router.push(`/(tabs)/board/deficiency/${n.entity_id}` as any);
        return;
      }
      if (n.entity_type === 'safety_document' && n.entity_id) {
        router.push(`/(tabs)/docs/safety/${n.entity_id}` as any);
        return;
      }
      if (n.entity_type === 'production_area' && n.entity_id) {
        router.push(`/(tabs)/board/${n.entity_id}` as any);
        return;
      }
      // Other entity_types (worker, phase_progress, legal_document, etc.)
      // — no specific route yet; user lands on the bell list, which is
      // already where the tap originated. Better than landing on a 404.
    },
    [markLocalRead, router],
  );

  // Hide read notifications from the list — once tapped (or marked read on
  // another device), the row clears out of the active view. The unread
  // badge on the bell is the source of truth; if the user wants to see
  // history, that's an "archive" UX we'll add when there's demand.
  //
  // The localRead overlay is what makes the row disappear instantly on tap
  // (without waiting for the server roundtrip + realtime echo). After
  // reload(), localRead resets and the server's read_at is authoritative.
  const displayList = useMemo(
    () => notifications.filter((n) => !n.read_at && !localRead.has(n.id)),
    [notifications, localRead],
  );

  const grouped = useMemo(() => {
    const map = new Map<ReturnType<typeof groupBucket>, Notification[]>();
    for (const n of displayList) {
      const key = groupBucket(n.created_at);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return map;
  }, [displayList]);

  const isEmpty = !loading && displayList.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications',
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
            colors={['#F97316']}
          />
        }
      >
        {isEmpty ? (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 80,
              paddingHorizontal: 24,
            }}
          >
            <Ionicons name="notifications-outline" size={48} color="#334155" />
            <Text
              style={{
                color: '#94A3B8',
                fontSize: 14,
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              You're all caught up.
            </Text>
          </View>
        ) : (
          SECTION_ORDER.map((key) => {
            const items = grouped.get(key);
            if (!items || items.length === 0) return null;
            return (
              <View key={key}>
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 8,
                    backgroundColor: '#0F172A',
                  }}
                >
                  <Text
                    style={{
                      color: '#64748B',
                      fontSize: 12,
                      fontWeight: '700',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    {SECTION_LABELS[key]}
                  </Text>
                </View>
                {items.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onPress={onPressItem}
                  />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
