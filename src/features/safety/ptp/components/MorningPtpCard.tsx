/**
 * Morning PTP card for the Home screen.
 *
 * States:
 *   - No PTP today     → orange CTA, tap opens /docs/safety/ptp/new
 *   - Draft            → amber "Resume" with signature count
 *   - Distributed      → green "Signed HH:MM" read-only
 *
 * The card is the foreman's daily ritual. One tap from Home. No nesting.
 */
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useTodaysPtp } from '../hooks/useTodaysPtp';
import type { PtpContent } from '../types';

export function MorningPtpCard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeProject } = useProjectStore();

  const { doc, loading } = useTodaysPtp(user?.id ?? null, activeProject?.id ?? null);

  if (!user || !activeProject) return null;

  // No PTP for today → CTA to start the morning huddle
  if (!doc && !loading) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start morning PTP"
        onPress={() => router.push('/(tabs)/docs/safety/ptp/new' as any)}
        className="mb-4 rounded-2xl border border-brand-orange bg-brand-orange/10 p-4 active:opacity-80"
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-orange/20">
            <Ionicons name="clipboard" size={22} color="#F97316" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-bold text-brand-orange">New Pre-Task Plan</Text>
            <Text className="mt-0.5 text-sm text-slate-400">
              Start your morning huddle · JHA + signatures
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#F97316" />
        </View>
      </Pressable>
    );
  }

  if (!doc) return null;

  const sigCount = doc.signatures?.length ?? 0;
  const distribution = (doc.content as PtpContent).distribution ?? null;

  // Distributed → green confirmation (detect via content.distribution, not
  // status — the DB only knows draft/active/completed)
  if (distribution?.distributed_at) {
    const sentAt = new Date(distribution.distributed_at).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View today's PTP"
        onPress={() => router.push(`/(tabs)/docs/safety/${doc.id}` as any)}
        className="mb-4 rounded-2xl border border-success/30 bg-success/10 p-4 active:opacity-80"
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-success/20">
            <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-bold text-success">PTP distributed · {sentAt}</Text>
            <Text className="mt-0.5 text-sm text-slate-400">
              {sigCount} signature{sigCount === 1 ? '' : 's'} · sent to GC
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#22C55E" />
        </View>
      </Pressable>
    );
  }

  // Draft → amber resume
  const sigLabel =
    sigCount === 0
      ? 'Pick tasks and capture signatures'
      : `${sigCount} signature${sigCount === 1 ? '' : 's'} captured`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Resume today's PTP"
      onPress={() => router.push(`/(tabs)/docs/safety/ptp/${doc.id}` as any)}
      className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 active:opacity-80"
    >
      <View className="flex-row items-center">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-warning/20">
          <Ionicons name="time" size={22} color="#F59E0B" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-warning">Resume today's PTP</Text>
          <Text className="mt-0.5 text-sm text-slate-400">{sigLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#F59E0B" />
      </View>
    </Pressable>
  );
}
