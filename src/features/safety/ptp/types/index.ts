/**
 * Sprint PTP — Types mirroring Takeoff Web's PM PTP schema.
 *
 * Contract: these Zod schemas MUST match Takeoff's `src/features/pm/types.ts`.
 * The DB stores PTP content + signatures as JSONB on the shared
 * `safety_documents` row. Both apps read and write the same rows.
 */

import { z } from 'zod';

// ─── Trade enum ───────────────────────────────────────────
// Mirrors the 10 trades seeded in `jha_library` for the Jantile org.
export const Trade = z.enum([
  'tile',
  'marble',
  'flooring',
  'drywall',
  'paint',
  'roofing',
  'concrete',
  'hvac',
  'electrical',
  'plumbing',
]);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Trade = z.infer<typeof Trade>;

// ─── JHA library item (read-only in Track) ────────────────
export const JhaHazardItem = z.object({
  name: z.string(),
  osha_ref: z.string().optional(),
});
export type JhaHazardItem = z.infer<typeof JhaHazardItem>;

export const JhaControlItem = z.object({
  name: z.string(),
  category: z.enum(['engineering', 'administrative', 'ppe', 'elimination', 'substitution']).optional(),
});
export type JhaControlItem = z.infer<typeof JhaControlItem>;

export const JhaLibraryItem = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  project_id: z.string().uuid().nullable(),
  trade: Trade,
  category: z.string().nullable(),
  task_name: z.string(),
  task_description: z.string().nullable(),
  typical_scenarios: z.string().nullable(),
  hazards: z.array(JhaHazardItem),
  controls: z.array(JhaControlItem),
  ppe_required: z.array(z.string()),
  notes: z.string().nullable(),
  active: z.boolean(),
});
export type JhaLibraryItem = z.infer<typeof JhaLibraryItem>;

// ─── PTP content (stored in safety_documents.content JSONB) ──
export const PtpWeather = z.object({
  temp_f: z.number().optional(),
  conditions: z.string().optional(),
  wind_mph: z.number().optional(),
});
export type PtpWeather = z.infer<typeof PtpWeather>;

/**
 * Snapshot of a JHA task at the moment the foreman picked it.
 * Deep-copy at selection time so the PTP is immutable if the library
 * changes later.
 */
export const PtpSelectedTask = z.object({
  jha_library_id: z.string().uuid(),
  task_name: z.string(),
  category: z.string().nullable(),
  hazards: z.array(JhaHazardItem),
  controls: z.array(JhaControlItem),
  ppe_required: z.array(z.string()),
});
export type PtpSelectedTask = z.infer<typeof PtpSelectedTask>;

export const PtpAdditionalHazard = z.object({
  description: z.string(),
  mitigation: z.string(),
});
export type PtpAdditionalHazard = z.infer<typeof PtpAdditionalHazard>;

export const PtpEmergencySnapshot = z.object({
  hospital_name: z.string().nullable().optional(),
  hospital_address: z.string().nullable().optional(),
  hospital_distance: z.string().nullable().optional(),
  assembly_point: z.string().nullable().optional(),
  first_aid_location: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
});
export type PtpEmergencySnapshot = z.infer<typeof PtpEmergencySnapshot>;

export const PtpGps = z.object({
  latitude: z.number(),
  longitude: z.number(),
});
export type PtpGps = z.infer<typeof PtpGps>;

export const PtpContentSchema = z.object({
  // Context
  area_id: z.string().uuid().nullable().optional(),
  area_label: z.string().optional(),
  ptp_date: z.string(), // ISO date YYYY-MM-DD
  shift: z.enum(['day', 'night', 'weekend']).default('day'),
  weather: PtpWeather.nullable().optional(),
  trade: Trade,

  // Selected JHA tasks (snapshots, immutable)
  selected_tasks: z.array(PtpSelectedTask).default([]),

  // Foreman-added hazards (rare safety valve)
  additional_hazards: z.array(PtpAdditionalHazard).default([]),

  // Emergency info snapshot from projects table
  emergency: PtpEmergencySnapshot.nullable().optional(),

  // Foreman context
  foreman_id: z.string().uuid(),
  foreman_name: z.string(),
  foreman_gps: PtpGps.nullable().optional(),

  // Free-form notes
  additional_notes: z.string().default(''),

  // Photo attachments (local URIs or Supabase URLs)
  photo_urls: z.array(z.string()).default([]),

  // PDF rendering options
  osha_citations_included: z.boolean().default(true),

  // Stamped by distributeService when /distribute succeeds. Drives the
  // "already sent" UI state — don't use the status column for that.
  distribution: z
    .object({
      distributed_at: z.string(),
      distributed_to: z.array(z.string()).default([]),
      pdf_sha256: z.string().nullable().optional(),
      emails_sent: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type PtpContent = z.infer<typeof PtpContentSchema>;

// ─── PTP signature (stored in safety_documents.signatures JSONB[]) ──
export const PtpSignatureSchema = z.object({
  worker_id: z.string().uuid().nullable(),
  worker_name: z.string(),
  sst_card_number: z.string().nullable().optional(),
  signature_data_url: z.string(), // data:image/png;base64,...
  signed_at: z.string(), // ISO timestamp
  is_foreman: z.boolean().default(false),
  is_walk_in: z.boolean().default(false),
  gps: PtpGps.nullable().optional(), // foreman only
});
export type PtpSignature = z.infer<typeof PtpSignatureSchema>;

// ─── PTP PDF labels (passed to distribute endpoint) ──
// Canonical shape mirrors Takeoff Web's `ptpPdfRenderer.ts` PtpPdfLabels.
// Two rules the renderer relies on:
//   1. shiftValues MUST be a { day, night, weekend } object map — the renderer
//      does `labels.shiftValues[content.shift]`. Sending a pre-resolved string
//      here crashes jsPDF ("Cannot read properties of undefined (reading 'day')").
//   2. Labels are STRING TEMPLATES only — no per-doc values. The renderer reads
//      values (project name, foreman name, shift, date, etc.) from the DB row.
export const PtpPdfLabels = z.object({
  // Headers
  title: z.string(),                   // "Pre-Task Plan (PTP)"
  subtitle: z.string(),                // "OSHA 1926.20(b) · NYC DOB 3301.12"
  ptpNumber: z.string(),               // "#"

  // Metadata column labels (left side of header table)
  project: z.string(),                 // "Project"
  location: z.string(),                // "Location"
  date: z.string(),                    // "Date"
  shift: z.string(),                   // "Shift"
  weather: z.string(),                 // "Weather"
  foreman: z.string(),                 // "Foreman"
  trade: z.string(),                   // "Trade"
  gc: z.string(),                      // "GC"
  // Toolbox-specific row labels (PTP renderer ignores these; toolbox
  // renderer reads topic_snapshot.category / .source / .osha_ref into
  // these slots). Required because the Web renderer reads them and
  // crashes/silently-blanks when absent.
  category: z.string(),                // "Category"
  source: z.string(),                  // "Source"

  // Enum maps — REQUIRED to be objects, not strings
  shiftValues: z.object({
    day: z.string(),
    night: z.string(),
    weekend: z.string(),
  }),

  // Section headers
  taskDescription: z.string(),
  hazardsIdentified: z.string(),
  oshaReference: z.string(),
  controlsInPlace: z.string(),
  controlsEngineering: z.string(),
  controlsAdministrative: z.string(),
  controlsPpe: z.string(),
  ppeRequired: z.string(),
  additionalHazards: z.string(),
  notes: z.string(),
  emergency: z.string(),
  emergencyHospital: z.string(),
  emergencyAssembly: z.string(),
  emergencyFirstAid: z.string(),
  emergencyContact: z.string(),

  // Signatures section
  acknowledgmentTitle: z.string(),
  acknowledgmentText: z.string(),
  foremanLabel: z.string(),
  crewLabel: z.string(),
  nameLabel: z.string(),
  roleLabel: z.string(),
  signedAtLabel: z.string(),
  gpsLabel: z.string(),
  sstLabel: z.string(),
  walkInLabel: z.string(),

  // Distribution section
  distributionTitle: z.string(),
  distributionDate: z.string(),
  distributionSentTo: z.string(),

  // Integrity section
  integrityTitle: z.string(),
  integrityText: z.string(),
  integrityHashLabel: z.string(),
  integrityVerifyLabel: z.string(),
  integrityGeneratedLabel: z.string(),

  // Footer
  poweredBy: z.string(),
  page: z.string(),

  // Misc
  notDistributed: z.string(),
  oshaCitationsIncluded: z.boolean(),
  verifyBaseUrl: z.string(),
});
export type PtpPdfLabels = z.infer<typeof PtpPdfLabels>;

// ─── Distribution metadata (lives inside content JSONB) ─────
// The DB status enum is {draft, active, completed}. We don't have a
// 'distributed' status — instead we stamp distribution metadata here the
// moment the /distribute endpoint succeeds. UI detects "already sent" via
// `content.distribution?.distributed_at` rather than the status column.
export const DistributionMeta = z.object({
  distributed_at: z.string(),          // ISO timestamp
  distributed_to: z.array(z.string()).default([]),
  pdf_sha256: z.string().nullable().optional(),
  emails_sent: z.number().nullable().optional(),
});
export type DistributionMeta = z.infer<typeof DistributionMeta>;

// ─── SafetyDocument envelope (the Supabase row) ─────────────
// doc_type matches the DB CHECK constraint exactly.
// status matches the DB CHECK constraint exactly.
export const SafetyDocument = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  number: z.number().optional(),
  doc_type: z.enum(['jha', 'ptp', 'toolbox', 'sign_off']),
  title: z.string(),
  content: PtpContentSchema.or(z.record(z.string(), z.any())),
  status: z.enum(['draft', 'active', 'completed']),
  signatures: z.array(PtpSignatureSchema).default([]),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SafetyDocument = z.infer<typeof SafetyDocument>;
