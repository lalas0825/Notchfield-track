/**
 * Stair tile — # steps + tread/riser/nosing dims → total sqft + linear ft of nosing.
 */

import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateStairTile } from '../../utils/coverage';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function StairTileHelper() {
  const { t } = useTranslation();
  const [steps, setSteps] = useState('');
  const [treadW, setTreadW] = useState('36');
  const [treadD, setTreadD] = useState('11');
  const [riserH, setRiserH] = useState('7');
  const [nosingW, setNosingW] = useState('36');

  const result = useMemo(
    () => calculateStairTile({
      steps: Math.max(0, Math.round(num(steps))),
      treadWidthIn: num(treadW),
      treadDepthIn: num(treadD),
      riserHeightIn: num(riserH),
      nosingWidthIn: num(nosingW),
    }),
    [steps, treadW, treadD, riserH, nosingW],
  );

  return (
    <View>
      <ResultCard
        primaryValue={result.totalSqft.toFixed(2)}
        primaryUnit={t('calculator.units.sqft')}
        primaryLabel={t('calculator.helpers.stair_tile')}
        secondaryValue={result.nosingLinearFt.toFixed(2)}
        secondaryUnit={`${t('calculator.units.feet')} nosing`}
      />
      <View className="mb-3 rounded-xl border border-border bg-card px-4 py-3">
        <Text className="text-xs text-slate-400">
          Treads: {result.treadSqft.toFixed(2)} sq ft · Risers: {result.riserSqft.toFixed(2)} sq ft
        </Text>
      </View>
      <NumberField label={t('calculator.fields.steps')} value={steps} onChangeText={setSteps} keyboardType="numeric" />
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.tread_width')} value={treadW} onChangeText={setTreadW} unit={t('calculator.units.inches')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.tread_depth')} value={treadD} onChangeText={setTreadD} unit={t('calculator.units.inches')} /></View>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.riser_height')} value={riserH} onChangeText={setRiserH} unit={t('calculator.units.inches')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.nosing_width')} value={nosingW} onChangeText={setNosingW} unit={t('calculator.units.inches')} /></View>
      </View>
      <HelperDoneButton value={result.totalSqft.toFixed(2)} unit={t('calculator.units.sqft')} />
    </View>
  );
}
