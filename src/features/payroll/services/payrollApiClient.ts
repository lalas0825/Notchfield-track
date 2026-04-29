/**
 * Sprint 73 Payroll Ask #4 — Web API client for foreman weekly submissions.
 *
 * Track NEVER touches `foreman_weekly_submissions` directly. Web team owns
 * the table + RLS + supervisor approval pipeline. Track only POSTs the
 * weekly snapshot when the foreman taps "Submit to Supervisor", and GETs
 * the current submission to show a "Submitted ✓ / Disputed" badge.
 *
 * Auth: bearer token resolved per-call from supabase.auth.getSession() —
 * same pattern as deficiency / signoff / notify clients.
 *
 * Errors are sanitized via the same postJson pattern (HTML 404 pages
 * dropped, status mapped to user-friendly messages, full detail logged).
 */

import { supabase } from '@/shared/lib/supabase/client';
import { WEB_API_URL } from '@/shared/config/urls';
import { logger } from '@/shared/lib/logger';

async function getBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type HttpError = Error & { status?: number; detail?: string; url?: string };

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const token = await getBearer();
  if (!token) throw new Error('payrollApiClient: no auth session');
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
      /* ignore */
    }
    let userMsg: string;
    if (res.status === 404) userMsg = 'This action is not available yet — please contact support if this persists.';
    else if (res.status === 401) userMsg = 'Session expired — please sign out and back in.';
    else if (res.status === 403) userMsg = "You don't have permission to do this.";
    else if (res.status >= 500) userMsg = 'Server error — please try again in a moment.';
    else userMsg = detail || `Request failed (${res.status})`;
    const e: HttpError = new Error(userMsg);
    e.status = res.status;
    e.detail = detail;
    e.url = url;
    logger.warn('[payrollApiClient] HTTP error', { url, status: res.status, detail });
    throw e;
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(url: string): Promise<T> {
  const token = await getBearer();
  if (!token) throw new Error('payrollApiClient: no auth session');
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const e: HttpError = new Error(`payrollApiClient: GET ${url} ${res.status}`);
    e.status = res.status;
    e.url = url;
    logger.warn('[payrollApiClient] GET error', { url, status: res.status });
    throw e;
  }
  return res.json() as Promise<T>;
}

// ─── Types matching SPRINT_TRACK_PAYROLL.md handoff spec ────────────────────

export type ForemanWeeklyHoursSummary = {
  workers: Array<{
    worker_id: string;
    full_name: string;
    days: {
      Mon: number;
      Tue: number;
      Wed: number;
      Thu: number;
      Fri: number;
      Sat: number;
      Sun: number;
    };
    total: number;
  }>;
  grand_total: number;
  /** ISO timestamp when foreman saw + submitted this snapshot. */
  generated_at: string;
  /** Audit field — what data source this aggregated from. */
  generated_from: 'area_time_entries';
};

export type SubmitForemanWeeklyPayload = {
  project_id: string;
  /** Friday cutoff date (YYYY-MM-DD), e.g. "2026-05-01". */
  week_ending: string;
  hours_summary: ForemanWeeklyHoursSummary;
  foreman_notes?: string | null;
};

export type SubmitForemanWeeklyResult = {
  success: true;
  submission_id: string;
  status: 'pending_supervisor_review';
};

export type ForemanSubmissionStatus =
  | 'pending_supervisor_review'
  | 'approved'
  | 'disputed'
  | 'cancelled';

export type ForemanSubmissionRecord = {
  id: string;
  project_id: string;
  week_ending: string;
  status: ForemanSubmissionStatus;
  /** If status='disputed', the supervisor's explanation (re-edit + re-submit). */
  supervisor_dispute_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

// ─── API methods ────────────────────────────────────────────────────────────

/**
 * Submit the foreman's weekly timesheet snapshot. Web inserts into
 * foreman_weekly_submissions with status='pending_supervisor_review'
 * and pings the supervisor via push. Foreman sees a "Submitted" lock
 * on Track until the supervisor approves or disputes.
 */
export async function submitForemanWeekly(
  payload: SubmitForemanWeeklyPayload,
): Promise<SubmitForemanWeeklyResult> {
  return postJson<SubmitForemanWeeklyResult>(
    `${WEB_API_URL}/api/payroll/foreman-submissions`,
    payload,
  );
}

/**
 * Fetch the foreman's submission record for a given week (or current).
 * Returns null if no submission exists yet (foreman hasn't tapped Submit).
 * Used by the timesheet screen to show "Submitted ✓ / Disputed" badge.
 */
export async function getForemanSubmission(
  projectId: string,
  weekEnding: string,
): Promise<ForemanSubmissionRecord | null> {
  try {
    const url = `${WEB_API_URL}/api/payroll/foreman-submissions?project_id=${encodeURIComponent(projectId)}&week_ending=${encodeURIComponent(weekEnding)}`;
    const result = await getJson<{ submission: ForemanSubmissionRecord | null }>(url);
    return result.submission ?? null;
  } catch (e) {
    // 404 = no submission yet — fine, return null. Other errors bubble.
    const status = (e as HttpError).status;
    if (status === 404) return null;
    throw e;
  }
}
