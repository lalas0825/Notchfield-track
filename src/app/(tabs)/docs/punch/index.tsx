import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePunchList } from '@/features/punch/hooks/usePunchList';
import { PunchItemCard } from '@/features/punch/components/PunchItemCard';
import type { PunchStatus } from '@/features/punch/services/punch-service';
import { useState } from 'react';

const FILTERS: { value: PunchStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

export default function PunchListScreen() {
  const router = useRouter();
  const { items, loading, counts } = usePunchList();
  const [filter, setFilter] = useState<PunchStatus | 'all'>('all');

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);

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
