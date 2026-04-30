/**
 * Formatters for calculator results.
 *
 * Converts an internal Value (mm / m² / m³ / scalar) to display strings
 * in various units. Imperial fractional uses snap-to-precision logic.
 *
 * Cross-repo sync: this file MUST stay byte-identical with
 * notchfield-takeoff/src/features/calculator/utils/format.ts.
 */

import {
  AREA_UNIT_TO_SQM,
  DEFAULT_PRECISION,
  LENGTH_UNIT_TO_MM,
  VOLUME_UNIT_TO_CUM,
  type ImperialPrecision,
  type Value,
} from '../types/units';

export interface FormattedValue {
  display: string;
  unit: string;
}

/**
 * Format a length value (in mm) as feet-inches with fractional inches
 * snapped to the nearest 1/precision.
 *
 *   formatImperialFractional(1606.55, 16) → "5'-3 1/4""
 *   formatImperialFractional(304.8, 16)   → "1'-0""
 *   formatImperialFractional(25.4, 16)    → "1""
 *   formatImperialFractional(-1606.55, 16) → "-5'-3 1/4""
 */
export function formatImperialFractional(
  mm: number,
  precision: ImperialPrecision = DEFAULT_PRECISION,
): string {
  const negative = mm < 0;
  const abs = Math.abs(mm);
  const totalInches = abs / LENGTH_UNIT_TO_MM.in;

  // Snap to nearest 1/precision inch
  const snapped = Math.round(totalInches * precision) / precision;
  let feet = Math.floor(snapped / 12);
  let remaining = snapped - feet * 12;
  let wholeInches = Math.floor(remaining);
  let fractionalInches = remaining - wholeInches;

  // Carry: if fraction rounds to a whole inch, bump
  let numerator = Math.round(fractionalInches * precision);
  let denominator: number = precision;
  if (numerator === precision) {
    wholeInches += 1;
    numerator = 0;
    if (wholeInches === 12) {
      feet += 1;
      wholeInches = 0;
    }
  }

  // Reduce fraction
  if (numerator > 0) {
    const g = gcd(numerator, denominator);
    numerator /= g;
    denominator /= g;
  }

  const fractionStr = numerator > 0 ? `${numerator}/${denominator}` : '';

  let body: string;
  if (feet === 0 && wholeInches === 0 && numerator === 0) {
    body = `0"`;
  } else if (feet === 0) {
    if (wholeInches === 0 && numerator > 0) {
      body = `${fractionStr}"`;
    } else if (numerator > 0) {
      body = `${wholeInches} ${fractionStr}"`;
    } else {
      body = `${wholeInches}"`;
    }
  } else if (wholeInches === 0 && numerator === 0) {
    body = `${feet}'`;
  } else {
    const inchPart =
      numerator > 0 ? `${wholeInches} ${fractionStr}` : `${wholeInches}`;
    body = `${feet}'-${inchPart}"`;
  }

  return negative ? `-${body}` : body;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function trimTrailingZeros(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals);
  // Strip trailing zeros after the decimal but keep at least one digit
  return fixed.replace(/\.?0+$/, '') || '0';
}

/**
 * Format a length value as a decimal in the requested unit.
 *
 *   formatLengthDecimal(1606.55, 'in', 4) → "63.2500" (then trimmed to "63.25")
 */
export function formatLengthDecimal(
  mm: number,
  unit: 'in' | 'ft' | 'yd' | 'mm' | 'cm' | 'm',
  decimals = 4,
): string {
  const v = mm / LENGTH_UNIT_TO_MM[unit];
  return trimTrailingZeros(v, decimals);
}

/**
 * Format an area value (m²) as a decimal in the requested unit.
 */
export function formatAreaDecimal(
  sqm: number,
  unit: 'sqft' | 'sqm' | 'sqin' | 'sqyd' | 'sqcm' | 'sqmm',
  decimals = 4,
): string {
  const v = sqm / AREA_UNIT_TO_SQM[unit];
  return trimTrailingZeros(v, decimals);
}

/**
 * Format a volume value (m³) as a decimal in the requested unit.
 */
export function formatVolumeDecimal(
  cum: number,
  unit: 'cum' | 'cuft' | 'cuin' | 'L' | 'gal',
  decimals = 4,
): string {
  const v = cum / VOLUME_UNIT_TO_CUM[unit];
  return trimTrailingZeros(v, decimals);
}

/**
 * Render a Value as the standard 5-line multi-unit display.
 * Returns rows in display order; UI is responsible for the layout.
 */
export function formatValueRows(
  value: Value,
  precision: ImperialPrecision = DEFAULT_PRECISION,
): FormattedValue[] {
  switch (value.kind) {
    case 'length':
      return [
        { display: formatImperialFractional(value.value, precision), unit: '' },
        { display: formatLengthDecimal(value.value, 'in'), unit: 'in' },
        { display: formatLengthDecimal(value.value, 'm'), unit: 'm' },
        { display: formatLengthDecimal(value.value, 'cm', 2), unit: 'cm' },
        { display: formatLengthDecimal(value.value, 'mm', 2), unit: 'mm' },
      ];
    case 'area':
      return [
        { display: formatAreaDecimal(value.value, 'sqft', 3), unit: 'sq ft' },
        { display: formatAreaDecimal(value.value, 'sqm', 4), unit: 'sq m' },
        { display: formatAreaDecimal(value.value, 'sqin', 2), unit: 'sq in' },
        { display: formatAreaDecimal(value.value, 'sqyd', 4), unit: 'sq yd' },
      ];
    case 'volume':
      return [
        { display: formatVolumeDecimal(value.value, 'cuft', 3), unit: 'cu ft' },
        { display: formatVolumeDecimal(value.value, 'cum', 4), unit: 'cu m' },
        { display: formatVolumeDecimal(value.value, 'L', 2), unit: 'L' },
        { display: formatVolumeDecimal(value.value, 'gal', 3), unit: 'gal' },
      ];
    case 'scalar':
      return [{ display: trimTrailingZeros(value.value, 6), unit: '' }];
  }
}

/**
 * Compact one-line summary — used in history list, copy-to-clipboard, etc.
 */
export function formatValueShort(
  value: Value,
  precision: ImperialPrecision = DEFAULT_PRECISION,
): string {
  switch (value.kind) {
    case 'length':
      return formatImperialFractional(value.value, precision);
    case 'area':
      return `${formatAreaDecimal(value.value, 'sqft', 2)} sq ft`;
    case 'volume':
      return `${formatVolumeDecimal(value.value, 'cuft', 2)} cu ft`;
    case 'scalar':
      return trimTrailingZeros(value.value, 4);
  }
}
