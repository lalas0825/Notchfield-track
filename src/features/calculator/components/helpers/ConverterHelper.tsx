/**
 * Direct unit converter — pick a "from" unit, type a value, see all other
 * units. Length-only for now (matches the 5-line main Display).
 */

import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChipRow } from '../shared/ChipRow';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { LENGTH_UNIT_TO_MM, type LengthUnit } from '../../types/units';
import { formatImperialFractional, formatLengthDecimal } from '../../utils/format';
import { useCalculator } from '../../hooks/useCalculator';

const UNITS: LengthUnit[] = ['ft', 'in', 'yd', 'mm', 'cm', 'm'];

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export function ConverterHelper() {
  const { t } = useTranslation();
  const precision = useCalculator((s) => s.precision);
  const [fromUnit, setFromUnit] = useState<LengthUnit>('ft');
  const [value, setValue] = useState('');

  const mm = useMemo(() => num(value) * LENGTH_UNIT_TO_MM[fromUnit], [value, fromUnit]);

  return (
    <View>
      <ResultCard
        primaryValue={formatImperialFractional(mm, precision)}
        primaryUnit=""
        primaryLabel={t('calculator.helpers.converter')}
      />
      <ChipRow<LengthUnit>
        label="From unit"
        options={UNITS.map((u) => ({ value: u, label: t(`calculator.units.${unitKey(u)}`) }))}
        value={fromUnit}
        onChange={setFromUnit}
      />
      <NumberField
        label="Value"
        value={value}
        onChangeText={setValue}
        unit={t(`calculator.units.${unitKey(fromUnit)}`)}
      />
      <View className="mt-2 rounded-xl border border-border bg-card overflow-hidden">
        {UNITS.filter((u) => u !== fromUnit).map((u) => (
          <View
            key={u}
            className="flex-row items-baseline justify-between border-b border-border px-4 py-3 last:border-b-0"
          >
            <Text className="text-base font-medium text-slate-300">
              {formatLengthDecimal(mm, u, 4)}
            </Text>
            <Text className="text-sm font-semibold text-slate-500">
              {t(`calculator.units.${unitKey(u)}`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function unitKey(u: LengthUnit): string {
  switch (u) {
    case 'ft': return 'feet';
    case 'in': return 'inches';
    case 'yd': return 'yards';
    case 'mm': return 'millimeters';
    case 'cm': return 'centimeters';
    case 'm':  return 'meters';
  }
}
