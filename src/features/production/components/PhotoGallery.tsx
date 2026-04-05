import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { enqueuePhoto } from '@/features/photos/services/photo-queue';
import { haptic } from '@/shared/lib/haptics';
import { PhotoViewer } from './PhotoViewer';

type FieldPhoto = {
  id: string;
  area_id: string;
  context_type: string;
  caption: string | null;
  local_uri: string | null;
  remote_url: string | null;
  thumbnail_url: string | null;
  taken_by: string | null;
  taken_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  sync_status: string;
};

type ContextType = 'all' | 'progress' | 'qc' | 'blocked';

const FILTER_CHIPS: { key: ContextType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'progress', label: 'Progress' },
  { key: 'qc', label: 'QC' },
  { key: 'blocked', label: 'Blocked' },
];

const CONTEXT_COLORS: Record<string, string> = {
  progress: '#22C55E',
  qc: '#3B82F6',
  blocked: '#EF4444',
  delivery: '#F59E0B',
  safety: '#8B5CF6',
  general: '#94A3B8',
};

type Props = {
  areaId: string;
};

export function PhotoGallery({ areaId }: Props) {
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();

  const [photos, setPhotos] = useState<FieldPhoto[]>([]);
  const [filter, setFilter] = useState<ContextType>('all');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const loadPhotos = useCallback(async () => {
    if (!areaId) return;

    const { data } = await supabase
      .from('field_photos')
      .select('id, area_id, context_type, caption, local_uri, remote_url, thumbnail_url, taken_by, taken_at, gps_lat, gps_lng, sync_status')
      .eq('area_id', areaId)
      .order('taken_at', { ascending: false });

    if (data) {
      setPhotos(data as FieldPhoto[]);
    }
  }, [areaId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const filtered = filter === 'all'
    ? photos
    : photos.filter((p) => p.context_type === filter);

  const handleTakePhoto = async () => {
    if (!user || !profile || !activeProject) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    // Try GPS — non-blocking
    let gpsLat: number | undefined;
    let gpsLng: number | undefined;
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        gpsLat = loc.coords.latitude;
        gpsLng = loc.coords.longitude;
      }
    } catch {
      // GPS is best-effort
    }

    await enqueuePhoto({
      sourceUri: result.assets[0].uri,
      organizationId: profile.organization_id,
      projectId: activeProject.id,
      areaId,
      phaseId: null,
      contextType: 'general',
      takenBy: user.id,
      gpsLat,
      gpsLng,
    });

    haptic.success();
    loadPhotos();
  };

  const handleThumbnailPress = (index: number) => {
    haptic.light();
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const getImageUri = (photo: FieldPhoto): string | undefined => {
    return photo.local_uri ?? photo.thumbnail_url ?? photo.remote_url ?? undefined;
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const renderThumbnail = ({ item, index }: { item: FieldPhoto; index: number }) => {
    const uri = getImageUri(item);
    const badgeColor = CONTEXT_COLORS[item.context_type] ?? CONTEXT_COLORS.general;

    return (
      <Pressable
        onPress={() => handleThumbnailPress(index)}
        accessibilityRole="button"
        accessibilityLabel={`Photo ${index + 1}, ${item.context_type}`}
        className="mr-3 items-center"
      >
        <View
          className="overflow-hidden rounded-lg border border-border"
          style={{ width: 80, height: 80 }}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: 80, height: 80 }}
              resizeMode="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-card">
              <Ionicons name="image-outline" size={28} color="#64748B" />
            </View>
          )}
        </View>

        {/* Date */}
        <Text className="mt-1 text-[10px] text-slate-400">
          {formatDate(item.taken_at)}
        </Text>

        {/* Context type badge */}
        <View
          className="mt-0.5 rounded-full px-2 py-0.5"
          style={{ backgroundColor: `${badgeColor}20` }}
        >
          <Text
            className="text-[9px] font-bold capitalize"
            style={{ color: badgeColor }}
          >
            {item.context_type}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="mb-4">
      {/* Section header */}
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="images" size={16} color="#94A3B8" />
          <Text className="ml-1.5 text-sm font-bold uppercase text-slate-400">
            Photos ({photos.length})
          </Text>
        </View>

        <Pressable
          onPress={handleTakePhoto}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Take area photo"
          className="h-9 w-9 items-center justify-center rounded-lg border border-border bg-card active:opacity-80"
        >
          <Ionicons name="camera" size={18} color="#F97316" />
        </Pressable>
      </View>

      {/* Filter chips */}
      <View className="mb-2 flex-row">
        {FILTER_CHIPS.map((chip) => {
          const isActive = filter === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => {
                haptic.light();
                setFilter(chip.key);
              }}
              className={`mr-2 rounded-full px-3 py-1.5 ${
                isActive
                  ? 'bg-brand-orange'
                  : 'border border-border bg-card'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Photo strip or empty state */}
      {filtered.length === 0 ? (
        <View className="items-center rounded-xl border border-border bg-card px-4 py-6">
          <Ionicons name="camera-outline" size={32} color="#64748B" />
          <Text className="mt-2 text-center text-sm text-slate-400">
            No photos yet. Take a photo using the camera button above.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderThumbnail}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4 }}
        />
      )}

      {/* Photo viewer modal */}
      <PhotoViewer
        photos={filtered}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}
