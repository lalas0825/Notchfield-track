/**
 * GC Punch Items Service — Sprint 42B
 * =====================================
 * Manages gc_punch_items — punchlist items synced from GC platforms (Procore).
 * Polishers mark items in_progress → ready_for_review.
 * push_pending = true triggers the gc-push-resolution Edge Function via cron.
 *
 * Offline-first: all reads via PowerSync localQuery, writes via localUpdate.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { localQuery, localUpdate } from '@/shared/lib/powersync/write';

export type GcPunchStatus = 'open' | 'in_progress' | 'ready_for_review' | 'closed';

export interface GcPunchItem {
  id: string;
  organization_id: string;
  gc_project_id: string | null;
  project_id: string;
  external_item_id: string | null;
  platform: string;
  title: string;
  description: string | null;
  item_number: string | null;
  location_description: string | null;
  floor: string | null;
  unit: string | null;
  status: GcPunchStatus;
  external_status: string | null;
  priority: string | null;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  external_assignee_id: string | null;
  external_assignee_name: string | null;
  due_date: string | null;
  created_externally_at: string | null;
  closed_at: string | null;
  hours_logged: number;
  resolution_notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  external_photos: string | null;    // JSON string: string[]
  resolution_photos: string | null;  // JSON string: string[]
  external_data: string | null;
  synced_at: string | null;
  push_pending: number;
  last_push_at: string | null;
  last_push_status: string | null;
  created_at: string;
  updated_at: string;
}

export function parsePhotos(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stringifyPhotos(photos: string[]): string {
  return JSON.stringify(photos);
}

/**
 * Fetch GC punch items for a project.
 * - supervisor/foreman: all items for the project
 * - worker: only items assigned to them
 * Falls back to Supabase REST if PowerSync not available.
 */
export async function fetchGcPunchItems(params: {
  projectId: string;
  userId: string;
  role: string;
}): Promise<GcPunchItem[]> {
  const { projectId, userId, role } = params;
  const isWorker = role === 'worker' || role === 'laborer' || role === 'mechanic' || role === 'helper';

  const sql = isWorker
    ? `SELECT * FROM gc_punch_items WHERE project_id = ? AND (assigned_to_user_id = ? OR assigned_to_user_id IS NULL)
       ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'open' THEN 2 WHEN 'ready_for_review' THEN 3 ELSE 4 END,
       floor ASC, unit ASC, item_number ASC`
    : `SELECT * FROM gc_punch_items WHERE project_id = ?
       ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'open' THEN 2 WHEN 'ready_for_review' THEN 3 ELSE 4 END,
       floor ASC, unit ASC, item_number ASC`;

  const sqlParams = isWorker ? [projectId, userId] : [projectId];

  const local = await localQuery<GcPunchItem>(sql, sqlParams);
  if (local !== null) return local;

  // Supabase fallback
  let query = supabase
    .from('gc_punch_items')
    .select('*')
    .eq('project_id', projectId)
    .order('floor')
    .order('unit')
    .order('item_number');

  if (isWorker) {
    query = query.or(`assigned_to_user_id.eq.${userId},assigned_to_user_id.is.null`);
  }

  const { data } = await query;
  return (data ?? []) as GcPunchItem[];
}

/**
 * Update status. Sets push_pending = 1 to trigger server-side push to GC platform.
 */
export async function updateGcPunchStatus(
  itemId: string,
  status: GcPunchStatus,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    push_pending: 1,
    updated_at: now,
  };

  if (status === 'in_progress') {
    updates.completed_at = null;
    updates.completed_by = null;
  } else if (status === 'ready_for_review') {
    updates.completed_at = now;
    updates.completed_by = userId;
  } else if (status === 'open') {
    updates.completed_at = null;
    updates.completed_by = null;
  }

  return localUpdate('gc_punch_items', itemId, updates);
}

/**
 * Save resolution data (hours, notes, photos).
 * Sets push_pending = 1 so server pushes to GC.
 */
export async function saveGcPunchResolution(
  itemId: string,
  data: {
    hours_logged?: number;
    resolution_notes?: string;
    resolution_photos?: string[];
  },
): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, unknown> = {
    push_pending: 1,
    updated_at: new Date().toISOString(),
  };

  if (data.hours_logged !== undefined) updates.hours_logged = data.hours_logged;
  if (data.resolution_notes !== undefined) updates.resolution_notes = data.resolution_notes;
  if (data.resolution_photos !== undefined) {
    updates.resolution_photos = stringifyPhotos(data.resolution_photos);
  }

  return localUpdate('gc_punch_items', itemId, updates);
}

/**
 * Upload a resolution photo to Supabase Storage and return the public URL.
 * Falls back to returning the local URI if upload fails (offline).
 */
export async function uploadResolutionPhoto(params: {
  localUri: string;
  organizationId: string;
  itemId: string;
}): Promise<string> {
  const { localUri, organizationId, itemId } = params;
  try {
    const ext = localUri.split('.').pop() ?? 'jpg';
    const filename = `${organizationId}/punch/${itemId}/${Date.now()}.${ext}`;

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('field-photos')
      .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });

    if (error || !data) return localUri;

    const { data: urlData } = supabase.storage.from('field-photos').getPublicUrl(filename);
    return urlData.publicUrl;
  } catch {
    // Offline — return local URI; server will handle upload on push
    return localUri;
  }
}
