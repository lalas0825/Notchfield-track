import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CONTEXT_COLORS: Record<string, string> = {
  progress: '#22C55E',
  qc: '#3B82F6',
  blocked: '#EF4444',
  delivery: '#F59E0B',
  safety: '#8B5CF6',
  general: '#94A3B8',
};

type Photo = {
  id: string;
  context_type: string;
  caption: string | null;
  local_uri: string | null;
  remote_url: string | null;
  thumbnail_url: string | null;
  taken_by: string | null;
  taken_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
};

type Props = {
  photos: Photo[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

export function PhotoViewer({ photos, initialIndex, visible, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const getImageUri = (photo: Photo): string | undefined => {
    return photo.local_uri ?? photo.remote_url ?? photo.thumbnail_url ?? undefined;
  };

  const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatCoords = (lat: number | null, lng: number | null): string | null => {
    if (lat == null || lng == null) return null;
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  const renderPhoto = ({ item }: { item: Photo }) => {
    const uri = getImageUri(item);

    return (
      <View style={{ width: SCREEN_WIDTH }} className="items-center justify-center">
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }}
            resizeMode="contain"
          />
        ) : (
          <View
            className="items-center justify-center bg-card"
            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
          >
            <Ionicons name="image-outline" size={64} color="#64748B" />
            <Text className="mt-2 text-sm text-slate-500">Image not available</Text>
          </View>
        )}
      </View>
    );
  };

  const current = photos[currentIndex] ?? photos[0];
  if (!current) return null;

  const badgeColor = CONTEXT_COLORS[current.context_type] ?? CONTEXT_COLORS.general;
  const coords = formatCoords(current.gps_lat, current.gps_lng);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1" style={{ backgroundColor: '#0A0F1A' }}>
        {/* Header — close button + page indicator */}
        <View
          className="flex-row items-center justify-between px-4"
          style={{ paddingTop: 52, paddingBottom: 12 }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close photo viewer"
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            className="rounded-full active:opacity-80"
          >
            <Ionicons name="close" size={28} color="#F8FAFC" />
          </Pressable>

          <Text className="text-base font-medium text-white">
            {currentIndex + 1} / {photos.length}
          </Text>

          {/* Spacer to balance close button */}
          <View style={{ width: 48 }} />
        </View>

        {/* Photo carousel */}
        <FlatList
          ref={flatListRef}
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhoto}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

        {/* Metadata panel */}
        <View className="px-4 pb-10 pt-4" style={{ backgroundColor: '#0F172A' }}>
          {/* Context type badge */}
          <View className="mb-2 flex-row items-center">
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${badgeColor}20` }}
            >
              <Text
                className="text-xs font-bold capitalize"
                style={{ color: badgeColor }}
              >
                {current.context_type}
              </Text>
            </View>
          </View>

          {/* Caption */}
          {current.caption ? (
            <Text className="mb-1 text-base text-white">{current.caption}</Text>
          ) : null}

          {/* Date + taken by */}
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#94A3B8" />
            <Text className="ml-1 text-sm text-slate-400">
              {formatDateTime(current.taken_at)}
            </Text>
          </View>

          {current.taken_by ? (
            <View className="mt-1 flex-row items-center">
              <Ionicons name="person-outline" size={14} color="#94A3B8" />
              <Text className="ml-1 text-sm text-slate-400">
                {current.taken_by}
              </Text>
            </View>
          ) : null}

          {/* GPS coordinates */}
          {coords ? (
            <View className="mt-1 flex-row items-center">
              <Ionicons name="location-outline" size={14} color="#94A3B8" />
              <Text className="ml-1 text-sm text-slate-400">{coords}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
