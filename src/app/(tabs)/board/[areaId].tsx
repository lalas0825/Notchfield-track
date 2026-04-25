import { ActivityIndicator, Alert, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useProduction } from '@/features/production/hooks/useProduction';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useCrewStore } from '@/features/crew/store/crew-store';
import { AreaDetail } from '@/features/production/components/AreaDetail';
import { PhaseChecklist } from '@/features/production/components/PhaseChecklist';
import { SurfaceChecklist } from '@/features/production/components/SurfaceChecklist';
import { PhotoGallery } from '@/features/production/components/PhotoGallery';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { enqueuePhoto } from '@/features/photos/services/photo-queue';

export default function AreaDetailScreen() {
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { areas, templatePhases, getAreaPhases, markAreaStatus, completePhase } =
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
    const result = await markAreaStatus(area.id, status, blockedReason);
    if (!result.success && result.error) {
      // Gate validation failed — show the error (AreaDetail handles display)
      Alert.alert('Cannot Complete', result.error);
    }
  };

  const handlePhaseComplete = async (progressId: string) => {
    if (!user) return;
    await completePhase(progressId, user.id);
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
      phaseId: null, // general area photo — not linked to a specific phase
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
        renderBeforePhases={
          <PhaseChecklist
            areaId={area.id}
            templateId={area.template_id}
            userId={user?.id ?? ''}
          />
        }
        renderAfterPhases={
          <SurfaceChecklist areaId={area.id} />
        }
        renderPhotoGallery={
          <PhotoGallery areaId={area.id} />
        }
        renderMessages={
          <MessageThread projectId={activeProject?.id ?? null} areaId={area.id} />
        }
      />
    </>
  );
}
