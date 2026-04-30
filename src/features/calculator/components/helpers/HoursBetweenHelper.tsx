/**
 * Hours between times — start + end (+ optional break) → decimal hours.
 *
 * Used daily by foremen reconciling crew time when the punch-clock isn't
 * available or when sanity-checking what was logged via the timesheet UI.
 */

import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { hoursBetween } from '../../utils/coverage';

function num(s: string, fallback = 0): number {
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : fallback;
}

export function HoursBetweenHelper() {
  const { t } = useTranslation();
  const [startH, setStartH] = useState('7');
  const [startM, setStartM] = useState('0');
  const [endH, setEndH] = useState('15');
  const [endM, setEndM] = useState('30');
  const [breakMin, setBreakMin] = useState('30');

  const hours = useMemo(
    () => hoursBetween({
      startHours: clamp(num(startH), 0, 23),
      startMinutes: clamp(num(startM), 0, 59),
      endHours: clamp(num(endH), 0, 23),
      endMinutes: clamp(num(endM), 0, 59),
      breakMinutes: Math.max(0, num(breakMin)),
    }),
    [startH, startM, endH, endM, breakMin],
  );

  return (
    <View>
      <ResultCard
        primaryValue={hours.toFixed(2)}
        primaryUnit={t('calculator.units.hours')}
        primaryLabel={t('calculator.helpers.hours_between')}
      />
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('calculator.fields.start_time')}
      </Text>
      <View className="mb-3 flex-row" style={{ gap: 8 }}>
        <View className="flex-1"><NumberField label="Hour (24h)" value={startH} onChangeText={setStartH} keyboardType="numeric" /></View>
        <View className="flex-1"><NumberField label="Min" value={startM} onChangeText={setStartM} keyboardType="numeric" /></View>
      </View>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('calculator.fields.end_time')}
      </Text>
      <View className="mb-3 flex-row" style={{ gap: 8 }}>
        <View className="flex-1"><NumberField label="Hour (24h)" value={endH} onChangeText={setEndH} keyboardType="numeric" /></View>
        <View className="flex-1"><NumberField label="Min" value={endM} onChangeText={setEndM} keyboardType="numeric" /></View>
      </View>
      <NumberField
        label={t('calculator.fields.break_minutes')}
        value={breakMin}
        onChangeText={setBreakMin}
        keyboardType="numeric"
      />
    </View>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
