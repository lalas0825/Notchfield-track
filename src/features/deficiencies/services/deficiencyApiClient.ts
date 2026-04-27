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
    const err = await res.text().catch(() => '');
    throw new Error(`${url} ${res.status}: ${err}`);
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
