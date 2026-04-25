/**
 * Sprint 53A — useAreaMessages.
 *
 * Watches field_messages for an area in real-time using two strategies:
 *   1. PowerSync local sync — primary, offline-safe, fires on every local
 *      INSERT or remote SYNC.
 *   2. Supabase realtime channel — fallback for cross-app reactivity (Web
 *      writes a message → Track sees it within ~1s without waiting for
 *      PowerSync's debounced sync window).
 *
 * Both strategies write to the same `messages` state via reload(). On
 * realtime fires we silently refetch (no loading flash, same pattern as
 * useWorkTickets after the flicker fix).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import {
  listAreaMessages,
  hydrateMessageDisplayFields,
  createMessage,
  recentMessageCount,
} from '../services/messagesService';
import type { FieldMessage, MessageType } from '../types';

export function useAreaMessages(params: {
  projectId: string | null;
  areaId: string | null;
  limit?: number;
}) {
  const { projectId, areaId, limit = 50 } = params;
  const [messages, setMessages] = useState<FieldMessage[]>([]);
  // Initial true so the thread doesn't flash empty-state before first load.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mounted ref so realtime callback doesn't setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!projectId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      const raw = await listAreaMessages({ projectId, areaId, limit });
      const hydrated = await hydrateMessageDisplayFields(raw);
      if (mountedRef.current) {
        setMessages(hydrated);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load messages');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [projectId, areaId, limit]);

  // Refocus refresh — keeps the thread fresh when foreman returns from
  // another screen.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Supabase realtime cross-app subscription. PowerSync covers Track→Track
  // already; this catches Web→Track inserts before the next sync window.
  useEffect(() => {
    if (!projectId) return;

    const filter = areaId
      ? `area_id=eq.${areaId}`
      : `project_id=eq.${projectId}`; // null area → fall back to project filter
    const channelName = `field_messages_${projectId}_${areaId ?? 'general'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'field_messages',
          filter,
        },
        () => {
          // Silent reload — no loading toggle (avoid flicker).
          reload();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, areaId, reload]);

  /**
   * Send a new message. Photos can be local URIs (composer just snapped
   * camera) or pre-uploaded remote URLs. The photo-queue worker will
   * upload local URIs in the background and patch the row with remote URLs.
   */
  const send = useCallback(
    async (input: {
      organizationId: string;
      senderId: string;
      messageType: MessageType;
      body: string;
      photos?: string[];
    }) => {
      if (!projectId) return { success: false, error: 'No project selected' };

      const result = await createMessage({
        organizationId: input.organizationId,
        projectId,
        areaId,
        senderId: input.senderId,
        messageType: input.messageType,
        body: input.body,
        photos: input.photos,
      });

      if (result.success) {
        // Optimistic local refetch — PowerSync should have the row already
        await reload();
      }
      return result;
    },
    [projectId, areaId, reload],
  );

  return {
    messages,
    loading,
    error,
    reload,
    send,
  };
}

/**
 * Lightweight hook for the Ready Board area card — returns just a count of
 * recent messages (last 24h). No subscription, no list.
 */
export function useAreaMessageActivity(
  areaId: string | null,
  windowHours = 24,
): { recentCount: number; reload: () => Promise<void> } {
  const [recentCount, setRecentCount] = useState(0);

  const reload = useCallback(async () => {
    if (!areaId) {
      setRecentCount(0);
      return;
    }
    const n = await recentMessageCount(areaId, windowHours);
    setRecentCount(n);
  }, [areaId, windowHours]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { recentCount, reload };
}
