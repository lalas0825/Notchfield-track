import { z } from 'zod';

// ─── Shared ───────────────────────────────────────────────
// Matches the DB CHECK constraint: doc_type IN ('jha','ptp','toolbox','sign_off').
// sign_off isn't surfaced in Track's create flow — reserved for future use.
export const DocType = z.enum(['jha', 'ptp', 'toolbox']);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type DocType = z.infer<typeof DocType>;

export const SignatureEntry = z.object({
  signer_name: z.string().min(1, 'Name is required'),
  signature_data: z.string().min(1, 'Signature is required'), // base64
  signed_at: z.string(),
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SignatureEntry = z.infer<typeof SignatureEntry>;

// ─── JHA (Job Hazard Analysis) ────────────────────────────
export const JhaHazard = z.object({
  description: z.string().min(1, 'Describe the hazard'),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  controls: z.string().min(1, 'Describe controls'),
  ppe: z.array(z.string()).min(1, 'Select at least one PPE'),
});

export const JhaContent = z.object({
  location: z.string().min(1, 'Location is required'),
  weather: z.string().optional(),
  hazards: z.array(JhaHazard).min(1, 'Add at least one hazard'),
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type JhaContent = z.infer<typeof JhaContent>;

// PTP schemas moved to `src/features/safety/ptp/types/index.ts`. The new
// flow stores hazards/controls/PPE as task snapshots sourced from the
// shared jha_library table rather than free-form strings.

// Toolbox Talk schemas moved to `src/features/safety/toolbox/types/index.ts`.
// The new flow sources topics from the `toolbox_library` table (3-tier,
// global/org/project) and snapshots them into content — no more free-form
// topic/discussion_points/attendance.

// ─── Full document validation ─────────────────────────────
// Legacy form only handles JHA now. PTP and Toolbox Talk have dedicated
// wizards in src/app/(tabs)/docs/safety/{ptp,toolbox}/ with their own Zod.
export const SafetyDocFormData = z.object({
  doc_type: DocType,
  title: z.string().min(1, 'Title is required'),
  content: JhaContent,
  signatures: z.array(SignatureEntry).min(1, 'At least one signature is required'),
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SafetyDocFormData = z.infer<typeof SafetyDocFormData>;

// ─── PPE options ──────────────────────────────────────────
export const PPE_OPTIONS = [
  'Hard Hat',
  'Safety Glasses',
  'Gloves',
  'Steel-Toe Boots',
  'High-Vis Vest',
  'Hearing Protection',
  'Respirator',
  'Fall Protection',
  'Face Shield',
] as const;

export const RISK_LEVELS = [
  { value: 'low', label: 'Low', color: '#22C55E' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#F97316' },
  { value: 'critical', label: 'Critical', color: '#EF4444' },
] as const;

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  jha: 'Job Hazard Analysis',
  ptp: 'Pre-Task Plan',
  toolbox: 'Toolbox Talk',
};
