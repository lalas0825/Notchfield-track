# TRACK UPDATE — Sync with Takeoff Sprints 29-37
# MODEL: /model claude-haiku-4-5
# Repo: notchfield-track

---

## Context

Takeoff had many sprints (29-37) that added/changed tables and columns.
Track needs to update PowerSync schema + sync rules + any affected UI.
Read CLAUDE_TRACK.md for current schema.

---

## 1. PowerSync Schema Updates (schema.ts)

### New columns on delivery_tickets:
Add if not already present:
- ticket_number: column.text
- requested_by: column.text
- shipping_method: column.text
- priority: column.text
- shipped_by: column.text
- approved_at: column.text
- shipped_at: column.text

### New columns on delivery_ticket_items:
Verify these exist:
- material_code: column.text
- quantity_ordered: column.real (NOT quantity)
- quantity_received: column.real
- receipt_status: column.text
- receipt_notes: column.text

### New columns on production_areas:
Add if not already present:
- area_code: column.text
- drawing_reference: column.text
- description: column.text

### Tables Track does NOT need (do not add):
- scope_materials (PM only)
- scope_groups (PM only)
- scope_column_definitions (PM only)
- purchase_orders (PM/warehouse only)
- purchase_order_items (PM/warehouse only)

---

## 2. Sync Rules Update (sync-rules.yaml)

Verify delivery_tickets sync rule exists.
No new tables needed for Track from sprints 29-37.

---

## 3. Delivery Confirmation — Filter by status

Track should only show delivery tickets with status IN ('shipped', 'delivered').
The foreman should NOT see: draft, pending_review, approved, preparing.

In the delivery feature, update the query that loads delivery tickets:
```
WHERE status IN ('shipped', 'delivered')
```

If already confirmed (status = 'confirmed'), show as read-only with receipt data.

---

## 4. Delivery Ticket Display

Update the delivery ticket card in Track to show:
- Ticket number (DT-1000)
- Destination
- Shipping date
- Priority badge (if urgent)
- Item count
- Status

---

## 5. Verify

1. PowerSync schema has new columns on delivery_tickets
2. delivery_ticket_items uses quantity_ordered (not quantity)
3. production_areas has area_code, drawing_reference, description
4. Delivery list only shows shipped/delivered tickets
5. No scope_materials or purchase_orders in schema
6. npx tsc --noEmit passes
