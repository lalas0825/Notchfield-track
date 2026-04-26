/**
 * Sprint 70 — Web API client for the Todos Hub.
 *
 * Track does NOT mutate the `todos` table directly. The Web team owns
 * the recipient resolver, the auto-completion engine, and the cron-based
 * todo creation. Track's job is:
 *
 *   1. READ active todos via PowerSync (offline-safe, by_user bucket).
 *   2. POST mark-done / snooze / dismiss intents to Web.
 *   3. POST create for manual todos (foreman jots a self-note).
 *
 * Auth: bearer token resolved from the current Supabase session, same
 * pattern as notifyApiClient.ts. We re-fetch per call instead of caching
 * because Track session refreshes can happen between calls.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { WEB_API_URL } from '@/shared/config/urls';
import { logger } from '@/shared/lib/logger';
import type { TodoPriority } from '../types';

async function getBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const token = await getBearer();
  if (!token) throw new Error('todoApiClient: no auth session');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`${url} ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export type TodoMutationResult = { ok: true };
export type TodoCreateResult = { success: true; id: string };

/**
 * Mark a todo as done. Web flips status to 'done' and PowerSync's sync rule
 * (status IN pending/in_progress/snoozed) excludes it on next sync — the
 * row falls out of the local SQLite naturally.
 *
 * Pattern note: callers should debounce 5s in the UI (the undo toast)
 * BEFORE calling this. Don't call eagerly on tap — if the user undoes
 * within 5s we cancel the call entirely.
 */
export async function markTodoDoneViaWeb(todoId: string): Promise<TodoMutationResult> {
  return postJson<TodoMutationResult>(`${WEB_API_URL}/api/todos/${todoId}/done`);
}

/** Snooze until ISO timestamp. Web sets snooze_until + status='snoozed'. */
export async function snoozeTodoViaWeb(
  todoId: string,
  untilIso: string,
): Promise<TodoMutationResult> {
  return postJson<TodoMutationResult>(
    `${WEB_API_URL}/api/todos/${todoId}/snooze`,
    { until: untilIso },
  );
}

/** User-initiated dismiss. Different from done — used for "not relevant". */
export async function dismissTodoViaWeb(todoId: string): Promise<TodoMutationResult> {
  return postJson<TodoMutationResult>(`${WEB_API_URL}/api/todos/${todoId}/dismiss`);
}

export type CreateManualTodoParams = {
  title: string;
  description?: string;
  /** YYYY-MM-DD or ISO timestamp. */
  dueDate?: string;
  priority?: TodoPriority;
  projectId?: string;
  linkUrl?: string;
};

/**
 * Manual todo create. Web's /api/todos/create enforces source='manual'
 * server-side regardless of what Track sends; Track must NEVER set the
 * field client-side per SPRINT_TRACK_TODOS.md §5.
 */
export async function createManualTodoViaWeb(
  params: CreateManualTodoParams,
): Promise<TodoCreateResult> {
  return postJson<TodoCreateResult>(`${WEB_API_URL}/api/todos/create`, params);
}

/** Fire-and-forget wrappers — log on failure, never throw. Used by the
 * 5-second undo flow where the call is async-after-toast. */
export function markDoneAndForget(todoId: string): void {
  markTodoDoneViaWeb(todoId).catch((err) => {
    logger.warn('[todos] markDone failed (non-fatal)', err);
  });
}

export function snoozeAndForget(todoId: string, untilIso: string): void {
  snoozeTodoViaWeb(todoId, untilIso).catch((err) => {
    logger.warn('[todos] snooze failed (non-fatal)', err);
  });
}

export function dismissAndForget(todoId: string): void {
  dismissTodoViaWeb(todoId).catch((err) => {
    logger.warn('[todos] dismiss failed (non-fatal)', err);
  });
}
