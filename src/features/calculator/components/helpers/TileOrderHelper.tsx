/**
 * Tile order helper — sqft + box coverage + waste% → boxes needed.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumberField } from '../shared/NumberField';
import { ResultCard } from '../shared/ResultCard';
import { HelperDoneButton } from '../shared/HelperDoneButton';
import { calculateTileOrder } from '../../utils/coverage';

function num(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function TileOrderHelper() {
  const { t } = useTranslation();
  const [sqft, setSqft] = useState('');
  const [boxCoverage, setBoxCoverage] = useState('');
  const [wastePercent, setWastePercent] = useState('10');

  const result = useMemo(
    () => calculateTileOrder({
      sqft: num(sqft),
      boxCoverageSqft: num(boxCoverage, 1),
      wastePercent: num(wastePercent, 10),
    }),
    [sqft, boxCoverage, wastePercent],
  );

  return (
    <View>
      <ResultCard
        primaryValue={String(result.quantity)}
        primaryUnit="boxes"
        primaryLabel={t('calculator.helpers.tile_order')}
        secondaryValue={result.rawQuantity.toFixed(2)}
        secondaryUnit="raw"
        formula={result.formula}
      />
      <NumberField
        label={t('calculator.fields.sqft')}
        value={sqft}
        onChangeText={setSqft}
        unit={t('calculator.units.sqft')}
      />
      <NumberField
        label="Box coverage"
        value={boxCoverage}
        onChangeText={setBoxCoverage}
        unit={t('calculator.units.sqft')}
      />
      <NumberField
        label={t('calculator.fields.waste_percent')}
        value={wastePercent}
        onChangeText={setWastePercent}
        unit={t('calculator.units.percent')}
      />
      <HelperDoneButton value={String(result.quantity)} unit="boxes" />
    </View>
  );
}
