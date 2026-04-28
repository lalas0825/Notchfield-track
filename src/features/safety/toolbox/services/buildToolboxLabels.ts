/**
 * PDF label strings for Takeoff's /distribute endpoint (toolbox branch).
 *
 * Toolbox and PTP share the same label shape — the server branches on
 * `doc_type` and its toolbox renderer picks the fields it needs. Same
 * contract rules as PTP:
 *   1. Labels are pure STRING TEMPLATES, no per-doc values.
 *   2. `shiftValues` MUST be an object map `{ day, night, weekend }`.
 *   3. All `PtpPdfLabels` fields REQUIRED — undefined reads crash the
 *      renderer even after commit 3b0dfd0's graceful fallbacks (Web
 *      Sprint 72H added (value ?? '').toUpperCase() guards as defense
 *      in depth, but Track's contract is still "send complete labels").
 *
 * 2026-04-28 — `title`/`subtitle` overridden so toolbox PDFs and email
 * subjects don't leak the PTP heading. Pilot reported Toolbox #34
 * arriving as "Pre-Task Plan (PTP) #34" because Web's renderer reads
 * `labels.title` verbatim. Override here matches the comment that's
 * been in this file since Sprint TOOLBOX shipped.
 */

import type { PtpPdfLabels } from '@/features/safety/ptp/types';
import { buildPtpLabels } from '@/features/safety/ptp/services/buildPtpLabels';

type BuildArgs = {
  oshaCitationsIncluded: boolean;
  verifyBaseUrl?: string;
};

export function buildToolboxLabels(args: BuildArgs): PtpPdfLabels {
  // Spread + override the heading strings so the toolbox renderer stops
  // showing "PRE-TASK PLAN (PTP)" as the document title.
  return {
    ...buildPtpLabels(args),
    title: 'Toolbox Talk',
    subtitle: 'Weekly safety briefing · OSHA 1926.21(b)(2)',
    // Keep `ptpNumber: '#'` from buildPtpLabels — both renderers prefix
    // the doc number with '#'. If Web ever splits the label key (e.g.
    // adds toolboxNumber separately), override here.
  };
}
