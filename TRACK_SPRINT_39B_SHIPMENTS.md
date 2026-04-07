# TRACK SPRINT 39B — Shipment-Aware Delivery Review
# MODEL: /model claude-opus-4-6
# Repo: notchfield-track
# DEPENDS ON: Takeoff Sprint 39A (delivery_shipments tables)

---

## Context

Read CLAUDE_TRACK.md before starting.

Takeoff Sprint 39A added shipments to delivery tickets. One DT can now have 
multiple shipments (e.g., DT-1000 has 3 shipments across 3 days). Each shipment 
is packed, verified, and shipped independently.

New tables in shared Supabase:

1. `delivery_shipments` — one per truck/shipment:
   - id, organization_id, ticket_id, shipment_number (1, 2, 3...)
   - status ('pending', 'preparing', 'shipped', 'delivered', 'confirmed')
   - ship_date, delivery_time, shipped_at, delivered_at, notes
   
2. `delivery_shipment_items` — what's in each shipment:
   - id, organization_id, shipment_id, ticket_item_id, quantity_shipped

3. `delivery_ticket_item_checks` was updated:
   - Added: shipment_id, shipment_item_id (links checks to shipment, not ticket)

Track currently shows delivery tickets as a flat list. The foreman needs to 
see and confirm SHIPMENTS, not tickets. A DT with 3 shipments means 3 separate 
arrivals on potentially different days — each needs its own confirmation.

---

## CHANGE 1: PowerSync Schema Updates

In `src/shared/lib/powersync/schema.ts`, add:

### New table: delivery_shipments
```typescript
delivery_shipments: new TableV2({
  organization_id: column.text,
  ticket_id: column.text,
  shipment_number: column.integer,
  status: column.text,
  ship_date: column.text,
  delivery_time: column.text,
  shipped_at: column.text,
  delivered_at: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
}),
```

### New table: delivery_shipment_items
```typescript
delivery_shipment_items: new TableV2({
  organization_id: column.text,
  shipment_id: column.text,
  ticket_item_id: column.text,
  quantity_shipped: column.real,
  created_at: column.text,
  updated_at: column.text,
}),
```

### Update delivery_ticket_item_checks — add shipment columns
```typescript
// Add to existing delivery_ticket_item_checks definition:
shipment_id: column.text,
shipment_item_id: column.text,
```

Add both new tables to the Schema export.

---

## CHANGE 2: Sync Rules

In `powersync/sync-rules.yaml`, add:

```yaml
- SELECT * FROM delivery_shipments WHERE organization_id = bucket.organization_id
- SELECT * FROM delivery_shipment_items WHERE organization_id = bucket.organization_id
```

---

## CHANGE 3: Delivery List — Show Shipments, Not Tickets

The delivery list screen (src/app/(tabs)/more/delivery/index.tsx) currently 
shows one card per delivery_ticket. 

Change it to show one card per SHIPMENT that has status 'shipped' 
(meaning it's on its way to the jobsite and needs foreman confirmation).

### Query change:
Instead of:
```sql
SELECT * FROM delivery_tickets WHERE status IN ('shipped', 'delivered')
```

Do:
```sql
SELECT ds.*, dt.ticket_number, dt.destination, dt.has_shortages,
       p.name as project_name
FROM delivery_shipments ds
JOIN delivery_tickets dt ON dt.id = ds.ticket_id
JOIN projects p ON p.id = dt.project_id
WHERE ds.status IN ('shipped', 'delivered')
  AND ds.organization_id = ?
ORDER BY ds.delivery_time ASC NULLS LAST, ds.ship_date ASC
```

### Card display:
```
┌─────────────────────────────────────────┐
│ DT-1000 · Shipment 1 of 3              │
│ Washroom 01-032                         │
│ Apr 7 · 1:00 PM                        │
│ 2 items · 10,000 SF                    │
│                              [Shipped]  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ DT-1000 · Shipment 2 of 3              │
│ Washroom 01-032                         │
│ Apr 8 · 9:00 AM                        │
│ 2 items · 10,000 SF                    │
│                              [Shipped]  │
└─────────────────────────────────────────┘
```

- Title: "DT-{ticket_number} · Shipment {shipment_number} of {total_shipments}"
- For single-shipment DTs (shipment 1 of 1): just show "DT-{ticket_number}"
  (no need to show "Shipment 1 of 1" — keep it clean)
- Use shipment's ship_date and delivery_time (not the ticket's)
- Show partial badge from Sprint 38C if dt.has_shortages = true
- Item count and total quantity come from delivery_shipment_items

### Get total shipment count:
```sql
SELECT COUNT(*) FROM delivery_shipments WHERE ticket_id = ?
```
Or batch this for all visible tickets.

---

## CHANGE 4: Delivery Detail — Shipment Items

The delivery detail screen (src/app/(tabs)/more/delivery/[id].tsx) currently 
receives a ticket_id and shows all delivery_ticket_items.

Change to receive a SHIPMENT id and show delivery_shipment_items.

### Navigation change:
When tapping a shipment card in the list, navigate to:
`/more/delivery/{shipment_id}` (not ticket_id)

### Detail screen changes:
- Header: "DT-1000 · Shipment 2 of 3" (or just "DT-1000" for single shipment)
- Subheader: destination + date + time
- Item list: query delivery_shipment_items for this shipment_id, 
  join with delivery_ticket_items to get material_name, material_code, unit
- Packing checks: filter by shipment_id (already has shipment_id from 38C)
- Quantity pre-fill: use quantity_shipped from delivery_shipment_items 
  (this is what warehouse actually put on the truck)

### Item query:
```sql
SELECT dsi.id, dsi.quantity_shipped, 
       dti.material_name, dti.material_code, dti.unit,
       dti.quantity_ordered as original_qty
FROM delivery_shipment_items dsi
JOIN delivery_ticket_items dti ON dti.id = dsi.ticket_item_id
WHERE dsi.shipment_id = ?
```

### Packing checks query (update from 38C):
```sql
SELECT * FROM delivery_ticket_item_checks 
WHERE shipment_id = ?
```

---

## CHANGE 5: Confirmation Logic — Per Shipment

The confirmation flow currently updates delivery_ticket_items and 
delivery_tickets status. Update to work per shipment.

### On confirm individual item:
- Update delivery_ticket_items.quantity_received (ADD to existing, don't replace)
  since multiple shipments contribute to the same ticket item
- Update delivery_ticket_items.receipt_status based on TOTAL received across 
  all shipments vs quantity_ordered

### On "Confirm All" for a shipment:
1. For each shipment item, set received = quantity_shipped (from shipment)
2. Update delivery_shipments.status = 'confirmed' for THIS shipment
3. Update delivery_shipments.delivered_at = now()
4. Check if ALL shipments for the parent ticket are confirmed:
   - If yes → update delivery_tickets.status = 'confirmed'
   - If not → update delivery_tickets.status = 'delivered' (partial)
5. Update delivery_ticket_items.quantity_received:
   - SUM quantity received across all confirmed shipments for each ticket item
   - If total received = quantity_ordered → receipt_status = 'received'
   - If total received < quantity_ordered → receipt_status = 'short'

### Confirm All button behavior:
Pre-fill with quantity_shipped (what's in THIS shipment), not quantity_ordered 
(what the full DT asked for). The foreman is confirming what arrived on THIS truck.

---

## CHANGE 6: Backward Compatibility

Some delivery tickets might not have shipments yet (created before 39A migration, 
or migration hasn't synced via PowerSync yet).

Handle gracefully:
- If a delivery_ticket has status 'shipped' but NO delivery_shipments exist 
  in the local PowerSync DB, fall back to the old behavior: show the ticket 
  directly with its items from delivery_ticket_items
- Once PowerSync syncs the shipment data, the new flow kicks in automatically
- Check: `SELECT COUNT(*) FROM delivery_shipments WHERE ticket_id = ?`
  - If 0 → old flow (show ticket items directly)
  - If > 0 → new flow (show shipments)

---

## Verify

1. delivery_shipments table added to PowerSync schema
2. delivery_shipment_items table added to PowerSync schema  
3. shipment_id + shipment_item_id added to delivery_ticket_item_checks
4. Sync rules updated for both new tables
5. Delivery list shows shipment cards (not ticket cards)
6. Single-shipment DTs show clean "DT-1000" (no "Shipment 1 of 1")
7. Multi-shipment DTs show "DT-1000 · Shipment 2 of 3"
8. Shipment cards use shipment's ship_date and delivery_time
9. Detail screen loads shipment items (not ticket items)
10. Packing checks filtered by shipment_id
11. Quantity pre-fills with quantity_shipped (shipment qty, not ticket qty)
12. Confirm updates shipment status to 'confirmed'
13. Parent ticket status updates when all shipments confirmed
14. Backward compatible: tickets without shipments still work
15. npx tsc --noEmit passes
