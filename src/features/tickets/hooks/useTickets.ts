import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localUpdate, generateUUID } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { logger } from '@/shared/lib/logger';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const result = await localInsert('work_tickets', {
        id: generateUUID(),
        project_id: activeProject.id,
        organization_id: profile.organization_id,
        title: params.title,
        description: params.description,
        status: params.status ?? 'draft',
        floor: params.floor,
        area: params.area,
        photos: params.photos,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      if (!result.success) {
        console.error('[Tickets] Create failed:', result.error);
        return { success: false, error: result.error };
      }

      logger.info(`[Tickets] Created: ${params.title}`);
      await fetchTickets();
      return { success: true };
    },
    [user, activeProject, profile, fetchTickets],
  );

  const updateStatus = useCallback(
    async (ticketId: string, status: string): Promise<{ success: boolean; error?: string }> => {
      const result = await localUpdate('work_tickets', ticketId, { status });

      if (!result.success) return { success: false, error: result.error };
      await fetchTickets();
      return { success: true };
    },
    [fetchTickets],
  );

  return { tickets, loading, fetchTickets, createTicket, updateStatus };
}
