/**
 * Delivery Service — Track T3
 * =============================
 * Foreman confirms deliveries in the field.
 * Per-item: received / short / damaged / rejected.
 * Material consumption tracked per area.
 *
 * All writes go through PowerSync (offline-first).
 * Takeoff web reads the same tables for PM dashboard.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { localUpdate, localInsert, generateUUID } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';

export type DeliveryTicket = {
  id: string;
  organization_id: string;
  project_id: string;
  supplier_name: string;
  supplier_po: string | null;
  ticket_number: string | null;
  status: string;
  delivery_date: string | null;
  received_at: string | null;
  received_by: string | null;
  requested_by: string | null;
  shipping_method: string | null;
  priority: string | null;
  shipped_by: string | null;
  approved_at: string | null;
  shipped_at: string | null;
  ticket_photo_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type DeliveryItem = {
  id: string;
  ticket_id: string;
  area_id: string | null;
  material_name: string;
  material_code: string | null;
  quantity_ordered: number;
  quantity_received: number | null;
  unit: string;
  receipt_status: string; // 'pending' | 'received' | 'short' | 'damaged' | 'rejected'
  receipt_notes: string | null;
  receipt_photos: string[];
};

export type MaterialRow = {
  id: string;
  area_id: string;
  material_name: string;
  unit: string;
  target_qty: number;
  delivered_qty: number;
  installed_qty: number;
  surplus_qty: number;
  waste_pct: number;
};

// ─── Fetch ─────────────────────────────────────

export async function fetchDeliveryTickets(
  projectId: string,
  organizationId: string,
): Promise<DeliveryTicket[]> {
  const { data } = await supabase
    .from('delivery_tickets')
    .select('*')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .in('status', ['shipped', 'delivered', 'partial', 'confirmed'])
    .order('delivery_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  return (data ?? []) as DeliveryTicket[];
}

export async function fetchDeliveryItems(ticketId: string): Promise<DeliveryItem[]> {
  const { data } = await supabase
    .from('delivery_ticket_items')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('material_name');

  return (data ?? []) as DeliveryItem[];
}

export async function fetchMaterialConsumption(
  projectId: string,
  organizationId: string,
): Promise<MaterialRow[]> {
  const { data } = await supabase
    .from('material_consumption')
    .select('*')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .order('material_name');

  return (data ?? []) as MaterialRow[];
}

// ─── Confirm delivery items ────────────────────

export async function confirmItem(
  itemId: string,
  status: 'received' | 'short' | 'damaged' | 'rejected',
  quantityReceived: number,
  notes?: string,
  photos?: string[],
): Promise<{ success: boolean; error?: string }> {
  const result = await localUpdate('delivery_ticket_items', itemId, {
    receipt_status: status,
    quantity_received: quantityReceived,
    receipt_notes: notes ?? null,
    receipt_photos: photos ?? [],
    updated_at: new Date().toISOString(),
  });

  if (!result.success) return result;
  logger.info('Delivery', `Item ${itemId} confirmed: ${status} (${quantityReceived})`);
  return { success: true };
}

/**
 * Confirm ALL items in a ticket as received (one-tap).
 */
export async function confirmAllItems(ticketId: string): Promise<{ success: boolean; error?: string }> {
  const items = await fetchDeliveryItems(ticketId);
  const pending = items.filter((i) => i.receipt_status === 'pending');

  for (const item of pending) {
    await localUpdate('delivery_ticket_items', item.id, {
      receipt_status: 'received',
      quantity_received: item.quantity_ordered,
      updated_at: new Date().toISOString(),
    });
  }

  logger.info('Delivery', `All ${pending.length} items confirmed for ticket ${ticketId}`);
  return { success: true };
}

/**
 * Mark a delivery ticket as delivered/partial based on item statuses.
 */
export async function finalizeTicket(
  ticketId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const items = await fetchDeliveryItems(ticketId);
  const allReceived = items.every((i) => i.receipt_status === 'received');
  const anyPending = items.some((i) => i.receipt_status === 'pending');

  let status = 'partial';
  if (allReceived) status = 'delivered';
  if (anyPending) status = 'pending';

  const result = await localUpdate('delivery_tickets', ticketId, {
    status,
    received_at: new Date().toISOString(),
    received_by: userId,
    updated_at: new Date().toISOString(),
  });

  if (!result.success) return result;
  logger.info('Delivery', `Ticket ${ticketId} finalized: ${status}`);
  return { success: true };
}

// ─── Material consumption ──────────────────────

/**
 * Update installed_qty for a material in an area.
 * Called when foreman marks surfaces complete.
 */
export async function updateInstalledQty(
  consumptionId: string,
  installedQty: number,
): Promise<{ success: boolean; error?: string }> {
  const result = await localUpdate('material_consumption', consumptionId, {
    installed_qty: installedQty,
    updated_at: new Date().toISOString(),
  });

  if (!result.success) return result;
  logger.info('Delivery', `Material ${consumptionId} installed: ${installedQty}`);
  return { success: true };
}

/**
 * Update delivered_qty when a delivery item is confirmed.
 * Finds or creates the material_consumption row for the area.
 */
export async function updateDeliveredQty(params: {
  organizationId: string;
  projectId: string;
  areaId: string;
  materialName: string;
  materialCode: string | null;
  unit: string;
  deliveredQty: number;
}): Promise<{ success: boolean; error?: string }> {
  // Check if consumption row exists
  const { data: existing } = await supabase
    .from('material_consumption')
    .select('id, delivered_qty')
    .eq('project_id', params.projectId)
    .eq('area_id', params.areaId)
    .eq('material_name', params.materialName)
    .single();

  if (existing) {
    return localUpdate('material_consumption', existing.id, {
      delivered_qty: (existing.delivered_qty ?? 0) + params.deliveredQty,
      updated_at: new Date().toISOString(),
    });
  }

  // Create new row
  return localInsert('material_consumption', {
    id: generateUUID(),
    organization_id: params.organizationId,
    project_id: params.projectId,
    area_id: params.areaId,
    material_name: params.materialName,
    material_code: params.materialCode,
    unit: params.unit,
    target_qty: 0,
    delivered_qty: params.deliveredQty,
    installed_qty: 0,
    surplus_qty: 0,
    waste_pct: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// ─── Pending reviews + incoming ───────────────

/**
 * Fetch tickets needing foreman review (pending_review).
 */
export async function fetchPendingReviews(
  projectId: string,
  organizationId: string,
): Promise<DeliveryTicket[]> {
  const { data } = await supabase
    .from('delivery_tickets')
    .select('*')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  return (data ?? []) as DeliveryTicket[];
}

/**
 * Fetch incoming deliveries (shipped, in transit).
 */
export async function fetchIncomingDeliveries(
  projectId: string,
  organizationId: string,
): Promise<DeliveryTicket[]> {
  const { data } = await supabase
    .from('delivery_tickets')
    .select('*')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .eq('status', 'shipped')
    .order('delivery_date', { ascending: true });

  return (data ?? []) as DeliveryTicket[];
}

/**
 * Approve a delivery ticket (pending_review → approved).
 */
export async function approveTicket(
  ticketId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await localUpdate('delivery_tickets', ticketId, {
    status: 'approved',
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (!result.success) return result;
  logger.info('Delivery', `Ticket ${ticketId} approved`);
  return { success: true };
}

/**
 * Request changes on a delivery ticket (append note, keep status).
 */
export async function requestChanges(
  ticketId: string,
  note: string,
  existingNotes: string | null,
): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toLocaleString();
  const appendedNote = existingNotes
    ? `${existingNotes}\n\n[${timestamp}] Change requested: ${note}`
    : `[${timestamp}] Change requested: ${note}`;

  const result = await localUpdate('delivery_tickets', ticketId, {
    notes: appendedNote,
    updated_at: new Date().toISOString(),
  });
  if (!result.success) return result;
  logger.info('Delivery', `Changes requested on ${ticketId}`);
  return { success: true };
}

// ─── Counts ────────────────────────────────────

export function getDeliveryCounts(tickets: DeliveryTicket[]) {
  return {
    pending: tickets.filter((t) => t.status === 'pending' || t.status === 'in_transit' || t.status === 'shipped').length,
    delivered: tickets.filter((t) => t.status === 'delivered' || t.status === 'confirmed').length,
    partial: tickets.filter((t) => t.status === 'partial').length,
    total: tickets.length,
  };
}
