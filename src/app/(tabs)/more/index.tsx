import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useTrackPermissions } from '@/shared/lib/permissions/TrackPermissionsContext';
import { normalizeTrackRole, type TrackFeature } from '@/shared/lib/permissions/trackPermissions';
import { FeedbackModal } from '@/shared/components/FeedbackModal';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  route?: string;
  onPress?: () => void;
  color?: string;
  feature?: TrackFeature; // gate this entry behind a feature permission
  supervisorOnly?: boolean; // gate this entry to canonical 'supervisor' role
};

export default function MoreScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { canUseFeature } = useTrackPermissions();
  const [showFeedback, setShowFeedback] = useState(false);

  const allItems: MenuItem[] = [
    {
      icon: 'checkmark-circle',
      label: 'GC Punchlist',
      subtitle: 'Resolve punch items from the GC',
      route: '/(tabs)/more/punchlist',
      color: '#F97316',
      feature: 'gc_punchlist',
    },
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
    // Sprint 53A.1 — Internal Punch List moved out of Safety screen
    // sub-tabs into its own More entry per pilot feedback 2026-04-25.
    // Distinct from the Procore-synced "GC Punchlist" entry above.
    {
      icon: 'flag',
      label: 'Punch List',
      subtitle: 'Internal QC items — supervisor → foreman',
      route: '/(tabs)/docs/punch',
      color: '#A855F7',
    },
    // Sprint 53A.1 — Legal Documents moved out of Safety screen sub-tabs.
    // Supervisor-only (NOD/REA workflow) — uses normalizeTrackRole gating.
    {
      icon: 'document-lock',
      label: 'Legal Documents',
      subtitle: 'NODs auto-detected from blocked areas',
      route: '/(tabs)/docs/legal',
      color: '#EF4444',
      supervisorOnly: true,
    },
    // Sprint 71 Phase 2 — Compliance: supervisor verifies foreman-resolved
    // deficiencies. Cascade-completes verification_due todos org-wide on
    // first verify (per Web Phase 2 wiring).
    {
      icon: 'shield-checkmark',
      label: 'Compliance',
      subtitle: 'Verify resolved deficiencies',
      route: '/(tabs)/more/compliance',
      color: '#3B82F6',
      supervisorOnly: true,
    },
    // Sprint 53A.1 — Project Notes moved to its own bottom tab (between
    // Delivery and More) per pilot feedback 2026-04-25. Removed from More
    // menu to avoid triplicated discoverability (header icon + bottom tab
    // + More entry).
    // "Safety & Docs" removed — now lives as its own "Safety" top tab.
    {
      icon: 'document-text',
      label: 'My Reports',
      subtitle: 'View your submitted reports',
      route: '/(tabs)/more/my-reports',
      color: '#A855F7',
    },
    {
      icon: 'settings',
      label: 'Settings',
      subtitle: 'Profile, preferences, account',
      route: '/(tabs)/more/settings',
      color: '#94A3B8',
    },
    {
      icon: 'warning',
      label: 'Report Issue',
      subtitle: 'Bug, feature request, or feedback',
      onPress: () => setShowFeedback(true),
      color: '#F97316',
    },
    // Sprint 53A.1 — Sync Diagnostics screen exists at /(tabs)/more/sync-debug
    // but is intentionally hidden from the More menu after the SyncStatusBar
    // root cause fix landed (commit f894ce0). Re-add this entry temporarily
    // if/when a future stuck-sync issue needs device-side debugging.
    {
      icon: 'log-out',
      label: 'Sign Out',
      subtitle: profile?.full_name ?? '',
      onPress: signOut,
      color: '#EF4444',
    },
  ];

  const isSupervisor = normalizeTrackRole(profile?.role) === 'supervisor';
  const items = allItems.filter((item) => {
    if (item.feature && !canUseFeature(item.feature)) return false;
    if (item.supervisorOnly && !isSupervisor) return false;
    return true;
  });

  return (
    <>
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

    <FeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
    </>
  );
}
