/**
 * PDF label strings for Takeoff's /distribute endpoint (toolbox branch).
 *
 * Toolbox and PTP share the same label shape — the server branches on
 * `doc_type` and its toolbox renderer picks the fields it needs. Same
 * contract rules as PTP:
 *   1. Labels are pure STRING TEMPLATES, no per-doc values.
 *   2. `shiftValues` MUST be an object map `{ day, night, weekend }`.
 *   3. All `PtpPdfLabels` fields REQUIRED — undefined reads crash the
 *      renderer even after commit 3b0dfd0's graceful fallbacks.
 */

import type { PtpPdfLabels } from '@/features/safety/ptp/types';
import { buildPtpLabels } from '@/features/safety/ptp/services/buildPtpLabels';

type BuildArgs = {
  oshaCitationsIncluded: boolean;
  verifyBaseUrl?: string;
};

export function buildToolboxLabels(args: BuildArgs): PtpPdfLabels {
  // Delegate to the PTP builder — same canonical shape. If the toolbox
  // renderer ever needs its own header overrides (e.g. "Why It Matters"
  // instead of "Task Description"), spread the result and override here.
  // For now, server-side branching handles display differences.
  return buildPtpLabels(args);
}
