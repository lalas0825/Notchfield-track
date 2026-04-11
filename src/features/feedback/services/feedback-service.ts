/**
 * Feedback Reports Service — Sprint 45B
 * ========================================
 * Offline-first text writes via PowerSync; screenshot uploads require online
 * (go direct to Supabase Storage in the `feedback-screenshots` bucket).
 */

import { supabase } from '@/shared/lib/supabase/client';
import {
  localQuery,
  localInsert,
  generateUUID,
} from '@/shared/lib/powersync/write';

export type FeedbackType = 'bug' | 'feature' | 'feedback';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'new' | 'reviewing' | 'resolved' | 'declined';

export interface FeedbackReport {
  id: string;
  organization_id: string;
  project_id: string | null;
  reported_by: string;
  reporter_name: string | null;
  reporter_role: string | null;
  type: FeedbackType;
  severity: FeedbackSeverity | null;
  title: string;
  description: string;
  page_url: string | null;
  page_name: string | null;
  app_source: string | null;
  device_info: string | null;
  browser_info: string | null;
  screen_size: string | null;
  screenshots: string | null; // JSON array of storage paths
  status: FeedbackStatus;
  admin_notes: string | null;
  admin_response: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export function parseScreenshots(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Read ─────────────────────────────────────────────────────

/**
 * Fetch all reports submitted by the current user (My Reports).
 * Local-first via PowerSync, falls back to Supabase REST.
 */
export async function fetchMyReports(userId: string): Promise<FeedbackReport[]> {
  const local = await localQuery<FeedbackReport>(
    `SELECT * FROM feedback_reports WHERE reported_by = ? ORDER BY created_at DESC`,
    [userId],
  );
  if (local !== null) return local;

  const { data, error } = await supabase
    .from('feedback_reports')
    .select('*')
    .eq('reported_by', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FeedbackReport[];
}

// ─── Create ───────────────────────────────────────────────────

export interface CreateFeedbackInput {
  organization_id: string;
  project_id: string | null;
  reported_by: string;
  reporter_name: string | null;
  reporter_role: string | null;
  type: FeedbackType;
  severity: FeedbackSeverity | null;
  title: string;
  description: string;
  page_url: string | null;
  page_name: string | null;
  device_info: string | null;
  screen_size: string | null;
  screenshots: string[]; // storage paths already uploaded
}

/**
 * Create a feedback report. Uses PowerSync local-first — works offline.
 * Returns the generated report id so callers can use it to upload screenshots
 * (which must happen AFTER the row exists to keep paths associative).
 */
export async function createFeedbackReport(
  input: CreateFeedbackInput,
): Promise<{ success: boolean; id: string; error?: string }> {
  const now = new Date().toISOString();
  const id = generateUUID();
  return localInsert('feedback_reports', {
    id,
    organization_id: input.organization_id,
    project_id: input.project_id,
    reported_by: input.reported_by,
    reporter_name: input.reporter_name,
    reporter_role: input.reporter_role,
    type: input.type,
    severity: input.severity,
    title: input.title,
    description: input.description,
    page_url: input.page_url,
    page_name: input.page_name,
    app_source: 'mobile',
    device_info: input.device_info,
    browser_info: null,
    screen_size: input.screen_size,
    screenshots: JSON.stringify(input.screenshots),
    status: 'new' as FeedbackStatus,
    created_at: now,
    updated_at: now,
  });
}

// ─── Screenshot uploads ───────────────────────────────────────

/**
 * Upload a screenshot to the `feedback-screenshots` bucket at
 * `{organization_id}/{report_id}/{idx}_{timestamp}.jpg`. Returns the storage
 * path (NOT a public URL — the bucket is private). Display logic must use
 * `createSignedUrl` when rendering.
 */
export async function uploadFeedbackScreenshot(params: {
  localUri: string;
  organizationId: string;
  reportId: string;
  index: number;
}): Promise<{ success: boolean; path?: string; error?: string }> {
  const { localUri, organizationId, reportId, index } = params;
  try {
    const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filename = `${organizationId}/${reportId}/${index}_${Date.now()}.${ext}`;

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('feedback-screenshots')
      .upload(filename, blob, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });

    if (error) return { success: false, error: error.message };
    return { success: true, path: filename };
  } catch (err) {
    return { success: false, error: (err as Error).message ?? 'Upload failed' };
  }
}

/**
 * Get a signed URL for a private screenshot path (1 hour expiry).
 */
export async function getScreenshotSignedUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('feedback-screenshots')
      .createSignedUrl(path, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
