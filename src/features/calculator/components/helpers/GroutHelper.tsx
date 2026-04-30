/**
 * Grout helper — sanded / unsanded / epoxy. Coverage from joint volume formula.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChipRow } from '../shared/ChipRow';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateGrout } from '../../utils/coverage';
import type { GroutType } from '../../types/materials';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function GroutHelper() {
  const { t } = useTranslation();
  const [type, setType] = useState<GroutType>('sanded');
  const [sqft, setSqft] = useState('');
  const [tileW, setTileW] = useState('');
  const [tileL, setTileL] = useState('');
  const [jointW, setJointW] = useState('0.125');
  // Default depth = 3/8" (industry standard, matches typical 12"+ tile
  // thickness and Laticrete coverage chart assumption). Adjust to actual
  // tile thickness for accurate result.
  const [jointD, setJointD] = useState('0.375');
  const [bagSize, setBagSize] = useState('25');
  const [wastePercent, setWastePercent] = useState('15');

  const result = useMemo(
    () => calculateGrout({
      type,
      sqft: num(sqft),
      tileWidthIn: num(tileW),
      tileLengthIn: num(tileL),
      jointWidthIn: num(jointW),
      jointDepthIn: num(jointD),
      bagSizeLb: num(bagSize, 25),
      wastePercent: num(wastePercent, 15),
    }),
    [type, sqft, tileW, tileL, jointW, jointD, bagSize, wastePercent],
  );

  return (
    <View>
      <ResultCard
        primaryValue={String(result.quantity)}
        primaryUnit={t('calculator.units.bags')}
        primaryLabel={t('calculator.helpers.grout')}
        secondaryValue={String(result.secondaryQuantity ?? '')}
        secondaryUnit={result.secondaryUnit}
        formula={result.formula}
      />
      <ChipRow<GroutType>
        options={[
          { value: 'sanded',   label: t('calculator.grout_types.sanded') },
          { value: 'unsanded', label: t('calculator.grout_types.unsanded') },
          { value: 'epoxy',    label: t('calculator.grout_types.epoxy') },
        ]}
        value={type}
        onChange={(v) => {
          setType(v);
          setBagSize(v === 'epoxy' ? '9' : '25');
        }}
      />
      <NumberField label={t('calculator.fields.sqft')} value={sqft} onChangeText={setSqft} unit={t('calculator.units.sqft')} />
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.tile_width')} value={tileW} onChangeText={setTileW} unit={t('calculator.units.inches')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.tile_length')} value={tileL} onChangeText={setTileL} unit={t('calculator.units.inches')} /></View>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.joint_width')} value={jointW} onChangeText={setJointW} unit={t('calculator.units.inches')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.joint_depth')} value={jointD} onChangeText={setJointD} unit={t('calculator.units.inches')} /></View>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1"><NumberField label={t('calculator.fields.bag_size')} value={bagSize} onChangeText={setBagSize} unit={t('calculator.units.lbs')} /></View>
        <View className="flex-1"><NumberField label={t('calculator.fields.waste_percent')} value={wastePercent} onChangeText={setWastePercent} unit={t('calculator.units.percent')} /></View>
      </View>
      <HelperDoneButton value={String(result.quantity)} unit={t('calculator.units.bags')} />
    </View>
  );
}
