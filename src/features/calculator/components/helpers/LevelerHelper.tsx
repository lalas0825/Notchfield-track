/**
 * Self-leveler helper — sqft + depth → bags.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateLeveler } from '../../utils/coverage';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function LevelerHelper() {
  const { t } = useTranslation();
  const [sqft, setSqft] = useState('');
  const [depth, setDepth] = useState('');
  const [bagSize, setBagSize] = useState('50');
  const [density, setDensity] = useState('125');
  const [wastePercent, setWastePercent] = useState('10');

  const result = useMemo(
    () => calculateLeveler({
      sqft: num(sqft),
      depthIn: num(depth),
      bagSizeLb: num(bagSize, 50),
      densityLbPerCuft: num(density, 125),
      wastePercent: num(wastePercent, 10),
    }),
    [sqft, depth, bagSize, density, wastePercent],
  );

  return (
    <View>
      <ResultCard
        primaryValue={String(result.quantity)}
        primaryUnit={t('calculator.units.bags')}
        primaryLabel={t('calculator.helpers.leveler')}
        secondaryValue={String(result.secondaryQuantity ?? '')}
        secondaryUnit={result.secondaryUnit}
        formula={result.formula}
      />
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.sqft')} value={sqft} onChangeText={setSqft} unit={t('calculator.units.sqft')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.depth')} value={depth} onChangeText={setDepth} unit={t('calculator.units.inches')} /></View>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.bag_size')} value={bagSize} onChangeText={setBagSize} unit={t('calculator.units.lbs')} /></View>
        <View className="flex-1"><NumberField label="Density" value={density} onChangeText={setDensity} unit="lb/cuft" /></View>
      </View>
      <NumberField label={t('calculator.fields.waste_percent')} value={wastePercent} onChangeText={setWastePercent} unit={t('calculator.units.percent')} />
      <HelperDoneButton value={String(result.quantity)} unit={t('calculator.units.bags')} />
    </View>
  );
}
