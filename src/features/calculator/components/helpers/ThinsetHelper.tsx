/**
 * Thinset helper — standard / modified / epoxy + trowel notch.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChipRow } from '../shared/ChipRow';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateThinset } from '../../utils/coverage';
import type { ThinsetType, TrowelNotch } from '../../types/materials';

const NOTCHES: { value: TrowelNotch; label: string }[] = [
  { value: '1/4_v',      label: '1/4" V' },
  { value: '1/4_square', label: '1/4" sq' },
  { value: '3/8_square', label: '3/8" sq' },
  { value: '1/2_square', label: '1/2" sq' },
  { value: '3/4_square', label: '3/4" sq' },
];

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function ThinsetHelper() {
  const { t } = useTranslation();
  const [type, setType] = useState<ThinsetType>('modified');
  const [notch, setNotch] = useState<TrowelNotch>('1/4_square');
  const [sqft, setSqft] = useState('');
  const [bagSize, setBagSize] = useState('50');
  const [wastePercent, setWastePercent] = useState('10');

  const result = useMemo(
    () => calculateThinset({
      type,
      notch,
      sqft: num(sqft),
      bagSizeLb: num(bagSize, 50),
      wastePercent: num(wastePercent, 10),
    }),
    [type, notch, sqft, bagSize, wastePercent],
  );

  return (
    <View>
      <ResultCard
        primaryValue={String(result.quantity)}
        primaryUnit={t('calculator.units.bags')}
        primaryLabel={t('calculator.helpers.thinset')}
        secondaryValue={result.rawQuantity.toFixed(2)}
        secondaryUnit="raw"
        formula={result.formula}
      />
      <ChipRow<ThinsetType>
        options={[
          { value: 'standard', label: t('calculator.thinset_types.standard') },
          { value: 'modified', label: t('calculator.thinset_types.modified') },
          { value: 'epoxy',    label: t('calculator.thinset_types.epoxy') },
        ]}
        value={type}
        onChange={setType}
      />
      <ChipRow<TrowelNotch>
        label={t('calculator.fields.trowel_notch')}
        options={NOTCHES}
        value={notch}
        onChange={setNotch}
      />
      <NumberField label={t('calculator.fields.sqft')} value={sqft} onChangeText={setSqft} unit={t('calculator.units.sqft')} />
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.bag_size')} value={bagSize} onChangeText={setBagSize} unit={t('calculator.units.lbs')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.waste_percent')} value={wastePercent} onChangeText={setWastePercent} unit={t('calculator.units.percent')} /></View>
      </View>
      <HelperDoneButton value={String(result.quantity)} unit={t('calculator.units.bags')} />
    </View>
  );
}
