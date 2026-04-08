import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useTrackPermissions } from '@/shared/lib/permissions/TrackPermissionsContext';
import type { TrackFeature } from '@/shared/lib/permissions/trackPermissions';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  route?: string;
  onPress?: () => void;
  color?: string;
  feature?: TrackFeature; // gate this entry behind a feature permission
};

export default function MoreScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { canUseFeature } = useTrackPermissions();

  const allItems: MenuItem[] = [
    {
      icon: 'location',
      label: 'GPS Check-in',
      subtitle: 'Clock in/out with GPS stamp',
      route: '/(tabs)/more/checkin',
      color: '#22C55E',
      feature: 'check_in',
    },
    {
      icon: 'people',
      label: 'Crew Management',
      subtitle: 'Assign workers to areas',
      route: '/(tabs)/more/crew',
      color: '#3B82F6',
      feature: 'assign_crews',
    },
    {
      icon: 'cube',
      label: 'Deliveries',
      subtitle: 'Confirm material deliveries',
      route: '/(tabs)/more/delivery',
      color: '#8B5CF6',
      feature: 'delivery_confirmation',
    },
    {
      icon: 'settings',
      label: 'Settings',
      subtitle: 'Language, notifications, profile',
      color: '#94A3B8',
    },
    {
      icon: 'log-out',
      label: 'Sign Out',
      subtitle: profile?.full_name ?? '',
      onPress: signOut,
      color: '#EF4444',
    },
  ];

  const items = allItems.filter((item) => !item.feature || canUseFeature(item.feature));

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-4">
      {/* Profile card */}
      <View className="mb-6 items-center rounded-2xl border border-border bg-card px-4 py-5">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-orange">
          <Text className="text-2xl font-bold text-white">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text className="mt-3 text-lg font-bold text-white">
          {profile?.full_name ?? 'User'}
        </Text>
        <Text className="mt-1 text-sm capitalize text-slate-400">
          {profile?.role ?? 'Unknown role'}
        </Text>
      </View>

      {/* Menu items */}
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => {
            if (item.onPress) {
              item.onPress();
            } else if (item.route) {
              router.push(item.route as any);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-4 py-4 active:opacity-80"
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${item.color}20` }}
          >
            <Ionicons name={item.icon} size={22} color={item.color} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-base font-medium text-white">{item.label}</Text>
            {item.subtitle ? (
              <Text className="mt-0.5 text-sm text-slate-400">{item.subtitle}</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748B" />
        </Pressable>
      ))}

      <View className="h-24" />
    </ScrollView>
  );
}
