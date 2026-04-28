/**
 * Sprint 72 — Sign-Offs Compliance list screen.
 *
 * PM/Supervisor primary surface. List of all org sign-offs with status
 * filter pills:
 *   1. All
 *   2. Draft
 *   3. Pending Sig
 *   4. Signed
 *
 * Tap row → /(tabs)/board/signoff/<id> with workflow actions (Send /
 * In-Person / Preview PDF).
 *
 * Realtime: useOrgSignoffs subscribes to all signoff_documents updates
 * for the org so this list reflects sends, sign completions, and
 * declines pushed from Web (or other devices) in real time.
 *
 * Available to all roles — read-only viewing for workers + write for
 * foreman/supervisor (the create + sign actions live on the detail
 * screen, gated by role inside that surface).
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
import { useProjectStore } from '@/features/projects/store/project-store';
import {
  useOrgSignoffs,
  type SignoffStatusTab,
} from '@/features/signoffs/hooks/useOrgSignoffs';
import { SignoffListItem } from '@/features/signoffs/components/SignoffListItem';
import type { SignoffDocument } from '@/features/signoffs/types';

const TABS: { key: SignoffStatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending_signature', label: 'Pending Sig' },
  { key: 'signed', label: 'Signed' },
];

export default function SignoffsListScreen() {
  const router = useRouter();
  const { activeProject } = useProjectStore();
  const projectId = activeProject?.id ?? null;

  const [tab, setTab] = useState<SignoffStatusTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { signoffs, counts, loading, reload } = useOrgSignoffs({
    projectId,
    status: tab,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const onPressItem = (s: SignoffDocument) => {
    router.push(`/(tabs)/board/signoff/${s.id}` as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <Stack.Screen options={{ title: 'Sign-Offs' }} />

      {/* Status counts strip */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#1E293B',
        }}
      >
        <CountChip color="#9CA3AF" label="Draft" value={counts.draft} />
        <CountChip
          color="#F59E0B"
          label="Pending"
          value={counts.pending_signature}
        />
        <CountChip color="#22C55E" label="Signed" value={counts.signed} />
      </View>

      {/* Tab pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 8,
        }}
        style={{ flexGrow: 0 }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? '#F97316' : '#334155',
                backgroundColor: active ? '#F9731620' : 'transparent',
              }}
            >
              <Text
                style={{
                  color: active ? '#F97316' : '#94A3B8',
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
          />
        }
      >
        {loading ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: '#94A3B8' }}>Loading…</Text>
          </View>
        ) : signoffs.length === 0 ? (
          <View
            style={{
              padding: 48,
              alignItems: 'center',
              paddingHorizontal: 32,
            }}
          >
            <Ionicons name="document-text-outline" size={48} color="#475569" />
            <Text
              style={{
                color: '#94A3B8',
                marginTop: 16,
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              {emptyMessage(tab)}
            </Text>
            <Text
              style={{
                color: '#64748B',
                marginTop: 8,
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              Sign-offs are created from Board → tap area → New Sign-Off.
            </Text>
          </View>
        ) : (
          signoffs.map((s) => (
            <SignoffListItem key={s.id} signoff={s} onPress={onPressItem} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CountChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        borderRadius: 10,
        backgroundColor: `${color}15`,
        borderWidth: 1,
        borderColor: `${color}40`,
        alignItems: 'center',
      }}
    >
      <Text style={{ color, fontSize: 18, fontWeight: '700' }}>{value}</Text>
      <Text
        style={{
          color: '#94A3B8',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function emptyMessage(tab: SignoffStatusTab): string {
  switch (tab) {
    case 'draft':
      return 'No drafts pending in this project.';
    case 'pending_signature':
      return 'No sign-offs awaiting signature.';
    case 'signed':
      return 'No signed sign-offs yet.';
    default:
      return 'No sign-offs in this project yet.';
  }
}
