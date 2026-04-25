/**
 * Sprint 53A — Messages service.
 * Local-first writes via PowerSync, Supabase fallback for web.
 *
 * NOTE: Web team confirmed Track is first mover. No API wrapper needed.
 * RLS handles auth: org members can read, only authenticated user can insert
 * with their own sender_id (existing org-scoped policy on field_messages).
 *
 * Photos: composer enqueues to photo-queue (context_type='general' bound to
 * the message via post-write update). For v1, simple — photos[] in the
 * message row is a JSON array of remote storage URLs (or local URIs while
 * pending upload). Photo-queue worker handles the lifecycle.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localQuery, generateUUID } from '@/shared/lib/powersync/write';
import type { FieldMessage, MessageType } from '../types';
import { isSystemMessage, stripSystemPrefix } from '../types';

type RawRow = Record<string, unknown>;

/**
 * Parse a raw DB row (PowerSync local OR Supabase REST) into a typed FieldMessage.
 * - photos JSONB → string[]
 * - tags is_system + strips [SYS:..] prefix from body for display
 */
function rowToMessage(row: RawRow): FieldMessage {
  const photos = parseJsonArray(row.photos);
  const rawBody = (row.message as string) ?? '';
  const sys = isSystemMessage(rawBody);

  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    project_id: row.project_id as string,
    area_id: (row.area_id as string | null) ?? null,
    sender_id: row.sender_id as string,
    message_type: (row.message_type as MessageType) ?? 'info',
    message: sys ? stripSystemPrefix(rawBody) : rawBody,
    photos,
    created_at: row.created_at as string,
    sender_name: (row.sender_name as string | null) ?? null,
    sender_role: (row.sender_role as string | null) ?? null,
    area_label: (row.area_label as string | null) ?? null,
    is_system: sys,
  };
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
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

/**
 * Read messages for an area — most recent first, capped at limit.
 * If areaId is null, reads project-level messages (the "General" channel).
 *
 * Local-first: pulls from PowerSync SQLite, falls back to Supabase if local
 * is empty (e.g. fresh install before first sync).
 */
export async function listAreaMessages(params: {
  projectId: string;
  areaId: string | null;
  limit?: number;
}): Promise<FieldMessage[]> {
  const { projectId, areaId, limit = 50 } = params;

  // Local query — paramtetrize area_id IS NULL vs = to keep the SQL simple
  const localSql = areaId
    ? `SELECT * FROM field_messages
         WHERE project_id = ? AND area_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
    : `SELECT * FROM field_messages
         WHERE project_id = ? AND area_id IS NULL
         ORDER BY created_at DESC
         LIMIT ?`;
  const localArgs = areaId ? [projectId, areaId, limit] : [projectId, limit];

  const local = await localQuery<RawRow>(localSql, localArgs);

  if (local && local.length > 0) {
    // Sort ascending for thread display (oldest at top)
    return local.map(rowToMessage).reverse();
  }

  // Web/empty fallback — direct Supabase
  let q = supabase
    .from('field_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  q = areaId ? q.eq('area_id', areaId) : q.is('area_id', null);

  const { data } = await q;
  return ((data ?? []) as RawRow[]).map(rowToMessage).reverse();
}

/**
 * Resolve display fields (sender_name, area_label) for a list of messages.
 * Two batched queries against profiles + production_areas. Local-first.
 */
export async function hydrateMessageDisplayFields(
  messages: FieldMessage[],
): Promise<FieldMessage[]> {
  if (messages.length === 0) return messages;

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const areaIds = [...new Set(messages.map((m) => m.area_id).filter(Boolean) as string[])];

  // Sender names — local first
  const sendersLocal = await localQuery<RawRow>(
    `SELECT id, full_name, role FROM profiles WHERE id IN (${senderIds.map(() => '?').join(',')})`,
    senderIds,
  );
  let senders = sendersLocal ?? [];
  if (senders.length === 0 && senderIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', senderIds);
    senders = (data ?? []) as RawRow[];
  }
  const senderMap = new Map(senders.map((s) => [s.id as string, s]));

  // Area labels — local first
  let areas: RawRow[] = [];
  if (areaIds.length > 0) {
    const areasLocal = await localQuery<RawRow>(
      `SELECT id, label, name FROM production_areas WHERE id IN (${areaIds.map(() => '?').join(',')})`,
      areaIds,
    );
    areas = areasLocal ?? [];
    if (areas.length === 0) {
      const { data } = await supabase
        .from('production_areas')
        .select('id, label, name')
        .in('id', areaIds);
      areas = (data ?? []) as RawRow[];
    }
  }
  const areaMap = new Map(areas.map((a) => [a.id as string, a]));

  return messages.map((m) => {
    const sender = senderMap.get(m.sender_id);
    const area = m.area_id ? areaMap.get(m.area_id) : undefined;
    return {
      ...m,
      sender_name: (sender?.full_name as string | null) ?? null,
      sender_role: (sender?.role as string | null) ?? null,
      area_label: (area?.label as string | null) ?? (area?.name as string | null) ?? null,
    };
  });
}

/**
 * Create a manual message (foreman / supervisor typed).
 * Triggers fanout-field-message Edge Function on Postgres webhook (post-INSERT).
 */
export async function createMessage(params: {
  organizationId: string;
  projectId: string;
  areaId: string | null;
  senderId: string;
  messageType: MessageType;
  body: string;
  photos?: string[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const trimmed = params.body.trim();
  if (!trimmed) return { success: false, error: 'Message cannot be empty' };

  const id = generateUUID();
  const result = await localInsert('field_messages', {
    id,
    organization_id: params.organizationId,
    project_id: params.projectId,
    area_id: params.areaId,
    sender_id: params.senderId,
    message_type: params.messageType,
    message: trimmed,
    photos: params.photos ?? [],
    created_at: new Date().toISOString(),
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, id };
}

/**
 * Create a system message (auto from blockPhase / phase complete / etc).
 * Body gets the [SYS:{kind}] prefix; UI strips it for display and tags
 * is_system=true (lock icon shown).
 *
 * The sender_id is the user that triggered the action (the foreman). Web
 * team agreed not to filter system messages out.
 */
export async function createSystemMessage(params: {
  organizationId: string;
  projectId: string;
  areaId: string | null;
  senderId: string;
  kind: 'blocker' | 'unblocked' | 'phase_complete' | 'gate_request';
  body: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  // Map kind → DB-allowed message_type
  const messageType: MessageType =
    params.kind === 'blocker' ? 'blocker' :
    params.kind === 'phase_complete' ? 'info' :
    params.kind === 'gate_request' ? 'info' :
    /* unblocked */                   'info';

  const taggedBody = `[SYS:${params.kind}] ${params.body}`.trim();

  return createMessage({
    organizationId: params.organizationId,
    projectId: params.projectId,
    areaId: params.areaId,
    senderId: params.senderId,
    messageType,
    body: taggedBody,
    photos: [],
  });
}

/**
 * Recent activity check — used by the Ready Board area card to show a "💬 N"
 * badge when messages were posted in the last 24h. Local query, fast.
 */
export async function recentMessageCount(
  areaId: string,
  windowHours = 24,
): Promise<number> {
  const since = new Date(Date.now() - windowHours * 3600000).toISOString();
  const rows = await localQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM field_messages
       WHERE area_id = ? AND created_at >= ?`,
    [areaId, since],
  );
  return (rows?.[0]?.n as number) ?? 0;
}
