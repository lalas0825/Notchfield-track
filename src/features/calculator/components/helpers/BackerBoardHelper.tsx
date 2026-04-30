/**
 * Backer board helper — sqft + sheet size → sheets needed.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChipRow } from '../shared/ChipRow';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateBackerBoard } from '../../utils/coverage';
import type { SheetSize } from '../../types/materials';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function BackerBoardHelper() {
  const { t } = useTranslation();
  const [sqft, setSqft] = useState('');
  const [sheetSize, setSheetSize] = useState<SheetSize>('3x5');
  const [wastePercent, setWastePercent] = useState('10');

  const result = useMemo(
    () => calculateBackerBoard({
      sqft: num(sqft),
      sheetSize,
      wastePercent: num(wastePercent, 10),
    }),
    [sqft, sheetSize, wastePercent],
  );

  return (
    <View>
      <ResultCard
        primaryValue={String(result.quantity)}
        primaryUnit={t('calculator.units.sheets')}
        primaryLabel={t('calculator.helpers.backer_board')}
        secondaryValue={result.rawQuantity.toFixed(2)}
        secondaryUnit="raw"
        formula={result.formula}
      />
      <ChipRow<SheetSize>
        label={t('calculator.fields.sheet_size')}
        options={[
          { value: '3x5', label: "3' × 5'" },
          { value: '4x8', label: "4' × 8'" },
        ]}
        value={sheetSize}
        onChange={setSheetSize}
      />
      <NumberField label={t('calculator.fields.sqft')} value={sqft} onChangeText={setSqft} unit={t('calculator.units.sqft')} />
      <NumberField label={t('calculator.fields.waste_percent')} value={wastePercent} onChangeText={setWastePercent} unit={t('calculator.units.percent')} />
      <HelperDoneButton value={String(result.quantity)} unit={t('calculator.units.sheets')} />
    </View>
  );
}
