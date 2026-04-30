/**
 * Slope / pitch helper — rise + run → degrees + percent.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { slopeFromRiseRun } from '../../utils/coverage';
import { MM_PER_FOOT } from '../../types/units';

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export function SlopeHelper() {
  const { t } = useTranslation();
  const [rise, setRise] = useState('');
  const [run, setRun] = useState('');

  const result = useMemo(
    () => slopeFromRiseRun(num(rise) * MM_PER_FOOT, num(run) * MM_PER_FOOT),
    [rise, run],
  );

  return (
    <View>
      <ResultCard
        primaryValue={result.degrees.toFixed(2)}
        primaryUnit={t('calculator.units.degrees')}
        primaryLabel={t('calculator.helpers.slope')}
        secondaryValue={Number.isFinite(result.percent) ? result.percent.toFixed(2) : '∞'}
        secondaryUnit={t('calculator.units.percent')}
      />
      <NumberField
        label="Rise"
        value={rise}
        onChangeText={setRise}
        unit={t('calculator.units.feet')}
      />
      <NumberField
        label="Run"
        value={run}
        onChangeText={setRun}
        unit={t('calculator.units.feet')}
      />
    </View>
  );
}
