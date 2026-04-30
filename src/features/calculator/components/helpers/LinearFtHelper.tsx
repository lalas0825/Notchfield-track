/**
 * Linear-feet helper — sum of up to 6 sides. Useful for perimeter,
 * trim runs, baseboard quantities.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { sumLinear } from '../../utils/coverage';
import { MM_PER_FOOT } from '../../types/units';
import { formatLengthDecimal } from '../../utils/format';

const SLOTS = 6;

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export function LinearFtHelper() {
  const { t } = useTranslation();
  const [sides, setSides] = useState<string[]>(Array(SLOTS).fill(''));

  const totalMm = useMemo(
    () => sumLinear(sides.map((s) => num(s) * MM_PER_FOOT)),
    [sides],
  );

  const update = (i: number, v: string) => {
    setSides((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  };

  return (
    <View>
      <ResultCard
        primaryValue={formatLengthDecimal(totalMm, 'ft', 2)}
        primaryUnit={t('calculator.units.feet')}
        primaryLabel={t('calculator.helpers.linear_ft')}
        secondaryValue={formatLengthDecimal(totalMm, 'm', 3)}
        secondaryUnit={t('calculator.units.meters')}
      />
      {sides.map((v, i) => (
        <NumberField
          key={i}
          label={`Side ${i + 1}`}
          value={v}
          onChangeText={(text) => update(i, text)}
          unit={t('calculator.units.feet')}
        />
      ))}
    </View>
  );
}
