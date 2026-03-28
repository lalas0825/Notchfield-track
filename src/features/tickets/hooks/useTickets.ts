import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';

export type TicketRow = {
  id: string;
  project_id: string;
  number: number;
  title: string;
  description: string | null;
  status: string;
  floor: string | null;
  area: string | null;
  photos: string[];
  created_by: string;
  created_at: string;
};

export function useTickets() {
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!activeProject || !profile) return;
    setLoading(true);

    const { data } = await supabase
      .from('work_tickets')
      .select('id, project_id, number, title, description, status, floor, area, photos, created_by, created_at')
      .eq('project_id', activeProject.id)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    setTickets((data ?? []) as TicketRow[]);
    setLoading(false);
  }, [activeProject?.id, profile?.organization_id]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = useCallback(
    async (params: {
      title: string;
      description: string;
      floor: string | null;
      area: string | null;
      photos: string[];
      status?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      if (!user || !activeProject || !profile) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase.from('work_tickets').insert({
        project_id: activeProject.id,
        organization_id: profile.organization_id,
        title: params.title,
        description: params.description,
        status: params.status ?? 'draft',
        floor: params.floor,
        area: params.area,
        photos: params.photos,
        created_by: user.id,
      });

      if (error) {
        console.error('[Tickets] Create failed:', error.message);
        return { success: false, error: error.message };
      }

      console.log(`[Tickets] Created: ${params.title}`);
      await fetchTickets();
      return { success: true };
    },
    [user, activeProject, profile, fetchTickets],
  );

  const updateStatus = useCallback(
    async (ticketId: string, status: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('work_tickets')
        .update({ status })
        .eq('id', ticketId);

      if (error) return { success: false, error: error.message };
      await fetchTickets();
      return { success: true };
    },
    [fetchTickets],
  );

  return { tickets, loading, fetchTickets, createTicket, updateStatus };
}
