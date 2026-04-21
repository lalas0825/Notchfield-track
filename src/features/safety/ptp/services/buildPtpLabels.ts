/**
 * Build the PDF label strings sent to Takeoff's /distribute endpoint.
 *
 * Contract rules (enforced by Web's ptpPdfRenderer):
 *   1. Labels are pure STRING TEMPLATES. No per-doc values — the renderer
 *      reads values (project name, shift value, date, foreman, etc.) from
 *      the safety_documents row it fetches by id.
 *   2. `shiftValues` MUST be an object map `{ day, night, weekend }`. The
 *      renderer does `labels.shiftValues[content.shift]`. A pre-resolved
 *      string here crashes jsPDF — see commit 3b0dfd0 on Web.
 *   3. Every field listed in `PtpPdfLabels` is REQUIRED. Missing fields
 *      crash the renderer (undefined reads from labels object).
 *
 * Keep strings in English for now. When Track adopts its own i18n namespace
 * for PTP, pass a translator in and pull values from the message catalog.
 */

import type { PtpPdfLabels } from '../types';

type BuildArgs = {
  oshaCitationsIncluded: boolean;
  /** Defaults to 'notchfield.com/verify' if not provided. */
  verifyBaseUrl?: string;
};

export function buildPtpLabels(args: BuildArgs): PtpPdfLabels {
  return {
    // Headers
    title: 'Pre-Task Plan (PTP)',
    subtitle: 'OSHA 1926.20(b) · NYC DOB 3301.12',
    ptpNumber: '#',

    // Metadata column labels
    project: 'Project',
    location: 'Location',
    date: 'Date',
    shift: 'Shift',
    weather: 'Weather',
    foreman: 'Foreman',
    trade: 'Trade',
    gc: 'GC',

    // Enum maps — renderer indexes by content.shift
    shiftValues: {
      day: 'Day shift',
      night: 'Night shift',
      weekend: 'Weekend shift',
    },

    // Section headers
    taskDescription: 'Task Description',
    hazardsIdentified: 'Hazards Identified',
    oshaReference: 'OSHA Reference',
    controlsInPlace: 'Controls in Place',
    controlsEngineering: 'Engineering Controls',
    controlsAdministrative: 'Administrative Controls',
    controlsPpe: 'PPE Controls',
    ppeRequired: 'PPE Required',
    additionalHazards: 'Additional Hazards',
    notes: 'Notes',
    emergency: 'Emergency Information',
    emergencyHospital: 'Nearest Hospital',
    emergencyAssembly: 'Assembly Point',
    emergencyFirstAid: 'First Aid Location',
    emergencyContact: 'Emergency Contact',

    // Signatures
    acknowledgmentTitle: 'Worker Acknowledgment',
    acknowledgmentText:
      'By signing below, workers acknowledge they have reviewed this Pre-Task Plan, ' +
      'understand the hazards identified, and agree to follow the controls and PPE requirements.',
    foremanLabel: 'Foreman',
    crewLabel: 'Crew',
    nameLabel: 'Name',
    roleLabel: 'Role',
    signedAtLabel: 'Signed at',
    gpsLabel: 'GPS',
    sstLabel: 'SST Card',
    walkInLabel: 'Walk-in',

    // Distribution
    distributionTitle: 'Distribution',
    distributionDate: 'Distributed on',
    distributionSentTo: 'Sent to',

    // Integrity
    integrityTitle: 'Document Integrity',
    integrityText:
      'This document is cryptographically signed. The SHA-256 hash below was computed ' +
      'when the PDF was generated — any modification invalidates it.',
    integrityHashLabel: 'Hash',
    integrityVerifyLabel: 'Verify',
    integrityGeneratedLabel: 'Generated',

    // Footer
    poweredBy: 'Powered by NotchField',
    page: 'Page',

    // Misc
    notDistributed: 'Not yet distributed',
    oshaCitationsIncluded: args.oshaCitationsIncluded,
    verifyBaseUrl: args.verifyBaseUrl ?? 'notchfield.com/verify',
  };
}
