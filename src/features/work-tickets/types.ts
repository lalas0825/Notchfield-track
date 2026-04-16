/**
 * Work Ticket types + Zod schemas — Sprint 45B
 * ================================================
 * These MIRROR Takeoff Web's `src/shared/types/documents.ts` exactly.
 * Same field names, same enums, same shape. If Takeoff adds a field, Track
 * adds it here too. Mirror, don't fork.
 */

import { z } from 'zod';

// ─── Labor / Materials ─────────────────────────────────────────

export const LaborEntrySchema = z.object({
  name: z.string(),
  classification: z.enum(['Mechanic', 'Helper', 'Apprentice', 'Foreman']),
  regular_hours: z.number().min(0),
  overtime_hours: z.number().min(0),
});
export type LaborEntry = z.infer<typeof LaborEntrySchema>;

export const MaterialEntrySchema = z.object({
  description: z.string(),
  quantity: z.number().min(0),
  unit: z.string(),
});
export type MaterialEntry = z.infer<typeof MaterialEntrySchema>;

// ─── Evidence Photos ───────────────────────────────────────────
// Mirror Takeoff Web's `WorkTicketPhoto` exactly. `local_uri` and
// `pending_upload` are Track-only fields that persist only in the
// local SQLite row — they're stripped before a ticket is sent for
// signature (see `workTicketPhotoService.processPendingUploads`).

export const WorkTicketPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),                       // public URL; '' while pending_upload
  thumbnail_url: z.string().optional(),
  caption: z.string().optional(),
  taken_at: z.string(),
  taken_by: z.string(),
  taken_by_name: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  // Track-only (offline support):
  local_uri: z.string().optional(),
  pending_upload: z.boolean().optional(),
});
export type WorkTicketPhoto = z.infer<typeof WorkTicketPhotoSchema>;

// ─── Ticket ────────────────────────────────────────────────────

export const WorkTicketPrioritySchema = z.enum(['normal', 'urgent']);
export type WorkTicketPriority = z.infer<typeof WorkTicketPrioritySchema>;

export const WorkTicketStatusSchema = z.enum(['draft', 'pending', 'signed', 'declined']);
export type WorkTicketStatus = z.infer<typeof WorkTicketStatusSchema>;

export const WorkTicketSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  project_id: z.string().uuid(),
  number: z.number().int().nullable(),
  service_date: z.string().nullable(),
  trade: z.string(),
  area: z.string().nullable(),
  area_description: z.string().nullable(),
  floor: z.string().nullable(),
  foreman_name: z.string().nullable(),
  priority: WorkTicketPrioritySchema.default('normal'),
  work_description: z.string(),
  labor: z.array(LaborEntrySchema).default([]),
  materials: z.array(MaterialEntrySchema).default([]),
  gc_notes: z.string().nullable(),
  status: WorkTicketStatusSchema.default('draft'),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable(),
});
export type WorkTicket = z.infer<typeof WorkTicketSchema>;

// Draft row as used by the create form (before insert)
export type WorkTicketDraft = Pick<
  WorkTicket,
  | 'organization_id'
  | 'project_id'
  | 'service_date'
  | 'trade'
  | 'area_description'
  | 'floor'
  | 'foreman_name'
  | 'priority'
  | 'work_description'
  | 'labor'
  | 'materials'
  | 'gc_notes'
  | 'created_by'
>;

// ─── Signatures ────────────────────────────────────────────────

export const SignerRoleSchema = z.enum(['gc', 'supervisor', 'foreman', 'pm', 'worker']);
export type SignerRole = z.infer<typeof SignerRoleSchema>;

export const DocumentSignatureStatusSchema = z.enum(['pending', 'signed', 'declined']);
export type DocumentSignatureStatus = z.infer<typeof DocumentSignatureStatusSchema>;

export const DocumentSignatureSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  document_type: z.enum(['work_ticket', 'jha', 'ptp', 'toolbox', 'signoff']),
  document_id: z.string().uuid(),
  project_id: z.string().uuid().nullable(),
  signer_name: z.string().nullable(),
  signer_email: z.string().nullable(),
  signer_role: SignerRoleSchema,
  signature_url: z.string().nullable(),
  status: DocumentSignatureStatusSchema,
  token: z.string().uuid(),
  content_hash: z.string().nullable(),
  hash_algorithm: z.string().nullable(),
  hashed_at: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  signed_at: z.string().nullable(),
  created_at: z.string(),
});
export type DocumentSignature = z.infer<typeof DocumentSignatureSchema>;

// ─── UI constants ──────────────────────────────────────────────

export const TRADES = ['Tile', 'Stone', 'Marble', 'Flooring', 'Polisher'] as const;
export const LABOR_CLASSIFICATIONS: LaborEntry['classification'][] = [
  'Mechanic',
  'Helper',
  'Apprentice',
  'Foreman',
];
export const MATERIAL_UNITS = ['pcs', 'box', 'bag', 'sqft', 'lf', 'gal', 'lbs'] as const;

// ─── Helpers ───────────────────────────────────────────────────

export function totalHours(labor: LaborEntry[]): number {
  return labor.reduce(
    (sum, l) => sum + (Number(l.regular_hours) || 0) + (Number(l.overtime_hours) || 0),
    0,
  );
}

export function workerCount(labor: LaborEntry[]): number {
  return labor.length;
}
