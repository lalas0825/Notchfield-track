import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardCard } from './DashboardCard';

type Props = {
  totalDocs: number;
  activeDocs: number;
  unsignedCount: number;
  onPress: () => void;
};

export function SafetyCard({ totalDocs, activeDocs, unsignedCount, onPress }: Props) {
  const allSigned = unsignedCount === 0 && totalDocs > 0;

  return (
    <DashboardCard title="Safety" icon="shield-checkmark" iconColor={allSigned ? '#22C55E' : '#F59E0B'} onPress={onPress}>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-3xl font-bold text-white">{activeDocs}</Text>
          <Text className="text-sm text-slate-400">active documents</Text>
        </View>
        {unsignedCount > 0 ? (
          <View className="flex-row items-center rounded-full bg-warning/20 px-3 py-1">
            <Ionicons name="alert-circle" size={14} color="#F59E0B" />
            <Text className="ml-1 text-sm font-bold text-warning">
              {unsignedCount} need signatures
            </Text>
          </View>
        ) : totalDocs > 0 ? (
          <View className="flex-row items-center rounded-full bg-success/20 px-3 py-1">
            <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
            <Text className="ml-1 text-sm font-bold text-success">All signed</Text>
          </View>
        ) : null}
      </View>
    </DashboardCard>
  );
}
