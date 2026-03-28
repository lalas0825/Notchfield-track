/**
 * Daily Report Service
 * =====================
 * Handles draft → submit lifecycle.
 * Drafts are saved locally (via Supabase → PowerSync).
 * Submitted reports are final and notify PM.
 */

import { supabase } from '@/shared/lib/supabase/client';

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
  const { data, error } = await supabase
    .from('daily_reports')
    .upsert(
      {
        project_id: draft.projectId,
        organization_id: draft.organizationId,
        foreman_id: draft.foremanId,
        report_date: draft.reportDate,
        status: 'draft',
        areas_worked: draft.areasWorked,
        progress_summary: draft.progressSummary,
        total_man_hours: draft.totalManHours,
        photos_count: draft.photosCount,
      },
      { onConflict: 'project_id,foreman_id,report_date' },
    )
    .select('id')
    .single();

  if (error) {
    console.error('[Report] Save draft failed:', error.message);
    return { success: false, error: error.message };
  }

  console.log(`[Report] Draft saved: ${draft.reportDate}`);
  return { success: true, id: data?.id };
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
  const { error } = await supabase
    .from('daily_reports')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (error) {
    return { success: false, error: error.message };
  }

  console.log(`[Report] Submitted: ${reportId}`);
  return { success: true };
}

/**
 * Get today's date as YYYY-MM-DD string.
 */
export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}
