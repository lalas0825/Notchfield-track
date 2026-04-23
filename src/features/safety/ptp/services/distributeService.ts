/**
 * Distribute service — POST to Takeoff web's /api/pm/safety-documents/[id]/distribute.
 *
 * Why not reimplement in Track:
 *   - jsPDF rendering lives on the server (one code path, zero drift)
 *   - SHA-256 integrity + audit log + email in one transaction
 *   - Track doesn't need Resend SDK, jsPDF, or logo-fetching
 *
 * Offline fallback: persist { docId, labels, recipients } to AsyncStorage and
 * retry when online. The background retry worker lives in
 * `useDistributionQueue` (hook) and polls every 30 s when the network is up.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/shared/lib/supabase/client';
import { forceSync } from '@/shared/lib/powersync/client';
import { setPtpStatus, patchPtpContent } from './ptpService';
import type { PtpPdfLabels } from '../types';

import { WEB_API_URL } from '@/shared/config/urls';

const WEB_BASE_URL = WEB_API_URL;

const QUEUE_KEY = 'notchfield:ptp:distribute_queue:v1';

export type DistributionQueueItem = {
  queue_id: string;
  doc_id: string;
  labels: PtpPdfLabels;
  recipients: string[];
  attempts: number;
  last_error: string | null;
  created_at: string;
};

export type DistributeResult = {
  success: boolean;
  queued?: boolean; // true when we fell back to offline queue
  emails_sent?: number;
  emails_failed?: number;
  integrity_hash?: string;
  error?: string;
};

async function loadQueue(): Promise<DistributionQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DistributionQueueItem[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: DistributionQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function enqueue(item: DistributionQueueItem): Promise<void> {
  const queue = await loadQueue();
  queue.push(item);
  await saveQueue(queue);
}

async function callDistribute(
  docId: string,
  labels: PtpPdfLabels,
  recipients: string[],
): Promise<DistributeResult & { wasNetworkError?: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { success: false, error: 'Not authenticated' };
  }

  const url = `${WEB_BASE_URL}/api/pm/safety-documents/${docId}/distribute`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ labels, recipients }),
    });

    if (!res.ok) {
      let body: { message?: string; error?: string } = {};
      let raw = '';
      try {
        raw = await res.text();
        body = JSON.parse(raw);
      } catch {
        /* non-JSON response */
      }
      const msg = body.message ?? body.error ?? `HTTP ${res.status} ${res.statusText}`;
      // eslint-disable-next-line no-console
      console.warn(
        `[distribute] endpoint rejected — POST ${url}\n` +
          `  status: ${res.status}\n` +
          `  body:   ${raw.slice(0, 300)}`,
      );
      return { success: false, error: msg };
    }

    // Takeoff's response contract (commit be6ac01) — camelCase:
    //   { success, emailsSent, emailsFailed, emailRecipients,
    //     distributedAt, pdfSha256 }
    const json = (await res.json()) as {
      success?: boolean;
      emailsSent?: number;
      emailsFailed?: number;
      emailRecipients?: number;
      distributedAt?: string;
      pdfSha256?: string;
      // Legacy/defensive — accept snake_case too in case a pre-be6ac01
      // build is hit somewhere.
      integrity_hash?: string;
      emails_sent?: number;
      emails_failed?: number;
    };

    return {
      success: true,
      emails_sent: json.emailsSent ?? json.emails_sent,
      emails_failed: json.emailsFailed ?? json.emails_failed,
      integrity_hash: json.pdfSha256 ?? json.integrity_hash,
    };
  } catch (err) {
    // Network or CORS error — treat as offline
    // eslint-disable-next-line no-console
    console.warn(
      `[distribute] network error — POST ${url}\n  ${err instanceof Error ? err.message : err}`,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
      wasNetworkError: true,
    };
  }
}

/**
 * Primary entry point used by the Distribute screen. Attempts the network call
 * immediately; on any failure, queues the request and reports `queued: true`.
 */
export async function distributePtp(
  docId: string,
  labels: PtpPdfLabels,
  recipients: string[],
): Promise<DistributeResult> {
  if (recipients.length === 0) {
    return { success: false, error: 'At least one recipient is required' };
  }

  // Drain PowerSync upload queue before hitting /distribute. If the draft
  // or any content/signature patches are still queued locally, the server
  // won't see them — we'd get a 404 "not_found" on a doc that exists only
  // in SQLite. Cheap defensive flush; offline/network errors are absorbed
  // because callDistribute's own network-error path queues for retry.
  try {
    await forceSync();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[distributePtp] forceSync failed (non-fatal):', err);
  }

  const result = await callDistribute(docId, labels, recipients);
  if (result.success) {
    // Stamp distribution metadata + bump status to 'active' (valid DB enum).
    await patchPtpContent(docId, {
      distribution: {
        distributed_at: new Date().toISOString(),
        distributed_to: recipients,
        pdf_sha256: result.integrity_hash ?? null,
        emails_sent: result.emails_sent ?? null,
      },
    });
    await setPtpStatus(docId, 'active');
    return result;
  }

  // Only queue for auto-retry when the failure looks like a transient
  // network issue. If the server actively rejected (4xx/5xx), queueing is
  // a lie — the request will fail the same way on retry. Surface the error.
  if (!result.wasNetworkError) {
    return { success: false, error: result.error };
  }

  await enqueue({
    queue_id: `${docId}:${Date.now()}`,
    doc_id: docId,
    labels,
    recipients,
    attempts: 0,
    last_error: result.error ?? null,
    created_at: new Date().toISOString(),
  });

  return { ...result, queued: true };
}

/**
 * Called by the background retry worker. Walks the queue once, attempts each
 * item, removes successes, and returns the updated queue for inspection.
 */
export async function flushDistributionQueue(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const queue = await loadQueue();
  if (queue.length === 0) return { attempted: 0, succeeded: 0, failed: 0 };

  // One forceSync covers all queued items — drain PowerSync writes first
  // so any local-only drafts/patches reach Supabase before we retry
  // distribute. Saves N-1 redundant flushes vs. putting it in callDistribute.
  try {
    await forceSync();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[flushDistributionQueue] forceSync failed (non-fatal):', err);
  }

  let succeeded = 0;
  let failed = 0;
  const remaining: DistributionQueueItem[] = [];

  // Cap attempts for network-error items too — a doc that's failed 20
  // times is almost certainly never coming back. Prevents infinite retry
  // on genuinely broken state.
  const MAX_ATTEMPTS = 20;

  for (const item of queue) {
    const result = await callDistribute(item.doc_id, item.labels, item.recipients);
    if (result.success) {
      succeeded++;
      await patchPtpContent(item.doc_id, {
        distribution: {
          distributed_at: new Date().toISOString(),
          distributed_to: item.recipients,
          pdf_sha256: result.integrity_hash ?? null,
          emails_sent: result.emails_sent ?? null,
        },
      });
      await setPtpStatus(item.doc_id, 'active');
      continue;
    }

    failed++;

    // Drop the item from the retry queue when:
    //   (a) the server actively rejected (4xx/5xx) — the zombie case,
    //       where the doc doesn't exist in Supabase and never will. Retry
    //       is hopeless and clogs the log on every flush tick.
    //   (b) we've exhausted MAX_ATTEMPTS even for network errors.
    // Mirror distributePtp's own guard (commit d637eb4) to finally purge
    // pre-guard zombies that were queued before that rule landed.
    const isNetworkError = result.wasNetworkError === true;
    const exhausted = item.attempts + 1 >= MAX_ATTEMPTS;
    if (!isNetworkError || exhausted) {
      // eslint-disable-next-line no-console
      console.warn(
        `[flushDistributionQueue] dropping doc=${item.doc_id} — ${result.error}` +
          (exhausted ? ` (after ${item.attempts + 1} attempts)` : ''),
      );
      continue;
    }

    remaining.push({
      ...item,
      attempts: item.attempts + 1,
      last_error: result.error ?? null,
    });
  }

  await saveQueue(remaining);
  return { attempted: queue.length, succeeded, failed };
}

export async function getPendingDistributions(): Promise<DistributionQueueItem[]> {
  return loadQueue();
}

/**
 * Generic alias — the distribute flow is doc_type-agnostic. The server
 * endpoint switches PDF renderer by doc_type, the client just POSTs labels
 * + recipients and stamps `content.distribution` on success. Toolbox uses
 * this alias so the intent is clearer at the call site.
 */
export const distributeSafetyDoc = distributePtp;
