/**
 * Surface Checklist — per-surface status with camera + block-with-notes.
 *
 * State cycle (tap):  not_started → in_progress → completed → not_started
 * Long press:         opens "Block surface" modal with required notes textbox
 * Camera:             only available once status !== 'not_started'
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { enqueuePhoto } from '@/features/photos/services/photo-queue';
import { localUpdate, localQuery } from '@/shared/lib/powersync/write';
import { haptic } from '@/shared/lib/haptics';
import { autoCompleteAndForget } from '@/features/todos/services/todoApiClient';
import { calculateSurfaceProgress, type SurfaceRow } from '../utils/progressCalculation';
import { useProductionStore, type ProductionArea } from '../store/production-store';

type Status = 'not_started' | 'in_progress' | 'completed' | 'blocked';

interface SurfaceObject {
  id: string;
  area_id: string;
  takeoff_object_id: string;
  material_code?: string;
  name?: string;                    // surface position: "floor" | "wall" | "base" | "saddle"
  surface_type?: string;
  total_quantity_sf?: number | null;
  quantity_per_unit_sf?: number | null;
  unit?: string;
  status?: Status | string;
  blocked_reason?: string | null;
  notes?: string | null;
}

type Props = {
  areaId: string;
};

function normalizeStatus(s?: string): Status {
  if (s === 'completed' || s === 'complete') return 'completed';
  if (s === 'in_progress' || s === 'started') return 'in_progress';
  if (s === 'blocked') return 'blocked';
  return 'not_started';
}

function nextStatus(current: Status): Status {
  switch (current) {
    case 'not_started': return 'in_progress';
    case 'in_progress': return 'completed';
    case 'completed':   return 'not_started';
    case 'blocked':     return 'not_started'; // unblock cycle
  }
}

const STATUS_META: Record<Status, { icon: 'ellipse-outline' | 'time-outline' | 'checkmark-circle' | 'close-circle'; color: string; label: string }> = {
  not_started: { icon: 'ellipse-outline',   color: '#9CA3AF', label: 'Not started' },
  in_progress: { icon: 'time-outline',      color: '#F59E0B', label: 'In progress' },
  completed:   { icon: 'checkmark-circle',  color: '#22C55E', label: 'Done' },
  blocked:     { icon: 'close-circle',      color: '#EF4444', label: 'Blocked' },
};

/**
 * Derive the aggregate area status from its surfaces.
 * - Any blocked          → 'blocked'
 * - All completed        → 'completed'
 * - Any in_progress/completed → 'in_progress'
 * - Otherwise            → 'not_started'
 */
function deriveAreaStatus(surfaces: SurfaceObject[]): string {
  if (surfaces.length === 0) return 'not_started';
  const statuses = surfaces.map((s) => normalizeStatus(s.status));
  if (statuses.some((s) => s === 'blocked')) return 'blocked';
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.some((s) => s === 'in_progress' || s === 'completed')) return 'in_progress';
  return 'not_started';
}

export function SurfaceChecklist({ areaId }: Props) {
  const [surfaces, setSurfaces] = useState<SurfaceObject[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Block modal state
  const [blockSurface, setBlockSurface] = useState<SurfaceObject | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();

  const loadSurfaces = useCallback(async () => {
    if (!areaId) return;
    const local = await localQuery<SurfaceObject>(
      `SELECT * FROM production_area_objects WHERE area_id = ? ORDER BY created_at`,
      [areaId],
    );
    if (local !== null) {
      setSurfaces(local);
    } else {
      const { data } = await supabase
        .from('production_area_objects')
        .select('*')
        .eq('area_id', areaId)
        .order('created_at');
      setSurfaces((data ?? []) as SurfaceObject[]);
    }
    setLoading(false);
  }, [areaId]);

  const loadPhotoCounts = useCallback(async () => {
    if (!areaId) return;
    const local = await localQuery<{ object_id: string | null }>(
      `SELECT object_id FROM field_photos WHERE area_id = ? AND object_id IS NOT NULL`,
      [areaId],
    );
    let rows: { object_id: string | null }[];
    if (local !== null) {
      rows = local;
    } else {
      const { data } = await supabase
        .from('field_photos')
        .select('object_id')
        .eq('area_id', areaId)
        .not('object_id', 'is', null);
      rows = (data ?? []) as { object_id: string | null }[];
    }
    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (row.object_id) {
        counts[row.object_id] = (counts[row.object_id] ?? 0) + 1;
      }
    }
    setPhotoCounts(counts);
  }, [areaId]);

  useEffect(() => {
    loadSurfaces();
    loadPhotoCounts();
  }, [loadSurfaces, loadPhotoCounts]);

  /**
   * After any surface update, derive the aggregate area status and push it
   * to production_areas + the in-memory production store so the Board card
   * reflects the change immediately without a full refetch.
   */
  const propagateAreaStatus = useCallback(
    async (updatedSurfaces: SurfaceObject[]) => {
      const derived = deriveAreaStatus(updatedSurfaces);
      const now = new Date().toISOString();

      // Look up current area so we only transition timestamps on actual state changes
      const store = useProductionStore.getState();
      const currentArea = store.areas.find((a) => a.id === areaId);
      const previousStatus = currentArea?.status;

      // chk_blocked_has_reason: when status != 'blocked', blocked_reason must be null
      const areaUpdates: Record<string, unknown> = { status: derived };

      // Takeoff Estimator Feedback Loop requires completed_at to flag the area
      // as "done" — without this the area is ignored by the feedback loop.
      if (derived === 'completed' && previousStatus !== 'completed') {
        areaUpdates.completed_at = now;
        areaUpdates.completed_by = user?.id ?? null;
        areaUpdates.blocked_reason = null;
        areaUpdates.blocked_at = null;
      } else if (derived === 'in_progress') {
        // First time the area is touched after being not_started → stamp started_at
        if (!currentArea?.started_at) {
          areaUpdates.started_at = now;
        }
        // If we are transitioning out of 'blocked', clear blocked fields and
        // stamp the resolution so Takeoff Block Analysis closes the log.
        if (previousStatus === 'blocked') {
          areaUpdates.blocked_reason = null;
          areaUpdates.blocked_at = null;
          areaUpdates.blocked_resolved_at = now;
        }
        // Revert accidental completion (e.g., user cycled a surface back)
        if (previousStatus === 'completed') {
          areaUpdates.completed_at = null;
          areaUpdates.completed_by = null;
        }
      } else if (derived === 'not_started') {
        // Full reset — the area no longer has any active work
        areaUpdates.started_at = null;
        areaUpdates.completed_at = null;
        areaUpdates.completed_by = null;
        areaUpdates.blocked_reason = null;
        areaUpdates.blocked_at = null;
      } else if (derived === 'blocked') {
        // blocked_reason / blocked_at are set at the area level by the
        // block-surface modal or markAreaStatus — don't overwrite them here.
      }

      await localUpdate('production_areas', areaId, areaUpdates);

      // Optimistically update production store so ReadyBoard re-renders
      if (!currentArea) return;

      useProductionStore.setState((s) => ({
        areas: s.areas.map((a) =>
          a.id === areaId ? { ...a, ...areaUpdates } as ProductionArea : a,
        ),
      }));
      // Recalc floor metrics + KPI counts after the area update is committed
      store.recalcFloor(currentArea.floor ?? 'Unassigned');
    },
    [areaId, user],
  );

  const handleCycleStatus = useCallback(
    async (surface: SurfaceObject) => {
      if (!user) return;
      const current = normalizeStatus(surface.status);
      const next = nextStatus(current);
      const now = new Date().toISOString();

      const updates: Record<string, unknown> = { status: next };
      if (next === 'in_progress') {
        if (!('started_at' in surface) || !surface['started_at' as keyof SurfaceObject]) {
          updates.started_at = now;
        }
        updates.completed_at = null;
        updates.completed_by = null;
        updates.blocked_reason = null;
        updates.blocked_at = null;
        updates.blocked_by = null;
      } else if (next === 'completed') {
        updates.completed_at = now;
        updates.completed_by = user.id;
        updates.blocked_reason = null;
        updates.blocked_at = null;
        updates.blocked_by = null;
      } else if (next === 'not_started') {
        updates.started_at = null;
        updates.completed_at = null;
        updates.completed_by = null;
        updates.blocked_reason = null;
        updates.blocked_at = null;
        updates.blocked_by = null;
      }

      // Optimistic update of local surface list
      const updatedSurfaces = surfaces.map((s) =>
        s.id === surface.id ? { ...s, ...updates } as SurfaceObject : s,
      );
      setSurfaces(updatedSurfaces);

      if (next === 'completed') haptic.success();
      else haptic.light();

      await localUpdate('production_area_objects', surface.id, updates);
      await propagateAreaStatus(updatedSurfaces);

      // Sprint 70 — fire surface_progress_stale auto-complete when the
      // foreman marks a surface complete. Cron creates this todo on areas
      // that haven't been updated in N days; ANY surface flip to
      // 'completed' is progress and clears it. Web's auto-completion
      // engine matches by entity_type='production_area_objects' + entity_id.
      // .catch via and-forget — never blocks the user action.
      if (next === 'completed') {
        autoCompleteAndForget(
          { type: 'production_area_objects', id: surface.id },
          'surface_progress_stale',
        );
      }
    },
    [user, surfaces, propagateAreaStatus],
  );

  const openBlockModal = useCallback((surface: SurfaceObject) => {
    haptic.medium();
    setBlockSurface(surface);
    setBlockReason(surface.blocked_reason ?? '');
  }, []);

  const closeBlockModal = useCallback(() => {
    setBlockSurface(null);
    setBlockReason('');
  }, []);

  const submitBlock = useCallback(async () => {
    if (!user || !blockSurface) return;
    const trimmed = blockReason.trim();
    if (trimmed.length === 0) {
      Alert.alert('Reason required', 'Please describe why this surface is blocked.');
      return;
    }
    const now = new Date().toISOString();
    const updates = {
      status: 'blocked',
      blocked_reason: trimmed,
      blocked_at: now,
      blocked_by: user.id,
      notes: trimmed,
    };
    const updatedSurfaces = surfaces.map((s) =>
      s.id === blockSurface.id ? { ...s, ...updates } as SurfaceObject : s,
    );
    setSurfaces(updatedSurfaces);
    haptic.error();
    await localUpdate('production_area_objects', blockSurface.id, updates);
    await propagateAreaStatus(updatedSurfaces);
    closeBlockModal();
  }, [user, blockSurface, blockReason, surfaces, propagateAreaStatus, closeBlockModal]);

  const handleTakePhoto = useCallback(
    async (surface: SurfaceObject) => {
      if (!user || !profile || !activeProject) return;

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;

      let gpsLat: number | undefined;
      let gpsLng: number | undefined;
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gpsLat = loc.coords.latitude;
          gpsLng = loc.coords.longitude;
        }
      } catch { /* GPS best-effort */ }

      await enqueuePhoto({
        sourceUri: result.assets[0].uri,
        organizationId: profile.organization_id,
        projectId: activeProject.id,
        areaId,
        objectId: surface.id,
        contextType: normalizeStatus(surface.status) === 'blocked' ? 'blocked' : 'progress',
        takenBy: user.id,
        gpsLat,
        gpsLng,
      });

      haptic.success();
      setPhotoCounts((prev) => ({
        ...prev,
        [surface.id]: (prev[surface.id] ?? 0) + 1,
      }));
    },
    [user, profile, activeProject, areaId],
  );

  if (loading || surfaces.length === 0) return null;

  const progress = calculateSurfaceProgress(surfaces as SurfaceRow[]);
  const progressPct = Math.round(progress * 100);

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="cube" size={16} color="#3B82F6" />
          <Text className="ml-2 text-sm font-bold uppercase text-slate-400">
            Surfaces ({surfaces.length})
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className="mr-2 h-2 w-16 overflow-hidden rounded-full bg-slate-700">
            <View className="h-full rounded-full bg-blue-500" style={{ width: `${progressPct}%` }} />
          </View>
          <Text className="text-sm font-bold text-blue-400">{progressPct}%</Text>
        </View>
      </View>

      {/* Hint */}
      <Text className="mb-2 text-[11px] text-slate-500">
        Tap to cycle status · Long-press to mark blocked
      </Text>

      {surfaces.map((surface) => {
        const status = normalizeStatus(surface.status);
        const meta = STATUS_META[status];
        const showCamera = status !== 'not_started';
        const count = photoCounts[surface.id] ?? 0;
        // Display: "[CT-05] wall — 288 SF" style
        const surfaceName =
          surface.name ?? surface.material_code ?? 'Unknown';

        return (
          <Pressable
            key={surface.id}
            onPress={() => handleCycleStatus(surface)}
            onLongPress={() => openBlockModal(surface)}
            delayLongPress={400}
            className="mb-1.5 rounded-xl border border-border bg-card px-4 py-3 active:opacity-70"
            style={{ minHeight: 52 }}
          >
            <View className="flex-row items-center">
              <Ionicons name={meta.icon} size={24} color={meta.color} />

              {surface.material_code && (
                <Text
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 10,
                    fontWeight: '700',
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC',
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 8,
                    overflow: 'hidden',
                  }}
                >
                  {surface.material_code}
                </Text>
              )}

              <View className="ml-2 flex-1">
                <Text className="text-sm font-medium text-white" numberOfLines={1}>
                  {surfaceName}
                </Text>
              </View>

              {showCamera && (
                <View className="flex-row items-center">
                  {count > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#F97316',
                        borderRadius: 10,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        marginRight: 4,
                      }}
                    >
                      <Ionicons name="camera" size={10} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginLeft: 2 }}>
                        {count}
                      </Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => handleTakePhoto(surface)}
                    hitSlop={8}
                    style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="camera-outline" size={18} color="#94A3B8" />
                  </Pressable>
                </View>
              )}
            </View>

            {/* Blocked reason inline */}
            {status === 'blocked' && surface.blocked_reason && (
              <View className="mt-2 ml-8 flex-row items-start">
                <Ionicons name="warning" size={12} color="#EF4444" style={{ marginTop: 2 }} />
                <Text className="ml-1.5 flex-1 text-xs text-red-400" numberOfLines={3}>
                  {surface.blocked_reason}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}

      {/* Block surface modal */}
      <Modal
        visible={blockSurface !== null}
        transparent
        animationType="fade"
        onRequestClose={closeBlockModal}
      >
        <Pressable
          onPress={closeBlockModal}
          className="flex-1 items-center justify-center bg-black/70 px-6"
        >
          <Pressable
            onPress={() => {}}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
          >
            <View className="mb-3 flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                <Ionicons name="warning" size={20} color="#EF4444" />
              </View>
              <Text className="ml-3 text-lg font-bold text-white">Block surface</Text>
            </View>
            <Text className="mb-3 text-sm text-slate-400">
              {blockSurface?.material_code ?? ''} {blockSurface?.name ?? 'Surface'} — describe why this can&apos;t be done.
            </Text>
            <TextInput
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder="e.g. Other trade not finished, missing material, access denied..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={4}
              autoFocus
              textAlignVertical="top"
              className="mb-4 rounded-xl border border-border bg-background p-3 text-sm text-white"
              style={{ minHeight: 100 }}
            />
            <View className="flex-row">
              <Pressable
                onPress={closeBlockModal}
                className="mr-2 flex-1 items-center justify-center rounded-xl border border-border bg-card py-3 active:opacity-70"
              >
                <Text className="text-base font-bold text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitBlock}
                className="ml-2 flex-1 items-center justify-center rounded-xl bg-red-600 py-3 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Mark blocked</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
