/**
 * Legal Document Service — NOD (Notice of Delay)
 * =================================================
 * Lifecycle: draft → signed → sent → opened
 *
 * Once signed, the Postgres trigger guard_legal_immutability()
 * prevents modification of title, description, sha256_hash, signed_by, signed_at.
 * The SHA-256 hash acts as tamper-detection.
 *
 * Supervisor only — foreman NEVER sees legal documents.
 */

import * as Crypto from 'expo-crypto';
import { supabase } from '@/shared/lib/supabase/client';

export type LegalDoc = {
  id: string;
  organization_id: string;
  project_id: string;
  document_type: string; // 'nod' | 'rea'
  status: string; // 'draft' | 'signed' | 'sent' | 'opened'
  related_area_id: string | null;
  title: string;
  description: string | null;
  sha256_hash: string | null;
  pdf_url: string | null;
  signed_by: string | null;
  signed_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  recipient_email: string | null;
  created_at: string;
};

/**
 * Detect areas blocked > threshold hours. Returns areas eligible for NOD.
 */
export async function detectBlockedAreas(
  projectId: string,
  thresholdHours = 24,
): Promise<{ id: string; name: string; floor: string | null; blocked_reason: string | null; blocked_at: string; hours_blocked: number }[]> {
  const { data } = await supabase
    .from('production_areas')
    .select('id, name, floor, blocked_reason, blocked_at')
    .eq('project_id', projectId)
    .eq('status', 'blocked')
    .not('blocked_at', 'is', null);

  if (!data) return [];

  const now = Date.now();
  return (data as any[])
    .map((area) => ({
      ...area,
      hours_blocked: (now - new Date(area.blocked_at).getTime()) / 3600000,
    }))
    .filter((area) => area.hours_blocked >= thresholdHours);
}

/**
 * Check if a NOD already exists for an area (avoid duplicates).
 */
export async function hasExistingNod(areaId: string): Promise<boolean> {
  const { count } = await supabase
    .from('legal_documents')
    .select('*', { count: 'exact', head: true })
    .eq('related_area_id', areaId)
    .eq('document_type', 'nod')
    .in('status', ['draft', 'signed', 'sent']);

  return (count ?? 0) > 0;
}

/**
 * Generate a NOD draft for a blocked area.
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
  // Check for existing NOD
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

  console.log(`[Legal] NOD draft generated: ${title}`);
  return { success: true, id: data?.id };
}

/**
 * Sign a NOD. Generates SHA-256 hash of content + signature.
 * Once signed, the Postgres trigger prevents modification.
 */
export async function signNod(
  docId: string,
  signedBy: string,
  signatureData: string, // base64 signature image
): Promise<{ success: boolean; error?: string }> {
  // Fetch the document to hash
  const { data: doc, error: fetchError } = await supabase
    .from('legal_documents')
    .select('title, description, related_area_id, created_at')
    .eq('id', docId)
    .single();

  if (fetchError || !doc) {
    return { success: false, error: 'Document not found' };
  }

  // Generate SHA-256 hash of content + signer + timestamp
  const now = new Date().toISOString();
  const hashInput = JSON.stringify({
    title: doc.title,
    description: doc.description,
    related_area_id: doc.related_area_id,
    created_at: doc.created_at,
    signed_by: signedBy,
    signed_at: now,
    signature_data_length: signatureData.length,
  });

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    hashInput,
  );

  // Update with signature + hash (trigger allows this on unsigned docs)
  const { error } = await supabase
    .from('legal_documents')
    .update({
      status: 'signed',
      signed_by: signedBy,
      signed_at: now,
      sha256_hash: hash,
    })
    .eq('id', docId);

  if (error) return { success: false, error: error.message };

  console.log(`[Legal] NOD signed: ${docId} hash=${hash.substring(0, 16)}...`);
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
 * Get counts by status.
 */
export function getLegalCounts(docs: LegalDoc[]) {
  return {
    draft: docs.filter((d) => d.status === 'draft').length,
    signed: docs.filter((d) => d.status === 'signed').length,
    sent: docs.filter((d) => d.status === 'sent').length,
    total: docs.length,
  };
}
