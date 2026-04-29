/**
 * Sprint Crew P1 — AreaCrewTile.
 *
 * Mounted in AreaDetail's `renderCrew` slot. Two compact sections:
 *
 *   1. Currently here (workers with open time entries, live elapsed)
 *   2. Worked here today (closed entries, sorted recent first)
 *
 * Each row → tap → WorkerTimelineModal showing the worker's full day.
 *
 * Total man-hours for the day (open + closed) shown in the header.
 *
 * Worker assignment / re-assignment is NOT done here — that lives on
 * the Crew screen (More → Crew). This tile is read-only context for
 * the foreman/supervisor walking the floor: "who's been in this room?"
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAreaCrew, type AreaCrewEntry } from '../hooks/useAreaCrew';
import { WorkerTimelineModal } from './WorkerTimelineModal';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';

type Props = {
  areaId: string;
};

function fmtHours(h: number): string {
  if (h < 0.1) return '<0.1h';
  return `${h.toFixed(1)}h`;
}

/**
 * Time-only for today, date+time for other days. Same logic as
 * WorkerTimelineModal so the AreaCrewTile labels stay consistent
 * when an entry crossed midnight or the foreman is viewing post-shift.
 */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AreaCrewTile({ areaId }: Props) {
  const { currentWorkers, todayWorkers, totalHoursToday, loading } =
    useAreaCrew(areaId);

  const [picked, setPicked] = useState<{
    workerId: string;
    workerName: string;
  } | null>(null);

  const onPressEntry = (entry: AreaCrewEntry) => {
    setPicked({
      workerId: entry.worker.worker_id,
      workerName: entry.worker.full_name,
    });
  };

  const hasAnyToday = currentWorkers.length > 0 || todayWorkers.length > 0;

  // Smart auto-expand: open when there are workers actively here right
  // now (foreman walking the floor wants to see who's in the room).
  // Closed entries from earlier today stay collapsed by default — they're
  // historical context, not live action.
  const shouldAutoExpand = currentWorkers.length > 0;

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="people" size={18} color="#3B82F6" />
        <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>
          Crew
        </Text>
        {!loading && hasAnyToday ? (
          <Text style={{ color: '#64748B', fontSize: 13 }}>
            {fmtHours(totalHoursToday)} today
          </Text>
        ) : null}
      </View>
      {currentWorkers.length > 0 ? (
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: '#22C55E20',
            borderWidth: 1,
            borderColor: '#22C55E',
          }}
        >
          <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>
            {currentWorkers.length} active
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <CollapsibleSection header={header} defaultExpanded={shouldAutoExpand}>
        {loading ? (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: '#64748B', fontSize: 13 }}>Loading…</Text>
          </View>
        ) : !hasAnyToday ? (
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 4,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#64748B', fontSize: 13 }}>
              No workers logged here today.
            </Text>
          </View>
        ) : (
          <>
            {currentWorkers.length > 0 ? (
              <SectionLabel text="Currently here" color="#22C55E" />
            ) : null}
            {currentWorkers.map((entry) => (
              <CrewRow
                key={entry.id}
                entry={entry}
                live
                onPress={() => onPressEntry(entry)}
              />
            ))}

            {todayWorkers.length > 0 ? (
              <SectionLabel text="Worked here today" color="#94A3B8" />
            ) : null}
            {todayWorkers.map((entry) => (
              <CrewRow
                key={entry.id}
                entry={entry}
                live={false}
                onPress={() => onPressEntry(entry)}
              />
            ))}
          </>
        )}
      </CollapsibleSection>

      <WorkerTimelineModal
        visible={picked !== null}
        onClose={() => setPicked(null)}
        workerId={picked?.workerId ?? null}
        workerName={picked?.workerName ?? null}
      />
    </>
  );
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return (
    <Text
      style={{
        color,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginTop: 8,
        marginBottom: 4,
        paddingHorizontal: 4,
      }}
    >
      {text}
    </Text>
  );
}

function CrewRow({
  entry,
  live,
  onPress,
}: {
  entry: AreaCrewEntry;
  live: boolean;
  onPress: () => void;
}) {
  const accent = live ? '#22C55E' : '#475569';
  const subtitle = live
    ? `since ${fmtTime(entry.started_at)} · ${entry.worker_role}`
    : `${fmtTime(entry.started_at)} → ${entry.ended_at ? fmtTime(entry.ended_at) : '—'} · ${entry.worker_role}`;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#1E293B' }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        gap: 10,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: accent,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}
        >
          {entry.worker.full_name}
        </Text>
        <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <Text
        style={{ color: accent, fontSize: 13, fontWeight: '700' }}
      >
        {fmtHours(entry.elapsed_hours)}
      </Text>
      <Ionicons name="chevron-forward" size={14} color="#475569" />
    </Pressable>
  );
}
