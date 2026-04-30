/**
 * 5-line multi-unit result display.
 *
 * Each row is independently tappable — tap any row to copy that exact
 * representation to the clipboard with a haptic + toast.
 */

import { useEffect, useState } from 'react';
import { Clipboard, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/shared/lib/haptics';
import { formatValueRows } from '../utils/format';
import type { Value } from '../types/units';
import { useCalculator } from '../hooks/useCalculator';

interface DisplayProps {
  value: Value | null;
  error: string | null;
}

export function Display({ value, error }: DisplayProps) {
  const { t } = useTranslation();
  const precision = useCalculator((s) => s.precision);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (copiedIdx === null) return;
    const id = setTimeout(() => setCopiedIdx(null), 1500);
    return () => clearTimeout(id);
  }, [copiedIdx]);

  if (error) {
    return (
      <View className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
        <Text className="text-sm font-medium text-danger">
          {t('calculator.expression_error')}
        </Text>
        <Text className="mt-1 text-xs text-slate-400">{error}</Text>
      </View>
    );
  }

  if (!value) {
    return (
      <View className="mb-3 rounded-xl border border-border bg-card px-4 py-6">
        <Text className="text-center text-sm text-slate-500">
          {t('calculator.result')}
        </Text>
      </View>
    );
  }

  const rows = formatValueRows(value, precision);

  return (
    <View className="mb-3 rounded-xl border border-border bg-card overflow-hidden">
      {rows.map((row, idx) => (
        <Pressable
          key={`${row.unit}-${idx}`}
          onPress={() => {
            void haptic.light();
            const txt = row.unit
              ? `${row.display} ${row.unit}`.trim()
              : row.display;
            Clipboard.setString(txt);
            setCopiedIdx(idx);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${row.display} ${row.unit}`}
          className={`flex-row items-baseline justify-between px-4 py-3 ${
            idx > 0 ? 'border-t border-border' : ''
          } ${idx === 0 ? '' : ''} active:bg-border`}
        >
          <View className="flex-row items-baseline">
            <Text
              className={`${
                idx === 0
                  ? 'text-3xl font-bold text-white'
                  : 'text-xl font-medium text-slate-300'
              }`}
            >
              {row.display}
            </Text>
            {row.unit ? (
              <Text
                className={`ml-2 ${
                  idx === 0
                    ? 'text-lg font-semibold text-slate-400'
                    : 'text-base text-slate-500'
                }`}
              >
                {row.unit}
              </Text>
            ) : null}
          </View>
          {copiedIdx === idx ? (
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text className="ml-1 text-xs font-semibold text-success">
                {t('calculator.copied')}
              </Text>
            </View>
          ) : (
            <Ionicons name="copy-outline" size={16} color="#475569" />
          )}
        </Pressable>
      ))}
    </View>
  );
}
