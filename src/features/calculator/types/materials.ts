/**
 * Type definitions for material coverage calculations.
 *
 * Cross-repo sync: this file MUST stay byte-identical with
 * notchfield-takeoff/src/features/calculator/types/materials.ts.
 */

export type GroutType = 'sanded' | 'unsanded' | 'epoxy';
export type ThinsetType = 'standard' | 'modified' | 'epoxy';

// Trowel notch — drives thinset coverage. Standard industry sizes.
export type TrowelNotch =
  | '1/4_v'
  | '1/4_square'
  | '3/8_square'
  | '1/2_square'
  | '3/4_square';

export type SheetSize = '3x5' | '4x8';
export type RollPreset = 'ditra' | 'ditra_xl' | 'kerdi' | 'custom';

export interface MaterialResult {
  // Primary count — what to actually order
  quantity: number;
  unit: 'bags' | 'tubes' | 'sheets' | 'rolls' | 'gallons' | 'lbs';
  // Optional secondary metric (e.g. total lbs alongside bag count)
  secondaryQuantity?: number;
  secondaryUnit?: string;
  // The unrounded raw quantity (so callers can show "3.4 bags = 4 bags")
  rawQuantity: number;
  // Compact human-readable description of the formula used
  formula: string;
}

export interface GroutInput {
  type: GroutType;
  sqft: number;
  tileWidthIn: number;   // inches
  tileLengthIn: number;  // inches
  jointWidthIn: number;  // inches (e.g. 0.125 for 1/8")
  jointDepthIn: number;  // inches (typically tile thickness)
  bagSizeLb: number;     // lb per bag
  wastePercent: number;  // 0–100
}

export interface ThinsetInput {
  type: ThinsetType;
  sqft: number;
  notch: TrowelNotch;
  bagSizeLb: number;     // lb per bag (standard 50)
  wastePercent: number;
}

export interface SealerInput {
  sqft: number;
  coveragePerGallon: number;  // sqft per gallon
  coats: number;
  wastePercent: number;
}

export interface LevelerInput {
  sqft: number;
  depthIn: number;
  bagSizeLb: number;       // standard 50
  densityLbPerCuft: number; // ~125 typical
  wastePercent: number;
}

export interface BackerBoardInput {
  sqft: number;
  sheetSize: SheetSize;
  wastePercent: number;
}

export interface CaulkInput {
  linearFt: number;
  jointWidthIn: number;
  jointDepthIn: number;
  tubeSizeOz: number;     // standard 10
  wastePercent: number;
}

export interface ShowerPanInput {
  radiusFt: number;            // furthest distance from drain
  slopeInPerFt: number;        // ¼" per ft default
  drainDepthIn: number;        // depth at the drain itself
}

export interface UncouplingInput {
  sqft: number;
  rollWidthFt: number;
  rollLengthFt: number;
  overlapIn: number;       // typically 2"
  wastePercent: number;
}

export interface StairTileInput {
  steps: number;
  treadWidthIn: number;
  treadDepthIn: number;
  riserHeightIn: number;
  nosingWidthIn: number;   // for linear ft of bullnose / nosing trim
}

export interface StairTileResult {
  totalSqft: number;
  treadSqft: number;
  riserSqft: number;
  nosingLinearFt: number;
}

export interface TileOrderInput {
  sqft: number;
  boxCoverageSqft: number;
  wastePercent: number;
}

// Density tables — calibrated against Laticrete published coverage charts
// (PermaColor Select sanded, PermaColor unsanded, SpectraLOCK Pro Premium
// epoxy). Values lower than dry-powder density because they represent
// effective installed density (mixed paste, accounting for water + air).
export const GROUT_DENSITY_LB_PER_CUFT: Record<GroutType, number> = {
  sanded: 100,
  unsanded: 95,
  epoxy: 105,
};

// sqft per 50 lb bag at 1/8" trowel — base coverage that gets adjusted
export const THINSET_COVERAGE_SQFT_PER_50LB: Record<TrowelNotch, number> = {
  '1/4_v': 90,
  '1/4_square': 80,
  '3/8_square': 55,
  '1/2_square': 35,
  '3/4_square': 22,
};

// Multiplier applied to thinset coverage when type is epoxy (industry rule)
export const EPOXY_THINSET_COVERAGE_FACTOR = 0.6;

export const SHEET_SQFT: Record<SheetSize, number> = {
  '3x5': 15,
  '4x8': 32,
};

// Schluter Ditra preset specs
export const ROLL_PRESETS: Record<RollPreset, { widthFt: number; lengthFt: number }> = {
  ditra: { widthFt: 3.25, lengthFt: 53.75 },     // 3'3" × 53'9" = ~175 sqft
  ditra_xl: { widthFt: 3.25, lengthFt: 41.0 },   // 3'3" × 41' = ~133 sqft
  kerdi: { widthFt: 3.25, lengthFt: 32.0 },      // 3'3" × 32'10"
  custom: { widthFt: 3.25, lengthFt: 53.75 },
};
