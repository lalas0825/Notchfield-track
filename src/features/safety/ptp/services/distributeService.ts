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
import { setPtpStatus } from './ptpService';
import type { PtpPdfLabels } from '../types';

const WEB_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WEB_API_URL) ||
  'https://notchfield.com';

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
): Promise<DistributeResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const res = await fetch(
      `${WEB_BASE_URL}/api/pm/safety-documents/${docId}/distribute`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ labels, recipients }),
      },
    );

    if (!res.ok) {
      let body: { message?: string; error?: string } = {};
      try {
        body = await res.json();
      } catch {
        /* ignore non-JSON */
      }
      return {
        success: false,
        error: body.message ?? body.error ?? `HTTP ${res.status}`,
      };
    }

    const json = (await res.json()) as {
      integrity_hash?: string;
      emails_sent?: number;
      emails_failed?: number;
    };

    return {
      success: true,
      emails_sent: json.emails_sent,
      emails_failed: json.emails_failed,
      integrity_hash: json.integrity_hash,
    };
  } catch (err) {
    // Network or CORS error — treat as offline
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
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

  const result = await callDistribute(docId, labels, recipients);
  if (result.success) {
    await setPtpStatus(docId, 'distributed');
    return result;
  }

  // Fallback — enqueue for retry
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

  let succeeded = 0;
  let failed = 0;
  const remaining: DistributionQueueItem[] = [];

  for (const item of queue) {
    const result = await callDistribute(item.doc_id, item.labels, item.recipients);
    if (result.success) {
      succeeded++;
      await setPtpStatus(item.doc_id, 'distributed');
    } else {
      failed++;
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        last_error: result.error ?? null,
      });
    }
  }

  await saveQueue(remaining);
  return { attempted: queue.length, succeeded, failed };
}

export async function getPendingDistributions(): Promise<DistributionQueueItem[]> {
  return loadQueue();
}
