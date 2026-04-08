/**
 * RoleGate — Sprint 40C
 * ======================
 * Renders a block screen for users whose role is not allowed in Track,
 * and a "no projects assigned" screen for valid roles with zero assignments.
 * Otherwise renders children.
 */

import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useTrackPermissions } from '@/shared/lib/permissions/TrackPermissionsContext';

const WEB_APP_URL = 'https://notchfield.com';

export function RoleGate({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuthStore();
  const { isTrackRole, assignedProjectIds, loading, reload } = useTrackPermissions();

  // No profile yet — let auth flow finish first
  if (!profile) return <>{children}</>;

  // Web-only role → block
  if (!isTrackRole) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-amber-500/20">
          <Ionicons name="laptop-outline" size={42} color="#F59E0B" />
        </View>
        <Text className="mt-6 text-center text-2xl font-bold text-white">
          Track is for the field
        </Text>
        <Text className="mt-3 text-center text-base text-slate-400">
          Your role ({profile.role}) uses the web app at notchfield.com.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(WEB_APP_URL)}
          className="mt-8 h-14 w-full items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
        >
          <Text className="text-base font-bold text-white">Open Web App</Text>
        </Pressable>
        <Pressable
          onPress={signOut}
          className="mt-3 h-14 w-full items-center justify-center rounded-xl border border-border bg-card active:opacity-80"
        >
          <Text className="text-base font-bold text-white">Logout</Text>
        </Pressable>
      </View>
    );
  }

  // Loading assignments
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  // Valid Track role but zero project assignments → block with refresh option
  if (assignedProjectIds.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-slate-700/40">
          <Ionicons name="folder-open-outline" size={42} color="#94A3B8" />
        </View>
        <Text className="mt-6 text-center text-2xl font-bold text-white">
          No projects assigned
        </Text>
        <Text className="mt-3 text-center text-base text-slate-400">
          Ask your supervisor to assign you to a project. Once they do,
          tap Refresh to load it.
        </Text>
        <Pressable
          onPress={reload}
          className="mt-8 h-14 w-full items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
        >
          <Text className="text-base font-bold text-white">Refresh</Text>
        </Pressable>
        <Pressable
          onPress={signOut}
          className="mt-3 h-14 w-full items-center justify-center rounded-xl border border-border bg-card active:opacity-80"
        >
          <Text className="text-base font-bold text-white">Logout</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
