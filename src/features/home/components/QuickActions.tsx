import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Action = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
};

type Props = {
  actions: Action[];
};

export function QuickActions({ actions }: Props) {
  return (
    <View className="mb-3 flex-row gap-2">
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          className="flex-1 items-center rounded-2xl border border-border bg-card py-4 active:opacity-80"
        >
          <View
            className="mb-2 h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: `${action.color}20` }}
          >
            <Ionicons name={action.icon} size={24} color={action.color} />
          </View>
          <Text className="text-xs font-medium text-white">{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
