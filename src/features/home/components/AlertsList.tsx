import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type Alert = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  color: string;
  onPress?: () => void;
};

type Props = {
  alerts: Alert[];
};

export function AlertsList({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <View className="mb-3">
      <Text className="mb-2 text-sm font-bold uppercase text-slate-400">Pending</Text>
      {alerts.map((alert) => (
        <Pressable
          key={alert.id}
          onPress={alert.onPress}
          className="mb-1.5 flex-row items-center rounded-xl border border-border bg-card px-4 py-3 active:opacity-80"
        >
          <Ionicons name={alert.icon} size={18} color={alert.color} />
          <Text className="ml-3 flex-1 text-base text-white">{alert.message}</Text>
          <Ionicons name="chevron-forward" size={16} color="#64748B" />
        </Pressable>
      ))}
    </View>
  );
}
