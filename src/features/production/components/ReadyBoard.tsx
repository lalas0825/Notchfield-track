import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ProductionArea, FloorGroup } from '../store/production-store';

type StatusFilter = 'all' | 'blocked' | 'in_progress' | 'complete' | 'not_started';

const STATUS_CONFIG: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  complete: { color: '#22C55E', icon: 'checkmark-circle', label: 'Complete' },
  in_progress: { color: '#F59E0B', icon: 'ellipse', label: 'In Progress' },
  blocked: { color: '#EF4444', icon: 'close-circle', label: 'Blocked' },
  not_started: { color: '#9CA3AF', icon: 'ellipse-outline', label: 'Not Started' },
};

const BLOCK_REASONS: Record<string, string> = {
  other_trade: 'Other trade',
  material: 'No material',
  inspection: 'Pending inspection',
  access: 'Access denied',
  rework: 'Rework needed',
  design: 'Design issue',
  other: 'Other',
};

type Props = {
  floors: FloorGroup[];
  blockedCount: number;
  inProgressCount: number;
  completedCount: number;
  totalCount: number;
  onAreaPress: (area: ProductionArea) => void;
};

export function ReadyBoard({
  floors,
  blockedCount,
  inProgressCount,
  completedCount,
  totalCount,
  onAreaPress,
}: Props) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (floor: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(floor) ? next.delete(floor) : next.add(floor);
      return next;
    });
  };

  // Filter areas
  const filteredFloors = floors
    .map((f) => ({
      ...f,
      areas: f.areas.filter((a) => {
        if (filter !== 'all' && a.status !== filter) return false;
        if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    }))
    .filter((f) => f.areas.length > 0);

  return (
    <View className="flex-1">
      {/* Status summary bar — tappable filters */}
      <View className="flex-row items-center justify-around border-b border-border px-2 py-2">
        <StatusChip
          count={blockedCount}
          color="#EF4444"
          icon="close-circle"
          active={filter === 'blocked'}
          onPress={() => setFilter(filter === 'blocked' ? 'all' : 'blocked')}
        />
        <StatusChip
          count={inProgressCount}
          color="#F59E0B"
          icon="ellipse"
          active={filter === 'in_progress'}
          onPress={() => setFilter(filter === 'in_progress' ? 'all' : 'in_progress')}
        />
        <StatusChip
          count={completedCount}
          color="#22C55E"
          icon="checkmark-circle"
          active={filter === 'complete'}
          onPress={() => setFilter(filter === 'complete' ? 'all' : 'complete')}
        />
        <StatusChip
          count={totalCount - blockedCount - inProgressCount - completedCount}
          color="#9CA3AF"
          icon="ellipse-outline"
          active={filter === 'not_started'}
          onPress={() => setFilter(filter === 'not_started' ? 'all' : 'not_started')}
        />
      </View>

      {/* Search */}
      <View className="mx-4 mt-2 flex-row items-center rounded-xl border border-border bg-card px-3">
        <Ionicons name="search" size={16} color="#64748B" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search areas..."
          placeholderTextColor="#64748B"
          className="ml-2 h-10 flex-1 text-sm text-white"
        />
      </View>

      {/* Area list grouped by floor */}
      <ScrollView className="flex-1 px-4 pt-2">
        {filteredFloors.length === 0 ? (
          <View className="items-center py-16">
            <Ionicons name="grid-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              {search ? 'No areas match your search.' : 'No production areas yet.'}
            </Text>
          </View>
        ) : (
          filteredFloors.map((floorGroup) => (
            <View key={floorGroup.floor} className="mb-3">
              {/* Floor header */}
              <Pressable
                onPress={() => toggleCollapse(floorGroup.floor)}
                className="mb-1 flex-row items-center justify-between py-1"
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={collapsed.has(floorGroup.floor) ? 'chevron-forward' : 'chevron-down'}
                    size={14}
                    color="#94A3B8"
                  />
                  <Text className="ml-1 text-sm font-bold text-slate-400">
                    {floorGroup.floor}
                  </Text>
                </View>
                {/* Floor metrics */}
                <View className="flex-row items-center gap-2">
                  {/* Blocked badge */}
                  {floorGroup.blockedCount > 0 && (
                    <View className="flex-row items-center rounded-full bg-red-500/20 px-2 py-0.5">
                      <Ionicons name="alert-circle" size={10} color="#EF4444" />
                      <Text className="ml-0.5 text-xs font-bold text-danger">{floorGroup.blockedCount}</Text>
                    </View>
                  )}
                  {/* Gate health */}
                  {floorGroup.totalGates > 0 && (
                    <View className="flex-row items-center">
                      <Ionicons
                        name="shield-checkmark"
                        size={12}
                        color={floorGroup.gateHealthPct === 100 ? '#22C55E' : '#F59E0B'}
                      />
                      <Text className="ml-0.5 text-xs text-slate-500">
                        {floorGroup.completedGates}/{floorGroup.totalGates}
                      </Text>
                    </View>
                  )}
                  {/* Progress bar */}
                  <View className="mr-1 h-2 w-16 overflow-hidden rounded-full bg-slate-700">
                    <View
                      className="h-full rounded-full bg-success"
                      style={{ width: `${floorGroup.progressPct}%` }}
                    />
                  </View>
                  <Text className="text-xs text-slate-500">{floorGroup.progressPct}%</Text>
                </View>
              </Pressable>

              {/* Area rows */}
              {!collapsed.has(floorGroup.floor) &&
                floorGroup.areas.map((area) => (
                  <AreaRow key={area.id} area={area} onPress={() => onAreaPress(area)} />
                ))}
            </View>
          ))
        )}
        <View className="h-24" />
      </ScrollView>
    </View>
  );
}

function AreaRow({ area, onPress }: { area: ProductionArea; onPress: () => void }) {
  const config = STATUS_CONFIG[area.status] ?? STATUS_CONFIG.not_started;

  return (
    <Pressable
      onPress={onPress}
      className="mb-1.5 flex-row items-center rounded-xl border border-border bg-card px-4 py-3 active:opacity-80"
    >
      {/* Status dot */}
      <View className="h-4 w-4 items-center justify-center">
        <Ionicons name={config.icon} size={16} color={config.color} />
      </View>

      {/* Area info */}
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <Text className="text-base font-medium text-white">{area.name}</Text>
        </View>
        {area.status === 'blocked' && area.blocked_reason && (
          <View className="mt-0.5 flex-row items-center">
            <Text className="text-sm text-danger">
              ↳ {BLOCK_REASONS[area.blocked_reason] ?? area.blocked_reason}
            </Text>
          </View>
        )}
      </View>

      {/* Status label */}
      <Text className="text-xs font-medium" style={{ color: config.color }}>
        {config.label}
      </Text>
    </Pressable>
  );
}

function StatusChip({
  count,
  color,
  icon,
  active,
  onPress,
}: {
  count: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-full px-3 py-1.5 ${active ? 'border border-white/30' : ''}`}
      style={active ? { backgroundColor: `${color}20` } : undefined}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text className="ml-1 text-sm font-bold" style={{ color }}>
        {count}
      </Text>
    </Pressable>
  );
}
