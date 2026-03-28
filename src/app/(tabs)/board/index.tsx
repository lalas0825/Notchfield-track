import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProduction } from '@/features/production/hooks/useProduction';
import { ReadyBoard } from '@/features/production/components/ReadyBoard';
import type { ProductionArea } from '@/features/production/store/production-store';

export default function BoardScreen() {
  const router = useRouter();
  const {
    floors,
    loading,
    totalAreas,
    completedAreas,
    blockedAreas,
    inProgressAreas,
  } = useProduction();

  const handleAreaPress = (area: ProductionArea) => {
    router.push({
      pathname: '/(tabs)/board/[areaId]' as any,
      params: { areaId: area.id },
    });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Ready Board' }} />
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Ready Board' }} />
      <View className="flex-1 bg-background">
        <ReadyBoard
          floors={floors}
          blockedCount={blockedAreas}
          inProgressCount={inProgressAreas}
          completedCount={completedAreas}
          totalCount={totalAreas}
          onAreaPress={handleAreaPress}
        />

        {/* FAB — Submit Daily Report */}
        <Pressable
          onPress={() => router.push('/(tabs)/board/report' as any)}
          className="absolute bottom-24 right-4 h-14 flex-row items-center rounded-full bg-success px-5 shadow-lg active:opacity-80"
        >
          <Ionicons name="document-text" size={20} color="#FFFFFF" />
          <Text className="ml-2 text-base font-bold text-white">Submit Report</Text>
        </Pressable>
      </View>
    </>
  );
}
