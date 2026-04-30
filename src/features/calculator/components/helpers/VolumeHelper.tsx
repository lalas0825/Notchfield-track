/**
 * Volume helper — box volume from W × L × H. All inputs in feet.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { boxVolume } from '../../utils/coverage';
import { MM_PER_FOOT } from '../../types/units';
import { formatVolumeDecimal } from '../../utils/format';

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export function VolumeHelper() {
  const { t } = useTranslation();
  const [w, setW] = useState('');
  const [l, setL] = useState('');
  const [h, setH] = useState('');

  const cum = useMemo(
    () => boxVolume(num(w) * MM_PER_FOOT, num(l) * MM_PER_FOOT, num(h) * MM_PER_FOOT),
    [w, l, h],
  );

  return (
    <View>
      <ResultCard
        primaryValue={formatVolumeDecimal(cum, 'cuft', 3)}
        primaryUnit={t('calculator.units.cuft')}
        primaryLabel={t('calculator.helpers.volume')}
        secondaryValue={formatVolumeDecimal(cum, 'L', 2)}
        secondaryUnit={t('calculator.units.liters')}
      />
      <NumberField
        label={t('calculator.fields.width')}
        value={w}
        onChangeText={setW}
        unit={t('calculator.units.feet')}
      />
      <NumberField
        label={t('calculator.fields.length')}
        value={l}
        onChangeText={setL}
        unit={t('calculator.units.feet')}
      />
      <NumberField
        label={t('calculator.fields.height')}
        value={h}
        onChangeText={setH}
        unit={t('calculator.units.feet')}
      />
    </View>
  );
}
