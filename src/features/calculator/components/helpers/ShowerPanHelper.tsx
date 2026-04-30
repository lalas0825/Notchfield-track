/**
 * Shower pan slope — radius to drain + slope per ft → mud bed depth at perimeter.
 *
 * TCNA standard slope: ¼" per foot.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateShowerPan } from '../../utils/coverage';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function ShowerPanHelper() {
  const { t } = useTranslation();
  const [radius, setRadius] = useState('');
  const [slope, setSlope] = useState('0.25');
  const [drainDepth, setDrainDepth] = useState('1');

  const result = useMemo(
    () => calculateShowerPan({
      radiusFt: num(radius),
      slopeInPerFt: num(slope, 0.25),
      drainDepthIn: num(drainDepth, 1),
    }),
    [radius, slope, drainDepth],
  );

  return (
    <View>
      <ResultCard
        primaryValue={result.perimeterDepthIn.toFixed(2)}
        primaryUnit={t('calculator.units.inches')}
        primaryLabel={t('calculator.helpers.shower_pan')}
        formula={result.formula}
      />
      <NumberField label={t('calculator.fields.radius_to_drain')} value={radius} onChangeText={setRadius} unit={t('calculator.units.feet')} />
      <NumberField label={t('calculator.fields.slope')} value={slope} onChangeText={setSlope} unit='" / ft' />
      <NumberField label={t('calculator.fields.drain_depth')} value={drainDepth} onChangeText={setDrainDepth} unit={t('calculator.units.inches')} />
      <HelperDoneButton value={result.perimeterDepthIn.toFixed(2)} unit={t('calculator.units.inches')} />
    </View>
  );
}
