import { View, Text } from 'react-native';

export default function BoardScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-2xl font-bold text-white">Ready Board</Text>
      <Text className="mt-2 text-slate-400">Production — Phase T2</Text>
    </View>
  );
}
