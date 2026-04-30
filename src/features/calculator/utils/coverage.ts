/**
 * Material coverage formulas + geometric / time helpers.
 *
 * Every function here is a pure computation. UI components call these and
 * render the result. No side effects, no React imports.
 *
 * Cross-repo sync: this file MUST stay byte-identical with
 * notchfield-takeoff/src/features/calculator/utils/coverage.ts.
 */

import {
  EPOXY_THINSET_COVERAGE_FACTOR,
  GROUT_DENSITY_LB_PER_CUFT,
  ROLL_PRESETS,
  SHEET_SQFT,
  THINSET_COVERAGE_SQFT_PER_50LB,
  type BackerBoardInput,
  type CaulkInput,
  type GroutInput,
  type LevelerInput,
  type MaterialResult,
  type SealerInput,
  type ShowerPanInput,
  type StairTileInput,
  type StairTileResult,
  type ThinsetInput,
  type TileOrderInput,
  type UncouplingInput,
} from '../types/materials';

// ─── helpers ──────────────────────────────────────────────────────────────

const CUFT_TO_CUIN = 1728;

function applyWaste(quantity: number, wastePercent: number): number {
  return quantity * (1 + wastePercent / 100);
}

function ceilUp(n: number): number {
  return Math.ceil(n);
}

// ─── tile boxes ───────────────────────────────────────────────────────────

export function calculateTileOrder(input: TileOrderInput): MaterialResult {
  const { sqft, boxCoverageSqft, wastePercent } = input;
  const raw = applyWaste(sqft / boxCoverageSqft, wastePercent);
  return {
    quantity: ceilUp(raw),
    rawQuantity: raw,
    unit: 'bags', // boxes — we reuse 'bags' label or label in helper
    formula: `${sqft} sqft × (1 + ${wastePercent}%) ÷ ${boxCoverageSqft} sqft/box`,
  };
}

// ─── grout ────────────────────────────────────────────────────────────────

/**
 * Grout coverage formula:
 *   joint_volume_per_sqft (in³) = 144 × (W + L) / (W × L) × Jw × Jd
 *
 * Mass of grout = volume × density. Density values are in materials.ts.
 *
 * Validated against Laticrete published coverage charts (PermaColor Select,
 * SpectraLOCK Pro Premium) — within 1-2%:
 *
 *   PermaColor sanded — 25 lb bag
 *   ─────────────────────────────────────
 *     6x6 × 1/2" depth, 1/8" joint:   146 sqft (chart) vs 144 (calc)
 *     12x12 × 3/8" depth, 1/8" joint: 388 sqft (chart) vs 384 (calc)
 *     18x18 × 3/8" depth, 1/8" joint: 581 sqft (chart) vs 576 (calc)
 *
 *   SpectraLOCK Pro epoxy — Full Unit (~17 lb mixed)
 *   ─────────────────────────────────────
 *     6x6 × 1/2" depth, 1/8" joint:    60 sqft
 *     12x12 × 3/8" depth, 1/8" joint: 159 sqft
 *
 * Note: other manufacturers (Mapei Ultracolor Plus, Custom Polyblend) publish
 * coverage 3-5× more conservative than Laticrete's. If using those products,
 * bump waste % to 50-100% to match their charts. Laticrete's numbers reflect
 * realistic field consumption with a skilled installer.
 *
 * Joint depth defaults to 3/8" (matches tile thickness for typical 12"+ tile).
 * Adjust to actual tile thickness for accurate results.
 */
export function calculateGrout(input: GroutInput): MaterialResult {
  const {
    type,
    sqft,
    tileWidthIn: W,
    tileLengthIn: L,
    jointWidthIn: Jw,
    jointDepthIn: Jd,
    bagSizeLb,
    wastePercent,
  } = input;

  if (W <= 0 || L <= 0 || Jw <= 0 || Jd <= 0) {
    return {
      quantity: 0,
      rawQuantity: 0,
      unit: 'bags',
      formula: 'Tile and joint dimensions must be positive',
    };
  }

  const volumePerSqftCuIn = (144 * (W + L) * Jw * Jd) / (W * L);
  const totalVolumeCuIn = sqft * volumePerSqftCuIn;
  const totalLbsNeeded = (totalVolumeCuIn / CUFT_TO_CUIN) * GROUT_DENSITY_LB_PER_CUFT[type];
  const lbsWithWaste = applyWaste(totalLbsNeeded, wastePercent);
  const bagsRaw = lbsWithWaste / bagSizeLb;

  return {
    quantity: ceilUp(bagsRaw),
    rawQuantity: bagsRaw,
    unit: 'bags',
    secondaryQuantity: Math.round(lbsWithWaste * 10) / 10,
    secondaryUnit: 'lb',
    formula: `${type}: 144 × (${W}+${L})/(${W}×${L}) × ${Jw}" × ${Jd}" × ${sqft} sqft × density (matches Laticrete chart)`,
  };
}

// ─── thinset ──────────────────────────────────────────────────────────────

export function calculateThinset(input: ThinsetInput): MaterialResult {
  const { type, sqft, notch, bagSizeLb, wastePercent } = input;
  const baseCoverage = THINSET_COVERAGE_SQFT_PER_50LB[notch];
  const adjustedCoverage =
    type === 'epoxy' ? baseCoverage * EPOXY_THINSET_COVERAGE_FACTOR : baseCoverage;
  // Scale coverage by actual bag size (table is for 50 lb)
  const coveragePerActualBag = adjustedCoverage * (bagSizeLb / 50);
  const bagsRaw = applyWaste(sqft / coveragePerActualBag, wastePercent);

  return {
    quantity: ceilUp(bagsRaw),
    rawQuantity: bagsRaw,
    unit: 'bags',
    formula: `${type} thinset, ${notch.replace('_', ' ')} notch: ${sqft} sqft ÷ ${coveragePerActualBag.toFixed(0)} sqft/bag × (1+${wastePercent}%)`,
  };
}

// ─── sealer / waterproofing ───────────────────────────────────────────────

export function calculateSealer(input: SealerInput): MaterialResult {
  const { sqft, coveragePerGallon, coats, wastePercent } = input;
  const gallonsRaw = applyWaste((sqft * coats) / coveragePerGallon, wastePercent);
  return {
    quantity: Math.ceil(gallonsRaw * 4) / 4, // round up to nearest quarter gallon
    rawQuantity: gallonsRaw,
    unit: 'gallons',
    formula: `${sqft} sqft × ${coats} coats ÷ ${coveragePerGallon} sqft/gal × (1+${wastePercent}%)`,
  };
}

// ─── self-leveler ─────────────────────────────────────────────────────────

export function calculateLeveler(input: LevelerInput): MaterialResult {
  const { sqft, depthIn, bagSizeLb, densityLbPerCuft, wastePercent } = input;
  const volumeCuFt = sqft * (depthIn / 12);
  const totalLbs = volumeCuFt * densityLbPerCuft;
  const bagsRaw = applyWaste(totalLbs / bagSizeLb, wastePercent);
  return {
    quantity: ceilUp(bagsRaw),
    rawQuantity: bagsRaw,
    unit: 'bags',
    secondaryQuantity: Math.round(totalLbs),
    secondaryUnit: 'lb',
    formula: `${sqft} sqft × ${depthIn}"/12 × ${densityLbPerCuft} lb/cuft ÷ ${bagSizeLb} lb/bag × (1+${wastePercent}%)`,
  };
}

// ─── backer board ─────────────────────────────────────────────────────────

export function calculateBackerBoard(input: BackerBoardInput): MaterialResult {
  const { sqft, sheetSize, wastePercent } = input;
  const sheetSqft = SHEET_SQFT[sheetSize];
  const sheetsRaw = applyWaste(sqft / sheetSqft, wastePercent);
  return {
    quantity: ceilUp(sheetsRaw),
    rawQuantity: sheetsRaw,
    unit: 'sheets',
    formula: `${sqft} sqft ÷ ${sheetSqft} sqft/sheet (${sheetSize}) × (1+${wastePercent}%)`,
  };
}

// ─── caulk for movement joints ────────────────────────────────────────────

const TUBE_OZ_TO_CUIN = 1.80469; // 1 fluid ounce ≈ 1.80469 cu inch

export function calculateCaulk(input: CaulkInput): MaterialResult {
  const { linearFt, jointWidthIn, jointDepthIn, tubeSizeOz, wastePercent } = input;
  const jointVolumeCuIn = linearFt * 12 * jointWidthIn * jointDepthIn;
  const tubeVolumeCuIn = tubeSizeOz * TUBE_OZ_TO_CUIN;
  const tubesRaw = applyWaste(jointVolumeCuIn / tubeVolumeCuIn, wastePercent);
  return {
    quantity: ceilUp(tubesRaw),
    rawQuantity: tubesRaw,
    unit: 'tubes',
    formula: `${linearFt} ft × 12 × ${jointWidthIn}" × ${jointDepthIn}" ÷ (${tubeSizeOz} oz × ${TUBE_OZ_TO_CUIN} in³/oz)`,
  };
}

// ─── shower pan slope (mud bed depth at perimeter) ────────────────────────

export interface ShowerPanResult {
  perimeterDepthIn: number;
  formula: string;
}

export function calculateShowerPan(input: ShowerPanInput): ShowerPanResult {
  const { radiusFt, slopeInPerFt, drainDepthIn } = input;
  const perimeterDepthIn = drainDepthIn + radiusFt * slopeInPerFt;
  return {
    perimeterDepthIn,
    formula: `${drainDepthIn}" + ${radiusFt}' × ${slopeInPerFt}"/ft = ${perimeterDepthIn.toFixed(2)}"`,
  };
}

// ─── uncoupling membrane (Ditra etc.) ─────────────────────────────────────

export function calculateUncoupling(input: UncouplingInput): MaterialResult {
  const { sqft, rollWidthFt, rollLengthFt, overlapIn, wastePercent } = input;
  const rollSqft = rollWidthFt * rollLengthFt;
  // Effective coverage per roll: each strip loses overlap_in on one side
  const effectiveCoverage =
    rollSqft * (1 - (overlapIn / 12) / rollWidthFt);
  const rollsRaw = applyWaste(sqft / effectiveCoverage, wastePercent);
  return {
    quantity: ceilUp(rollsRaw),
    rawQuantity: rollsRaw,
    unit: 'rolls',
    formula: `${sqft} sqft ÷ ${effectiveCoverage.toFixed(1)} sqft/roll (${rollWidthFt}'×${rollLengthFt}', ${overlapIn}" overlap)`,
  };
}

// Convenience: get standard roll specs by name
export function rollPresetSpecs(preset: keyof typeof ROLL_PRESETS) {
  return ROLL_PRESETS[preset];
}

// ─── stair tile ───────────────────────────────────────────────────────────

export function calculateStairTile(input: StairTileInput): StairTileResult {
  const { steps, treadWidthIn, treadDepthIn, riserHeightIn, nosingWidthIn } = input;
  const treadSqft = (steps * treadWidthIn * treadDepthIn) / 144;
  const riserSqft = (steps * treadWidthIn * riserHeightIn) / 144;
  const nosingLinearFt = (steps * nosingWidthIn) / 12;
  return {
    treadSqft,
    riserSqft,
    totalSqft: treadSqft + riserSqft,
    nosingLinearFt,
  };
}

// ─── area / volume / linear ─ pure geometry ───────────────────────────────

export function rectangleArea(widthMm: number, lengthMm: number): number {
  return (widthMm * lengthMm) / 1_000_000; // m²
}

export function triangleArea(baseMm: number, heightMm: number): number {
  return (baseMm * heightMm) / 2 / 1_000_000;
}

export function circleArea(radiusMm: number): number {
  return (Math.PI * radiusMm * radiusMm) / 1_000_000;
}

export function boxVolume(widthMm: number, lengthMm: number, heightMm: number): number {
  return (widthMm * lengthMm * heightMm) / 1_000_000_000; // m³
}

export function sumLinear(sidesMm: number[]): number {
  return sidesMm.reduce((acc, x) => acc + x, 0);
}

// ─── slope / pythagorean ──────────────────────────────────────────────────

export interface SlopeResult {
  degrees: number;
  percent: number;
}

export function slopeFromRiseRun(riseMm: number, runMm: number): SlopeResult {
  if (runMm === 0) return { degrees: riseMm > 0 ? 90 : 0, percent: Infinity };
  const radians = Math.atan(riseMm / runMm);
  return {
    degrees: (radians * 180) / Math.PI,
    percent: (riseMm / runMm) * 100,
  };
}

export function pythagoreanHypotenuse(aMm: number, bMm: number): number {
  return Math.sqrt(aMm * aMm + bMm * bMm);
}

// Diagonal of a rectangle with sides a, b — useful for out-of-square check
export function rectangleDiagonal(widthMm: number, lengthMm: number): number {
  return pythagoreanHypotenuse(widthMm, lengthMm);
}

// ─── time (hours between) ─────────────────────────────────────────────────

export interface HoursBetweenInput {
  startHours: number;   // 0–23
  startMinutes: number; // 0–59
  endHours: number;
  endMinutes: number;
  breakMinutes: number;
}

export function hoursBetween(input: HoursBetweenInput): number {
  const startTotal = input.startHours * 60 + input.startMinutes;
  let endTotal = input.endHours * 60 + input.endMinutes;
  // Handle overnight (end < start)
  if (endTotal < startTotal) endTotal += 24 * 60;
  const workMinutes = endTotal - startTotal - input.breakMinutes;
  return Math.max(0, workMinutes) / 60;
}
