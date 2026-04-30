/**
 * Big result card — the conclusion of every helper screen.
 *
 * Pinned to the top of helper bodies so the answer is always visible
 * while the user is editing inputs below.
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Clipboard } from 'react-native';
import { haptic } from '@/shared/lib/haptics';

interface ResultCardProps {
  primaryValue: string;
  primaryUnit: string;
  primaryLabel?: string;
  secondaryValue?: string;
  secondaryUnit?: string;
  secondaryLabel?: string;
  formula?: string;
  copyOnTap?: boolean;
}

export function ResultCard({
  primaryValue,
  primaryUnit,
  primaryLabel,
  secondaryValue,
  secondaryUnit,
  secondaryLabel,
  formula,
  copyOnTap = true,
}: ResultCardProps) {
  const handleCopy = () => {
    if (!copyOnTap) return;
    void haptic.light();
    Clipboard.setString(`${primaryValue} ${primaryUnit}`.trim());
  };

  return (
    <Pressable
      onPress={handleCopy}
      accessibilityRole="button"
      accessibilityLabel={`Copy result: ${primaryValue} ${primaryUnit}`}
      className="mb-4 rounded-2xl border-2 border-brand-orange/40 bg-card px-5 py-5 active:opacity-80"
    >
      {primaryLabel ? (
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {primaryLabel}
        </Text>
      ) : null}
      <View className="flex-row items-baseline justify-between">
        <View className="flex-row items-baseline">
          <Text className="text-4xl font-bold text-white">{primaryValue}</Text>
          {primaryUnit ? (
            <Text className="ml-2 text-xl font-semibold text-slate-400">
              {primaryUnit}
            </Text>
          ) : null}
        </View>
        {copyOnTap ? (
          <Ionicons name="copy-outline" size={20} color="#94A3B8" />
        ) : null}
      </View>

      {secondaryValue ? (
        <View className="mt-3 border-t border-border pt-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {secondaryLabel ?? 'Also'}
          </Text>
          <Text className="mt-1 text-base font-medium text-slate-300">
            {secondaryValue} {secondaryUnit}
          </Text>
        </View>
      ) : null}

      {formula ? (
        <Text className="mt-3 text-xs leading-relaxed text-slate-500">
          {formula}
        </Text>
      ) : null}
    </Pressable>
  );
}
