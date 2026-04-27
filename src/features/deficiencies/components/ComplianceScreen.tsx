/**
 * Sprint 71 Phase 2 — Compliance screen for supervisors / PMs.
 *
 * Refactored 2026-04-27 (pilot feedback): single-tab "To Verify" was
 * insufficient. Supervisors also need to see open work in progress and
 * verified history (for audit trails + GC reports). Three sub-tabs:
 *
 *   1. Open       (status='open' or 'in_progress')   — what's still active
 *   2. To Verify  (status='resolved')                 — needs review
 *   3. Verified   (status='verified')                 — closed history
 *
 * Cascade behavior unchanged: when any supervisor verifies a deficiency,
 * Web cascade-completes ALL supervisors' verification_due todos. Realtime
 * subscription on the org-scoped channel fires → all tabs refresh.
 *
 * Selection mode + Export to GC:
 *   - "Select" button (top right) enters multi-select mode
 *   - Each row gets a checkbox; tap toggles selection
 *   - Footer shows "Export X to GC" CTA
 *   - Web shipped the export endpoint but didn't share contract details
 *     yet — button is wired with a "coming soon" placeholder that opens
 *     an Alert. When Web confirms the endpoint shape (per-deficiency vs
 *     batch, return URL vs send-direct, etc.), wire the API call.
 *
 * Role-gate: non-supervisors see a Lock screen since the data is
 * org-wide and would expose other foremen's unfinished work.
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
import { useOrgDeficiencies } from '../hooks/useOrgDeficiencies';
import { DeficiencyListItem } from './DeficiencyListItem';
import { ExportToGcModal } from './ExportToGcModal';
import type { Deficiency, DeficiencyStatus } from '../types';

type TabKey = 'open' | 'verify' | 'verified';

const TAB_CONFIG: Record<
  TabKey,
  { label: string; statuses: DeficiencyStatus[]; sort: 'severity' | 'recent' }
> = {
  open: {
    label: 'Open',
    statuses: ['open', 'in_progress'],
    sort: 'severity',
  },
  verify: {
    label: 'To Verify',
    statuses: ['resolved'],
    sort: 'severity',
  },
  verified: {
    label: 'Verified',
    statuses: ['verified'],
    sort: 'recent',
  },
};

export default function ComplianceScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const isSupervisor = normalizeTrackRole(profile?.role) === 'supervisor';

  const [activeTab, setActiveTab] = useState<TabKey>('verify');
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const config = TAB_CONFIG[activeTab];
  const { deficiencies, loading, reload } = useOrgDeficiencies({
    statuses: config.statuses,
    sort: config.sort,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const onPressItem = useCallback(
    (d: Deficiency) => {
      if (selectionMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(d.id)) next.delete(d.id);
          else next.add(d.id);
          return next;
        });
        return;
      }
      router.push(`/(tabs)/board/deficiency/${d.id}` as any);
    },
    [selectionMode, router],
  );

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    // Exit selection mode when switching tabs to avoid mixed-status batches
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleExport = useCallback(() => {
    if (selectedIds.size === 0) return;
    setExportModalOpen(true);
  }, [selectedIds.size]);

  const handleExported = useCallback(() => {
    // Clear selection after a successful export. Modal stays open on its
    // success state so the user can copy/share/open the PDF; closing the
    // modal returns to a clean Compliance list.
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const isEmpty = !loading && deficiencies.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Compliance',
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
          headerRight: () =>
            isSupervisor && deficiencies.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSelectionMode((m) => !m);
                  setSelectedIds(new Set());
                }}
                hitSlop={8}
                style={{ paddingHorizontal: 12 }}
              >
                <Text
                  style={{
                    color: selectionMode ? '#F97316' : '#94A3B8',
                    fontSize: 15,
                    fontWeight: '600',
                  }}
                >
                  {selectionMode ? 'Done' : 'Select'}
                </Text>
              </Pressable>
            ) : null,
        }}
      />

      {!isSupervisor ? (
        <View style={[ScreenStyle, { padding: 24 }]}>
          <View style={EmptyStateStyle}>
            <Ionicons name="lock-closed-outline" size={48} color="#475569" />
            <Text style={EmptyTitleStyle}>Supervisor Only</Text>
            <Text style={EmptyBodyStyle}>
              Only supervisors can review and verify deficiencies. Foremen
              see their own assignments via the Today screen.
            </Text>
          </View>
        </View>
      ) : (
        <View style={ScreenStyle}>
          {/* Tabs */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              paddingTop: 8,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: '#1E293B',
            }}
          >
            {(['open', 'verify', 'verified'] as TabKey[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => handleTabChange(tab)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor:
                    activeTab === tab ? '#F97316' : 'transparent',
                  marginBottom: -1,
                }}
              >
                <Text
                  style={{
                    color: activeTab === tab ? '#F97316' : '#94A3B8',
                    fontSize: 14,
                    fontWeight: activeTab === tab ? '700' : '600',
                  }}
                >
                  {TAB_CONFIG[tab].label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#F97316"
                colors={['#F97316']}
              />
            }
          >
            <Text
              style={{
                color: '#94A3B8',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {tabSubtitle(activeTab, deficiencies.length, loading)}
            </Text>

            {isEmpty ? (
              <View style={EmptyStateStyle}>
                <Ionicons
                  name={emptyStateIcon(activeTab)}
                  size={56}
                  color={activeTab === 'open' ? '#475569' : '#22C55E'}
                />
                <Text style={EmptyTitleStyle}>{emptyStateTitle(activeTab)}</Text>
                <Text style={EmptyBodyStyle}>
                  {emptyStateBody(activeTab)}
                </Text>
              </View>
            ) : (
              deficiencies.map((d) => (
                <DeficiencyRow
                  key={d.id}
                  deficiency={d}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(d.id)}
                  onPress={onPressItem}
                />
              ))
            )}
          </ScrollView>

          {/* Footer for selection mode — Export to GC CTA */}
          {selectionMode && selectedIds.size > 0 ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: 16,
                paddingBottom: 24,
                backgroundColor: '#0F172A',
                borderTopWidth: 1,
                borderTopColor: '#1E293B',
              }}
            >
              <Pressable
                onPress={handleExport}
                style={{
                  height: 52,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F97316',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Ionicons name="document-attach" size={20} color="#FFFFFF" />
                <Text
                  style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}
                >
                  Export {selectedIds.size} to GC
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Sprint 71 Phase 3 — Export to GC modal */}
          <ExportToGcModal
            visible={exportModalOpen}
            deficiencyIds={[...selectedIds]}
            onClose={() => setExportModalOpen(false)}
            onExported={handleExported}
          />
        </View>
      )}
    </>
  );
}

function DeficiencyRow({
  deficiency,
  selectionMode,
  selected,
  onPress,
}: {
  deficiency: Deficiency;
  selectionMode: boolean;
  selected: boolean;
  onPress: (d: Deficiency) => void;
}) {
  if (!selectionMode) {
    return <DeficiencyListItem deficiency={deficiency} onPress={onPress} />;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={() => onPress(deficiency)}
        hitSlop={8}
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: selected ? '#F97316' : '#475569',
          backgroundColor: selected ? '#F97316' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
        }}
      >
        {selected ? (
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        ) : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <DeficiencyListItem deficiency={deficiency} onPress={onPress} />
      </View>
    </View>
  );
}

function tabSubtitle(tab: TabKey, count: number, loading: boolean): string {
  if (loading) return 'Loading…';
  if (count === 0) return '';
  switch (tab) {
    case 'open':
      return `${count} active · being worked on`;
    case 'verify':
      return `${count} resolved · awaiting your verification`;
    case 'verified':
      return `${count} verified · history (most recent first)`;
  }
}

function emptyStateIcon(
  tab: TabKey,
): React.ComponentProps<typeof Ionicons>['name'] {
  if (tab === 'open') return 'thumbs-up-outline';
  if (tab === 'verify') return 'checkmark-done-circle-outline';
  return 'archive-outline';
}

function emptyStateTitle(tab: TabKey): string {
  if (tab === 'open') return 'Nothing active';
  if (tab === 'verify') return "You're all caught up";
  return 'No verified history yet';
}

function emptyStateBody(tab: TabKey): string {
  if (tab === 'open')
    return 'No open or in-progress deficiencies. Foremen will report new ones via the Area screens.';
  if (tab === 'verify')
    return 'Nothing pending verification. Foremen are either still fixing things or you’ve verified them all.';
  return 'Nothing has been verified yet. Once you verify resolutions they’ll show up here as audit history.';
}

const ScreenStyle = {
  flex: 1,
  backgroundColor: '#0F172A',
};

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
