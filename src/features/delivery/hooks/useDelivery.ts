import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import {
  fetchDeliveryTickets,
  fetchMaterialConsumption,
  getDeliveryCounts,
  type DeliveryTicket,
  type MaterialRow,
} from '../services/delivery-service';

export function useDelivery() {
  const { profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeProject || !profile) return;
    setLoading(true);
    const [t, m] = await Promise.all([
      fetchDeliveryTickets(activeProject.id, profile.organization_id),
      fetchMaterialConsumption(activeProject.id, profile.organization_id),
    ]);
    setTickets(t);
    setMaterials(m);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, profile?.organization_id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const counts = getDeliveryCounts(tickets);

  return { tickets, materials, loading, reload, counts };
}
