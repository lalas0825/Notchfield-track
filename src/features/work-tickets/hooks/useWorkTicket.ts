/**
 * useWorkTicket — Sprint 45B
 * Single-ticket hook with realtime subscription. Auto-refreshes the ticket
 * AND its latest signature whenever the server updates them.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import {
  getWorkTicket,
  getSignatureForTicket,
} from '../services/work-tickets-service';
import type { WorkTicket, DocumentSignature } from '../types';

export function useWorkTicket(ticketId: string | null) {
  const [ticket, setTicket] = useState<WorkTicket | null>(null);
  const [signature, setSignature] = useState<DocumentSignature | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!ticketId) {
      setTicket(null);
      setSignature(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        getWorkTicket(ticketId),
        getSignatureForTicket(ticketId),
      ]);
      setTicket(t);
      setSignature(s);
    } catch (err) {
      console.warn('[useWorkTicket] reload failed', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`work_ticket_${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_tickets',
          filter: `id=eq.${ticketId}`,
        },
        () => { reload(); },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_signatures',
          filter: `document_id=eq.${ticketId}`,
        },
        () => { reload(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, reload]);

  return { ticket, signature, loading, reload };
}
