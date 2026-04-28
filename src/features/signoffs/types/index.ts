/**
 * Sprint 72 — Sign-Off types.
 *
 * Mirrors Web's `signoff_templates`, `signoff_documents`, and `signoff_areas`
 * tables verbatim (Web Sprint 72 spec, src/features/signoffs/types.ts). Track
 * only READS rows scoped to the current org via the by_org PowerSync bucket;
 * sync filter excludes status IN ('declined','expired','cancelled') to keep
 * the local payload small.
 *
 * The DB CHECK constraints on `signer_role`, `evidence_type`, `status_after_sign`,
 * and `status` reject any value not in the union below — Track must NOT invent
 * new enum values; coordinate with Web before adding.
 *
 * `signoff_areas` is NOT in PowerSync (composite PK, no synthetic id column);
 * fetch via direct Supabase query. See useSignoffAreas hook.
 */

export type SignoffSignerRole = 'contractor' | 'gc' | 'either';

export type SignoffEvidenceType =
  | 'photo'
  | 'video'
  | 'numeric_reading'
  | 'checkbox';

export type SignoffEvidenceRule = {
  type: SignoffEvidenceType;
  label: string;
  required: boolean;
};

export type SignoffStatusAfterSign =
  | 'unlocks_next_trade'
  | 'closes_phase'
  | 'archives';

export type SignoffDocStatus =
  | 'draft'
  | 'pending_signature'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type SignoffEvidencePhoto = {
  url: string;
  type: SignoffEvidenceType;
  /** MUST exact-match the rule's label for server-side validation on send. */
  label: string;
  taken_at?: string | null;
  taken_by?: string | null;
  reading_value?: number | null;
};

export type SignoffTemplate = {
  id: string;
  organization_id: string | null;       // null = NotchField-seeded global
  trade: string;
  name: string;
  description: string | null;
  /** Body with ${areas} ${trade} ${gc} ${contractor} ${date} ${project} placeholders. */
  body_template: string;
  signer_role: SignoffSignerRole;
  required_evidence: SignoffEvidenceRule[];
  /** Auto-spawn a draft signoff when production_area_objects.status flips to
   * 'completed' AND surface_type matches this. NULL = no auto-spawn. */
  auto_spawn_on_surface_type: string | null;
  allows_multi_area: boolean;
  default_status_after_sign: SignoffStatusAfterSign;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SignoffDocument = {
  id: string;
  organization_id: string;
  project_id: string;
  number: number;
  template_id: string | null;
  title: string;
  /** Pre-rendered at create time — display directly, no further substitution. */
  body: string;
  /** Polish R2 — optional extra context shown in PDF + signing page. */
  notes: string | null;
  signer_role: SignoffSignerRole;
  trade: string | null;
  status: SignoffDocStatus;
  evidence_photos: SignoffEvidencePhoto[];
  required_evidence_snapshot: SignoffEvidenceRule[];
  status_after_sign: SignoffStatusAfterSign;
  /** NULL when auto-spawned by DB trigger. UI should show "Auto-created". */
  created_by: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_company: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  /** Populated async after signed (PDF rendering happens fire-and-forget). */
  pdf_url: string | null;
  sha256_hash: string | null;
  spawned_from_object_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SignoffArea = {
  signoff_id: string;
  area_id: string;
  surface_id: string | null;
  area_label_snapshot: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Polish R1 — placeholder rendered when no recipient name was provided. */
export const SIGNOFF_BLANK_LINE = '_______________';

/**
 * Substitute body_template placeholders for live preview in the FAB Step 2.
 * Server does the same at create time — Track only uses this to show the
 * foreman what the GC will see while typing.
 *
 * Polish R1 contract: empty/undefined values for `gc` and `date` collapse to
 * SIGNOFF_BLANK_LINE so the foreman sees the underline on screen and knows
 * the signer will fill it in. Other placeholders (areas, trade, contractor,
 * project) get the empty-string fallback.
 */
export function renderSignoffBody(
  template: string,
  values: {
    areas?: string;
    trade?: string;
    gc?: string;
    contractor?: string;
    date?: string;
    project?: string;
  },
): string {
  const blank = SIGNOFF_BLANK_LINE;
  return template
    .replace(/\$\{areas\}/g, values.areas ?? '')
    .replace(/\$\{trade\}/g, values.trade ?? '')
    .replace(/\$\{contractor\}/g, values.contractor ?? '')
    .replace(/\$\{project\}/g, values.project ?? '')
    .replace(/\$\{gc\}/g, values.gc?.trim() || blank)
    .replace(/\$\{date\}/g, values.date?.trim() || blank);
}

/** Filter templates by the org's primary trades + 'general'. Polish R2. */
export function filterTemplatesByPrimaryTrades(
  templates: SignoffTemplate[],
  primaryTrades: string[] | null | undefined,
): SignoffTemplate[] {
  // Fallback: no opinion = no filter (show all).
  if (!primaryTrades || primaryTrades.length === 0) return templates;
  const allowed = new Set([...primaryTrades, 'general']);
  return templates.filter((t) => allowed.has(t.trade));
}
