import { z } from 'zod';

// ─── Shared ───────────────────────────────────────────────
export const DocType = z.enum(['jha', 'ptp', 'toolbox_talk']);
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

// ─── PTP (Pre-Task Plan) ─────────────────────────────────
export const PtpTask = z.object({
  task: z.string().min(1, 'Describe the task'),
  hazards: z.string().min(1, 'Identify hazards'),
  controls: z.string().min(1, 'Describe controls'),
});

export const PtpContent = z.object({
  location: z.string().min(1, 'Location is required'),
  crew_members: z.array(z.string()).min(1, 'Add crew members'),
  tasks: z.array(PtpTask).min(1, 'Add at least one task'),
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type PtpContent = z.infer<typeof PtpContent>;

// ─── Toolbox Talk ─────────────────────────────────────────
export const ToolboxContent = z.object({
  topic: z.string().min(1, 'Topic is required'),
  discussion_points: z.array(z.string()).min(1, 'Add discussion points'),
  attendance: z.array(z.string()).min(1, 'Add attendees'),
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ToolboxContent = z.infer<typeof ToolboxContent>;

// ─── Full document validation ─────────────────────────────
export const SafetyDocFormData = z.object({
  doc_type: DocType,
  title: z.string().min(1, 'Title is required'),
  content: z.union([JhaContent, PtpContent, ToolboxContent]),
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
  toolbox_talk: 'Toolbox Talk',
};
