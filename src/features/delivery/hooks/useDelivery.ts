import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import {
  fetchDeliveryRows,
  fetchDeliveryTickets,
  fetchPendingReviews,
  fetchIncomingDeliveries,
  fetchMaterialConsumption,
  getDeliveryCounts,
  type DeliveryRow,
  type DeliveryTicket,
  type MaterialRow,
} from '../services/delivery-service';

export function useDelivery() {
  const { profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [pendingReviews, setPendingReviews] = useState<DeliveryTicket[]>([]);
  const [incoming, setIncoming] = useState<DeliveryTicket[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeProject || !profile) return;
    setLoading(true);
    const [r, t, pr, inc, m] = await Promise.all([
      fetchDeliveryRows(activeProject.id, profile.organization_id),
      fetchDeliveryTickets(activeProject.id, profile.organization_id),
      fetchPendingReviews(activeProject.id, profile.organization_id),
      fetchIncomingDeliveries(activeProject.id, profile.organization_id),
      fetchMaterialConsumption(activeProject.id, profile.organization_id),
    ]);
    setRows(r);
    setTickets(t);
    setPendingReviews(pr);
    setIncoming(inc);
    setMaterials(m);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, profile?.organization_id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const counts = getDeliveryCounts(tickets);

  // Badge count for Docs tab: pending reviews + incoming
  const badgeCount = pendingReviews.length + incoming.length;

  return { rows, tickets, pendingReviews, incoming, materials, loading, reload, counts, badgeCount };
}
