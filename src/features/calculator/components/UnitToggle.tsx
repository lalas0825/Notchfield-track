/**
 * Precision picker — controls fractional inch snap (1/2 → 1/32).
 */

import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/shared/lib/haptics';
import { PRECISION_OPTIONS, type ImperialPrecision } from '../types/units';
import { useCalculator } from '../hooks/useCalculator';

export function UnitToggle() {
  const { t } = useTranslation();
  const precision = useCalculator((s) => s.precision);
  const setPrecision = useCalculator((s) => s.setPrecision);

  return (
    <View className="mb-3 flex-row items-center">
      <Text className="mr-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('calculator.precision')}
      </Text>
      <View className="flex-1 flex-row" style={{ gap: 4 }}>
        {PRECISION_OPTIONS.map((p) => (
          <Pressable
            key={p}
            onPress={() => {
              void haptic.selection();
              setPrecision(p as ImperialPrecision);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Precision 1/${p}`}
            accessibilityState={{ selected: precision === p }}
            className={`flex-1 items-center justify-center rounded-lg py-2 ${
              precision === p ? 'bg-brand-orange' : 'border border-border bg-card'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                precision === p ? 'text-white' : 'text-slate-400'
              }`}
            >
              1/{p}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
