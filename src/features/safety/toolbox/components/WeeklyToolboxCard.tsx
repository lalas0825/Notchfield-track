/**
 * "This week's toolbox talk" card for Home. Sits alongside the Morning PTP
 * card. Three visual states:
 *   - Nothing yet this week → green CTA "Weekly safety talk · Start"
 *   - Draft in progress     → amber "Resume · N signed"
 *   - Sent this week        → green check with distributed timestamp
 */
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useThisWeeksToolbox } from '../hooks/useThisWeeksToolbox';

export function WeeklyToolboxCard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeProject } = useProjectStore();
  const profileOrgId = useAuthStore((s) => s.profile?.organization_id ?? null);

  const { result, delivered, loading } = useThisWeeksToolbox(
    profileOrgId,
    activeProject?.id ?? null,
    [],
  );

  if (!user || !activeProject) return null;

  // Already delivered this week
  if (delivered) {
    const distributed = (delivered.content as { distribution?: { distributed_at?: string } })
      .distribution?.distributed_at;
    const title =
      (delivered.content as { topic_snapshot?: { title?: string } }).topic_snapshot?.title ??
      'Toolbox talk';

    if (distributed) {
      const sentAt = new Date(distributed).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/docs/safety/${delivered.id}` as any)}
          className="mb-4 rounded-2xl border border-success/30 bg-success/10 p-4 active:opacity-80"
        >
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-success/20">
              <Ionicons name="shield-checkmark" size={22} color="#22C55E" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-bold text-success">Toolbox delivered · {sentAt}</Text>
              <Text className="mt-0.5 text-sm text-slate-400" numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#22C55E" />
          </View>
        </Pressable>
      );
    }

    // Draft in progress
    const sigCount = Array.isArray((delivered.content as { signatures?: unknown[] }).signatures)
      ? ((delivered.content as { signatures?: unknown[] }).signatures as unknown[]).length
      : 0;
    return (
      <Pressable
        onPress={() => router.push(`/(tabs)/docs/safety/toolbox/${delivered.id}` as any)}
        className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 active:opacity-80"
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-warning/20">
            <Ionicons name="time" size={22} color="#F59E0B" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-bold text-warning">Resume weekly safety talk</Text>
            <Text className="mt-0.5 text-sm text-slate-400" numberOfLines={1}>
              {title}
              {sigCount > 0 ? ` · ${sigCount} signed` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#F59E0B" />
        </View>
      </Pressable>
    );
  }

  // Nothing yet — CTA
  const suggestedTitle = result?.suggested?.title ?? null;
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/docs/safety/toolbox/new' as any)}
      disabled={loading}
      className="mb-4 rounded-2xl border p-4 active:opacity-80"
      style={{
        borderColor: '#22C55E',
        backgroundColor: '#22C55E10',
      }}
    >
      <View className="flex-row items-center">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-success/20">
          <Ionicons name="shield" size={22} color="#22C55E" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-success">Weekly safety talk</Text>
          <Text className="mt-0.5 text-sm text-slate-400" numberOfLines={1}>
            {loading
              ? 'Loading library…'
              : suggestedTitle
                ? `Suggested: ${suggestedTitle}`
                : 'Start this week\'s toolbox'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#22C55E" />
      </View>
    </Pressable>
  );
}
