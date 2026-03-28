import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PunchItem, PunchPriority } from '../services/punch-service';

const PRIORITY_COLORS: Record<PunchPriority, string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  open: { color: '#EF4444', label: 'Open' },
  in_progress: { color: '#F59E0B', label: 'In Progress' },
  resolved: { color: '#3B82F6', label: 'Resolved' },
  verified: { color: '#22C55E', label: 'Verified' },
  rejected: { color: '#EF4444', label: 'Rejected' },
};

type Props = {
  item: PunchItem;
  onPress: () => void;
};

export function PunchItemCard({ item, onPress }: Props) {
  const priorityColor = PRIORITY_COLORS[item.priority] ?? '#94A3B8';
  const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open;
  const photos = item.photos ?? [];
  const hasBeforeAfter = photos.length > 0 && (item.resolution_photos ?? []).length > 0;

  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-xl border border-border bg-card active:opacity-80"
    >
      {/* Photo preview row */}
      {(photos.length > 0 || hasBeforeAfter) && (
        <View className="flex-row">
          {/* Before photo */}
          {photos[0] && (
            <View className="flex-1">
              <Image source={{ uri: photos[0] }} className="h-24 rounded-tl-xl" resizeMode="cover" />
              {hasBeforeAfter && (
                <View className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5">
                  <Text className="text-[10px] font-bold text-white">BEFORE</Text>
                </View>
              )}
            </View>
          )}
          {/* After photo */}
          {hasBeforeAfter && item.resolution_photos[0] && (
            <View className="flex-1">
              <Image
                source={{ uri: item.resolution_photos[0] }}
                className="h-24 rounded-tr-xl"
                resizeMode="cover"
              />
              <View className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-white">AFTER</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <View className="px-4 py-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-base font-medium text-white" numberOfLines={2}>
              {item.title}
            </Text>
            {item.description && (
              <Text className="mt-0.5 text-sm text-slate-400" numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>

          {/* Priority dot */}
          <View className="ml-2 mt-1 flex-row items-center gap-2">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: priorityColor }}
            />
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: `${statusConfig.color}20` }}
            >
              <Text className="text-xs font-medium" style={{ color: statusConfig.color }}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Rejected reason */}
        {item.status === 'rejected' && item.rejected_reason && (
          <View className="mt-2 rounded-lg bg-red-500/10 px-3 py-1.5">
            <Text className="text-sm text-danger">Rejected: {item.rejected_reason}</Text>
          </View>
        )}

        {/* Meta */}
        <View className="mt-2 flex-row items-center">
          <Text className="text-xs text-slate-500">
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
          {item.area_name && (
            <Text className="ml-2 text-xs text-slate-500">{item.area_name}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Before/After side-by-side comparison for verified items.
 */
export function BeforeAfterView({ item }: { item: PunchItem }) {
  const beforePhoto = (item.photos ?? [])[0];
  const afterPhoto = (item.resolution_photos ?? [])[0];

  if (!beforePhoto || !afterPhoto) return null;

  return (
    <View className="overflow-hidden rounded-xl border border-border">
      <View className="flex-row">
        <View className="flex-1">
          <Image source={{ uri: beforePhoto }} className="h-48" resizeMode="cover" />
          <View className="absolute bottom-2 left-2 rounded-full bg-danger px-3 py-1">
            <Text className="text-xs font-bold text-white">BEFORE</Text>
          </View>
        </View>
        <View className="w-px bg-border" />
        <View className="flex-1">
          <Image source={{ uri: afterPhoto }} className="h-48" resizeMode="cover" />
          <View className="absolute bottom-2 left-2 rounded-full bg-success px-3 py-1">
            <Text className="text-xs font-bold text-white">AFTER</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
