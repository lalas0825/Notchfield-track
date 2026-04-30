/**
 * Pythagorean / diagonal helper — c = √(a² + b²).
 *
 * Field use: out-of-square check (measure both diagonals of a rectangle,
 * compare; if they differ, room is not square). Also useful for laying
 * out a 45° tile pattern.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { pythagoreanHypotenuse } from '../../utils/coverage';
import { MM_PER_FOOT } from '../../types/units';
import { formatImperialFractional, formatLengthDecimal } from '../../utils/format';
import { useCalculator } from '../../hooks/useCalculator';

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export function PythagoreanHelper() {
  const { t } = useTranslation();
  const precision = useCalculator((s) => s.precision);
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const cMm = useMemo(
    () => pythagoreanHypotenuse(num(a) * MM_PER_FOOT, num(b) * MM_PER_FOOT),
    [a, b],
  );

  return (
    <View>
      <ResultCard
        primaryValue={formatImperialFractional(cMm, precision)}
        primaryUnit=""
        primaryLabel={t('calculator.helpers.pythagorean')}
        secondaryValue={formatLengthDecimal(cMm, 'ft', 4)}
        secondaryUnit={t('calculator.units.feet')}
      />
      <NumberField
        label="Side A"
        value={a}
        onChangeText={setA}
        unit={t('calculator.units.feet')}
      />
      <NumberField
        label="Side B"
        value={b}
        onChangeText={setB}
        unit={t('calculator.units.feet')}
      />
    </View>
  );
}
