/**
 * Recent calculations list — last 10, persisted via useHistory.
 *
 * Tap a row to load it back into the expression input.
 * Long-press to delete.
 */

import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/shared/lib/haptics';
import { useHistory } from '../hooks/useHistory';
import { useCalculator } from '../hooks/useCalculator';
import { formatValueShort } from '../utils/format';

export function HistoryList() {
  const { t } = useTranslation();
  const { entries, remove, clear } = useHistory();
  const loadFromHistory = useCalculator((s) => s.loadFromHistory);
  const precision = useCalculator((s) => s.precision);

  if (entries.length === 0) {
    return (
      <View className="rounded-xl border border-border bg-card px-4 py-6">
        <Text className="text-center text-sm text-slate-500">
          {t('calculator.history')}
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-xl border border-border bg-card overflow-hidden">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('calculator.history')}
        </Text>
        <Pressable
          onPress={() => {
            Alert.alert('', '', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => void clear() },
            ]);
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear history"
          className="px-2 py-1 active:opacity-70"
        >
          <Ionicons name="trash-outline" size={16} color="#94A3B8" />
        </Pressable>
      </View>
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={() => {
            void haptic.light();
            loadFromHistory(entry.expression);
          }}
          onLongPress={() => {
            void haptic.medium();
            void remove(entry.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Reuse ${entry.expression}`}
          className="border-b border-border px-4 py-3 active:bg-border last:border-b-0"
        >
          <Text className="text-sm font-medium text-slate-300" numberOfLines={1}>
            {entry.expression}
          </Text>
          <Text className="mt-1 text-base font-bold text-white">
            = {formatValueShort({ kind: entry.kind, value: entry.value }, precision)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
