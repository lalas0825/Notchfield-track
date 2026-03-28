import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Worker } from '../store/crew-store';

type Props = {
  worker: Worker;
  currentArea: string | null; // area name if assigned, null if free
  selected: boolean;
  onPress: () => void;
};

export function WorkerCard({ worker, currentArea, selected, onPress }: Props) {
  const initials = worker.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 flex-row items-center rounded-xl border px-4 py-3 active:opacity-80 ${
        selected
          ? 'border-brand-orange bg-brand-orange/10'
          : 'border-border bg-card'
      }`}
    >
      {/* Checkbox — 48dp touch target */}
      <View
        className={`h-7 w-7 items-center justify-center rounded-lg ${
          selected ? 'bg-brand-orange' : 'border border-slate-500'
        }`}
      >
        {selected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
      </View>

      {/* Avatar */}
      <View className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-slate-600">
        <Text className="text-sm font-bold text-white">{initials}</Text>
      </View>

      {/* Info */}
      <View className="ml-3 flex-1">
        <Text className="text-base font-medium text-white">{worker.full_name}</Text>
        {currentArea && (
          <View className="mt-0.5 flex-row items-center">
            <Ionicons name="location" size={12} color="#F59E0B" />
            <Text className="ml-1 text-sm text-warning">{currentArea}</Text>
          </View>
        )}
      </View>

      {/* Role badge */}
      <Text className="text-xs capitalize text-slate-500">{worker.role}</Text>
    </Pressable>
  );
}
