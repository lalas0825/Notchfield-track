/**
 * Sprint 53C — Sign + Send orchestrator (Option B: Web endpoint).
 *
 * Architecture (post-Zoho alignment):
 *   Track renders PDF locally (expo-print) and uploads to Supabase Storage.
 *   Track then calls Takeoff Web's distribute endpoint:
 *     POST {WEB_API_URL}/api/pm/legal-documents/{docId}/distribute
 *   Web's endpoint:
 *     - Fetches the PDF from the URL we provide
 *     - Sends via their Zoho SMTP sendEmail() (single source of email truth)
 *     - Generates tracking_token + embeds tracking pixel URL in HTML body
 *     - Returns { sent_at, tracking_token }
 *   Track then writes the DB transaction (applySignAndSend).
 *
 * Why this shape:
 *   - Don't duplicate Zoho SMTP credentials across Track + Web
 *   - Web owns the email pipeline (same sendEmail() used by Safety distribute)
 *   - Track still owns the PDF render (local, offline-safe during draft)
 *
 * Blocker: the Web endpoint MUST exist for Legal send to work. See
 * SPRINT_53_TAKEOFF_COORDINATION.md §2.1 for the contract Web needs to ship.
 * Until then, NODs can be drafted in Track but "Sign & Send" will 404.
 */

import { supabase } from '@/shared/lib/supabase/client';
import * as FileSystem from 'expo-file-system/legacy';
import { applySignAndSend, type LegalDoc } from './legal-service';
import { computeDelayCost, persistDelayCostLog } from './costEngine';
import { renderAndUploadNod } from './nodPdfRenderer';
import { WEB_API_URL } from '@/shared/config/urls';
import { logger } from '@/shared/lib/logger';

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
 * Signature PNG uploaded separately so downstream renderers (future Web
 * server-side render) can reference by URL.
 * Path: signatures/{org_id}/legal/{doc_id}.png
 */
async function uploadSignatureImage(params: {
  organizationId: string;
  docId: string;
  dataUrlOrBase64: string;
}): Promise<{ url: string; path: string }> {
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
 * End-to-end pipeline. Called by NodSignModal.
 */
export async function signAndSendNod(input: SignAndSendParams): Promise<SignAndSendResult> {
  const { doc, area, organization, project, gc, signer, signatureDataUrl, recipientEmail, additionalNotes } = input;

  // ───────── Stage 1 — Signature image upload ─────────
  try {
    await uploadSignatureImage({
      organizationId: doc.organization_id,
      docId: doc.id,
      dataUrlOrBase64: signatureDataUrl,
    });
  } catch (e) {
    logger.warn('[Legal] signature upload failed', e);
    return { success: false, error: (e as Error).message, stage: 'upload-signature' };
  }

  // ───────── Stage 2 — Cost log persistence ─────────
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
      // Non-fatal — NOD still ships without the cost log
      logger.warn('[Legal] cost log failed (non-fatal)', e);
    }
  }

  // ───────── Stage 3 — PDF render + upload + SHA-256 ─────────
  const nowIso = new Date().toISOString();
  let pdfUrl: string, sha256Hash: string, localPdfUri: string;
  try {
    const rendered = await renderAndUploadNod({
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
      signedAtIso: nowIso,
      additionalNotes,
    });
    pdfUrl = rendered.pdfUrl;
    sha256Hash = rendered.sha256Hash;
    localPdfUri = rendered.localUri;
  } catch (e) {
    logger.warn('[Legal] PDF render/upload failed', e);
    return { success: false, error: (e as Error).message, stage: 'pdf' };
  }

  // ───────── Stage 4 — Call Takeoff Web distribute endpoint ─────────
  // Web team owns the Zoho SMTP pipeline + tracking pixel generation.
  // They return { sent_at, tracking_token }; Track writes both to the DB.
  let trackingToken: string = '';
  let sentAtIso: string = nowIso;
  try {
    const { data: session } = await supabase.auth.getSession();
    const accessToken = session?.session?.access_token;
    if (!accessToken) throw new Error('no auth session');

    const distributeUrl = `${WEB_API_URL}/api/pm/legal-documents/${doc.id}/distribute`;
    const resp = await fetch(distributeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipientEmail,
        recipientName: gc.name || null,
        senderName: signer.name,
        senderTitle: signer.title,
        projectName: project.name,
        gcCompany: gc.name,
        areaLabel: area.label ?? area.name,
        pdfUrl,
        pdfSha256: sha256Hash,
        oshaCitationsIncluded: false, // v1 — future toggle
      }),
    });

    // 404 — endpoint should be live (Web shipped 2026-04-25 commit cc16f75).
    // If we hit this in the field, Web rolled back or the WEB_API_URL is
    // pointing somewhere wrong (e.g. staging build with stale env var).
    if (resp.status === 404) {
      return {
        success: false,
        error: 'Legal distribute endpoint not found on Takeoff Web. Check EXPO_PUBLIC_WEB_API_URL points at the correct Web deploy.',
        stage: 'email',
      };
    }

    // 409 — server rejected because the doc is no longer in draft status.
    // Most common cause: another supervisor already sent this NOD on a
    // different device, and PowerSync hasn't synced the new status yet.
    if (resp.status === 409) {
      return {
        success: false,
        error: 'This NOD has already been sent (or is no longer a draft). Pull to refresh and check the latest status.',
        stage: 'email',
      };
    }

    const payload = (await resp.json().catch(() => ({}))) as {
      success?: boolean;
      tracking_token?: string;
      sent_at?: string;
      error?: string;
    };

    if (!resp.ok || !payload.success) {
      throw new Error(payload.error ?? `distribute endpoint ${resp.status}`);
    }
    if (!payload.tracking_token) {
      throw new Error('Web endpoint did not return tracking_token');
    }
    trackingToken = payload.tracking_token;
    if (payload.sent_at) sentAtIso = payload.sent_at;
  } catch (e) {
    logger.warn('[Legal] Web distribute endpoint failed', e);
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
    delayLogId: delayLogId ?? doc.id,
  });

  if (!dbResult.success) {
    logger.error('[Legal] DB update failed AFTER send', dbResult.error);
    // Email was already sent. DB inconsistent. Surface clearly.
    return {
      success: false,
      error: `Email was sent but local record update failed: ${dbResult.error}. Contact support; the GC already received the NOD.`,
      stage: 'db-update',
    };
  }

  // Success — discard local PDF (Supabase has the authoritative copy)
  FileSystem.deleteAsync(localPdfUri, { idempotent: true }).catch(() => undefined);

  return { success: true, trackingToken, pdfUrl, sha256: sha256Hash };
}
