/**
 * Daily Report Service
 * =====================
 * Handles draft → submit lifecycle.
 * Drafts are saved locally (via Supabase → PowerSync).
 * Submitted reports are final and notify PM.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localUpdate, generateUUID } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';
import { autoCompleteAndForget } from '@/features/todos/services/todoApiClient';

export type DailyReportDraft = {
  projectId: string;
  organizationId: string;
  foremanId: string;
  reportDate: string; // ISO date string (YYYY-MM-DD)
  areasWorked: string[];
  progressSummary: string;
  totalManHours: number;
  photosCount: number;
};

/**
 * Check if a report already exists for this foreman + date.
 */
export async function getExistingReport(
  projectId: string,
  foremanId: string,
  date: string,
): Promise<{ id: string; status: string } | null> {
  const { data } = await supabase
    .from('daily_reports')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('foreman_id', foremanId)
    .eq('report_date', date)
    .single();

  return data as { id: string; status: string } | null;
}

/**
 * Create or update a draft report.
 * Uses upsert on the UNIQUE(project_id, foreman_id, report_date) constraint.
 */
export async function saveDraft(draft: DailyReportDraft): Promise<{ success: boolean; id?: string; error?: string }> {
  // PowerSync doesn't support upsert — check if a report already exists, then insert or update
  const existing = await getExistingReport(draft.projectId, draft.foremanId, draft.reportDate);

  const reportData = {
    project_id: draft.projectId,
    organization_id: draft.organizationId,
    foreman_id: draft.foremanId,
    report_date: draft.reportDate,
    status: 'draft',
    areas_worked: draft.areasWorked,
    progress_summary: draft.progressSummary,
    total_man_hours: draft.totalManHours,
    photos_count: draft.photosCount,
  };

  if (existing) {
    // Update the existing draft
    const result = await localUpdate('daily_reports', existing.id, reportData);
    if (!result.success) {
      console.error('[Report] Save draft failed:', result.error);
      return { success: false, error: result.error };
    }
    logger.info(`[Report] Draft updated: ${draft.reportDate}`);
    return { success: true, id: existing.id };
  }

  // Insert new draft
  const result = await localInsert('daily_reports', {
    id: generateUUID(),
    ...reportData,
    created_at: new Date().toISOString(),
  });

  if (!result.success) {
    console.error('[Report] Save draft failed:', result.error);
    return { success: false, error: result.error };
  }

  logger.info(`[Report] Draft saved: ${draft.reportDate}`);
  return { success: true, id: result.id };
}

/**
 * Submit a report (draft → submitted). Validates required fields.
 */
export async function submitReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  // Fetch the draft
  const { data: report, error: fetchError } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (fetchError || !report) {
    return { success: false, error: 'Report not found' };
  }

  // Validate
  const areas = report.areas_worked as string[];
  if (!areas || areas.length === 0) {
    return { success: false, error: 'No areas worked — add at least one area' };
  }

  // Submit
  const result = await localUpdate('daily_reports', reportId, {
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Sprint 70 — fire daily_report_submit auto-complete. The cron creates
  // this todo daily for every foreman with assigned crew; submit clears it.
  // Fire-and-forget — never blocks the submit success path.
  autoCompleteAndForget(
    { type: 'daily_report', id: reportId },
    'daily_report_submit',
  );

  logger.info(`[Report] Submitted: ${reportId}`);
  return { success: true };
}

/**
 * Get today's date as YYYY-MM-DD string.
 */
export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}
