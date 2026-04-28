/**
 * Sprint 71 — Web API client for Deficiencies.
 *
 * Track NEVER inserts into `deficiencies` directly — RLS doesn't allow it
 * for foreman/supervisor roles, and the auto-blindaje rules in the spec
 * §8 explicitly forbid it. All mutations go through Web endpoints, which
 * enforce business rules (e.g. resolve requires resolution_photos > 0,
 * verify requires status='resolved').
 *
 * Auth: bearer token resolved per-call from supabase.auth.getSession() —
 * same pattern as Sprint 69/70. Errors logged + swallowed by the
 * `*AndForget` wrappers; throwing variants exist for the cases where
 * the UI needs to react to success (e.g. show created deficiency on
 * the screen immediately).
 */

import { supabase } from '@/shared/lib/supabase/client';
import { WEB_API_URL } from '@/shared/config/urls';
import { logger } from '@/shared/lib/logger';
import type {
  DeficiencySeverity,
  DeficiencyStage,
  DeficiencyResponsibility,
} from '../types';

async function getBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const token = await getBearer();
  if (!token) throw new Error('deficiencyApiClient: no auth session');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    // Sanitize the error response. JSON bodies surface a useful detail;
    // HTML bodies (e.g. Next.js 404 pages) are dropped from the user
    // message — they're 5KB+ of `<script>` tags that flood the modal.
    const ct = res.headers.get('content-type') ?? '';
    let detail = '';
    try {
      if (ct.includes('application/json')) {
        const body = await res.json();
        detail = (body && (body.error || body.message)) || '';
      } else {
        const text = await res.text().catch(() => '');
        detail = text.length > 200 ? '' : text.trim();
      }
    } catch {
      /* ignore body-parse failures */
    }

    let userMsg: string;
    if (res.status === 404) userMsg = 'This action is not available yet — please contact support if this persists.';
    else if (res.status === 401) userMsg = 'Session expired — please sign out and back in.';
    else if (res.status === 403) userMsg = "You don't have permission to do this.";
    else if (res.status >= 500) userMsg = 'Server error — please try again in a moment.';
    else userMsg = detail || `Request failed (${res.status})`;

    type HttpError = Error & { status?: number; detail?: string; url?: string };
    const e: HttpError = new Error(userMsg);
    e.status = res.status;
    e.detail = detail;
    e.url = url;
    logger.warn('[deficiencyApiClient] HTTP error', { url, status: res.status, detail });
    throw e;
  }
  return res.json() as Promise<T>;
}

export type CreateDeficiencyPayload = {
  projectId: string;
  areaId: string;
  surfaceId?: string;
  title: string;
  description?: string;
  severity?: DeficiencySeverity;
  stage?: DeficiencyStage;
  responsibility?: DeficiencyResponsibility;
  trade?: string;
  category?: string;
  libraryId?: string;
  /** Public Supabase Storage URLs (already uploaded). The endpoint
   * stores them in the `photos` JSONB column verbatim. */
  photos?: string[];
};

export type CreateDeficiencyResult = { success: true; id: string };
export type DeficiencyMutationResult = { ok: true };

/**
 * Foreman creates a new deficiency. Web's create endpoint:
 *   - Resolves library_id → fills missing severity/title/category from template
 *   - Sets status='open', stage='internal_qc' (default)
 *   - Inserts photos[] verbatim (URLs already uploaded by Track)
 *   - Triggers a Sprint 70 todo for the assigned foreman (Phase 2 wiring
 *     coming) and a Sprint 69 notification for the PM if severity=critical
 */
export async function createDeficiencyViaWeb(
  payload: CreateDeficiencyPayload,
): Promise<CreateDeficiencyResult> {
  return postJson<CreateDeficiencyResult>(
    `${WEB_API_URL}/api/deficiencies/create`,
    payload,
  );
}

/**
 * Foreman uploads after-photos and marks the deficiency as resolved.
 * Web flips status to 'resolved' and stamps resolved_at + resolved_by.
 * The auto-blindaje rule (§8) requires at least one resolutionPhotos URL.
 */
export async function resolveDeficiencyViaWeb(
  id: string,
  resolutionPhotos: string[],
): Promise<DeficiencyMutationResult> {
  if (resolutionPhotos.length === 0) {
    throw new Error(
      'resolveDeficiency: at least one resolution photo is required (per spec §8)',
    );
  }
  return postJson<DeficiencyMutationResult>(
    `${WEB_API_URL}/api/deficiencies/${id}/resolve`,
    { resolutionPhotos },
  );
}

/** PM/supervisor verifies the resolution → status='verified'. */
export async function verifyDeficiencyViaWeb(
  id: string,
): Promise<DeficiencyMutationResult> {
  return postJson<DeficiencyMutationResult>(
    `${WEB_API_URL}/api/deficiencies/${id}/verify`,
  );
}

/** PM/supervisor rejects the resolution with a reason → status='in_progress',
 * rejected_reason filled. Foreman gets a new todo to redo the work. */
export async function rejectDeficiencyViaWeb(
  id: string,
  reason: string,
): Promise<DeficiencyMutationResult> {
  return postJson<DeficiencyMutationResult>(
    `${WEB_API_URL}/api/deficiencies/${id}/reject`,
    { reason },
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bulk export to GC (Web Sprint 71 Phase 3 — `/api/deficiencies/bulk-export`)
//
// Single endpoint handles both modes: bundle PDF only, or bundle PDF +
// email to GC. Per-deficiency "Send to GC" calls the same endpoint with
// deficiencyIds: [oneId] — Web doesn't differentiate.
//
// Server-side validation: deficiencies must all be from the same project
// (else 400), all visible to the user's org via RLS (else 404), 1-200 ids.
// On sendTo: Web's "Hybrid Sender" sends from the PM's identity (Reply-To
// is their work_email), so GC replies go directly to the PM, not Track.
//
// Returns ALWAYS JSON (no binary). pdfUrl is a public link in
// `pm-documents` bucket — Track can preview / share / save without
// re-fetching from the API. SHA-256 is court-admissible integrity proof
// for legal traceability (matches the NOD pattern from Sprint 53C).
// ─────────────────────────────────────────────────────────────────────────

export type ExportRecipient = {
  email: string;
  name?: string | null;
  company?: string | null;
};

export type BulkExportPayload = {
  deficiencyIds: string[];
  /** Defaults to "Deficiency Report (N items)" server-side if omitted. */
  title?: string;
  /**
   * If present, Web sends the PDF via email (Hybrid Sender from PM identity).
   * If null/undefined, only generates PDF — Track gets the URL back to
   * preview/share via expo-sharing without an email round-trip.
   */
  sendTo?: ExportRecipient | null;
};

export type BulkExportResult = {
  ok: true;
  /** Public Supabase Storage URL in pm-documents bucket — preview/share. */
  pdfUrl: string;
  /** 64-char SHA-256 of the PDF bytes. Stamp on the cover for integrity. */
  sha256: string;
  count: number;
  projectId: string;
  /** Present only if sendTo was in the request and email succeeded. */
  sentTo: ExportRecipient | null;
};

/**
 * Bundle one or more deficiencies into a single PDF, optionally email it
 * to a GC contact. Server validates all-from-same-project + visibility.
 */
export async function bulkExportDeficiencies(
  payload: BulkExportPayload,
): Promise<BulkExportResult> {
  if (payload.deficiencyIds.length === 0) {
    throw new Error('bulkExportDeficiencies: at least one deficiency id required');
  }
  if (payload.deficiencyIds.length > 200) {
    throw new Error('bulkExportDeficiencies: max 200 ids per bundle');
  }
  return postJson<BulkExportResult>(
    `${WEB_API_URL}/api/deficiencies/bulk-export`,
    payload,
  );
}

// ─── Fire-and-forget wrappers ─────────────────────────────────────────────
// Use these from screens where the user shouldn't block on the API call.
// Same pattern as notifyAndForget / autoCompleteAndForget.

export function verifyAndForget(id: string): void {
  verifyDeficiencyViaWeb(id).catch((err) => {
    logger.warn('[deficiencies] verify failed (non-fatal)', err);
  });
}

export function rejectAndForget(id: string, reason: string): void {
  rejectDeficiencyViaWeb(id, reason).catch((err) => {
    logger.warn('[deficiencies] reject failed (non-fatal)', err);
  });
}
