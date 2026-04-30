/**
 * Horizontal chip selector. Used by helpers with mode toggles
 * (sanded/unsanded/epoxy, rectangle/triangle/circle, etc).
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { haptic } from '@/shared/lib/haptics';

export interface Chip<T extends string = string> {
  value: T;
  label: string;
}

interface ChipRowProps<T extends string> {
  label?: string;
  options: Chip<T>[];
  value: T;
  onChange: (v: T) => void;
}

export function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChipRowProps<T>) {
  return (
    <View className="mb-3">
      {label ? (
        <Text className="mb-1 text-sm font-medium text-slate-300">{label}</Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                void haptic.selection();
                onChange(opt.value);
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected }}
              className={`rounded-full px-4 py-2 ${
                selected
                  ? 'bg-brand-orange'
                  : 'border border-border bg-card'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  selected ? 'text-white' : 'text-slate-300'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
