/**
 * PTP service — create, update, sign, and distribute Pre-Task Plans.
 *
 * Track writes to the SAME `safety_documents` row the PM sees in Takeoff web.
 * There is no sync layer. Writes go through PowerSync local SQLite first so
 * the flow works offline; PowerSync uploads to Supabase when online.
 */

import { supabase } from '@/shared/lib/supabase/client';
import {
  localInsert,
  localUpdate,
  localQuery,
  generateUUID,
} from '@/shared/lib/powersync/write';
import { forceSync } from '@/shared/lib/powersync/client';
import {
  PtpContentSchema,
  PtpSignatureSchema,
  type PtpContent,
  type PtpSignature,
  type SafetyDocument,
  type Trade,
} from '../types';

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseSafetyDocRow(row: Record<string, unknown>): SafetyDocument | null {
  if (!row || !row.id) return null;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    organization_id: row.organization_id as string,
    number: (row.number as number | undefined) ?? undefined,
    doc_type: row.doc_type as SafetyDocument['doc_type'],
    title: row.title as string,
    content: parseJson<Record<string, unknown>>(row.content, {}),
    status: (row.status as SafetyDocument['status']) ?? 'draft',
    signatures: parseJson<PtpSignature[]>(row.signatures, []),
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  };
}

// ───────────────────────────────────────────────────────────
// Create + Read
// ───────────────────────────────────────────────────────────

export type CreateDraftParams = {
  organizationId: string;
  projectId: string;
  foremanId: string;
  foremanName: string;
  trade: Trade;
  areaId?: string | null;
  areaLabel?: string;
  date: string; // ISO yyyy-mm-dd
  shift?: 'day' | 'night' | 'weekend';
  emergency?: PtpContent['emergency'];
};

/**
 * Create a draft PTP row. Returns the new document id.
 *
 * Title mirrors Takeoff's convention: `${trade} PTP — ${areaLabel} — ${date}`.
 * Rows are created in `status='draft'` — downstream screens mutate `content`
 * and `signatures` until distribution.
 */
export async function createDraftPtp(
  params: CreateDraftParams,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const id = generateUUID();
  const now = new Date().toISOString();

  const content: PtpContent = PtpContentSchema.parse({
    area_id: params.areaId ?? null,
    area_label: params.areaLabel ?? '',
    ptp_date: params.date,
    shift: params.shift ?? 'day',
    weather: null,
    trade: params.trade,
    selected_tasks: [],
    additional_hazards: [],
    emergency: params.emergency ?? null,
    foreman_id: params.foremanId,
    foreman_name: params.foremanName,
    foreman_gps: null,
    additional_notes: '',
    photo_urls: [],
    osha_citations_included: true,
  });

  const titlePieces = [
    params.trade.charAt(0).toUpperCase() + params.trade.slice(1),
    'PTP',
    params.areaLabel ? `— ${params.areaLabel}` : '',
    `— ${params.date}`,
  ].filter(Boolean);

  const result = await localInsert('safety_documents', {
    id,
    project_id: params.projectId,
    organization_id: params.organizationId,
    doc_type: 'ptp',
    title: titlePieces.join(' ').trim(),
    status: 'draft',
    content,
    signatures: [],
    created_by: params.foremanId,
    created_at: now,
    // updated_at is managed by a trigger in Supabase
  });

  if (!result.success) return { success: false, error: result.error };

  // Flush the PowerSync upload queue so the draft reaches Supabase before
  // the user can sign and distribute. Without this the row can sit in
  // local SQLite while the foreman signs + taps Distribute, and the
  // distribute endpoint 404s on a doc that "doesn't exist" server-side.
  // Non-fatal: if offline, PowerSync retries automatically, and
  // distributeService does its own preflight flush as a second belt.
  try {
    await forceSync();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[createDraftPtp] forceSync failed (non-fatal):', err);
  }

  return { success: true, id };
}

export async function getPtpById(docId: string): Promise<SafetyDocument | null> {
  const local = await localQuery<Record<string, unknown>>(
    `SELECT * FROM safety_documents WHERE id = ? LIMIT 1`,
    [docId],
  );
  if (local && local.length > 0) {
    return parseSafetyDocRow(local[0]);
  }
  const { data } = await supabase
    .from('safety_documents')
    .select('*')
    .eq('id', docId)
    .maybeSingle();
  return data ? parseSafetyDocRow(data as Record<string, unknown>) : null;
}

/**
 * Most recent PTP by the same foreman for the same area within the last N days.
 * Used by the "Copy from yesterday" entry point on Screen 1.
 */
export async function getYesterdaysPtp(
  foremanId: string,
  areaId: string,
  days = 2,
): Promise<SafetyDocument | null> {
  // Local first — search JSON content->area_id. SQLite doesn't support JSON
  // operators, so we read all ptp rows and filter in JS. Acceptable because
  // most foremen have very few recent drafts.
  const local = await localQuery<Record<string, unknown>>(
    `SELECT * FROM safety_documents
     WHERE doc_type = 'ptp'
       AND created_by = ?
       AND datetime(created_at) >= datetime('now', ?)
     ORDER BY created_at DESC`,
    [foremanId, `-${days} days`],
  );

  if (local) {
    for (const row of local) {
      const doc = parseSafetyDocRow(row);
      if (!doc) continue;
      const contentAreaId = (doc.content as PtpContent).area_id;
      if (contentAreaId === areaId) return doc;
    }
    return null;
  }

  // Web / server fallback — JSON operator query.
  const { data } = await supabase
    .from('safety_documents')
    .select('*')
    .eq('doc_type', 'ptp')
    .eq('created_by', foremanId)
    .eq('content->>area_id', areaId)
    .gte('created_at', new Date(Date.now() - days * 24 * 3600 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? parseSafetyDocRow(data as Record<string, unknown>) : null;
}

// ───────────────────────────────────────────────────────────
// Mutations
// ───────────────────────────────────────────────────────────

export async function updatePtpContent(
  docId: string,
  content: PtpContent,
): Promise<{ success: boolean; error?: string }> {
  const parsed = PtpContentSchema.safeParse(content);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid content' };
  }
  return localUpdate('safety_documents', docId, { content: parsed.data });
}

/**
 * Append a signature to the document's signatures JSONB array.
 *
 * Race note: sequential device handoff means two signatures rarely land at
 * once. If they do, last-write-wins is acceptable per §4.2 of the sprint.
 */
export async function appendSignature(
  docId: string,
  signature: PtpSignature,
): Promise<{ success: boolean; error?: string }> {
  const parsed = PtpSignatureSchema.safeParse(signature);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid signature' };
  }

  const doc = await getPtpById(docId);
  if (!doc) return { success: false, error: 'PTP not found' };

  const existing = Array.isArray(doc.signatures) ? doc.signatures : [];
  const next = [...existing, parsed.data];
  return localUpdate('safety_documents', docId, { signatures: next });
}

export async function removeSignature(
  docId: string,
  index: number,
): Promise<{ success: boolean; error?: string }> {
  const doc = await getPtpById(docId);
  if (!doc) return { success: false, error: 'PTP not found' };
  const next = [...(doc.signatures ?? [])];
  next.splice(index, 1);
  return localUpdate('safety_documents', docId, { signatures: next });
}

/**
 * Flip the DB status column. The enum is narrow: {draft, active, completed}.
 * Distribution is NOT a status — distributeService stamps
 * `content.distribution.distributed_at` instead.
 */
export async function setPtpStatus(
  docId: string,
  status: 'draft' | 'active' | 'completed',
): Promise<{ success: boolean; error?: string }> {
  return localUpdate('safety_documents', docId, { status });
}

/**
 * Merge a partial content patch into the existing JSONB content. Used by
 * distributeService to write the distribution block without clobbering
 * selected_tasks / signatures / etc.
 */
export async function patchPtpContent(
  docId: string,
  patch: Partial<PtpContent>,
): Promise<{ success: boolean; error?: string }> {
  const doc = await getPtpById(docId);
  if (!doc) return { success: false, error: 'PTP not found' };
  const merged = { ...(doc.content as PtpContent), ...patch };
  return localUpdate('safety_documents', docId, { content: merged });
}
