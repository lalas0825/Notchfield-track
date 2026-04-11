/**
 * useWorkTickets — Sprint 45B
 * List hook with tab filtering + realtime subscription to auto-refresh
 * when tickets or signatures change (cross-app: Web signs → Track updates).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { listWorkTickets, type WorkTicketWithSignature } from '../services/work-tickets-service';

export type TicketFilter = 'all' | 'draft' | 'pending' | 'signed';

export function useWorkTickets(projectId: string | null) {
  const [tickets, setTickets] = useState<WorkTicketWithSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [search, setSearch] = useState('');

  const reload = useCallback(async () => {
    if (!projectId) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listWorkTickets(projectId);
      setTickets(data);
    } catch (err) {
      console.warn('[useWorkTickets] list failed', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime subscription — refresh on any relevant change
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`work_tickets_list_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_tickets',
          filter: `project_id=eq.${projectId}`,
        },
        () => { reload(); },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_signatures',
          filter: `project_id=eq.${projectId}`,
        },
        () => { reload(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, reload]);

  const filtered = tickets.filter((t) => {
    if (filter !== 'all') {
      if (filter === 'draft' && t.status !== 'draft') return false;
      if (filter === 'pending' && t.status !== 'pending') return false;
      if (filter === 'signed' && t.status !== 'signed') return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = [
        t.number != null ? `#${t.number}` : '',
        t.work_description ?? '',
        t.area_description ?? '',
        t.trade ?? '',
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: tickets.length,
    draft: tickets.filter((t) => t.status === 'draft').length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    signed: tickets.filter((t) => t.status === 'signed').length,
  };

  return {
    tickets: filtered,
    allTickets: tickets,
    loading,
    filter,
    setFilter,
    search,
    setSearch,
    counts,
    reload,
  };
}
