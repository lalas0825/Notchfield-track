import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
  children: React.ReactNode;
};

/**
 * Base card for the Home dashboard.
 * Modular slot: wrap any content inside. Adding a T2 KPI card =
 * just create a new component that uses <DashboardCard>.
 */
export function DashboardCard({ title, icon, iconColor = '#F97316', onPress, children }: Props) {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      className="mb-3 rounded-2xl border border-border bg-card px-4 py-4 active:opacity-80"
    >
      <View className="mb-3 flex-row items-center">
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text className="ml-2 text-sm font-bold uppercase text-slate-400">{title}</Text>
      </View>
      {children}
    </Wrapper>
  );
}
