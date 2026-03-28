import { Text, View } from 'react-native';
import { DashboardCard } from './DashboardCard';

type Props = {
  assignedCount: number;
  totalWorkers: number;
  todayHours: number;
  onPress: () => void;
};

export function CrewCard({ assignedCount, totalWorkers, todayHours, onPress }: Props) {
  return (
    <DashboardCard title="Crew" icon="people" iconColor="#3B82F6" onPress={onPress}>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-3xl font-bold text-white">
            {assignedCount}
            <Text className="text-lg text-slate-500"> / {totalWorkers}</Text>
          </Text>
          <Text className="text-sm text-slate-400">workers assigned</Text>
        </View>
        <View className="items-end">
          <Text className="text-xl font-bold text-white">{todayHours.toFixed(1)}h</Text>
          <Text className="text-sm text-slate-400">today</Text>
        </View>
      </View>
    </DashboardCard>
  );
}
