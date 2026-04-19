/**
 * Sprint MANPOWER — Worker + ProjectWorker types.
 *
 * Mirrors the `workers` / `project_workers` tables in Takeoff Supabase.
 * Profiles (auth users) are separate from workers (HR). Foremen link them
 * via `workers.profile_id`. Walk-in workers have `profile_id = null`.
 */

import { z } from 'zod';

export const TradeLevel = z.enum([
  'foreman',
  'mechanic',
  'helper',
  'apprentice',
  'other',
]);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TradeLevel = z.infer<typeof TradeLevel>;

export const Worker = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  profile_id: z.string().uuid().nullable(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  hire_date: z.string().nullable().optional(),
  active: z.boolean(),
  trade: z.string().nullable().optional(),
  trade_level: TradeLevel.nullable().optional(),
  years_experience: z.number().nullable().optional(),
  daily_rate_cents: z.number().nullable().optional(),
  // Certs
  sst_card_number: z.string().nullable().optional(),
  sst_expires_at: z.string().nullable().optional(),
  osha_10_cert_number: z.string().nullable().optional(),
  osha_10_expires_at: z.string().nullable().optional(),
  osha_30_cert_number: z.string().nullable().optional(),
  osha_30_expires_at: z.string().nullable().optional(),
  swac_cert_number: z.string().nullable().optional(),
  swac_expires_at: z.string().nullable().optional(),
  silica_trained: z.boolean().default(false),
  silica_trained_at: z.string().nullable().optional(),
  i9_verified: z.boolean().default(false),
  i9_verified_at: z.string().nullable().optional(),
  // ICE (emergency contact)
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  emergency_contact_relation: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Worker = z.infer<typeof Worker>;

export const ProjectWorker = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  project_id: z.string().uuid(),
  worker_id: z.string().uuid(),
  assigned_at: z.string(),
  assigned_by: z.string().uuid().nullable().optional(),
  removed_at: z.string().nullable().optional(),
  active: z.boolean(),
  notes: z.string().nullable().optional(),
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ProjectWorker = z.infer<typeof ProjectWorker>;

export function workerFullName(w: Pick<Worker, 'first_name' | 'last_name'>): string {
  return `${w.first_name} ${w.last_name}`.trim();
}
