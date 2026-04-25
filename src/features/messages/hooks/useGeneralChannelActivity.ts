/**
 * Sprint 53A.1 — Activity counter for the project-level General channel.
 *
 * Returns the count of UNREAD messages in the General channel (area_id IS NULL).
 * "Unread" = created after the user's last visit, AND not authored by the user
 * themselves (no point flagging your own messages).
 *
 * "Last visit" is tracked in AsyncStorage per (user, project) pair.
 * ProjectNotesScreen calls `markGeneralChannelVisited` on blur (when the
 * user navigates away after reading), and the count resets to 0.
 *
 * The hook is consumed by TWO surfaces:
 *   - <ProjectNotesIcon/>      mounted in the Home screen header
 *   - <Tabs.Screen name="messages" tabBarBadge={...}/> in (tabs)/_layout.tsx
 *
 * Both surfaces stay in sync because:
 *   - DeviceEventEmitter fires GENERAL_CHANNEL_VISITED when markVisited
 *     runs → both subscribers re-fetch the count from the DB.
 *   - Supabase realtime channel fires on every INSERT on field_messages
 *     for the active project → both subscribers re-fetch.
 *
 * Why local AsyncStorage for read state, not a DB column: read receipts on
 * field_messages would require schema coordination with Web (per
 * SPRINT_53_TAKEOFF_COORDINATION.md §3.3). Local storage is sufficient
 * for v1 — each device tracks its own read state.
 */

import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localQuery } from '@/shared/lib/powersync/write';
import { supabase } from '@/shared/lib/supabase/client';

const VISIT_KEY_PREFIX = 'messages:lastVisit:';
const FALLBACK_WINDOW_HOURS = 24;
const VISITED_EVENT = 'general_channel_visited';

function visitKey(userId: string, projectId: string): string {
  return `${VISIT_KEY_PREFIX}${userId}:${projectId}`;
}

async function getLastVisitedAt(userId: string, projectId: string): Promise<string> {
  const stored = await AsyncStorage.getItem(visitKey(userId, projectId));
  if (stored) return stored;
  // First-time user — count messages from the last 24h to surface activity
  return new Date(Date.now() - FALLBACK_WINDOW_HOURS * 3600000).toISOString();
}

/**
 * Mark the General channel as just-visited. Persists to AsyncStorage AND
 * emits an event so both ProjectNotesIcon (Home) and the bottom tab
 * badge re-render immediately with count=0.
 */
export async function markGeneralChannelVisited(
  userId: string,
  projectId: string,
): Promise<void> {
  await AsyncStorage.setItem(visitKey(userId, projectId), new Date().toISOString());
  DeviceEventEmitter.emit(VISITED_EVENT, { userId, projectId });
}

export function useGeneralChannelActivity(
  userId: string | null | undefined,
  projectId: string | null | undefined,
) {
  const [recentCount, setRecentCount] = useState(0);

  const reload = useCallback(async () => {
    if (!userId || !projectId) {
      setRecentCount(0);
      return;
    }
    const lastVisited = await getLastVisitedAt(userId, projectId);
    const rows = await localQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM field_messages
         WHERE project_id = ?
           AND area_id IS NULL
           AND sender_id != ?
           AND created_at > ?`,
      [projectId, userId, lastVisited],
    );
    setRecentCount((rows?.[0]?.n as number) ?? 0);
  }, [userId, projectId]);

  // (1) Initial load + listen for visit events to reset count instantly
  useEffect(() => {
    reload();
    const sub = DeviceEventEmitter.addListener(VISITED_EVENT, (payload: { userId: string; projectId: string }) => {
      // Only re-fetch if the visit was for the same (user, project) we're tracking
      if (payload?.userId === userId && payload?.projectId === projectId) {
        reload();
      }
    });
    return () => sub.remove();
  }, [reload, userId, projectId]);

  // (2) Realtime — refresh when a new message arrives in the project
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`general_activity_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'field_messages',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, reload]);

  return { recentCount, reload };
}
