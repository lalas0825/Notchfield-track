/**
 * Uncoupling membrane (Schluter Ditra etc) — sqft + roll dims + overlap → rolls.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateUncoupling } from '../../utils/coverage';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function UncouplingHelper() {
  const { t } = useTranslation();
  const [sqft, setSqft] = useState('');
  const [rollW, setRollW] = useState('3.25');
  const [rollL, setRollL] = useState('53.75');
  const [overlap, setOverlap] = useState('2');
  const [wastePercent, setWastePercent] = useState('10');

  const result = useMemo(
    () => calculateUncoupling({
      sqft: num(sqft),
      rollWidthFt: num(rollW, 3.25),
      rollLengthFt: num(rollL, 53.75),
      overlapIn: num(overlap, 2),
      wastePercent: num(wastePercent, 10),
    }),
    [sqft, rollW, rollL, overlap, wastePercent],
  );

  return (
    <View>
      <ResultCard
        primaryValue={String(result.quantity)}
        primaryUnit={t('calculator.units.rolls')}
        primaryLabel={t('calculator.helpers.uncoupling')}
        secondaryValue={result.rawQuantity.toFixed(2)}
        secondaryUnit="raw"
        formula={result.formula}
      />
      <NumberField label={t('calculator.fields.sqft')} value={sqft} onChangeText={setSqft} unit={t('calculator.units.sqft')} />
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.roll_width')} value={rollW} onChangeText={setRollW} unit={t('calculator.units.feet')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.roll_length')} value={rollL} onChangeText={setRollL} unit={t('calculator.units.feet')} /></View>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.overlap')} value={overlap} onChangeText={setOverlap} unit={t('calculator.units.inches')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.waste_percent')} value={wastePercent} onChangeText={setWastePercent} unit={t('calculator.units.percent')} /></View>
      </View>
      <HelperDoneButton value={String(result.quantity)} unit={t('calculator.units.rolls')} />
    </View>
  );
}
