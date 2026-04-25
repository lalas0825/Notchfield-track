import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { usePunchList } from '@/features/punch/hooks/usePunchList';
import { PunchItemCard } from '@/features/punch/components/PunchItemCard';
import { AddPunchSheet } from '@/features/punch/components/AddPunchSheet';
import type { PunchStatus } from '@/features/punch/services/punch-service';

const FILTERS: { value: PunchStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

/**
 * Internal Punch List — Sprint 53A.1.
 *
 * Reachable via More → Punch List. Used to be a sub-tab inside Safety
 * but moved out per pilot feedback (Safety should stay single-purpose).
 *
 * Distinct from the GC Punchlist (Procore-synced) at /more/punchlist.
 *
 * The FAB at the bottom-right opens AddPunchSheet for free-form
 * (non-plan-anchored) punch creation. Plan-anchored punches are
 * created from the Plans tab via FAB + drop-pin (Sprint 53B).
 */
export default function PunchListScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const activeProject = useProjectStore((s) => s.activeProject);
  const { items, loading, counts, reload } = usePunchList();
  const [filter, setFilter] = useState<PunchStatus | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);
  const canCreate = !!user && !!profile && !!activeProject;

  return (
    <>
      <Stack.Screen options={{ title: `Punch List (${counts.open} open)` }} />
      <View className="flex-1 bg-background">
        {/* KPI bar */}
        <View className="flex-row items-center justify-around border-b border-border px-2 py-3">
          <KPI label="Open" value={counts.open} color="#EF4444" />
          <KPI label="Resolved" value={counts.resolved} color="#3B82F6" />
          <KPI label="Verified" value={counts.verified} color="#22C55E" />
          <KPI label="Total" value={counts.total} color="#94A3B8" />
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-border px-4 py-2">
          <View className="flex-row gap-2">
            {FILTERS.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                className={`rounded-full px-4 py-1.5 ${
                  filter === f.value ? 'bg-brand-orange' : 'border border-border'
                }`}
              >
                <Text className={`text-sm font-medium ${filter === f.value ? 'text-white' : 'text-slate-400'}`}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="checkmark-done-circle-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              {filter === 'all' ? 'No punch items yet.' : `No ${filter} items.`}
            </Text>
            <Text className="mt-2 text-center text-xs text-slate-500">
              Tap the + button below to create one,{'\n'}
              or drop a pin from the Plans tab to anchor it to a drawing.
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4 pt-3">
            {filtered.map((item) => (
              <PunchItemCard
                key={item.id}
                item={item}
                onPress={() => router.push(`/(tabs)/docs/punch/${item.id}` as any)}
              />
            ))}
            <View className="h-24" />
          </ScrollView>
        )}

        {/* FAB — opens AddPunchSheet for free-form (non-plan-anchored)
            punch creation. Plan-anchored is via Plans tab. */}
        {canCreate && (
          <Pressable
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Create new punch item"
            className="absolute bottom-6 right-4 h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg active:opacity-80"
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </Pressable>
        )}

        {canCreate && (
          <AddPunchSheet
            visible={showAdd}
            onClose={() => setShowAdd(false)}
            onCreated={reload}
            organizationId={profile.organization_id}
            projectId={activeProject.id}
            createdBy={user.id}
            // Free-form: no drawing/coords. Area is picked inside the sheet.
          />
        )}
      </View>
    </>
  );
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="items-center">
      <Text className="text-xl font-bold" style={{ color }}>{value}</Text>
      <Text className="text-xs text-slate-500">{label}</Text>
    </View>
  );
}
