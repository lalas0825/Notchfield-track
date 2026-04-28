/**
 * Sprint 72 — Web API client for Sign-Offs.
 *
 * Track NEVER inserts into `signoff_documents` or `signoff_areas` directly —
 * RLS doesn't allow it for foreman/supervisor roles, and the auto-blindaje
 * rules in §10 forbid it. All mutations go through Web endpoints, which
 * enforce business rules:
 *   - create: pre-renders body with snapshot substitutions, snapshots
 *     required_evidence_snapshot, validates evidence labels against rules
 *   - send: validates required evidence is satisfied (label exact-match),
 *     generates token, fans out notifications + todos
 *   - sign-in-person: bypasses token (PM authenticates), flips status to
 *     signed, fires PDF render fire-and-forget
 *
 * Auth: bearer token resolved per-call from supabase.auth.getSession() —
 * same pattern as Sprint 69/70/71.
 *
 * Errors are sanitized (HTML 404 pages dropped, status mapped to user
 * messages) — same pattern as deficiencyApiClient.postJson, copied
 * verbatim. The detail is preserved on `err.detail` for logger.warn.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { WEB_API_URL } from '@/shared/config/urls';
import { logger } from '@/shared/lib/logger';
import type {
  SignoffSignerRole,
  SignoffStatusAfterSign,
  SignoffEvidenceType,
} from '../types';

async function getBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const token = await getBearer();
  if (!token) throw new Error('signoffApiClient: no auth session');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const ct = res.headers.get('content-type') ?? '';
    let detail = '';
    try {
      if (ct.includes('application/json')) {
        const b = await res.json();
        detail = (b && (b.error || b.message)) || '';
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
    logger.warn('[signoffApiClient] HTTP error', { url, status: res.status, detail });
    throw e;
  }
  return res.json() as Promise<T>;
}

// ─── Create ───────────────────────────────────────────────────────────────

export type CreateSignoffArea = {
  areaId: string;
  surfaceId?: string;
  /** Optional snapshot label for display when the area is renamed later. */
  label?: string;
};

export type CreateSignoffEvidence = {
  url: string;
  type: SignoffEvidenceType;
  /** MUST exact-match a rule's label for server-side validation on send.
   * Use slot-based UI (one upload card per rule) — never let the foreman
   * type the label. */
  label: string;
  reading_value?: number;
};

export type CreateSignoffPayload = {
  projectId: string;
  /** Omit for ad-hoc (will require title, signerRole, trade, requiredEvidence). */
  templateId?: string;
  areas: CreateSignoffArea[];
  evidence?: CreateSignoffEvidence[];
  /** Polish R2 — extra context shown in PDF + signing page. */
  notes?: string | null;
  /**
   * Polish R1 — pre-rendered body with ${gc} substituted (or left blank).
   * Server will use this verbatim if provided; otherwise renders with
   * SIGNOFF_BLANK_LINE underlines for missing values.
   */
  body?: string;
  // Ad-hoc only fields (when templateId omitted):
  title?: string;
  signerRole?: SignoffSignerRole;
  trade?: string;
  requiredEvidence?: { type: SignoffEvidenceType; label: string; required: boolean }[];
  statusAfterSign?: SignoffStatusAfterSign;
};

export type CreateSignoffResult = {
  success: true;
  id: string;
  number: number;
};

export async function createSignoffViaWeb(
  payload: CreateSignoffPayload,
): Promise<CreateSignoffResult> {
  return postJson<CreateSignoffResult>(
    `${WEB_API_URL}/api/signoffs/create`,
    payload,
  );
}

// ─── Send for signature ───────────────────────────────────────────────────

export type SendSignoffPayload = {
  recipientEmail?: string;
  recipientName?: string;
  recipientCompany?: string;
  /** Default 14 days server-side. */
  expiresInDays?: number;
};

export type SendSignoffResult = {
  ok: true;
  /** Public sign URL: ${WEB_URL}/sign/${token} */
  token: string;
};

export async function sendSignoffViaWeb(
  id: string,
  payload: SendSignoffPayload,
): Promise<SendSignoffResult> {
  return postJson<SendSignoffResult>(
    `${WEB_API_URL}/api/signoffs/${id}/send`,
    payload,
  );
}

// ─── Decline ──────────────────────────────────────────────────────────────

export type SignoffMutationResult = { ok: true };

export async function declineSignoffViaWeb(
  id: string,
  reason: string,
): Promise<SignoffMutationResult> {
  return postJson<SignoffMutationResult>(
    `${WEB_API_URL}/api/signoffs/${id}/decline`,
    { reason },
  );
}

// ─── Sign in person ───────────────────────────────────────────────────────
// PM/foreman hands iPad to GC standing there. Bypasses the public-token
// flow entirely — PM is the authenticated user. Server enforces required
// evidence client-side too: Track must verify required photos are uploaded
// BEFORE calling this (auto-blindaje §10).

export type SignInPersonPayload = {
  signerName: string;
  signerCompany?: string;
  /** Data URL of the captured signature (`data:image/png;base64,...`). */
  signatureDataUrl: string;
};

export async function signInPersonViaWeb(
  id: string,
  payload: SignInPersonPayload,
): Promise<SignoffMutationResult> {
  return postJson<SignoffMutationResult>(
    `${WEB_API_URL}/api/signoffs/${id}/sign-in-person`,
    payload,
  );
}

// ─── Fire-and-forget wrappers ─────────────────────────────────────────────

export function declineAndForget(id: string, reason: string): void {
  declineSignoffViaWeb(id, reason).catch((err) => {
    logger.warn('[signoffs] decline failed (non-fatal)', err);
  });
}
