# TRACK SPRINT 38C — Delivery Updates (Time + Partial Shipments)
# MODEL: /model claude-opus-4-6
# Repo: notchfield-track
# DEPENDS ON: Takeoff Sprint 38A (packing verification + delivery_time column)

---

## Context

Read CLAUDE_TRACK.md before starting.

Takeoff Sprint 38A added these changes to the shared Supabase database:

1. New column on `delivery_tickets`: `delivery_time TIME` — stores when delivery arrives
2. New column on `delivery_tickets`: `has_shortages BOOLEAN DEFAULT false` — flags partial shipments
3. New table: `delivery_ticket_item_checks` — packing verification per item:
   - id, organization_id, ticket_id, ticket_item_id
   - check_status ('pending', 'verified', 'short', 'damaged', 'unavailable')
   - quantity_confirmed, quantity_short, shortage_reason, notes
   - checked_by, checked_at

4. New column on `delivery_ticket_items`: the `quantity_ordered` field gets ADJUSTED 
   when warehouse reports a shortage (reduced to what was actually packed/shipped)

Track's delivery review feature (Sprint 34) currently shows deliveries for foreman 
to confirm receipt. It needs to be updated to:
- Show the delivery time so foreman knows WHEN material arrives
- Show partial shipment warnings so foreman knows BEFORE confirming that items are short
- Show packing verification details (what warehouse actually packed vs what was requested)

---

## CHANGE 1: PowerSync Schema Updates

In `src/shared/lib/powersync/schema.ts`, add:

### New table: delivery_ticket_item_checks
```typescript
delivery_ticket_item_checks: new Table({
  // PowerSync uses TEXT for UUIDs
  organization_id: column.text,
  ticket_id: column.text,
  ticket_item_id: column.text,
  check_status: column.text,       // 'pending', 'verified', 'short', 'damaged', 'unavailable'
  quantity_confirmed: column.real,
  quantity_short: column.real,
  shortage_reason: column.text,
  notes: column.text,
  checked_by: column.text,
  checked_at: column.text,
  created_at: column.text,
  updated_at: column.text,
}),
```

### Update delivery_tickets table — add new columns:
```typescript
// Add to existing delivery_tickets definition:
delivery_time: column.text,         // TIME stored as text in PowerSync
has_shortages: column.integer,      // BOOLEAN as integer (0/1) in PowerSync
```

### Verify delivery_ticket_items has quantity_ordered
It should already exist from previous sprints. Confirm it's there.

---

## CHANGE 2: Sync Rules Update

In `powersync/sync-rules.yaml`, add the new table:

```yaml
- SELECT * FROM delivery_ticket_item_checks WHERE organization_id = bucket.organization_id
```

Verify delivery_tickets sync rule includes the new columns (delivery_time, has_shortages).
PowerSync SELECT * should automatically pick them up, but verify.

---

## CHANGE 3: Delivery Review Screen — Show Delivery Time

The delivery review screen (find it — likely in a Deliveries tab or notification flow) 
shows incoming delivery tickets for the foreman to review and confirm.

### Add delivery time to the delivery card header:

Current:
```
┌─────────────────────────────────┐
│ DT-1000                         │
│ Washroom 01-032                 │
│ Ship: 04/07/26                  │
│ 2 items                         │
└─────────────────────────────────┘
```

New:
```
┌─────────────────────────────────┐
│ DT-1000                         │
│ Washroom 01-032                 │
│ Ship: 04/07/26  🕐 1:00 PM     │  ← delivery_time displayed here
│ 2 items                         │
└─────────────────────────────────┘
```

- If delivery_time is null, don't show the time (just show date)
- If delivery_time has a value, format as "h:mm A" (e.g., "1:00 PM")
- Use the clock icon or similar visual indicator
- Font size: 16sp minimum (field readable)

---

## CHANGE 4: Partial Shipment Warning

When a delivery ticket has `has_shortages = true`, the foreman needs to see this 
PROMINENTLY before they start confirming items.

### Warning banner at top of delivery detail:

```
┌─────────────────────────────────────────┐
│ ⚠️  PARTIAL SHIPMENT                    │
│ Warehouse reported shortages on this     │
│ delivery. Check quantities carefully.    │
└─────────────────────────────────────────┘
```

- Background: amber/warning color (use existing warning style from Track)
- Show ONLY when has_shortages = true
- Position: at the top of the delivery detail screen, before the item list
- Touch target not needed — this is informational only

### Item-level shortage indicators:

In the item list, for each delivery_ticket_item, check if there's a matching 
delivery_ticket_item_checks record:

- If check_status = 'verified': show green indicator ✅ "Packed: X SF"
- If check_status = 'short': show amber indicator ⚠️ "Packed: X SF (short Y SF)"
  - Also show the shortage_reason from the check record
- If check_status = 'damaged': show red indicator 🔴 "Damaged in warehouse"
- If check_status = 'unavailable': show red indicator 🔴 "Not available"

Example item display:
```
┌─────────────────────────────────────────┐
│ CT-04  FLORIM STONE MONTPELLIER 24X48   │
│ Ordered: 2,000 SF                        │
│ ✅ Packed: 2,000 SF                      │  ← verified, full qty
│                                          │
│ [Qty Received: ________] [Confirm ✓]    │
├──────────────────────────────────────────┤
│ Laticrete Tri Lite Thinset               │
│ Ordered: 200 bags                        │
│ ⚠️ Packed: 150 bags (short 50 bags)     │  ← shortage reported
│ Reason: Not in stock                     │
│                                          │
│ [Qty Received: ________] [Confirm ✓]    │
└─────────────────────────────────────────┘
```

The foreman's received quantity input should DEFAULT to the packed quantity 
(quantity_confirmed from the check), NOT the original quantity_ordered.
This way, if warehouse packed 150 of 200, the foreman sees "150" pre-filled 
and just confirms. If they received less than 150, they adjust down.

---

## CHANGE 5: Update Delivery Confirmation Logic

The existing confirmation flow writes to delivery_ticket_items:
- receipt_status: 'received' / 'short' / 'damaged'
- quantity_received: what foreman actually received

Update this logic:
1. Pre-fill quantity_received with quantity_confirmed (from packing check) 
   instead of quantity_ordered
2. If quantity_received < quantity_confirmed → receipt_status = 'short' 
   (lost in transit)
3. If quantity_received = quantity_confirmed AND check_status was 'short' → 
   receipt_status = 'received' but the original shortage from warehouse is 
   already reflected in the adjusted quantity_ordered
4. "Confirm All" button should use quantity_confirmed values as the default 
   received quantities (not quantity_ordered)

---

## CHANGE 6: Delivery List — Visual Indicators

In the delivery list (where foreman sees all pending deliveries), add:

1. **Delivery time** — show next to the date: "Apr 7 · 1:00 PM"
2. **Partial badge** — if has_shortages = true, show "⚠️ Partial" badge 
   on the delivery card in the list view
3. Sort deliveries by delivery_time ascending (earliest first) when available

---

## Styling Notes (Field-First Design)

Follow existing Track UX rules:
- Minimum touch targets: 48x48dp, prefer 56x56dp for primary actions
- Font sizes: 16sp minimum for content, 14sp minimum for secondary
- High contrast colors for status indicators
- Warning banner: solid amber background, bold text, visible in sunlight
- Shortage text: use amber/orange for short items, red for damaged/unavailable

---

## Verify

1. delivery_ticket_item_checks table added to PowerSync schema
2. delivery_time and has_shortages columns added to delivery_tickets in schema
3. Sync rules updated to include delivery_ticket_item_checks
4. Delivery cards show delivery_time formatted as "h:mm A" when available
5. Partial shipment warning banner shows when has_shortages = true
6. Item-level packing status shown (verified/short/damaged/unavailable)
7. Shortage reason displayed on short items
8. Quantity received pre-fills with quantity_confirmed (not quantity_ordered)
9. "Confirm All" uses packed quantities as defaults
10. Delivery list shows time and partial badge
11. Deliveries sorted by delivery_time ascending
12. npx tsc --noEmit passes
