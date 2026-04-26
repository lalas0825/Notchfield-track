/**
 * Sprint 69 — useNotifications.
 *
 * Reads in-app notifications for the signed-in user. Two-layer strategy:
 *
 *   1. PowerSync local sync — primary. Reads from the local SQLite
 *      `notifications` table populated by the by_user bucket. Fully
 *      offline-safe.
 *   2. Supabase realtime channel — silent refetch trigger. Cross-app
 *      writes (Web inserts a notification row) reach Track in <1s
 *      without waiting for PowerSync's debounced window. Same pattern as
 *      useAreaMessages.
 *
 * Mock fallback: while Web is still shipping the `notifications` table +
 * /api/notifications/notify endpoint (W1–W4 in SPRINT_TRACK_NOTIFICATIONS.md),
 * Track surfaces MOCK_NOTIFICATIONS so foreman/UI can be developed in
 * parallel. Once Web posts "Sprint 69 backend ready", flip
 * USE_MOCK_NOTIFICATIONS to false and the hook switches to live data with
 * no other changes required.
 *
 * Returns:
 *   - notifications: ordered desc by created_at (newest first)
 *   - unreadCount: count where read_at IS NULL AND archived_at IS NULL
 *   - loading: true on initial fetch only — silent on realtime refetches
 *   - reload(): manual refetch trigger
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type { Notification } from '../types';
import { MOCK_NOTIFICATIONS } from '../mocks/MOCK_NOTIFICATIONS';

/**
 * While Web is still building the backend (DB table + recipient resolver +
 * /api/notifications/notify endpoint, tasks W1–W4 in the spec), Track shows
 * MOCK_NOTIFICATIONS so the UI can be exercised. Web confirms via
 * "Sprint 69 backend ready" message → flip this to false → ship.
 */
const USE_MOCK_NOTIFICATIONS = true;

type RawRow = Record<string, unknown>;

function rowToNotification(row: RawRow): Notification {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    recipient_id: row.recipient_id as string,
    type: row.type as Notification['type'],
    entity_type: (row.entity_type as string | null) ?? null,
    entity_id: (row.entity_id as string | null) ?? null,
    project_id: (row.project_id as string | null) ?? null,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    icon: (row.icon as string) ?? 'notifications-outline',
    severity: (row.severity as Notification['severity']) ?? 'info',
    link_url: (row.link_url as string | null) ?? null,
    read_at: (row.read_at as string | null) ?? null,
    archived_at: (row.archived_at as string | null) ?? null,
    email_sent_at: (row.email_sent_at as string | null) ?? null,
    push_sent_at: (row.push_sent_at as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

function sortDesc(list: Notification[]): Notification[] {
  return [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function countUnread(list: Notification[]): number {
  return list.filter((n) => !n.read_at && !n.archived_at).length;
}

export function useNotifications() {
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
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
        setNotifications([]);
        setLoading(false);
      }
      return;
    }

    // Mock branch — runs until Web ships W1.
    if (USE_MOCK_NOTIFICATIONS) {
      if (mountedRef.current) {
        setNotifications(sortDesc(MOCK_NOTIFICATIONS));
        setLoading(false);
      }
      return;
    }

    // Live branch — read from PowerSync local SQLite. Excludes archived
    // rows (still synced, but the bell shouldn't surface them).
    const rows = await localQuery<RawRow>(
      `SELECT * FROM notifications
         WHERE recipient_id = ?
           AND archived_at IS NULL
         ORDER BY created_at DESC
         LIMIT 100`,
      [userId],
    );

    if (mountedRef.current) {
      const list = rows ? rows.map(rowToNotification) : [];
      setNotifications(list);
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

  // Realtime — only when running live (mock branch has no server data).
  useEffect(() => {
    if (USE_MOCK_NOTIFICATIONS || !userId) return;

    const channel = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
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

  const unreadCount = countUnread(notifications);

  return { notifications, unreadCount, loading, reload };
}
