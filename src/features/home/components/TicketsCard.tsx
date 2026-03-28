import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardCard } from './DashboardCard';

type Props = {
  openCount: number;
  last24hCount: number;
  onPress: () => void;
};

export function TicketsCard({ openCount, last24hCount, onPress }: Props) {
  return (
    <DashboardCard title="Work Tickets" icon="construct" iconColor="#8B5CF6" onPress={onPress}>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-3xl font-bold text-white">{openCount}</Text>
          <Text className="text-sm text-slate-400">open tickets</Text>
        </View>
        {last24hCount > 0 && (
          <View className="flex-row items-center">
            <Ionicons name="add-circle" size={14} color="#94A3B8" />
            <Text className="ml-1 text-sm text-slate-400">{last24hCount} today</Text>
          </View>
        )}
      </View>
    </DashboardCard>
  );
}
