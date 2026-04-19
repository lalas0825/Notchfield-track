/**
 * Build the PDF label strings sent to Takeoff's /distribute endpoint. These
 * are pure display strings — no logic, no data. Matches the label set
 * Takeoff's `ptpPdfRenderer` expects.
 *
 * Keep strings in English for now. When Track adopts its own i18n namespace
 * for PTP, pass a translator in and pull values from the message catalog.
 */

import type { PtpPdfLabels } from '../types';

type BuildArgs = {
  title: string;
  projectName: string;
  projectAddress?: string;
  foremanName: string;
  dateIso: string;
  shift: 'day' | 'night' | 'weekend';
  areaLabel?: string;
  trade: string;
  weather?: { temp_f?: number; conditions?: string } | null;
  oshaCitationsIncluded: boolean;
};

const SHIFT_LABEL: Record<BuildArgs['shift'], string> = {
  day: 'Day shift',
  night: 'Night shift',
  weekend: 'Weekend shift',
};

export function buildPtpLabels(args: BuildArgs): PtpPdfLabels {
  const dateLabel = new Date(args.dateIso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const weatherLabel = args.weather
    ? [
        args.weather.temp_f !== undefined ? `${args.weather.temp_f}°F` : null,
        args.weather.conditions,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return {
    title: args.title,
    project_name: args.projectName,
    project_address: args.projectAddress,
    foreman_label: `Foreman: ${args.foremanName}`,
    date_label: `Date: ${dateLabel}`,
    shift_label: SHIFT_LABEL[args.shift],
    area_label: args.areaLabel ? `Area: ${args.areaLabel}` : undefined,
    trade_label: `Trade: ${args.trade.charAt(0).toUpperCase()}${args.trade.slice(1)}`,
    weather_label: weatherLabel ? `Weather: ${weatherLabel}` : undefined,
    tasks_header: 'Tasks',
    hazards_header: 'Hazards',
    controls_header: 'Controls',
    ppe_header: 'PPE Required',
    emergency_header: 'Emergency Information',
    signatures_header: 'Crew Signatures',
    footer_integrity_label: 'Document integrity:',
    osha_citations_included: args.oshaCitationsIncluded,
  };
}
