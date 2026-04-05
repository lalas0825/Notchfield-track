import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

// Stores — reactive via Zustand selectors (no useEffect needed)
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useCrewStore } from '@/features/crew/store/crew-store';

// Dashboard components
import { GpsStatusCard } from '@/features/home/components/GpsStatusCard';
import { CrewCard } from '@/features/home/components/CrewCard';
import { SafetyCard } from '@/features/home/components/SafetyCard';
import { TicketsCard } from '@/features/home/components/TicketsCard';
import { QuickActions } from '@/features/home/components/QuickActions';
import { AlertsList, type Alert } from '@/features/home/components/AlertsList';
import { ProjectSwitcher } from '@/features/projects/components/ProjectSwitcher';
import { useDelivery } from '@/features/delivery/hooks/useDelivery';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { activeProject, geofence } = useProjectStore();
  const { workers, assignments, timeEntries } = useCrewStore();
  const { pendingReviews, incoming } = useDelivery();

  // ─── No project selected → Welcome state ───
  if (!activeProject) {
    return <WelcomeState name={profile?.full_name ?? null} />;
  }

  // ─── Compute stats from stores (no API calls) ───
  const assignedCount = assignments.length;
  const totalWorkers = workers.length;

  // Today's hours from time entries
  const todayHours = timeEntries.reduce((sum, e) => {
    if (e.hours) return sum + e.hours;
    if (!e.ended_at) {
      const elapsed = (Date.now() - new Date(e.started_at).getTime()) / 3600000;
      return sum + elapsed;
    }
    return sum;
  }, 0);

  // Build alerts from current state
  const alerts: Alert[] = [];

  if (assignedCount === 0 && totalWorkers > 0) {
    alerts.push({
      id: 'no-assignments',
      icon: 'people-outline',
      message: t('home.no_crew_assigned'),
      color: '#F59E0B',
      onPress: () => router.push('/(tabs)/more/crew' as any),
    });
  }

  if (pendingReviews.length > 0) {
    alerts.push({
      id: 'pending-reviews',
      icon: 'cube',
      message: `${pendingReviews.length} Delivery Ticket${pendingReviews.length > 1 ? 's' : ''} Need Your Review`,
      color: '#8B5CF6',
      onPress: () => router.push('/(tabs)/more/delivery/reviews' as any),
    });
  }

  if (incoming.length > 0) {
    alerts.push({
      id: 'incoming-deliveries',
      icon: 'car',
      message: `${incoming.length} Delivery${incoming.length > 1 ? 'ies' : ''} In Transit`,
      color: '#3B82F6',
      onPress: () => router.push('/(tabs)/more/delivery' as any),
    });
  }

  // ─── Quick actions ───
  const quickActions = [
    {
      icon: 'location' as const,
      label: t('home.quick_check_in'),
      color: '#22C55E',
      onPress: () => router.push('/(tabs)/more/checkin' as any),
    },
    {
      icon: 'construct' as const,
      label: t('home.quick_new_ticket'),
      color: '#3B82F6',
      onPress: () => router.push('/(tabs)/docs/tickets/new' as any),
    },
    {
      icon: 'shield' as const,
      label: t('home.quick_safety_doc'),
      color: '#F97316',
      onPress: () => router.push('/(tabs)/docs/safety/new?type=jha' as any),
    },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.greeting_morning') : hour < 17 ? t('home.greeting_afternoon') : t('home.greeting_evening');

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-4">
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-sm text-slate-400">{greeting}</Text>
            <Text className="text-2xl font-bold text-white">
              {profile?.full_name ?? 'Foreman'}
            </Text>
          </View>
          {/* Supervisor: project switcher. Foreman: hidden */}
          <ProjectSwitcher />
        </View>
        <View className="mt-1 flex-row items-center">
          <Ionicons name="business" size={14} color="#F97316" />
          <Text className="ml-1 text-base text-brand-orange">{activeProject.name}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <QuickActions actions={quickActions} />

      {/* Alerts */}
      <AlertsList alerts={alerts} />

      {/* GPS Status */}
      <GpsStatusCard
        isCheckedIn={false}
        lastCheckinTime={null}
        isInsideFence={geofence ? null : null}
        onPress={() => router.push('/(tabs)/more/checkin' as any)}
      />

      {/* Crew */}
      <CrewCard
        assignedCount={assignedCount}
        totalWorkers={totalWorkers}
        todayHours={todayHours}
        onPress={() => router.push('/(tabs)/more/crew' as any)}
      />

      {/* Safety — reads from store */}
      <SafetyCard
        totalDocs={0}
        activeDocs={0}
        unsignedCount={0}
        onPress={() => router.push('/(tabs)/docs' as any)}
      />

      {/* Tickets */}
      <TicketsCard
        openCount={0}
        last24hCount={0}
        onPress={() => router.push('/(tabs)/docs' as any)}
      />

      <View className="h-24" />
    </ScrollView>
  );
}

/**
 * Welcome state — shown when no project is selected.
 */
function WelcomeState({ name }: { name: string | null }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-brand-orange/20">
        <Ionicons name="construct" size={40} color="#F97316" />
      </View>
      <Text className="text-2xl font-bold text-white">
        {t('home.welcome')}{name ? `, ${name.split(' ')[0]}` : ''}
      </Text>
      <Text className="mt-3 text-center text-base leading-6 text-slate-400">
        {t('home.no_project')}{'\n'}{t('home.no_project_hint')}
      </Text>
    </View>
  );
}
