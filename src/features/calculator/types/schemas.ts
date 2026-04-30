/**
 * Zod schemas for calculator state that crosses persistence boundaries.
 *
 * Cross-repo sync: this file MUST stay byte-identical with
 * notchfield-takeoff/src/features/calculator/types/schemas.ts.
 */

import { z } from 'zod';

export const HistoryEntrySchema = z.object({
  id: z.string(),
  expression: z.string(),
  // mm for length / sqm for area / cum for volume / raw for scalar — matches Value
  value: z.number(),
  kind: z.enum(['length', 'area', 'volume', 'scalar']),
  createdAt: z.string(), // ISO
  // Optional helper-context tag — e.g. 'helper:grout' if produced by Grout helper
  source: z.string().optional(),
});

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const HistorySchema = z.array(HistoryEntrySchema).max(50);
export type History = z.infer<typeof HistorySchema>;
