/**
 * This Week entry — Screen 1 of the toolbox flow.
 *
 * Runs the scheduler engine to suggest a topic, lets the foreman accept it
 * or pick an alternative, then creates the draft safety_documents row and
 * redirects to the wizard at /(tabs)/docs/safety/toolbox/[id].
 *
 * Already-delivered check: if this week already has a toolbox talk, the
 * screen shows a banner and either links to the existing draft (resume) or
 * the distributed view (read-only).
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useMyWorker } from '@/features/workers/hooks/useMyWorker';
import { workerFullName } from '@/features/workers/types';
import { OnboardingBlocker } from '@/features/workers/components/OnboardingBlocker';
import { useThisWeeksToolbox } from '@/features/safety/toolbox/hooks/useThisWeeksToolbox';
import { createDraftToolbox } from '@/features/safety/toolbox/services/toolboxService';
import { snapshotOf, type ToolboxLibraryTopic, ToolboxContentSchema } from '@/features/safety/toolbox/types';
import { ToolboxTopicPicker } from '@/features/safety/toolbox/components/ToolboxTopicPicker';

export default function NewToolboxScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { worker: myWorker, loading: myWorkerLoading, needsOnboarding } = useMyWorker();

  // Org's primary_trades hint for the scheduler. In practice it's stored on
  // organizations.primary_trades (array). We read it via the projects store's
  // sync of organizations; if not available, fall back to [].
  const primaryTrades = useMemo<string[]>(() => [], []);

  const { result, library, weekStart, delivered, loading } = useThisWeeksToolbox(
    profile?.organization_id ?? null,
    activeProject?.id ?? null,
    primaryTrades,
  );

  const [picked, setPicked] = useState<ToolboxLibraryTopic | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || myWorkerLoading || !profile || !user || !activeProject) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }

  if (needsOnboarding || !myWorker) {
    return <OnboardingBlocker />;
  }

  const current = picked ?? result?.suggested ?? null;

  const handleStart = async () => {
    if (!current || !profile || !user) return;
    setBusy(true);
    setError(null);

    const content = ToolboxContentSchema.parse({
      topic_snapshot: snapshotOf(current),
      scheduled_date: weekStart,
      delivered_date: new Date().toISOString().slice(0, 10),
      shift: 'day',
      weather: null,
      foreman_id: myWorker.id,
      foreman_name: workerFullName(myWorker) || profile.full_name || user.email || 'Foreman',
      foreman_gps: null,
      photo_urls: [],
      discussion_notes: '',
      delivered_language: 'en',
      additional_notes: '',
    });

    const res = await createDraftToolbox({
      organizationId: profile.organization_id,
      projectId: activeProject.id,
      foremanProfileId: user.id,
      content,
    });

    setBusy(false);
    if (!res.success || !res.id) {
      setError(res.error ?? 'Could not create toolbox talk');
      return;
    }
    router.replace(`/(tabs)/docs/safety/toolbox/${res.id}`);
  };

  // Already-delivered banner — pick the link target based on current state.
  if (delivered) {
    const isDraft = delivered.status === 'draft';
    const distributed = (delivered.content as { distribution?: { distributed_at?: string } })
      .distribution?.distributed_at;
    return (
      <>
        <Stack.Screen options={{ title: 'Weekly Safety' }} />
        <View className="flex-1 items-center justify-center bg-background px-6">
          <View
            className="mb-4 h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: distributed ? '#22C55E20' : '#F59E0B20' }}
          >
            <Ionicons
              name={distributed ? 'checkmark-circle' : 'time'}
              size={40}
              color={distributed ? '#22C55E' : '#F59E0B'}
            />
          </View>
          <Text className="text-center text-2xl font-bold text-white">
            {distributed ? "This week's talk is done" : "Resume this week's talk"}
          </Text>
          <Text className="mt-3 text-center text-base leading-6 text-slate-400">
            Week of {weekStart}. Only one toolbox talk can be submitted per week.
          </Text>
          <Pressable
            onPress={() => {
              if (isDraft) {
                router.replace(`/(tabs)/docs/safety/toolbox/${delivered.id}`);
              } else {
                router.replace(`/(tabs)/docs/safety/${delivered.id}`);
              }
            }}
            className="mt-6 h-14 w-full max-w-xs items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
          >
            <Text className="text-base font-bold text-white">
              {isDraft ? 'Resume' : 'View talk'}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  // Empty library fallback
  if (library.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Weekly Safety' }} />
        <View className="flex-1 items-center justify-center bg-background px-6">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-warning/20">
            <Ionicons name="library-outline" size={40} color="#F59E0B" />
          </View>
          <Text className="text-center text-2xl font-bold text-white">
            Library is empty
          </Text>
          <Text className="mt-3 text-center text-base leading-6 text-slate-400">
            The PM needs to seed toolbox topics in Takeoff web's Safety
            Documents module before Track can schedule a weekly talk.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 h-12 w-full max-w-xs items-center justify-center rounded-xl border border-border"
          >
            <Text className="text-base text-slate-400">Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Weekly Safety',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <ScrollView className="flex-1 bg-background px-4 pt-4">
        {/* Context */}
        <View className="mb-4 flex-row items-center">
          <Ionicons name="calendar" size={16} color="#94A3B8" />
          <Text className="ml-1 text-xs uppercase text-slate-500">Week of</Text>
          <Text className="ml-2 text-sm font-medium text-white">{weekStart}</Text>
        </View>

        {current ? (
          <View
            className={`mb-4 rounded-2xl border p-4 ${
              result?.wasOverridden
                ? 'border-brand-orange bg-brand-orange/10'
                : 'border-border bg-card'
            }`}
          >
            <View className="mb-2 flex-row items-start">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/20">
                <Ionicons name="shield" size={22} color="#F97316" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-white">{current.title}</Text>
                <Text className="text-xs text-slate-500">{current.category}</Text>
              </View>
            </View>

            <Text className="mt-2 text-sm leading-5 text-slate-300" numberOfLines={4}>
              {current.why_it_matters}
            </Text>

            {result?.explanation?.length ? (
              <View className="mt-3 rounded-xl border border-border bg-background p-3">
                <Text className="mb-1 text-[10px] font-bold uppercase text-slate-500">
                  Why this week
                </Text>
                {result.explanation.slice(0, 4).map((line, i) => (
                  <View key={i} className="flex-row items-start">
                    <Text className="mr-1 text-slate-500">•</Text>
                    <Text className="flex-1 text-xs text-slate-300">{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View className="mb-4 rounded-2xl border border-border bg-card p-4">
            <Text className="text-sm text-slate-400">
              No topic eligible this week — every option is in cooldown.
              Tap Change topic to override.
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleStart}
          disabled={busy || !current}
          className="mb-3 h-14 items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
          style={{ opacity: !current || busy ? 0.5 : 1 }}
        >
          <Text className="text-base font-bold text-white">
            {busy ? 'Creating…' : '📖 Start Talk'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setPickerOpen(true)}
          className="mb-4 h-12 flex-row items-center justify-center rounded-xl border border-border active:opacity-70"
        >
          <Ionicons name="swap-horizontal" size={18} color="#94A3B8" />
          <Text className="ml-2 text-sm text-slate-400">Change topic</Text>
        </Pressable>

        {error ? (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base text-danger">{error}</Text>
          </View>
        ) : null}

        <View className="h-24" />
      </ScrollView>

      <ToolboxTopicPicker
        visible={pickerOpen}
        library={library}
        currentTopicId={current?.id ?? null}
        onSelect={(topic) => {
          setPicked(topic);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />

      {busy ? (
        <View className="absolute inset-0 items-center justify-center bg-black/40">
          <ActivityIndicator color="#F97316" size="large" />
        </View>
      ) : null}
    </>
  );
}
