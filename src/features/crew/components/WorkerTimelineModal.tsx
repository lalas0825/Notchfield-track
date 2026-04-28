/**
 * Sprint Crew P1 — WorkerTimelineModal.
 *
 * Bottom-sheet modal that shows a single worker's day:
 *   "L3-E2 — 7h (07:00 → 14:00)"
 *   "L3-E4 — 3h (14:00 → 17:00)"
 *   "Total: 10h"
 *
 * Open entries (ended_at NULL) display "running" with live elapsed time
 * recomputed every 30s by the underlying hook.
 *
 * Tappable from any list — AreaCrewTile, Crew screen, future History
 * view. Pure read-only; no edit affordances at P1 (foreman re-assigns
 * via the Crew screen, that closes/opens entries through the existing
 * crew-store path).
 */

import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkerTimeline } from '../hooks/useWorkerTimeline';

type Props = {
  visible: boolean;
  onClose: () => void;
  workerId: string | null;
  workerName: string | null;
  /** Defaults to today. Pass other ranges from history view. */
  fromISO?: string;
  toISO?: string;
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtHours(h: number): string {
  if (h < 0.1) return '<0.1h';
  return `${h.toFixed(1)}h`;
}

export function WorkerTimelineModal({
  visible,
  onClose,
  workerId,
  workerName,
  fromISO,
  toISO,
}: Props) {
  const { segments, totalHours, loading } = useWorkerTimeline(
    visible ? workerId : null,
    { fromISO, toISO },
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: '#1E293B',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: '#334155',
            maxHeight: '80%',
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#475569',
              }}
            />
          </View>

          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '700' }}>
              {workerName ?? 'Worker'}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 6,
                gap: 6,
              }}
            >
              <Ionicons name="time" size={14} color="#22C55E" />
              <Text style={{ color: '#22C55E', fontSize: 14, fontWeight: '700' }}>
                Total {fmtHours(totalHours)}
              </Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>
                · {segments.length} {segments.length === 1 ? 'segment' : 'segments'}
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          >
            {loading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8' }}>Loading timeline…</Text>
              </View>
            ) : segments.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={40} color="#475569" />
                <Text style={{ color: '#94A3B8', marginTop: 12 }}>
                  No time logged in this range.
                </Text>
              </View>
            ) : (
              segments.map((seg, i) => {
                const open = seg.ended_at === null;
                return (
                  <View
                    key={seg.id}
                    style={{
                      flexDirection: 'row',
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: '#0F172A',
                    }}
                  >
                    {/* Timeline dot column */}
                    <View
                      style={{
                        width: 24,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: open ? '#22C55E' : '#475569',
                          marginTop: 4,
                        }}
                      />
                      {i < segments.length - 1 ? (
                        <View
                          style={{
                            flex: 1,
                            width: 2,
                            backgroundColor: '#334155',
                            marginTop: 2,
                          }}
                        />
                      ) : null}
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text
                          style={{
                            color: '#F8FAFC',
                            fontSize: 15,
                            fontWeight: '700',
                          }}
                        >
                          {seg.area_floor
                            ? `${seg.area_floor} · `
                            : ''}
                          {seg.area_label}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: open ? '#22C55E20' : '#475569',
                          }}
                        >
                          <Text
                            style={{
                              color: open ? '#22C55E' : '#F8FAFC',
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {fmtHours(seg.elapsed_hours)}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={{
                          color: '#94A3B8',
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        {fmtTime(seg.started_at)}
                        {open
                          ? ' → running'
                          : ` → ${fmtTime(seg.ended_at as string)}`}
                        {seg.worker_role ? ` · ${seg.worker_role}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
