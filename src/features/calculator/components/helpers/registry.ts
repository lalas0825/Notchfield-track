/**
 * Single source of truth for helper IDs + their grid metadata.
 *
 * Keep ordering + colors in sync with the categories described in
 * SPRINT_TRACK_CALCULATOR.md §2:
 *   - blue   → geometry (area, volume, linear)
 *   - amber  → math (slope, pythagorean)
 *   - gray   → utility (converter)
 *   - orange → tile-related (tile_order, grout, thinset, stair_tile)
 *   - green  → substrate / membrane (sealer, leveler, backer_board, caulk, shower_pan, uncoupling)
 *   - purple → time (hours_between)
 */

import type { Ionicons } from '@expo/vector-icons';

export type HelperId =
  | 'area'
  | 'volume'
  | 'linear_ft'
  | 'slope'
  | 'pythagorean'
  | 'converter'
  | 'tile_order'
  | 'grout'
  | 'thinset'
  | 'sealer'
  | 'leveler'
  | 'backer_board'
  | 'caulk'
  | 'shower_pan'
  | 'uncoupling'
  | 'stair_tile'
  | 'hours_between';

export interface HelperEntry {
  id: HelperId;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const HELPERS: HelperEntry[] = [
  { id: 'area',          icon: 'square-outline',          color: '#3B82F6' },
  { id: 'volume',        icon: 'cube-outline',            color: '#3B82F6' },
  { id: 'linear_ft',     icon: 'remove-outline',          color: '#3B82F6' },
  { id: 'slope',         icon: 'trending-up-outline',     color: '#F59E0B' },
  { id: 'pythagorean',   icon: 'triangle-outline',        color: '#F59E0B' },
  { id: 'converter',     icon: 'swap-horizontal-outline', color: '#94A3B8' },
  { id: 'tile_order',    icon: 'grid-outline',            color: '#F97316' },
  { id: 'grout',         icon: 'apps-outline',            color: '#F97316' },
  { id: 'thinset',       icon: 'layers-outline',          color: '#F97316' },
  { id: 'stair_tile',    icon: 'reorder-three-outline',   color: '#F97316' },
  { id: 'sealer',        icon: 'water-outline',           color: '#22C55E' },
  { id: 'leveler',       icon: 'analytics-outline',       color: '#22C55E' },
  { id: 'backer_board',  icon: 'reader-outline',          color: '#22C55E' },
  { id: 'caulk',         icon: 'pricetag-outline',        color: '#22C55E' },
  { id: 'shower_pan',    icon: 'umbrella-outline',        color: '#22C55E' },
  { id: 'uncoupling',    icon: 'reorder-four-outline',    color: '#22C55E' },
  { id: 'hours_between', icon: 'time-outline',            color: '#A855F7' },
];
