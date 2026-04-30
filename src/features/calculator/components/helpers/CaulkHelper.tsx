/**
 * Caulk for movement joints — linear ft + joint dims → tubes.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateCaulk } from '../../utils/coverage';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function CaulkHelper() {
  const { t } = useTranslation();
  const [linearFt, setLinearFt] = useState('');
  const [jointW, setJointW] = useState('0.25');
  const [jointD, setJointD] = useState('0.25');
  const [tubeSize, setTubeSize] = useState('10');
  const [wastePercent, setWastePercent] = useState('15');

  const result = useMemo(
    () => calculateCaulk({
      linearFt: num(linearFt),
      jointWidthIn: num(jointW),
      jointDepthIn: num(jointD),
      tubeSizeOz: num(tubeSize, 10),
      wastePercent: num(wastePercent, 15),
    }),
    [linearFt, jointW, jointD, tubeSize, wastePercent],
  );

  return (
    <View>
      <ResultCard
        primaryValue={String(result.quantity)}
        primaryUnit={t('calculator.units.tubes')}
        primaryLabel={t('calculator.helpers.caulk')}
        secondaryValue={result.rawQuantity.toFixed(2)}
        secondaryUnit="raw"
        formula={result.formula}
      />
      <NumberField label={t('calculator.fields.linear_ft')} value={linearFt} onChangeText={setLinearFt} unit={t('calculator.units.feet')} />
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.joint_width')} value={jointW} onChangeText={setJointW} unit={t('calculator.units.inches')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.joint_depth')} value={jointD} onChangeText={setJointD} unit={t('calculator.units.inches')} /></View>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.tube_size')} value={tubeSize} onChangeText={setTubeSize} unit="oz" /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.waste_percent')} value={wastePercent} onChangeText={setWastePercent} unit={t('calculator.units.percent')} /></View>
      </View>
      <HelperDoneButton value={String(result.quantity)} unit={t('calculator.units.tubes')} />
    </View>
  );
}
