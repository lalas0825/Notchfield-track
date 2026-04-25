/**
 * Legal Document Service — Sprint 53C REWRITE
 * =============================================
 *
 * CRITICAL FIX: the prior flow set status='signed' after the supervisor
 * signed the document. The DB CHECK constraint is:
 *   status IN ('draft', 'sent', 'opened', 'no_response')
 * There is NO 'signed' state. Web team confirmed (Hipótesis A):
 *   "El acto de firmar IS el acto de enviar — son una sola transición."
 *
 * Flow:
 *   draft    → user taps "Sign & Send" in the NodSignModal
 *               → signature pad + recipient email + cost preview
 *   (submit) → signature PNG uploaded to Storage
 *               → PDF rendered locally via expo-print
 *               → PDF uploaded to Storage
 *               → SHA-256 of PDF bytes
 *               → delay_cost_logs row INSERTed
 *               → Edge Function called (email + tracking_token)
 *               → UPDATE legal_documents in ONE transaction:
 *                   status='sent', signed_at, signed_by, sha256_hash,
 *                   pdf_url, recipient_email, recipient_name, sent_at,
 *                   tracking_token, related_delay_log_id
 *   sent     → GC opens email → tracking pixel UPDATEs:
 *                   status='opened', opened_at, receipt_ip, receipt_device
 *   opened   → (final state for v1; 48h cron flips to 'no_response' in v2)
 *
 * The guard_legal_immutability trigger prevents modification of
 * title/description/sha256_hash/signed_by/signed_at on sent+ docs.
 *
 * Supervisor-only — foreman NEVER sees legal documents (RLS + in-app gate).
 */

import { supabase } from '@/shared/lib/supabase/client';
import { logger } from '@/shared/lib/logger';

export type LegalDocStatus = 'draft' | 'sent' | 'opened' | 'no_response';

export type LegalDoc = {
  id: string;
  organization_id: string;
  project_id: string;
  document_type: 'nod' | 'rea' | 'evidence';
  status: LegalDocStatus;
  related_area_id: string | null;
  related_delay_log_id: string | null;
  title: string;
  description: string | null;
  sha256_hash: string | null;
  pdf_url: string | null;
  signed_by: string | null;
  signed_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  receipt_ip: string | null;
  receipt_device: string | null;
  tracking_token: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Detect areas blocked > threshold hours. Returns areas eligible for NOD.
 * Default threshold 24h — the pilot ops window.
 */
export async function detectBlockedAreas(
  projectId: string,
  thresholdHours = 24,
): Promise<{
  id: string;
  name: string;
  floor: string | null;
  blocked_reason: string | null;
  blocked_at: string;
  hours_blocked: number;
}[]> {
  const { data } = await supabase
    .from('production_areas')
    .select('id, name, floor, blocked_reason, blocked_at')
    .eq('project_id', projectId)
    .eq('status', 'blocked')
    .not('blocked_at', 'is', null);

  if (!data) return [];

  const now = Date.now();
  return (data as Array<{
    id: string;
    name: string;
    floor: string | null;
    blocked_reason: string | null;
    blocked_at: string;
  }>)
    .map((area) => ({
      ...area,
      hours_blocked: (now - new Date(area.blocked_at).getTime()) / 3600000,
    }))
    .filter((area) => area.hours_blocked >= thresholdHours);
}

/**
 * Check if a NOD already exists for an area (avoid duplicates).
 * Only matches active states (draft/sent/opened). no_response does NOT
 * count as "already exists" — it means the GC never acknowledged, so a
 * re-issue is valid.
 */
export async function hasExistingNod(areaId: string): Promise<boolean> {
  const { count } = await supabase
    .from('legal_documents')
    .select('*', { count: 'exact', head: true })
    .eq('related_area_id', areaId)
    .eq('document_type', 'nod')
    .in('status', ['draft', 'sent', 'opened']);

  return (count ?? 0) > 0;
}

/**
 * Generate a NOD draft for a blocked area. Status='draft'; supervisor
 * reviews + adds recipient + signs via NodSignModal.
 */
export async function generateNodDraft(params: {
  organizationId: string;
  projectId: string;
  areaId: string;
  areaName: string;
  blockedReason: string;
  blockedAt: string;
  hoursBlocked: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const exists = await hasExistingNod(params.areaId);
  if (exists) {
    return { success: false, error: 'A NOD already exists for this area' };
  }

  const title = `Notice of Delay — ${params.areaName}`;
  const description = [
    `Area: ${params.areaName}`,
    `Blocked since: ${new Date(params.blockedAt).toLocaleString()}`,
    `Duration: ${Math.round(params.hoursBlocked)} hours`,
    `Reason: ${params.blockedReason}`,
    '',
    'This Notice of Delay documents that work has been impeded due to conditions beyond the control of the subcontractor. All associated costs and schedule impacts are being tracked.',
  ].join('\n');

  const { data, error } = await supabase
    .from('legal_documents')
    .insert({
      organization_id: params.organizationId,
      project_id: params.projectId,
      document_type: 'nod',
      status: 'draft',
      related_area_id: params.areaId,
      title,
      description,
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  logger.info(`[Legal] NOD draft generated: ${title}`);
  return { success: true, id: data?.id };
}

/**
 * Load a single legal document (for the detail screen / signing modal).
 */
export async function getLegalDoc(docId: string): Promise<LegalDoc | null> {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('*')
    .eq('id', docId)
    .maybeSingle();
  if (error) {
    logger.warn('[Legal] getLegalDoc failed', error);
    return null;
  }
  return data as LegalDoc | null;
}

/**
 * Apply the sign + send transaction to legal_documents.
 * Called by NodSignModal after:
 *   1. signature PNG uploaded
 *   2. PDF rendered + uploaded
 *   3. SHA-256 computed
 *   4. delay_cost_logs row INSERTed (cost engine)
 *   5. Edge Function returned tracking_token + sent_at
 *
 * This is the ONLY legitimate path from draft → sent. No separate "sign"
 * state exists in the schema.
 */
export async function applySignAndSend(params: {
  docId: string;
  signedBy: string;
  sha256Hash: string;
  pdfUrl: string;
  recipientEmail: string;
  recipientName: string | null;
  sentAt: string;
  trackingToken: string;
  delayLogId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('legal_documents')
    .update({
      status: 'sent',
      signed_by: params.signedBy,
      signed_at: params.sentAt,              // sign and send happen together
      sha256_hash: params.sha256Hash,
      pdf_url: params.pdfUrl,
      recipient_email: params.recipientEmail,
      recipient_name: params.recipientName,
      sent_at: params.sentAt,
      tracking_token: params.trackingToken,
      related_delay_log_id: params.delayLogId,
    })
    .eq('id', params.docId);

  if (error) return { success: false, error: error.message };
  logger.info(`[Legal] NOD sent: ${params.docId}`);
  return { success: true };
}

/**
 * Fetch all legal documents for a project (supervisor only).
 */
export async function fetchLegalDocs(
  projectId: string,
  organizationId: string,
): Promise<LegalDoc[]> {
  const { data } = await supabase
    .from('legal_documents')
    .select('*')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  return (data ?? []) as LegalDoc[];
}

/**
 * Counts by status for the Docs tab badge + KPI bar.
 */
export function getLegalCounts(docs: LegalDoc[]) {
  return {
    draft: docs.filter((d) => d.status === 'draft').length,
    sent: docs.filter((d) => d.status === 'sent').length,
    opened: docs.filter((d) => d.status === 'opened').length,
    noResponse: docs.filter((d) => d.status === 'no_response').length,
    total: docs.length,
  };
}
