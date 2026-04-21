/**
 * Toolbox service — library read, delivery history, schedule overrides,
 * PTP-tag signal extraction. All reads are offline-first via PowerSync.
 *
 * Writes happen through the generic `safety_documents` path (see
 * saveDelivery / distributeToolbox). The library itself is PM-owned in
 * Takeoff web; Track only reads.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { localQuery, localInsert, generateUUID } from '@/shared/lib/powersync/write';
import { setPtpStatus, patchPtpContent } from '@/features/safety/ptp/services/ptpService';
import {
  ToolboxContentSchema,
  ToolboxLibraryTopic,
  type ToolboxContent,
  type ToolboxDelivery,
  type ToolboxScheduleOverride,
} from '../types';

type Raw = Record<string, unknown>;

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

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

function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === '1';
}

function normalizeTopic(row: Raw): ToolboxLibraryTopic | null {
  try {
    return ToolboxLibraryTopic.parse({
      id: row.id as string,
      organization_id: (row.organization_id as string | null) ?? null,
      project_id: (row.project_id as string | null) ?? null,
      trade: parseJsonArray(row.trade),
      title: row.title as string,
      title_es: (row.title_es as string | null) ?? null,
      slug: row.slug as string,
      why_it_matters: row.why_it_matters as string,
      why_it_matters_es: (row.why_it_matters_es as string | null) ?? null,
      key_points: parseJsonArray(row.key_points),
      key_points_es: row.key_points_es ? parseJsonArray(row.key_points_es) : null,
      discussion_questions: parseJsonArray(row.discussion_questions),
      discussion_questions_es: row.discussion_questions_es
        ? parseJsonArray(row.discussion_questions_es)
        : null,
      osha_ref: (row.osha_ref as string | null) ?? null,
      category: row.category as string,
      tags: parseJsonArray(row.tags),
      season: parseJsonArray(row.season),
      source: (row.source as string | null) ?? null,
      active: toBool(row.active),
    });
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[toolbox] dropped malformed library row', row.id);
    return null;
  }
}

/**
 * All topics visible to the foreman — global rows (org NULL) plus the
 * foreman's org. RLS on Supabase mirrors this; the local DB may include
 * stale rows if the sync hasn't caught up yet, which is fine.
 */
export async function getToolboxLibrary(orgId: string): Promise<ToolboxLibraryTopic[]> {
  const local = await localQuery<Raw>(
    `SELECT * FROM toolbox_library
     WHERE active = 1
       AND (organization_id IS NULL OR organization_id = ?)
     ORDER BY title`,
    [orgId],
  );
  if (local !== null) {
    return local.map(normalizeTopic).filter((t): t is ToolboxLibraryTopic => t !== null);
  }

  const { data } = await supabase
    .from('toolbox_library')
    .select('*')
    .eq('active', true)
    .or(`organization_id.is.null,organization_id.eq.${orgId}`)
    .order('title');
  return (data ?? [])
    .map((r) => normalizeTopic(r as Raw))
    .filter((t): t is ToolboxLibraryTopic => t !== null);
}

export async function getRecentDeliveries(
  projectId: string,
  weeksBack: number,
): Promise<ToolboxDelivery[]> {
  const cutoff = new Date(Date.now() - weeksBack * 7 * 24 * 3600 * 1000).toISOString();

  const local = await localQuery<Raw>(
    `SELECT id, content, created_at FROM safety_documents
     WHERE doc_type = 'toolbox'
       AND project_id = ?
       AND created_at >= ?
     ORDER BY created_at DESC`,
    [projectId, cutoff],
  );

  const rows: Raw[] =
    local ??
    ((
      await supabase
        .from('safety_documents')
        .select('id, content, created_at')
        .eq('doc_type', 'toolbox')
        .eq('project_id', projectId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
    ).data ?? []);

  const out: ToolboxDelivery[] = [];
  for (const r of rows) {
    const content = parseJson<Record<string, unknown>>(r.content, {});
    const snap = content.topic_snapshot as
      | { toolbox_library_id?: string; slug?: string }
      | undefined;
    if (!snap?.toolbox_library_id) continue;
    out.push({
      toolbox_library_id: snap.toolbox_library_id,
      slug: snap.slug ?? '',
      delivered_date:
        (content.delivered_date as string | undefined) ??
        (r.created_at as string).slice(0, 10),
    });
  }
  return out;
}

export async function getWeeklyOverride(
  projectId: string,
  weekStartIso: string,
): Promise<ToolboxScheduleOverride | null> {
  const local = await localQuery<Raw>(
    `SELECT * FROM toolbox_schedule_overrides
     WHERE project_id = ? AND week_start_date = ?
     LIMIT 1`,
    [projectId, weekStartIso],
  );
  if (local && local.length > 0) {
    const row = local[0];
    return {
      id: row.id as string,
      organization_id: row.organization_id as string,
      project_id: row.project_id as string,
      week_start_date: row.week_start_date as string,
      topic_id: row.topic_id as string,
      set_by: (row.set_by as string | null) ?? null,
      reason: (row.reason as string | null) ?? null,
    };
  }

  const { data } = await supabase
    .from('toolbox_schedule_overrides')
    .select('*')
    .eq('project_id', projectId)
    .eq('week_start_date', weekStartIso)
    .maybeSingle();
  return data
    ? {
        id: data.id as string,
        organization_id: data.organization_id as string,
        project_id: data.project_id as string,
        week_start_date: data.week_start_date as string,
        topic_id: data.topic_id as string,
        set_by: (data.set_by as string | null) ?? null,
        reason: (data.reason as string | null) ?? null,
      }
    : null;
}

/**
 * Pull hazard names from the last N weeks of PTPs as a scheduler signal.
 * Matches Takeoff's `getRecentPtpTags` — reads `content.selected_tasks[].hazards[].name`.
 */
export async function getRecentPtpTags(
  projectId: string,
  weeksBack: number,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - weeksBack * 7 * 24 * 3600 * 1000).toISOString();

  const local = await localQuery<Raw>(
    `SELECT content FROM safety_documents
     WHERE doc_type = 'ptp'
       AND project_id = ?
       AND created_at >= ?`,
    [projectId, cutoff],
  );
  const rows: Raw[] =
    local ??
    ((
      await supabase
        .from('safety_documents')
        .select('content')
        .eq('doc_type', 'ptp')
        .eq('project_id', projectId)
        .gte('created_at', cutoff)
    ).data ?? []);

  const tags = new Set<string>();
  for (const r of rows) {
    const content = parseJson<Record<string, unknown>>(r.content, {});
    const tasks = (content.selected_tasks as Array<{ hazards?: { name: string }[] }>) ?? [];
    for (const t of tasks) {
      for (const h of t.hazards ?? []) {
        if (h.name) tags.add(h.name.toLowerCase().trim());
      }
    }
  }
  return [...tags];
}

/**
 * Any toolbox already delivered this week for this project? UI uses this to
 * block double-delivery.
 */
export async function getThisWeeksDelivery(
  projectId: string,
  weekStartIso: string,
): Promise<{ id: string; status: string; content: Record<string, unknown> } | null> {
  const local = await localQuery<Raw>(
    `SELECT id, status, content FROM safety_documents
     WHERE doc_type = 'toolbox'
       AND project_id = ?
       AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId, weekStartIso],
  );
  if (local && local.length > 0) {
    return {
      id: local[0].id as string,
      status: local[0].status as string,
      content: parseJson<Record<string, unknown>>(local[0].content, {}),
    };
  }

  const { data } = await supabase
    .from('safety_documents')
    .select('id, status, content')
    .eq('doc_type', 'toolbox')
    .eq('project_id', projectId)
    .gte('created_at', weekStartIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        id: data.id as string,
        status: data.status as string,
        content: parseJson<Record<string, unknown>>(data.content, {}),
      }
    : null;
}

// ─── Delivery mutations ──────────────────────────────────

export type CreateDraftParams = {
  organizationId: string;
  projectId: string;
  foremanProfileId: string;
  content: ToolboxContent;
};

/** Create the safety_documents draft row for a toolbox talk. */
export async function createDraftToolbox(
  params: CreateDraftParams,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = ToolboxContentSchema.safeParse(params.content);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid content' };
  }

  const id = generateUUID();
  const now = new Date().toISOString();

  const result = await localInsert('safety_documents', {
    id,
    project_id: params.projectId,
    organization_id: params.organizationId,
    doc_type: 'toolbox',
    title: parsed.data.topic_snapshot.title,
    status: 'draft',
    content: parsed.data,
    signatures: [],
    // safety_documents FK wants profiles.id here (not workers.id) so we
    // pass the foreman's profile explicitly. `content.foreman_id` keeps
    // the workers.id per Sprint MANPOWER convention.
    created_by: params.foremanProfileId,
    created_at: now,
  });

  if (!result.success) return { success: false, error: result.error };

  // forceSync is intentionally NOT called here — see createDraftPtp for
  // the full rationale. Short version: manual flush races PowerSync's
  // own uploader and burns SERIAL numbers. The distribute preflight is
  // the single belt.
  return { success: true, id };
}

/**
 * Convenience helper mirroring ptpService.patchPtpContent + setPtpStatus.
 * The same primitives already work for any safety_documents row.
 */
export async function patchToolboxContent(
  docId: string,
  patch: Partial<ToolboxContent>,
): Promise<{ success: boolean; error?: string }> {
  return patchPtpContent(docId, patch as unknown as Record<string, unknown>);
}

export async function setToolboxStatus(
  docId: string,
  status: 'draft' | 'active' | 'completed',
): Promise<{ success: boolean; error?: string }> {
  return setPtpStatus(docId, status);
}
