import { ActivityIndicator, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useProduction } from '@/features/production/hooks/useProduction';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useCrewStore } from '@/features/crew/store/crew-store';
import { AreaDetail } from '@/features/production/components/AreaDetail';
import { enqueuePhoto } from '@/features/photos/services/photo-queue';

export default function AreaDetailScreen() {
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { areas, templatePhases, getAreaPhases, markAreaStatus, updatePhaseProgress, reload } =
    useProduction();
  const { timeEntries } = useCrewStore();

  const area = areas.find((a) => a.id === areaId);
  const phases = area ? getAreaPhases(area.id) : [];

  // Calculate time for this area today
  const areaTimeToday = timeEntries
    .filter((e) => e.area_id === areaId)
    .reduce((sum, e) => {
      if (e.hours) return sum + e.hours;
      if (!e.ended_at) {
        return sum + (Date.now() - new Date(e.started_at).getTime()) / 3600000;
      }
      return sum;
    }, 0);

  if (!area) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  const handleMarkStatus = async (status: string, blockedReason?: string) => {
    await markAreaStatus(area.id, status, blockedReason);
    await reload();
  };

  const handlePhaseComplete = async (progressId: string) => {
    await updatePhaseProgress(progressId, {
      status: 'complete',
      percent_complete: 100,
      completed_at: new Date().toISOString(),
      completed_by: user?.id,
    } as any);
    await reload();
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0] || !profile || !activeProject) return;

    await enqueuePhoto({
      sourceUri: result.assets[0].uri,
      organizationId: profile.organization_id,
      projectId: activeProject.id,
      areaId: area.id,
      contextType: 'progress',
      takenBy: user!.id,
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: area.name,
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <AreaDetail
        area={area}
        phases={phases}
        templatePhases={templatePhases}
        onMarkStatus={handleMarkStatus}
        onPhaseComplete={handlePhaseComplete}
        onTakePhoto={handleTakePhoto}
        timeHours={areaTimeToday > 0 ? areaTimeToday : null}
      />
    </>
  );
}
