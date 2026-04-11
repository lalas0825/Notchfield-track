/**
 * GC Punch Item Detail Screen — Sprint 42B
 * ==========================================
 * Polisher workflow:
 *   Open → Start Work (in_progress) → Mark Ready for Review → done
 *
 * Sections:
 *   Header: item #, platform, title, location, due date, priority
 *   Description: read-only from GC
 *   GC Photos: external_photos JSON — what needs to be fixed
 *   Resolution: status, hours, notes, resolution photos
 *   Action button
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { localQuery } from '@/shared/lib/powersync/write';
import { haptic } from '@/shared/lib/haptics';
import {
  parsePhotos,
  updateGcPunchStatus,
  saveGcPunchResolution,
  uploadResolutionPhoto,
  type GcPunchItem,
  type GcPunchStatus,
} from '@/features/gc-punch/services/gc-punch-service';
import { supabase } from '@/shared/lib/supabase/client';

const STATUS_CONFIG: Record<GcPunchStatus, { color: string; label: string }> = {
  open:             { color: '#9CA3AF', label: 'Open' },
  in_progress:      { color: '#F59E0B', label: 'In Progress' },
  ready_for_review: { color: '#3B82F6', label: 'Ready for Review' },
  closed:           { color: '#22C55E', label: 'Closed' },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:      '#22C55E',
  medium:   '#F59E0B',
  high:     '#F97316',
  critical: '#EF4444',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(due) < new Date();
}

export default function GcPunchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();

  const [item, setItem] = useState<GcPunchItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Resolution fields (local state, saved on blur / action)
  const [hours, setHours] = useState('0');
  const [notes, setNotes] = useState('');
  const [resPhotos, setResPhotos] = useState<string[]>([]);

  const hoursDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    const local = await localQuery<GcPunchItem>(
      `SELECT * FROM gc_punch_items WHERE id = ?`,
      [id],
    );
    if (local !== null && local.length > 0) {
      const it = local[0];
      setItem(it);
      setHours(String(it.hours_logged ?? 0));
      setNotes(it.resolution_notes ?? '');
      setResPhotos(parsePhotos(it.resolution_photos));
    } else {
      const { data } = await supabase
        .from('gc_punch_items')
        .select('*')
        .eq('id', id)
        .single();
      if (data) {
        const it = data as GcPunchItem;
        setItem(it);
        setHours(String(it.hours_logged ?? 0));
        setNotes(it.resolution_notes ?? '');
        setResPhotos(parsePhotos(it.resolution_photos));
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Auto-save hours on change ─────────────────────────────────────────────
  const handleHoursChange = (val: string) => {
    setHours(val);
    if (hoursDebounce.current) clearTimeout(hoursDebounce.current);
    hoursDebounce.current = setTimeout(async () => {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed >= 0) {
        await saveGcPunchResolution(id!, { hours_logged: parsed });
      }
    }, 800);
  };

  // ── Save notes on blur ────────────────────────────────────────────────────
  const handleNotesBlur = async () => {
    await saveGcPunchResolution(id!, { resolution_notes: notes });
  };

  // ── Take resolution photo ─────────────────────────────────────────────────
  const handleTakePhoto = async () => {
    if (!user || !activeProject) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.75 });
    if (result.canceled || !result.assets[0]) return;

    haptic.light();
    const localUri = result.assets[0].uri;

    // Optimistic: show local URI immediately
    const updatedPhotos = [...resPhotos, localUri];
    setResPhotos(updatedPhotos);

    // Upload + replace with remote URL (non-blocking)
    uploadResolutionPhoto({
      localUri,
      organizationId: profile?.organization_id ?? '',
      itemId: id!,
    }).then(async (url) => {
      const finalPhotos = updatedPhotos.map((p) => (p === localUri ? url : p));
      setResPhotos(finalPhotos);
      await saveGcPunchResolution(id!, { resolution_photos: finalPhotos });
    });
  };

  // ── Status actions ────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: GcPunchStatus) => {
    if (!user || !item) return;
    setSaving(true);
    haptic.medium();
    const result = await updateGcPunchStatus(item.id, newStatus, user.id);
    setSaving(false);
    if (result.success) {
      setItem((prev) => prev ? { ...prev, status: newStatus } : prev);
      if (newStatus === 'ready_for_review') haptic.success();
    } else {
      Alert.alert('Error', result.error ?? 'Could not update status.');
    }
  };

  // ── Loading / empty states ────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }
  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-base text-slate-400">Punch item not found.</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open;
  const priorityColor = PRIORITY_COLOR[item.priority ?? ''] ?? '#94A3B8';
  const itemLabel = item.item_number ? `PL-${item.item_number}` : `#${item.external_item_id?.slice(0, 8) ?? '—'}`;
  const gcPhotos = parsePhotos(item.external_photos);
  const isClosed = item.status === 'closed';
  const overdue = isOverdue(item.due_date);

  // Action button config
  type ActionBtn = { label: string; color: string; onPress: () => void } | null;
  let actionBtn: ActionBtn = null;
  if (item.status === 'open') {
    actionBtn = { label: 'Start Work', color: '#F59E0B', onPress: () => handleStatusChange('in_progress') };
  } else if (item.status === 'in_progress') {
    actionBtn = { label: 'Mark Ready for Review', color: '#3B82F6', onPress: () => handleStatusChange('ready_for_review') };
  } else if (item.status === 'ready_for_review') {
    actionBtn = { label: 'Reopen', color: '#9CA3AF', onPress: () => handleStatusChange('in_progress') };
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: itemLabel,
          headerRight: () => (
            <View className="mr-2 rounded-full px-2 py-0.5" style={{ backgroundColor: `${statusCfg.color}25` }}>
              <Text className="text-xs font-bold" style={{ color: statusCfg.color }}>
                {statusCfg.label}
              </Text>
            </View>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-background">
        <View className="px-4 pt-4">

          {/* ── Header card ───────────────────────────────────────────────── */}
          <View className="mb-4 rounded-2xl border border-border bg-card p-4">
            {/* Platform badge */}
            {item.platform && (
              <Text className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                {item.platform}
              </Text>
            )}

            {/* Title */}
            <Text className="text-lg font-bold text-white">{item.title}</Text>

            {/* Location */}
            <View className="mt-2 flex-row items-center flex-wrap gap-x-3 gap-y-1">
              {(item.floor || item.unit) && (
                <View className="flex-row items-center">
                  <Ionicons name="location-outline" size={13} color="#64748B" />
                  <Text className="ml-0.5 text-sm text-slate-400">
                    {[item.floor, item.unit].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}
              {item.location_description && (
                <Text className="text-sm text-slate-400">· {item.location_description}</Text>
              )}
            </View>

            {/* Due date + priority */}
            <View className="mt-2 flex-row items-center gap-4">
              {item.due_date && (
                <Text className="text-sm" style={{ color: overdue ? '#EF4444' : '#94A3B8' }}>
                  Due: {formatDate(item.due_date)}{overdue ? ' ⚠️' : ''}
                </Text>
              )}
              {item.priority && (
                <View className="flex-row items-center">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: priorityColor }} />
                  <Text className="ml-1.5 text-sm capitalize" style={{ color: priorityColor }}>
                    {item.priority}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Description ───────────────────────────────────────────────── */}
          {item.description ? (
            <View className="mb-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Description
              </Text>
              <View className="rounded-xl border border-border bg-card p-4">
                <Text className="text-sm leading-5 text-slate-300">{item.description}</Text>
              </View>
            </View>
          ) : null}

          {/* ── GC Photos ─────────────────────────────────────────────────── */}
          {gcPhotos.length > 0 && (
            <View className="mb-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                GC Photos ({gcPhotos.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {gcPhotos.map((uri, i) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      className="rounded-xl"
                      style={{ width: 120, height: 120 }}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── Resolution ────────────────────────────────────────────────── */}
          <View className="mb-4">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Resolution
            </Text>
            <View className="rounded-2xl border border-border bg-card p-4">

              {isClosed ? (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  <Text className="ml-2 text-base font-medium text-success">Closed by GC</Text>
                </View>
              ) : (
                <>
                  {/* Hours */}
                  <View className="mb-4 flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-slate-300">Hours worked</Text>
                    <View className="flex-row items-center gap-3">
                      <Pressable
                        onPress={() => {
                          const v = Math.max(0, parseFloat(hours) - 0.5);
                          handleHoursChange(String(v));
                        }}
                        className="h-10 w-10 items-center justify-center rounded-lg border border-border bg-background active:opacity-70"
                      >
                        <Ionicons name="remove" size={18} color="#94A3B8" />
                      </Pressable>
                      <TextInput
                        value={hours}
                        onChangeText={handleHoursChange}
                        keyboardType="decimal-pad"
                        className="h-10 w-16 rounded-lg border border-border bg-background text-center text-base font-bold text-white"
                        style={{ fontSize: 18 }}
                      />
                      <Pressable
                        onPress={() => {
                          const v = parseFloat(hours) + 0.5;
                          handleHoursChange(String(v));
                        }}
                        className="h-10 w-10 items-center justify-center rounded-lg border border-border bg-background active:opacity-70"
                      >
                        <Ionicons name="add" size={18} color="#94A3B8" />
                      </Pressable>
                    </View>
                  </View>

                  {/* Notes */}
                  <View className="mb-4">
                    <Text className="mb-1.5 text-sm font-medium text-slate-300">Resolution notes</Text>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      onBlur={handleNotesBlur}
                      placeholder="Describe what was done..."
                      placeholderTextColor="#475569"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      className="rounded-xl border border-border bg-background p-3 text-sm text-white"
                      style={{ minHeight: 80 }}
                    />
                  </View>

                  {/* Resolution photos */}
                  <View>
                    <Text className="mb-2 text-sm font-medium text-slate-300">
                      Resolution photos {resPhotos.length > 0 ? `(${resPhotos.length})` : ''}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-2">
                        {resPhotos.map((uri, i) => (
                          <View key={i} className="relative">
                            <Image
                              source={{ uri }}
                              className="rounded-xl"
                              style={{ width: 90, height: 90 }}
                              resizeMode="cover"
                            />
                            <Pressable
                              onPress={async () => {
                                const updated = resPhotos.filter((_, j) => j !== i);
                                setResPhotos(updated);
                                await saveGcPunchResolution(id!, { resolution_photos: updated });
                              }}
                              className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-danger"
                            >
                              <Ionicons name="close" size={12} color="#fff" />
                            </Pressable>
                          </View>
                        ))}
                        <Pressable
                          onPress={handleTakePhoto}
                          className="h-[90px] w-[90px] items-center justify-center rounded-xl border-2 border-dashed border-slate-600 active:opacity-70"
                        >
                          <Ionicons name="camera-outline" size={26} color="#94A3B8" />
                          <Text className="mt-1 text-[10px] text-slate-500">Photo</Text>
                        </Pressable>
                      </View>
                    </ScrollView>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Action button ──────────────────────────────────────────────── */}
          {actionBtn && (
            <Pressable
              onPress={actionBtn.onPress}
              disabled={saving}
              className="mb-6 h-14 items-center justify-center rounded-2xl active:opacity-80"
              style={{ backgroundColor: actionBtn.color }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-bold text-white">{actionBtn.label}</Text>
              )}
            </Pressable>
          )}

          {isClosed && (
            <View className="mb-6 h-14 items-center justify-center rounded-2xl border border-border bg-card">
              <Text className="text-sm text-slate-500">Closed by GC — no further action needed</Text>
            </View>
          )}

          <View className="h-8" />
        </View>
      </ScrollView>
    </>
  );
}
