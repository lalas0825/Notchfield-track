/**
 * Sprint 71 polish (2026-04-27) — Per-area unread message counter.
 *
 * Mirror of useGeneralChannelActivity (Sprint 53A.1) but scoped to a
 * single area instead of the project-wide General channel. Powers the
 * badge on the floating <AreaChatBubble/> in the area detail screen.
 *
 * "Unread" = count of field_messages for this area created AFTER the
 * user's last visit, excluding the user's own messages (no point flagging
 * what you wrote yourself).
 *
 * "Last visit" tracked in AsyncStorage per (user, project, area) tuple.
 * AreaChatBubble's modal-close handler calls markAreaVisited → emits
 * AREA_VISITED event → all subscribers re-fetch from local DB instantly.
 *
 * Same realtime + DeviceEventEmitter dual-trigger pattern used elsewhere:
 *   - Realtime fires on every INSERT for this area's messages → reload
 *   - Visit event fires on modal close → reload (count resets to 0)
 *
 * Why local AsyncStorage for read state, not a DB column: read receipts
 * on field_messages would require schema coordination with Web (per the
 * Sprint 53 coordination doc §3.3). Local storage is sufficient for v1.
 */

import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localQuery } from '@/shared/lib/powersync/write';
import { supabase } from '@/shared/lib/supabase/client';

const VISIT_KEY_PREFIX = 'messages:lastVisit:area:';
const FALLBACK_WINDOW_HOURS = 24;
const AREA_VISITED_EVENT = 'area_channel_visited';

function visitKey(
  userId: string,
  projectId: string,
  areaId: string,
): string {
  return `${VISIT_KEY_PREFIX}${userId}:${projectId}:${areaId}`;
}

async function getLastVisitedAt(
  userId: string,
  projectId: string,
  areaId: string,
): Promise<string> {
  const stored = await AsyncStorage.getItem(visitKey(userId, projectId, areaId));
  if (stored) return stored;
  // First-time user — count messages from the last 24h to surface activity
  // (vs returning '1970-01-01' and showing every message ever as "unread").
  return new Date(Date.now() - FALLBACK_WINDOW_HOURS * 3600000).toISOString();
}

/**
 * Mark this area's chat as just-visited. Persists to AsyncStorage AND
 * emits an event so the bubble badge resets to 0 immediately on modal
 * close (no waiting for the next realtime tick).
 */
export async function markAreaVisited(
  userId: string,
  projectId: string,
  areaId: string,
): Promise<void> {
  await AsyncStorage.setItem(
    visitKey(userId, projectId, areaId),
    new Date().toISOString(),
  );
  DeviceEventEmitter.emit(AREA_VISITED_EVENT, { userId, projectId, areaId });
}

export function useAreaMessageActivity(
  userId: string | null | undefined,
  projectId: string | null | undefined,
  areaId: string | null | undefined,
) {
  const [recentCount, setRecentCount] = useState(0);

  const reload = useCallback(async () => {
    if (!userId || !projectId || !areaId) {
      setRecentCount(0);
      return;
    }
    const lastVisited = await getLastVisitedAt(userId, projectId, areaId);
    const rows = await localQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM field_messages
         WHERE project_id = ?
           AND area_id = ?
           AND sender_id != ?
           AND created_at > ?`,
      [projectId, areaId, userId, lastVisited],
    );
    setRecentCount((rows?.[0]?.n as number) ?? 0);
  }, [userId, projectId, areaId]);

  // (1) Initial load + listen for visit events to reset count instantly
  useEffect(() => {
    reload();
    const sub = DeviceEventEmitter.addListener(
      AREA_VISITED_EVENT,
      (payload: { userId: string; projectId: string; areaId: string }) => {
        if (
          payload?.userId === userId &&
          payload?.projectId === projectId &&
          payload?.areaId === areaId
        ) {
          reload();
        }
      },
    );
    return () => sub.remove();
  }, [reload, userId, projectId, areaId]);

  // (2) Realtime — refresh when a new message arrives in this area
  useEffect(() => {
    if (!projectId || !areaId) return;
    const channel = supabase
      .channel(`area_activity_${projectId}_${areaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'field_messages',
          filter: `area_id=eq.${areaId}`,
        },
        () => {
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, areaId, reload]);

  return { recentCount, reload };
}
