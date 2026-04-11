/**
 * GC Punchlist Screen — Sprint 42B
 * Items grouped by floor/unit, sorted in_progress → open → ready_for_review.
 * Closed items in collapsible section at bottom.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGcPunchList } from '@/features/gc-punch/hooks/useGcPunchList';
import type { GcPunchItem, GcPunchStatus } from '@/features/gc-punch/services/gc-punch-service';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'ready_for_review';
type PriorityFilter = 'all' | 'high' | 'critical';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  open:             { color: '#9CA3AF', label: 'Open' },
  in_progress:      { color: '#F59E0B', label: 'In Progress' },
  ready_for_review: { color: '#3B82F6', label: 'Ready for Review' },
  closed:           { color: '#22C55E', label: 'Closed' },
};

const PRIORITY_CONFIG: Record<string, { color: string; icon: string }> = {
  high:     { color: '#F97316', icon: '⚡' },
  critical: { color: '#EF4444', icon: '🔴' },
};

function formatDueDate(due: string | null): { text: string; color: string } | null {
  if (!due) return null;
  const d = new Date(due);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  const text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diffDays < 0) return { text: `Due ${text}`, color: '#EF4444' };
  if (diffDays <= 3) return { text: `Due ${text}`, color: '#F59E0B' };
  return { text: `Due ${text}`, color: '#94A3B8' };
}

function PunchCard({ item, onPress }: { item: GcPunchItem; onPress: () => void }) {
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open;
  const priorityCfg = item.priority ? PRIORITY_CONFIG[item.priority] : null;
  const due = formatDueDate(item.due_date);
  const itemLabel = item.item_number ? `PL-${item.item_number}` : `#${item.external_item_id?.slice(0, 8) ?? '—'}`;
  const locationParts = [item.location_description].filter(Boolean);

  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-xl border border-border bg-card px-4 py-3 active:opacity-75"
    >
      <View className="flex-row items-start justify-between">
        {/* Left: number + title */}
        <View className="flex-1 pr-3">
          <Text className="mb-0.5 text-xs font-bold text-slate-500">{itemLabel}</Text>
          <Text className="text-sm font-semibold text-white" numberOfLines={2}>
            {item.title}
          </Text>
          {locationParts.length > 0 && (
            <View className="mt-1 flex-row items-center">
              <Ionicons name="location-outline" size={11} color="#64748B" />
              <Text className="ml-0.5 text-xs text-slate-500" numberOfLines={1}>
                {locationParts.join(' · ')}
              </Text>
            </View>
          )}
          <View className="mt-1.5 flex-row items-center gap-2">
            {due && (
              <Text className="text-xs" style={{ color: due.color }}>
                {due.text}
              </Text>
            )}
            {priorityCfg && (
              <Text className="text-xs" style={{ color: priorityCfg.color }}>
                {priorityCfg.icon} {item.priority}
              </Text>
            )}
          </View>
        </View>

        {/* Right: status badge */}
        <View
          className="rounded-full px-2 py-1"
          style={{ backgroundColor: `${statusCfg.color}20` }}
        >
          <Text className="text-[11px] font-bold" style={{ color: statusCfg.color }}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* Platform badge */}
      {item.platform && (
        <Text className="mt-1.5 text-[10px] text-slate-600 uppercase tracking-wide">
          {item.platform}
        </Text>
      )}
    </Pressable>
  );
}

export default function GcPunchlistScreen() {
  const router = useRouter();
  const { groups, closedItems, loading, counts } = useGcPunchList();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showClosed, setShowClosed] = useState(false);

  function filterItem(item: GcPunchItem): boolean {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
    return true;
  }

  const filteredGroups = groups
    .map((g) => ({ ...g, items: g.items.filter(filterItem) }))
    .filter((g) => g.items.length > 0);

  const filteredClosed = closedItems.filter(filterItem);

  return (
    <>
      <Stack.Screen options={{ title: 'GC Punchlist' }} />
      <View className="flex-1 bg-background">

        {/* KPI bar */}
        <View className="flex-row items-center justify-around border-b border-border px-2 py-3">
          <KPI label="Open"     value={counts.open}             color="#9CA3AF" />
          <KPI label="Working"  value={counts.in_progress}      color="#F59E0B" />
          <KPI label="Review"   value={counts.ready_for_review} color="#3B82F6" />
          <KPI label="Closed"   value={counts.closed}           color="#22C55E" />
        </View>

        {/* Status filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-border px-3 py-2"
        >
          <View className="flex-row gap-2">
            {([
              { value: 'all',             label: 'All' },
              { value: 'open',            label: 'Open' },
              { value: 'in_progress',     label: 'In Progress' },
              { value: 'ready_for_review',label: 'Ready' },
            ] as { value: StatusFilter; label: string }[]).map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setStatusFilter(f.value)}
                className={`rounded-full px-3 py-1.5 ${
                  statusFilter === f.value ? 'bg-brand-orange' : 'border border-border bg-card'
                }`}
              >
                <Text className={`text-xs font-semibold ${statusFilter === f.value ? 'text-white' : 'text-slate-400'}`}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
            <View className="w-px bg-border mx-1" />
            {([
              { value: 'all',      label: 'Any priority' },
              { value: 'high',     label: '⚡ High' },
              { value: 'critical', label: '🔴 Critical' },
            ] as { value: PriorityFilter; label: string }[]).map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setPriorityFilter(f.value)}
                className={`rounded-full px-3 py-1.5 ${
                  priorityFilter === f.value ? 'bg-blue-600' : 'border border-border bg-card'
                }`}
              >
                <Text className={`text-xs font-semibold ${priorityFilter === f.value ? 'text-white' : 'text-slate-400'}`}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : filteredGroups.length === 0 && filteredClosed.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="checkmark-done-circle-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              No punch items to resolve.
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4 pt-3">

            {/* Active groups */}
            {filteredGroups.map((group) => (
              <View key={group.key} className="mb-4">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {group.key}
                </Text>
                {group.items.map((item) => (
                  <PunchCard
                    key={item.id}
                    item={item}
                    onPress={() => router.push(`/(tabs)/more/punchlist/${item.id}` as any)}
                  />
                ))}
              </View>
            ))}

            {/* Closed section — collapsible */}
            {filteredClosed.length > 0 && (
              <View className="mb-4">
                <Pressable
                  onPress={() => setShowClosed((v) => !v)}
                  className="mb-2 flex-row items-center justify-between"
                >
                  <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Closed ({filteredClosed.length})
                  </Text>
                  <Ionicons
                    name={showClosed ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#64748B"
                  />
                </Pressable>
                {showClosed && filteredClosed.map((item) => (
                  <PunchCard
                    key={item.id}
                    item={item}
                    onPress={() => router.push(`/(tabs)/more/punchlist/${item.id}` as any)}
                  />
                ))}
              </View>
            )}

            <View className="h-24" />
          </ScrollView>
        )}
      </View>
    </>
  );
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="items-center">
      <Text className="text-xl font-bold" style={{ color }}>{value}</Text>
      <Text className="text-xs text-slate-500">{label}</Text>
    </View>
  );
}
