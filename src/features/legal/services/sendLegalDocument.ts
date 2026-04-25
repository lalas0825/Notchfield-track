/**
 * Sprint 53C — Sign + Send orchestrator.
 *
 * Single entry point called by NodSignModal. Coordinates:
 *   1. Upload signature PNG to Storage (reusable visual asset)
 *   2. Render PDF locally via expo-print (embeds signature + tracking pixel URL)
 *   3. Upload PDF + compute SHA-256 (renderAndUploadNod)
 *   4. Persist delay_cost_logs row (costEngine.persistDelayCostLog)
 *   5. Call Edge Function send-legal-document → get tracking_token + sent_at
 *   6. UPDATE legal_documents via applySignAndSend (one transaction)
 *
 * Returns the full chain's success/error. No retry here — the UI handles
 * error display. An offline-aware queue is a future enhancement (Track
 * deferred because the sign flow genuinely requires internet for email
 * send — it's not meaningful to queue a "send" that can never execute).
 */

import { supabase } from '@/shared/lib/supabase/client';
import * as FileSystem from 'expo-file-system/legacy';
import { applySignAndSend, type LegalDoc } from './legal-service';
import { computeDelayCost, persistDelayCostLog } from './costEngine';
import { renderAndUploadNod } from './nodPdfRenderer';
import { logger } from '@/shared/lib/logger';

const TRACKING_PIXEL_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/legal-tracking-pixel/`;

type Area = {
  id: string;
  name: string;
  label: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
};

type Org = { name: string; logo_url: string | null };
type Project = { name: string };
type Gc = { name: string };
type Signer = { id: string; name: string; title: string | null };

export type SignAndSendParams = {
  doc: LegalDoc;
  area: Area;
  organization: Org;
  project: Project;
  gc: Gc;
  signer: Signer;
  signatureDataUrl: string; // base64 PNG from SignaturePad
  recipientEmail: string;
  additionalNotes?: string;
};

export type SignAndSendResult =
  | { success: true; trackingToken: string; pdfUrl: string; sha256: string }
  | { success: false; error: string; stage: 'upload-signature' | 'pdf' | 'cost-log' | 'email' | 'db-update' };

/**
 * Upload the signature PNG to Storage so downstream components (PDF re-render
 * later, Web viewer) can reference it by URL.
 * Convention: signatures/{org_id}/legal/{doc_id}.png
 */
async function uploadSignatureImage(params: {
  organizationId: string;
  docId: string;
  dataUrlOrBase64: string;
}): Promise<{ url: string; path: string }> {
  // Normalize to raw base64
  const base64 = params.dataUrlOrBase64.replace(/^data:image\/\w+;base64,/, '');
  const path = `signatures/${params.organizationId}/legal/${params.docId}.png`;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage
    .from('field-photos')
    .upload(path, bytes, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`signature upload: ${error.message}`);

  const { data } = supabase.storage.from('field-photos').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/**
 * The end-to-end pipeline. Called by NodSignModal.
 */
export async function signAndSendNod(input: SignAndSendParams): Promise<SignAndSendResult> {
  const { doc, area, organization, project, gc, signer, signatureDataUrl, recipientEmail, additionalNotes } = input;

  // ───────── Stage 1 — Signature image upload ─────────
  let signatureUrl: string;
  try {
    const res = await uploadSignatureImage({
      organizationId: doc.organization_id,
      docId: doc.id,
      dataUrlOrBase64: signatureDataUrl,
    });
    signatureUrl = res.url;
  } catch (e) {
    logger.warn('[Legal] signature upload failed', e);
    return { success: false, error: (e as Error).message, stage: 'upload-signature' };
  }

  // ───────── Stage 2 — Cost log persistence ─────────
  // We compute cost at render time and ALSO save it to delay_cost_logs. The
  // PDF embeds the computed numbers; the DB row preserves them immutably.
  let cost = { crew_size: 0, daily_rate_cents: 0, days_lost: 1, total_cost_cents: 0 };
  let delayLogId: string | null = null;
  if (area.blocked_at) {
    try {
      cost = await computeDelayCost({ areaId: area.id, blockedAt: area.blocked_at });
      const logResult = await persistDelayCostLog({
        organizationId: doc.organization_id,
        projectId: doc.project_id,
        areaId: area.id,
        cost,
      });
      if (logResult.success && logResult.id) delayLogId = logResult.id;
    } catch (e) {
      logger.warn('[Legal] cost log failed (non-fatal)', e);
      // Non-fatal — we can still ship the NOD without cost log. It's a nice-to-have.
    }
  }

  // ───────── Stage 3 — PDF render + upload ─────────
  const provisionalToken = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 14)}`;
  const trackingPixelUrl = `${TRACKING_PIXEL_BASE}${provisionalToken}`;

  const nowIso = new Date().toISOString();
  let pdfUrl: string, sha256Hash: string, localPdfUri: string;
  try {
    const rendered = await renderAndUploadNod(
      {
        doc,
        area: {
          label: area.label,
          name: area.name,
          blocked_reason: area.blocked_reason,
          blocked_at: area.blocked_at,
        },
        cost,
        organization,
        project,
        gc,
        signer: { name: signer.name, title: signer.title },
        signatureDataUrl,
        trackingToken: provisionalToken,
        signedAtIso: nowIso,
        additionalNotes,
      },
      trackingPixelUrl,
    );
    pdfUrl = rendered.pdfUrl;
    sha256Hash = rendered.sha256Hash;
    localPdfUri = rendered.localUri;
  } catch (e) {
    logger.warn('[Legal] PDF render/upload failed', e);
    return { success: false, error: (e as Error).message, stage: 'pdf' };
  }

  // ───────── Stage 4 — Edge Function: send email with tracking token ─────────
  let trackingToken: string = provisionalToken;
  let sentAtIso: string = nowIso;
  try {
    const { data: session } = await supabase.auth.getSession();
    const accessToken = session?.session?.access_token;
    if (!accessToken) throw new Error('no auth session');

    const resp = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-legal-document`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          docId: doc.id,
          organizationId: doc.organization_id,
          recipientEmail,
          recipientName: gc.name,
          senderName: signer.name,
          projectName: project.name,
          gcCompany: gc.name,
          pdfUrl,
          areaLabel: area.label ?? area.name,
          trackingTokenHint: provisionalToken,
        }),
      },
    );

    const payload = (await resp.json().catch(() => ({}))) as { success?: boolean; tracking_token?: string; sent_at?: string; error?: string };
    if (!resp.ok || !payload.success) {
      throw new Error(payload.error ?? `edge fn ${resp.status}`);
    }
    if (payload.tracking_token) trackingToken = payload.tracking_token;
    if (payload.sent_at) sentAtIso = payload.sent_at;
  } catch (e) {
    logger.warn('[Legal] send-legal-document failed', e);
    return { success: false, error: (e as Error).message, stage: 'email' };
  }

  // ───────── Stage 5 — Apply DB transaction ─────────
  const dbResult = await applySignAndSend({
    docId: doc.id,
    signedBy: signer.id,
    sha256Hash,
    pdfUrl,
    recipientEmail,
    recipientName: gc.name,
    sentAt: sentAtIso,
    trackingToken,
    delayLogId: delayLogId ?? doc.id, // FK is nullable but we write delay_cost_logs.id when available
  });

  if (!dbResult.success) {
    logger.error('[Legal] DB update failed AFTER send', dbResult.error);
    // Email was already sent. The DB is inconsistent. Surface clearly.
    return {
      success: false,
      error: `Email was sent but local record update failed: ${dbResult.error}. Contact support; the GC already received the NOD.`,
      stage: 'db-update',
    };
  }

  // Success — discard the local PDF (Supabase has the authoritative copy)
  FileSystem.deleteAsync(localPdfUri, { idempotent: true }).catch(() => undefined);

  return { success: true, trackingToken, pdfUrl, sha256: sha256Hash };
}
