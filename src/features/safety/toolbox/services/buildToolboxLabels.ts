/**
 * PDF label strings for Takeoff's /distribute endpoint (toolbox branch).
 * Mirrors `buildPtpLabels` — pure display strings, no logic. When Takeoff
 * ships Sprint 50D's `toolboxPdfRenderer.ts`, these header names line up
 * with the section IDs it expects.
 */

import type { PtpPdfLabels } from '@/features/safety/ptp/types';

type BuildArgs = {
  title: string;
  projectName: string;
  projectAddress?: string;
  foremanName: string;
  dateIso: string;
  shift: 'day' | 'night' | 'weekend';
  areaLabel?: string;
  language: 'en' | 'es' | 'both';
  oshaCitationsIncluded: boolean;
};

const SHIFT_LABEL: Record<BuildArgs['shift'], string> = {
  day: 'Day shift',
  night: 'Night shift',
  weekend: 'Weekend shift',
};

const LANGUAGE_LABEL: Record<BuildArgs['language'], string> = {
  en: 'English',
  es: 'Español',
  both: 'EN + ES',
};

export function buildToolboxLabels(args: BuildArgs): PtpPdfLabels {
  const dateLabel = new Date(args.dateIso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    title: args.title,
    project_name: args.projectName,
    project_address: args.projectAddress,
    foreman_label: `Foreman: ${args.foremanName}`,
    date_label: `Date: ${dateLabel}`,
    shift_label: SHIFT_LABEL[args.shift],
    area_label: args.areaLabel ? `Area: ${args.areaLabel}` : undefined,
    // Reuse trade_label slot for language since the toolbox PDF doesn't
    // need a per-trade label (topics can span trades). Keeps the server
    // label schema unchanged.
    trade_label: `Language: ${LANGUAGE_LABEL[args.language]}`,
    weather_label: undefined,
    tasks_header: 'Why It Matters',
    hazards_header: 'Key Points',
    controls_header: 'Discussion Questions',
    ppe_header: 'Field Notes',
    emergency_header: 'Distribution',
    signatures_header: 'Crew Signatures',
    footer_integrity_label: 'Document integrity:',
    osha_citations_included: args.oshaCitationsIncluded,
  };
}
