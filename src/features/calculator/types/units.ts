/**
 * Unit system for the calculator.
 *
 * Internal storage:
 *   length  → millimeters (decimal mm — handles 1/16" = 1.5875 without drift)
 *   area    → square meters
 *   volume  → cubic meters
 *   scalar  → dimensionless (counts, percentages, multipliers)
 *
 * All conversion factors are exact per international yard-pound agreement.
 *
 * Cross-repo sync: this file MUST stay byte-identical with
 * notchfield-takeoff/src/features/calculator/types/units.ts.
 */

export type ValueKind = 'length' | 'area' | 'volume' | 'scalar';

export interface Value {
  kind: ValueKind;
  value: number;
}

// Length conversions — base unit mm
export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;
export const MM_PER_YARD = 914.4;
export const MM_PER_CM = 10;
export const MM_PER_M = 1000;

// Area conversions — base unit m²
export const SQM_PER_SQFT = 0.09290304;
export const SQM_PER_SQIN = 0.00064516;
export const SQM_PER_SQYD = 0.83612736;
export const SQM_PER_SQCM = 0.0001;
export const SQM_PER_SQMM = 0.000001;

// Volume conversions — base unit m³
export const CUM_PER_CUFT = 0.028316846592;
export const CUM_PER_CUIN = 0.000016387064;
export const CUM_PER_LITER = 0.001;
export const CUM_PER_GALLON_US = 0.003785411784;

// Length-unit identifiers used by the tokenizer and formatters
export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'yd';
export type AreaUnit = 'sqmm' | 'sqcm' | 'sqm' | 'sqin' | 'sqft' | 'sqyd';
export type VolumeUnit = 'cum' | 'cuft' | 'cuin' | 'L' | 'gal';

// Parse helpers — single source of truth for which strings the tokenizer accepts
export const LENGTH_UNIT_TOKENS: Record<string, LengthUnit> = {
  // imperial
  '"': 'in',
  in: 'in',
  inch: 'in',
  inches: 'in',
  "'": 'ft',
  ft: 'ft',
  foot: 'ft',
  feet: 'ft',
  yd: 'yd',
  yard: 'yd',
  yards: 'yd',
  // metric
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  meter: 'm',
  meters: 'm',
};

// mm value of 1 unit
export const LENGTH_UNIT_TO_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: MM_PER_CM,
  m: MM_PER_M,
  in: MM_PER_INCH,
  ft: MM_PER_FOOT,
  yd: MM_PER_YARD,
};

// m² value of 1 unit²
export const AREA_UNIT_TO_SQM: Record<AreaUnit, number> = {
  sqmm: SQM_PER_SQMM,
  sqcm: SQM_PER_SQCM,
  sqm: 1,
  sqin: SQM_PER_SQIN,
  sqft: SQM_PER_SQFT,
  sqyd: SQM_PER_SQYD,
};

// m³ value of 1 unit³
export const VOLUME_UNIT_TO_CUM: Record<VolumeUnit, number> = {
  cum: 1,
  cuft: CUM_PER_CUFT,
  cuin: CUM_PER_CUIN,
  L: CUM_PER_LITER,
  gal: CUM_PER_GALLON_US,
};

// Helpers for callers who carry non-canonical units
export function lengthToMm(value: number, unit: LengthUnit): number {
  return value * LENGTH_UNIT_TO_MM[unit];
}

export function mmToLength(mm: number, unit: LengthUnit): number {
  return mm / LENGTH_UNIT_TO_MM[unit];
}

export function areaToSqm(value: number, unit: AreaUnit): number {
  return value * AREA_UNIT_TO_SQM[unit];
}

export function sqmToArea(sqm: number, unit: AreaUnit): number {
  return sqm / AREA_UNIT_TO_SQM[unit];
}

export function volumeToCum(value: number, unit: VolumeUnit): number {
  return value * VOLUME_UNIT_TO_CUM[unit];
}

export function cumToVolume(cum: number, unit: VolumeUnit): number {
  return cum / VOLUME_UNIT_TO_CUM[unit];
}

// Precision values for imperial fractional display
export type ImperialPrecision = 2 | 4 | 8 | 16 | 32;
export const PRECISION_OPTIONS: ImperialPrecision[] = [2, 4, 8, 16, 32];
export const DEFAULT_PRECISION: ImperialPrecision = 16;
