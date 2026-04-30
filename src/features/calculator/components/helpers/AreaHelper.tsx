/**
 * Area helper — rectangle, triangle, circle.
 * All inputs in feet (decimal); result in sq ft + sq m.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChipRow } from '../shared/ChipRow';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import {
  circleArea,
  rectangleArea,
  triangleArea,
} from '../../utils/coverage';
import { MM_PER_FOOT } from '../../types/units';
import { formatAreaDecimal } from '../../utils/format';

type Shape = 'rectangle' | 'triangle' | 'circle';

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export function AreaHelper() {
  const { t } = useTranslation();
  const [shape, setShape] = useState<Shape>('rectangle');
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const result = useMemo(() => {
    const aMm = num(a) * MM_PER_FOOT;
    const bMm = num(b) * MM_PER_FOOT;
    switch (shape) {
      case 'rectangle': return rectangleArea(aMm, bMm);
      case 'triangle':  return triangleArea(aMm, bMm);
      case 'circle':    return circleArea(aMm);
    }
  }, [shape, a, b]);

  return (
    <View>
      <ResultCard
        primaryValue={formatAreaDecimal(result, 'sqft', 3)}
        primaryUnit={t('calculator.units.sqft')}
        primaryLabel={t('calculator.helpers.area')}
        secondaryValue={formatAreaDecimal(result, 'sqm', 4)}
        secondaryUnit={t('calculator.units.sqm')}
      />
      <ChipRow<Shape>
        options={[
          { value: 'rectangle', label: t('calculator.shapes.rectangle') },
          { value: 'triangle',  label: t('calculator.shapes.triangle') },
          { value: 'circle',    label: t('calculator.shapes.circle') },
        ]}
        value={shape}
        onChange={setShape}
      />
      {shape === 'circle' ? (
        <NumberField
          label={t('calculator.fields.radius')}
          value={a}
          onChangeText={setA}
          unit={t('calculator.units.feet')}
        />
      ) : (
        <>
          <NumberField
            label={t(shape === 'triangle' ? 'calculator.fields.base' : 'calculator.fields.width')}
            value={a}
            onChangeText={setA}
            unit={t('calculator.units.feet')}
          />
          <NumberField
            label={t(shape === 'triangle' ? 'calculator.fields.height' : 'calculator.fields.length')}
            value={b}
            onChangeText={setB}
            unit={t('calculator.units.feet')}
          />
        </>
      )}
    </View>
  );
}
