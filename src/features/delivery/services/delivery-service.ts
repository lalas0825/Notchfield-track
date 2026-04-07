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

// Sprint 39B — Shipments
export type DeliveryRow = {
  id: string; // shipment_id (new) OR ticket_id (legacy fallback)
  type: 'shipment' | 'ticket';
  ticket_id: string;
  ticket_number: string | null;
  supplier_name: string;
  supplier_po: string | null;
  status: string;
  has_shortages: boolean;
  priority: string | null;
  // shipment-specific
  shipment_number?: number;
  total_shipments?: number;
  ship_date?: string | null;
  delivery_time?: string | null;
  // legacy
  delivery_date?: string | null;
};

export type ShipmentItem = {
  id: string; // delivery_shipment_items.id
  shipment_id: string;
  ticket_item_id: string;
  quantity_shipped: number;
  // joined from delivery_ticket_items
  material_name: string;
  material_code: string | null;
  unit: string;
  quantity_ordered: number;
  quantity_received: number | null;
  receipt_status: string;
  area_id: string | null;
};

export type ShipmentDetail = {
  shipment: {
    id: string;
    ticket_id: string;
    shipment_number: number;
    total_shipments: number;
    status: string;
    ship_date: string | null;
    delivery_time: string | null;
  };
  ticket: {
    id: string;
    ticket_number: string | null;
    supplier_name: string;
    has_shortages: boolean;
  };
  items: ShipmentItem[];
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

// ─── Sprint 39B: Shipments ─────────────────────

/**
 * Fetch delivery rows for the list screen.
 * Returns one row per SHIPMENT (with status shipped/delivered/confirmed).
 * Tickets without shipments fall back to one row per ticket (backward compat).
 */
export async function fetchDeliveryRows(
  projectId: string,
  organizationId: string,
): Promise<DeliveryRow[]> {
  const { data: tickets } = await supabase
    .from('delivery_tickets')
    .select('*')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .in('status', ['shipped', 'delivered', 'partial', 'confirmed']);

  if (!tickets?.length) return [];

  const ticketIds = tickets.map((t: any) => t.id);

  const { data: allShipments } = await supabase
    .from('delivery_shipments')
    .select('*')
    .in('ticket_id', ticketIds)
    .eq('organization_id', organizationId);

  // Total shipments per ticket (including non-shipped) for "X of Y" label
  const totalByTicket = new Map<string, number>();
  for (const s of (allShipments ?? []) as any[]) {
    totalByTicket.set(s.ticket_id, (totalByTicket.get(s.ticket_id) ?? 0) + 1);
  }

  // Visible shipments (shipped/delivered/confirmed) grouped by ticket
  const visibleByTicket = new Map<string, any[]>();
  for (const s of (allShipments ?? []) as any[]) {
    if (!['shipped', 'delivered', 'confirmed'].includes(s.status)) continue;
    if (!visibleByTicket.has(s.ticket_id)) visibleByTicket.set(s.ticket_id, []);
    visibleByTicket.get(s.ticket_id)!.push(s);
  }

  const rows: DeliveryRow[] = [];
  for (const ticket of tickets as any[]) {
    const shipments = visibleByTicket.get(ticket.id) ?? [];
    const total = totalByTicket.get(ticket.id) ?? 0;
    const hasShortages = ticket.has_shortages === true || ticket.has_shortages === 1;

    if (shipments.length > 0) {
      for (const s of shipments) {
        rows.push({
          id: s.id,
          type: 'shipment',
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          supplier_name: ticket.supplier_name,
          supplier_po: ticket.supplier_po,
          status: s.status,
          has_shortages: hasShortages,
          priority: ticket.priority,
          shipment_number: s.shipment_number,
          total_shipments: total,
          ship_date: s.ship_date,
          delivery_time: s.delivery_time,
        });
      }
    } else {
      // Backward compat: ticket has no shipments yet → render the ticket itself
      rows.push({
        id: ticket.id,
        type: 'ticket',
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        supplier_name: ticket.supplier_name,
        supplier_po: ticket.supplier_po,
        status: ticket.status,
        has_shortages: hasShortages,
        priority: ticket.priority,
        delivery_date: ticket.delivery_date,
        delivery_time: ticket.delivery_time,
      });
    }
  }

  // Sort by date+time ASC, nulls last
  rows.sort((a, b) => {
    const aDate = a.ship_date ?? a.delivery_date ?? '9999-12-31';
    const bDate = b.ship_date ?? b.delivery_date ?? '9999-12-31';
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    const aTime = a.delivery_time ?? '99:99';
    const bTime = b.delivery_time ?? '99:99';
    return aTime.localeCompare(bTime);
  });

  return rows;
}

/**
 * Fetch one shipment with its items joined to delivery_ticket_items.
 * Returns null if id doesn't match a shipment (caller should fall back to ticket flow).
 */
export async function fetchShipmentDetail(shipmentId: string): Promise<ShipmentDetail | null> {
  const { data: shipment } = await supabase
    .from('delivery_shipments')
    .select('*')
    .eq('id', shipmentId)
    .maybeSingle();

  if (!shipment) return null;

  const [{ data: shipmentItems }, { data: ticket }, { count: total }] = await Promise.all([
    supabase
      .from('delivery_shipment_items')
      .select('*, delivery_ticket_items!inner(material_name, material_code, unit, quantity_ordered, quantity_received, receipt_status, area_id)')
      .eq('shipment_id', shipmentId),
    supabase
      .from('delivery_tickets')
      .select('id, ticket_number, supplier_name, has_shortages')
      .eq('id', shipment.ticket_id)
      .single(),
    supabase
      .from('delivery_shipments')
      .select('*', { count: 'exact', head: true })
      .eq('ticket_id', shipment.ticket_id),
  ]);

  const items: ShipmentItem[] = ((shipmentItems ?? []) as any[]).map((si) => ({
    id: si.id,
    shipment_id: si.shipment_id,
    ticket_item_id: si.ticket_item_id,
    quantity_shipped: si.quantity_shipped,
    material_name: si.delivery_ticket_items.material_name,
    material_code: si.delivery_ticket_items.material_code,
    unit: si.delivery_ticket_items.unit,
    quantity_ordered: si.delivery_ticket_items.quantity_ordered,
    quantity_received: si.delivery_ticket_items.quantity_received,
    receipt_status: si.delivery_ticket_items.receipt_status,
    area_id: si.delivery_ticket_items.area_id,
  }));

  return {
    shipment: {
      id: shipment.id,
      ticket_id: shipment.ticket_id,
      shipment_number: shipment.shipment_number,
      total_shipments: total ?? 1,
      status: shipment.status,
      ship_date: shipment.ship_date,
      delivery_time: shipment.delivery_time,
    },
    ticket: {
      id: ticket?.id ?? shipment.ticket_id,
      ticket_number: ticket?.ticket_number ?? null,
      supplier_name: ticket?.supplier_name ?? '',
      has_shortages: ticket?.has_shortages === true || ticket?.has_shortages === 1,
    },
    items,
  };
}

/**
 * Confirm one item from a shipment.
 * ADDS quantityReceived to the ticket item's existing total (instead of replacing),
 * since multiple shipments contribute to the same ticket item.
 * Recomputes receipt_status based on TOTAL across all shipments.
 */
export async function confirmShipmentItem(
  ticketItemId: string,
  status: 'received' | 'short' | 'damaged' | 'rejected',
  quantityReceived: number,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  // Read current ticket item to get prior received qty + ordered qty
  const { data: current } = await supabase
    .from('delivery_ticket_items')
    .select('quantity_ordered, quantity_received')
    .eq('id', ticketItemId)
    .single();

  if (!current) return { success: false, error: 'item not found' };

  const newTotal = (current.quantity_received ?? 0) + quantityReceived;
  let newStatus = status;
  if (status === 'received' || status === 'short') {
    newStatus = newTotal >= current.quantity_ordered ? 'received' : 'short';
  }

  const result = await localUpdate('delivery_ticket_items', ticketItemId, {
    receipt_status: newStatus,
    quantity_received: newTotal,
    receipt_notes: notes ?? null,
    updated_at: new Date().toISOString(),
  });

  if (!result.success) return result;
  logger.info('Delivery', `Shipment item ${ticketItemId}: +${quantityReceived} → ${newTotal} (${newStatus})`);
  return { success: true };
}

/**
 * Confirm ALL items in a shipment + mark shipment confirmed + recompute parent ticket status.
 */
export async function confirmShipmentAll(
  shipmentId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const detail = await fetchShipmentDetail(shipmentId);
  if (!detail) return { success: false, error: 'shipment not found' };

  // Update each item: ADD quantity_shipped to existing quantity_received
  for (const item of detail.items) {
    const newTotal = (item.quantity_received ?? 0) + item.quantity_shipped;
    const newStatus = newTotal >= item.quantity_ordered ? 'received' : 'short';
    await localUpdate('delivery_ticket_items', item.ticket_item_id, {
      receipt_status: newStatus,
      quantity_received: newTotal,
      updated_at: new Date().toISOString(),
    });
  }

  // Mark this shipment as confirmed
  await localUpdate('delivery_shipments', shipmentId, {
    status: 'confirmed',
    delivered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Recompute parent ticket status
  const { data: siblings } = await supabase
    .from('delivery_shipments')
    .select('id, status')
    .eq('ticket_id', detail.ticket.id);

  const allConfirmed = (siblings ?? []).every((s: any) =>
    s.id === shipmentId ? true : s.status === 'confirmed',
  );

  await localUpdate('delivery_tickets', detail.ticket.id, {
    status: allConfirmed ? 'confirmed' : 'delivered',
    received_at: new Date().toISOString(),
    received_by: userId,
    updated_at: new Date().toISOString(),
  });

  logger.info('Delivery', `Shipment ${shipmentId} confirmed; parent ticket → ${allConfirmed ? 'confirmed' : 'delivered'}`);
  return { success: true };
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
