/**
 * Dedupe hazards/controls/PPE across selected tasks preserving first-seen
 * order. Matches the consolidate() helper used by Takeoff's ptpPdfRenderer
 * so Track's Review screen shows the same roll-up the PDF will render.
 */

import type {
  PtpSelectedTask,
  JhaHazardItem,
  JhaControlItem,
} from '../types';

export type ConsolidatedPtp = {
  hazards: JhaHazardItem[];
  controls: JhaControlItem[];
  ppe: string[];
};

export function consolidate(tasks: PtpSelectedTask[]): ConsolidatedPtp {
  const seenHazards = new Map<string, JhaHazardItem>();
  const seenControls = new Map<string, JhaControlItem>();
  const seenPpe = new Set<string>();
  const orderedPpe: string[] = [];

  for (const t of tasks) {
    for (const h of t.hazards ?? []) {
      const key = h.name.toLowerCase().trim();
      if (!seenHazards.has(key)) seenHazards.set(key, h);
    }
    for (const c of t.controls ?? []) {
      const key = c.name.toLowerCase().trim();
      if (!seenControls.has(key)) seenControls.set(key, c);
    }
    for (const p of t.ppe_required ?? []) {
      const key = p.toLowerCase().trim();
      if (!seenPpe.has(key)) {
        seenPpe.add(key);
        orderedPpe.push(p);
      }
    }
  }

  return {
    hazards: [...seenHazards.values()],
    controls: [...seenControls.values()],
    ppe: orderedPpe,
  };
}
