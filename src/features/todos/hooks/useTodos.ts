/**
 * Sprint 70 — useTodos.
 *
 * Reads the active action queue for the signed-in user. Mirrors the
 * Sprint 69 useNotifications hook architecture:
 *
 *   1. PowerSync local sync — primary. Reads from local SQLite filtered
 *      by owner_profile_id; status ∈ pending|in_progress (snoozed rows
 *      sync but stay hidden until Web flips them back to pending on
 *      snooze_until expiry).
 *   2. Supabase realtime — silent refetch trigger. PM-side mutations
 *      (auto-completion engine marking a todo done) reach Track in <1s
 *      without waiting for PowerSync's debounced window.
 *   3. Optimistic store overlay — pendingDone/Snooze/Dismiss ids hide
 *      rows immediately on user action; the hook subscribes so the
 *      Today screen and the header badge re-render together.
 *
 * Mock fallback: while Web ships W1 (todos table) and W36–W39 (mutation
 * endpoints), Track surfaces MOCK_TODOS so foreman can pilot the UI.
 * Once Web posts "Sprint 70 backend ready", flip USE_MOCK_TODOS to false
 * and the hook switches to live data with no other changes required.
 *
 * Sort order (per SPRINT_TRACK_TODOS.md §1 T4):
 *   priority asc (critical → low), then due_date asc NULLS LAST,
 *   then created_at asc.
 *
 * Returns:
 *   - todos: ordered list, optimistically-hidden rows excluded
 *   - counts: { critical, high, normal, low } for the priority chips
 *   - actionableCount: total of pending + in_progress (badge source)
 *   - loading: true on initial fetch only
 *   - reload(): manual refetch trigger
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type { Todo, TodoPriority } from '../types';
import { PRIORITY_ORDER } from '../types';
import { MOCK_TODOS } from '../mocks/MOCK_TODOS';
import { useTodoOptimisticStore } from '../state/optimisticStore';

/**
 * While Web is still building the backend (W1 table + W36–W39 endpoints),
 * Track shows MOCK_TODOS so the UI can be exercised. Web confirms via
 * "Sprint 70 backend ready" → flip this to false → ship.
 */
const USE_MOCK_TODOS = true;

type RawRow = Record<string, unknown>;

function rowToTodo(row: RawRow): Todo {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    owner_profile_id: row.owner_profile_id as string,
    type: (row.type as string) ?? 'unknown',
    entity_type: (row.entity_type as string | null) ?? null,
    entity_id: (row.entity_id as string | null) ?? null,
    project_id: (row.project_id as string | null) ?? null,
    title: (row.title as string) ?? '',
    description: (row.description as string | null) ?? null,
    link_url: (row.link_url as string | null) ?? null,
    status: (row.status as Todo['status']) ?? 'pending',
    priority: (row.priority as TodoPriority) ?? 'normal',
    due_date: (row.due_date as string | null) ?? null,
    snooze_until: (row.snooze_until as string | null) ?? null,
    done_at: (row.done_at as string | null) ?? null,
    done_by: (row.done_by as string | null) ?? null,
    dismissed_at: (row.dismissed_at as string | null) ?? null,
    source: (row.source as Todo['source']) ?? 'auto_event',
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  };
}

/**
 * Sort comparator: priority asc (critical=0 < low=3), then due_date asc
 * NULLS LAST, then created_at asc.
 */
function compareTodos(a: Todo, b: Todo): number {
  const pa = PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.normal;
  const pb = PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.normal;
  if (pa !== pb) return pa - pb;
  // due_date NULLS LAST
  if (a.due_date && b.due_date) {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  } else if (a.due_date) {
    return -1;
  } else if (b.due_date) {
    return 1;
  }
  // tie-break on created_at asc
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function isActiveStatus(status: Todo['status']): boolean {
  return status === 'pending' || status === 'in_progress';
}

export type TodoCounts = Record<TodoPriority, number>;

const ZERO_COUNTS: TodoCounts = { critical: 0, high: 0, normal: 0, low: 0 };

function countByPriority(list: Todo[]): TodoCounts {
  const out: TodoCounts = { critical: 0, high: 0, normal: 0, low: 0 };
  for (const t of list) {
    out[t.priority] = (out[t.priority] ?? 0) + 1;
  }
  return out;
}

export function useTodos() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  // Subscribe to optimistic store so changes on any surface refresh both
  // the Today screen list and the header badge in the same render.
  const pendingDone = useTodoOptimisticStore((s) => s.pendingDoneIds);
  const pendingSnooze = useTodoOptimisticStore((s) => s.pendingSnoozeIds);
  const pendingDismiss = useTodoOptimisticStore((s) => s.pendingDismissIds);

  const [rawTodos, setRawTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) {
        setRawTodos([]);
        setLoading(false);
      }
      return;
    }

    if (USE_MOCK_TODOS) {
      if (mountedRef.current) {
        setRawTodos(MOCK_TODOS);
        setLoading(false);
      }
      return;
    }

    // Live branch — local SQLite read. Filter status to active only at
    // the SQL layer (sync rule keeps snoozed rows in the table for the
    // server-side flip-back; UI doesn't show them).
    const rows = await localQuery<RawRow>(
      `SELECT * FROM todos
         WHERE owner_profile_id = ?
           AND status IN ('pending', 'in_progress')
         ORDER BY created_at DESC
         LIMIT 200`,
      [userId],
    );

    if (mountedRef.current) {
      const parsed = rows ? rows.map(rowToTodo).filter((t) => isActiveStatus(t.status)) : [];
      setRawTodos(parsed);
      setLoading(false);
    }
  }, [userId]);

  // Initial load + on-focus refresh
  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Realtime — only when running live (mock branch has no server rows)
  useEffect(() => {
    if (USE_MOCK_TODOS || !userId) return;

    const channel = supabase
      .channel(`todos_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `owner_profile_id=eq.${userId}`,
        },
        () => {
          reload();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  // Apply optimistic overlay + sort. Memoized so identity-stable consumers
  // don't re-render unless the underlying lists or sets actually change.
  const todos = useMemo(() => {
    const visible = rawTodos.filter(
      (t) =>
        !pendingDone.has(t.id) && !pendingSnooze.has(t.id) && !pendingDismiss.has(t.id),
    );
    return [...visible].sort(compareTodos);
  }, [rawTodos, pendingDone, pendingSnooze, pendingDismiss]);

  const counts = useMemo<TodoCounts>(
    () => (todos.length === 0 ? ZERO_COUNTS : countByPriority(todos)),
    [todos],
  );

  const actionableCount = todos.length;

  return { todos, counts, actionableCount, loading, reload };
}
