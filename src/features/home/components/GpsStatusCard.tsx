import { Text, View } from 'react-native';
import { DashboardCard } from './DashboardCard';

type Props = {
  isCheckedIn: boolean;
  lastCheckinTime: string | null;
  isInsideFence: boolean | null;
  onPress: () => void;
};

export function GpsStatusCard({ isCheckedIn, lastCheckinTime, isInsideFence, onPress }: Props) {
  return (
    <DashboardCard title="GPS Status" icon="location" iconColor="#22C55E" onPress={onPress}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor: isCheckedIn
                ? '#22C55E'
                : isInsideFence === false
                ? '#F59E0B'
                : '#94A3B8',
            }}
          />
          <Text className="ml-2 text-lg font-bold text-white">
            {isCheckedIn ? 'On Site' : 'Not Checked In'}
          </Text>
        </View>
        {lastCheckinTime && (
          <Text className="text-sm text-slate-400">Since {lastCheckinTime}</Text>
        )}
      </View>
      {isInsideFence === false && !isCheckedIn && (
        <Text className="mt-1 text-sm text-warning">Outside geofence</Text>
      )}
    </DashboardCard>
  );
}
