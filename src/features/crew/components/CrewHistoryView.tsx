/**
 * Sprint Crew P2 — CrewHistoryView.
 *
 * Historical reporting view shown as the "History" tab inside the Crew
 * screen. Two pivots over a date range:
 *   - By area:   "L3-E2: Carlos 18h, Mario 12h | total 30h"
 *   - By worker: "Carlos: L3-E2 18h, L3-E4 6h | total 24h"
 *
 * Date range — preset chips (Today / Yesterday / 7d / 30d). Custom range
 * deferred until pilot asks for it (most reporting is week-anchored).
 *
 * Tap a worker row → WorkerTimelineModal shows the worker's segments
 * within the selected range. Tap an area row → expands inline showing
 * each worker's hours.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/features/projects/store/project-store';
import {
  useCrewHistory,
  type ByAreaRow,
  type ByWorkerRow,
} from '../hooks/useCrewHistory';
import { WorkerTimelineModal } from './WorkerTimelineModal';

type Pivot = 'by_area' | 'by_worker';
type RangeKey = 'today' | 'yesterday' | '7d' | '30d';

const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

function rangeFor(key: RangeKey): { fromISO: string; toISO: string } {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (key === 'today') {
    const tomorrow = new Date(startOfToday);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { fromISO: startOfToday.toISOString(), toISO: tomorrow.toISOString() };
  }
  if (key === 'yesterday') {
    const yesterday = new Date(startOfToday);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      fromISO: yesterday.toISOString(),
      toISO: startOfToday.toISOString(),
    };
  }
  if (key === '7d') {
    const sevenAgo = new Date(startOfToday);
    sevenAgo.setDate(sevenAgo.getDate() - 7);
    const tomorrow = new Date(startOfToday);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      fromISO: sevenAgo.toISOString(),
      toISO: tomorrow.toISOString(),
    };
  }
  // 30d
  const thirtyAgo = new Date(startOfToday);
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    fromISO: thirtyAgo.toISOString(),
    toISO: tomorrow.toISOString(),
  };
}

function fmtHours(h: number): string {
  if (h < 0.1) return '<0.1h';
  return `${h.toFixed(1)}h`;
}

export function CrewHistoryView() {
  const { activeProject } = useProjectStore();
  const [range, setRange] = useState<RangeKey>('7d');
  const [pivot, setPivot] = useState<Pivot>('by_area');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(null);

  const { fromISO, toISO } = useMemo(() => rangeFor(range), [range]);

  const { byArea, byWorker, grandTotal, loading, entryCount } = useCrewHistory({
    projectId: activeProject?.id ?? null,
    fromISO,
    toISO,
  });

  return (
    <View style={{ flex: 1 }}>
      {/* Range pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        style={{ flexGrow: 0, paddingTop: 12, paddingBottom: 4 }}
      >
        {(['today', 'yesterday', '7d', '30d'] as RangeKey[]).map((k) => {
          const active = range === k;
          return (
            <Pressable
              key={k}
              onPress={() => setRange(k)}
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
                {RANGE_LABEL[k]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Summary strip */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 8,
        }}
      >
        <SummaryChip
          color="#22C55E"
          label="Man-hours"
          value={fmtHours(grandTotal)}
        />
        <SummaryChip
          color="#3B82F6"
          label="Areas"
          value={String(byArea.length)}
        />
        <SummaryChip
          color="#F97316"
          label="Workers"
          value={String(byWorker.length)}
        />
        <SummaryChip
          color="#94A3B8"
          label="Segments"
          value={String(entryCount)}
        />
      </View>

      {/* Pivot toggle */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: '#334155',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <PivotTab
          label="By Area"
          active={pivot === 'by_area'}
          onPress={() => setPivot('by_area')}
        />
        <PivotTab
          label="By Worker"
          active={pivot === 'by_worker'}
          onPress={() => setPivot('by_worker')}
        />
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: 12 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      >
        {loading ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: '#94A3B8' }}>Loading…</Text>
          </View>
        ) : pivot === 'by_area' ? (
          byArea.length === 0 ? (
            <EmptyState />
          ) : (
            byArea.map((row) => (
              <ByAreaCard
                key={row.area_id}
                row={row}
                expanded={expandedAreaId === row.area_id}
                onToggle={() =>
                  setExpandedAreaId(
                    expandedAreaId === row.area_id ? null : row.area_id,
                  )
                }
                onPickWorker={(w) =>
                  setPicked({ id: w.worker_id, name: w.full_name })
                }
              />
            ))
          )
        ) : byWorker.length === 0 ? (
          <EmptyState />
        ) : (
          byWorker.map((row) => (
            <ByWorkerCard
              key={row.worker_id}
              row={row}
              onPick={() =>
                setPicked({ id: row.worker_id, name: row.full_name })
              }
            />
          ))
        )}
      </ScrollView>

      <WorkerTimelineModal
        visible={picked !== null}
        onClose={() => setPicked(null)}
        workerId={picked?.id ?? null}
        workerName={picked?.name ?? null}
        fromISO={fromISO}
        toISO={toISO}
      />
    </View>
  );
}

function SummaryChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 8,
        borderRadius: 10,
        backgroundColor: `${color}15`,
        borderWidth: 1,
        borderColor: `${color}40`,
        alignItems: 'center',
      }}
    >
      <Text style={{ color, fontSize: 16, fontWeight: '700' }}>{value}</Text>
      <Text
        style={{
          color: '#94A3B8',
          fontSize: 9,
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

function PivotTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: active ? '#F97316' : 'transparent',
      }}
    >
      <Text
        style={{
          color: active ? '#FFFFFF' : '#94A3B8',
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ByAreaCard({
  row,
  expanded,
  onToggle,
  onPickWorker,
}: {
  row: ByAreaRow;
  expanded: boolean;
  onToggle: () => void;
  onPickWorker: (w: ByAreaRow['workers'][0]) => void;
}) {
  return (
    <View
      style={{
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: '#1E293B',
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}
          >
            {row.area_floor ? `${row.area_floor} · ` : ''}
            {row.area_label}
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
            {row.workers.length} {row.workers.length === 1 ? 'worker' : 'workers'}
          </Text>
        </View>
        <Text
          style={{ color: '#22C55E', fontSize: 14, fontWeight: '700' }}
        >
          {fmtHours(row.total_hours)}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#475569"
        />
      </Pressable>

      {expanded ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: '#0F172A',
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          {row.workers.map((w) => (
            <Pressable
              key={w.worker_id}
              onPress={() => onPickWorker(w)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                gap: 8,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: '#F8FAFC', fontSize: 13 }}
                >
                  {w.full_name}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 10, marginTop: 1 }}>
                  {w.trade_level ?? w.trade ?? 'worker'} · {w.segments} {w.segments === 1 ? 'seg' : 'segs'}
                </Text>
              </View>
              <Text
                style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}
              >
                {fmtHours(w.hours)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#475569" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ByWorkerCard({
  row,
  onPick,
}: {
  row: ByWorkerRow;
  onPick: () => void;
}) {
  return (
    <Pressable
      onPress={onPick}
      style={{
        marginBottom: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: '#1E293B',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}
        >
          {row.full_name}
        </Text>
        <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
          {row.trade_level ?? row.trade ?? 'worker'} ·{' '}
          {row.areas.length} {row.areas.length === 1 ? 'area' : 'areas'}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}
        >
          {row.areas
            .slice(0, 3)
            .map((a) => `${a.area_label} ${fmtHours(a.hours)}`)
            .join(' · ')}
          {row.areas.length > 3 ? ' · …' : ''}
        </Text>
      </View>
      <Text
        style={{ color: '#22C55E', fontSize: 14, fontWeight: '700' }}
      >
        {fmtHours(row.total_hours)}
      </Text>
      <Ionicons name="chevron-forward" size={14} color="#475569" />
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View
      style={{
        padding: 48,
        alignItems: 'center',
      }}
    >
      <Ionicons name="time-outline" size={40} color="#475569" />
      <Text
        style={{
          color: '#94A3B8',
          marginTop: 12,
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        No time logged in this range.
      </Text>
    </View>
  );
}
