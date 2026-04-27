/**
 * Sprint 70 — Today screen.
 *
 * Single screen that adapts to the user's role: foreman sees their action
 * queue (PTPs to sign, crews to assign, daily reports to submit, stale
 * surfaces). Supervisor sees compliance items (block escalations, SST
 * expiring, foremen who missed reports, worker intake). Web's recipient
 * resolver decides which todos each user gets — Track just renders what
 * arrives in the by_user PowerSync bucket.
 *
 * Layout:
 *   ─────────────────────────────────
 *   Today · Wed Apr 26
 *   [Critical: 1] [High: 2] [Normal: 1] [Low: 0]
 *
 *   ┌──────────────────────────────┐
 *   │ 🔴  Sign today's PTP    [⋯] │
 *   │     Floor 03 · Bath rough-in │
 *   │     CRITICAL · Due today     │
 *   └──────────────────────────────┘
 *   ...
 *
 *                             [+ Manual]
 *
 *   Marked done · UNDO · 5s          ← UndoToast at bottom
 *   ─────────────────────────────────
 *
 * Mark-done flow (debounced commit):
 *   1. Tap row → store.markDone(id) — row drops out optimistically
 *   2. UndoToast appears with 5s timer
 *   3a. Tap UNDO within 5s → store.undoMarkDone(id) — row returns
 *   3b. 5s elapses → markDoneAndForget(id) — commit to server
 *   4. If a 2nd row tap arrives during the window → flush the 1st
 *      (commit it) and start a fresh 5s for the 2nd. Standard Gmail
 *      pattern; the user's 2nd intent shouldn't wait on the 1st undo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTodos } from '../hooks/useTodos';
import { useTodoOptimisticStore } from '../state/optimisticStore';
import {
  markDoneAndForget,
  snoozeAndForget,
  dismissAndForget,
} from '../services/todoApiClient';
import { formatTodayHeader } from '../services/dateHelpers';
import { useProjectStore } from '@/features/projects/store/project-store';
import { TodoItem } from './TodoItem';
import { PriorityChips } from './PriorityChips';
import { TodoActionSheet } from './TodoActionSheet';
import { UndoToast } from './UndoToast';
import { ManualTodoModal } from './ManualTodoModal';
import type { Todo, TodoPriority } from '../types';

const UNDO_WINDOW_MS = 5000;

export default function TodayScreen() {
  const router = useRouter();
  const { todos, counts, actionableCount, loading, reload } = useTodos();
  const activeProject = useProjectStore((s) => s.activeProject);
  const markDone = useTodoOptimisticStore((s) => s.markDone);
  const undoMarkDone = useTodoOptimisticStore((s) => s.undoMarkDone);
  const markSnoozed = useTodoOptimisticStore((s) => s.markSnoozed);
  const markDismissed = useTodoOptimisticStore((s) => s.markDismissed);

  const [refreshing, setRefreshing] = useState(false);
  const [filterPriority, setFilterPriority] = useState<TodoPriority | null>(null);
  const [actionTodo, setActionTodo] = useState<Todo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Pending-undo state — single slot. If user taps a 2nd todo before
  // the 1st 5s expires, flush the 1st and start fresh for the 2nd.
  const [pendingUndo, setPendingUndo] = useState<{ id: string; title: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingUndo = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (pendingUndo) {
      markDoneAndForget(pendingUndo.id);
      setPendingUndo(null);
    }
  }, [pendingUndo]);

  // Cleanup on unmount — commit any open undo so the action isn't lost.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      if (pendingUndo) {
        markDoneAndForget(pendingUndo.id);
      }
    };
  }, [pendingUndo]);

  const onMarkDone = useCallback(
    (todo: Todo) => {
      // Flush any prior pending undo first (commit the previous one).
      flushPendingUndo();
      const added = markDone(todo.id);
      if (!added) return;
      setPendingUndo({ id: todo.id, title: todo.title });
      undoTimerRef.current = setTimeout(() => {
        markDoneAndForget(todo.id);
        setPendingUndo((curr) => (curr?.id === todo.id ? null : curr));
        undoTimerRef.current = null;
      }, UNDO_WINDOW_MS);
    },
    [flushPendingUndo, markDone],
  );

  const onUndo = useCallback(() => {
    if (!pendingUndo) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    undoMarkDone(pendingUndo.id);
    setPendingUndo(null);
  }, [pendingUndo, undoMarkDone]);

  const onOpenActions = useCallback((todo: Todo) => {
    setActionTodo(todo);
  }, []);

  const onSnooze = useCallback(
    (todo: Todo, untilIso: string, _label: string) => {
      markSnoozed(todo.id);
      snoozeAndForget(todo.id, untilIso);
    },
    [markSnoozed],
  );

  const onDismiss = useCallback(
    (todo: Todo) => {
      markDismissed(todo.id);
      dismissAndForget(todo.id);
    },
    [markDismissed],
  );

  const onOpen = useCallback(
    (todo: Todo) => {
      // Sprint 71 Phase 2 — deficiency-driven todos (resolution_due,
      // verification_due) carry entity_type='deficiency' + entity_id =
      // the deficiency UUID. Route directly to the detail screen, which
      // surfaces the resolve flow (foreman) or verify/reject (PM) based
      // on role + status. This takes precedence over link_url parsing
      // because Web's link_url for these todos is /projects/{id}/pm/...
      // which we can't deep-link to without a full router.
      if (todo.entity_type === 'deficiency' && todo.entity_id) {
        router.push(`/(tabs)/board/deficiency/${todo.entity_id}` as any);
        return;
      }

      // Phase 1 — link_url is a Web URL ('/projects/x/pm/...'). Track-side
      // conversion to a local route is a Phase 2 task; for now, the row's
      // mere presence is enough action-prompting. Best-effort: if it's a
      // simple known mapping, route; otherwise no-op.
      if (!todo.link_url) return;
      const url = todo.link_url;
      // Crude PoC mappings — real router lives in Phase 2.
      if (url.includes('/safety-documents/')) {
        const id = url.split('/safety-documents/')[1]?.split(/[/?#]/)[0];
        if (id) router.push(`/(tabs)/docs/safety/${id}` as any);
        return;
      }
      if (url.includes('/ready-board')) {
        router.push('/(tabs)/board' as any);
        return;
      }
      if (url.includes('/manpower/')) {
        router.push('/(tabs)/more/crew' as any);
        return;
      }
      if (url.includes('/reports/daily')) {
        router.push('/(tabs)/docs' as any);
        return;
      }
    },
    [router],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const filteredTodos = useMemo(() => {
    if (!filterPriority) return todos;
    return todos.filter((t) => t.priority === filterPriority);
  }, [todos, filterPriority]);

  const isEmpty = !loading && todos.length === 0;
  const isFilteredEmpty = !loading && todos.length > 0 && filteredTodos.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Today',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={{ paddingHorizontal: 8 }}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
            </Pressable>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F97316"
              colors={['#F97316']}
            />
          }
        >
          {/* Subheader */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>
              Today · {formatTodayHeader()}
            </Text>
            <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: '800', marginTop: 2 }}>
              {actionableCount === 0
                ? "You're all caught up"
                : `${actionableCount} ${actionableCount === 1 ? 'action' : 'actions'} pending`}
            </Text>
          </View>

          <PriorityChips counts={counts} active={filterPriority} onChange={setFilterPriority} />

          {/* Empty states */}
          {isEmpty ? (
            <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 }}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color="#22C55E" />
              <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                Nothing on your plate. Tap + to add a self-reminder.
              </Text>
            </View>
          ) : isFilteredEmpty ? (
            <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 }}>
              <Ionicons name="filter-outline" size={32} color="#475569" />
              <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8 }}>
                No items match this priority.
              </Text>
            </View>
          ) : (
            filteredTodos.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                onMarkDone={onMarkDone}
                onOpenActions={onOpenActions}
              />
            ))
          )}
        </ScrollView>

        {/* Manual create FAB — bottom right */}
        <Pressable
          onPress={() => setCreateOpen(true)}
          style={{
            position: 'absolute',
            right: 20,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#F97316',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
          accessibilityRole="button"
          accessibilityLabel="New manual todo"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>

        {/* Action sheet (Snooze / Open / Dismiss) */}
        <TodoActionSheet
          visible={!!actionTodo}
          todo={actionTodo}
          onClose={() => setActionTodo(null)}
          onSnooze={onSnooze}
          onDismiss={onDismiss}
          onOpen={onOpen}
        />

        {/* Manual create modal */}
        <ManualTodoModal
          visible={createOpen}
          projectId={activeProject?.id ?? null}
          onClose={() => setCreateOpen(false)}
          onCreated={reload}
        />

        {/* 5-second undo toast for mark-done */}
        <UndoToast
          title={pendingUndo?.title ?? null}
          durationSec={UNDO_WINDOW_MS / 1000}
          onUndo={onUndo}
        />
      </View>
    </>
  );
}
