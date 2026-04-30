/**
 * Sealer / waterproofing helper — sqft × coats / coverage.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateSealer } from '../../utils/coverage';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function SealerHelper() {
  const { t } = useTranslation();
  const [sqft, setSqft] = useState('');
  const [coverage, setCoverage] = useState('100');
  const [coats, setCoats] = useState('2');
  const [wastePercent, setWastePercent] = useState('10');

  const result = useMemo(
    () => calculateSealer({
      sqft: num(sqft),
      coveragePerGallon: num(coverage, 100),
      coats: num(coats, 1),
      wastePercent: num(wastePercent, 10),
    }),
    [sqft, coverage, coats, wastePercent],
  );

  return (
    <View>
      <ResultCard
        primaryValue={result.quantity.toFixed(2)}
        primaryUnit={t('calculator.units.gallons')}
        primaryLabel={t('calculator.helpers.sealer')}
        formula={result.formula}
      />
      <NumberField label={t('calculator.fields.sqft')} value={sqft} onChangeText={setSqft} unit={t('calculator.units.sqft')} />
      <NumberField label={t('calculator.fields.coverage_per_gal')} value={coverage} onChangeText={setCoverage} unit={t('calculator.units.sqft')} />
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.coats')} value={coats} onChangeText={setCoats} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.waste_percent')} value={wastePercent} onChangeText={setWastePercent} unit={t('calculator.units.percent')} /></View>
      </View>
      <HelperDoneButton value={result.quantity.toFixed(2)} unit={t('calculator.units.gallons')} />
    </View>
  );
}
