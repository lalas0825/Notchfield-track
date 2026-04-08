/**
 * Surface Checklist — per-surface checkboxes with camera icons.
 * Each surface shows: checkbox + material code + name + sqft + camera icon + photo count.
 * Camera only shows for in_progress/completed/blocked surfaces.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { enqueuePhoto } from '@/features/photos/services/photo-queue';
import { localUpdate } from '@/shared/lib/powersync/write';
import { haptic } from '@/shared/lib/haptics';
import { calculateSurfaceProgress, type SurfaceRow } from '../utils/progressCalculation';

interface SurfaceObject {
  id: string;
  area_id: string;
  takeoff_object_id: string;
  material_code?: string;
  quantity_sf?: number;
  // Joined from takeoff_objects or inline
  label?: string;
  unit?: string;
  status?: string;
}

type Props = {
  areaId: string;
};

export function SurfaceChecklist({ areaId }: Props) {
  const [surfaces, setSurfaces] = useState<SurfaceObject[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();

  const loadSurfaces = useCallback(async () => {
    if (!areaId) return;

    const { data } = await supabase
      .from('production_area_objects')
      .select('*')
      .eq('area_id', areaId)
      .order('created_at');

    setSurfaces((data ?? []) as SurfaceObject[]);
    setLoading(false);
  }, [areaId]);

  const loadPhotoCounts = useCallback(async () => {
    if (!areaId) return;
    const { data } = await supabase
      .from('field_photos')
      .select('object_id')
      .eq('area_id', areaId)
      .not('object_id', 'is', null);

    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as any[]) {
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

  const handleToggle = useCallback(
    async (surface: SurfaceObject) => {
      if (!user) return;
      const now = new Date().toISOString();
      const isComplete = surface.status === 'completed' || surface.status === 'complete';

      const updates = isComplete
        ? { status: 'in_progress', completed_at: null, completed_by: null }
        : { status: 'completed', completed_at: now, completed_by: user.id };

      // Optimistic update
      setSurfaces((prev) =>
        prev.map((s) => (s.id === surface.id ? { ...s, ...updates } : s)),
      );

      if (isComplete) haptic.light();
      else haptic.success();

      await localUpdate('production_area_objects', surface.id, updates);
    },
    [user],
  );

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
        contextType: 'progress',
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

      {surfaces.map((surface) => {
        const isComplete = surface.status === 'completed' || surface.status === 'complete';
        const isBlocked = surface.status === 'blocked';
        const showCamera = isComplete || isBlocked || surface.status === 'in_progress';
        const count = photoCounts[surface.id] ?? 0;

        return (
          <Pressable
            key={surface.id}
            onPress={() => handleToggle(surface)}
            disabled={isBlocked}
            className="mb-1.5 flex-row items-center rounded-xl border border-border bg-card px-4 py-3 active:opacity-70"
            style={{ minHeight: 52 }}
          >
            {/* Status icon / checkbox */}
            <Ionicons
              name={isComplete ? 'checkmark-circle' : isBlocked ? 'close-circle' : 'ellipse-outline'}
              size={24}
              color={isComplete ? '#22C55E' : isBlocked ? '#EF4444' : '#9CA3AF'}
            />

            {/* Material code badge */}
            {surface.material_code && (
              <Text
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  color: '#475569',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  borderRadius: 3,
                  marginLeft: 8,
                  overflow: 'hidden',
                }}
              >
                {surface.material_code}
              </Text>
            )}

            {/* Surface name + sqft */}
            <View className="ml-2 flex-1">
              <Text className="text-sm font-medium text-white" numberOfLines={1}>
                {surface.label ?? `Surface`}
              </Text>
            </View>

            {/* Sqft */}
            {surface.quantity_sf != null && surface.quantity_sf > 0 && (
              <Text className="mr-2 text-xs text-slate-500">
                {Math.round(surface.quantity_sf)} SF
              </Text>
            )}

            {/* Camera + photo count */}
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
          </Pressable>
        );
      })}
    </View>
  );
}
