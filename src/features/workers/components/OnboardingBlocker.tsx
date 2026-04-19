/**
 * Shown when the current profile has no matching `workers` row.
 *
 * PTP creation, crew sign-off, and any other feature that needs worker-level
 * HR data (SST, OSHA, trade) has to be gated on this check. The fix is a PM
 * action in Takeoff web, not something the foreman can do from Track.
 */
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export function OnboardingBlocker() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-warning/20">
        <Ionicons name="person-outline" size={40} color="#F59E0B" />
      </View>
      <Text className="text-center text-2xl font-bold text-white">
        You're not in Manpower yet
      </Text>
      <Text className="mt-3 text-center text-base leading-6 text-slate-400">
        Before you can create a PTP, your PM needs to add you in the Manpower
        module in Takeoff web with your SST card and trade. Once added, pull
        down to refresh here.
      </Text>
      <Pressable
        onPress={() => router.back()}
        className="mt-6 h-12 w-full max-w-xs items-center justify-center rounded-xl border border-border"
      >
        <Text className="text-base font-medium text-slate-400">Go back</Text>
      </Pressable>
    </View>
  );
}
