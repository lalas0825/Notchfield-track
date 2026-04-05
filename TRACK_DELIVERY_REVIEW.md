# TRACK — Delivery Review + Foreman Dashboard Alert
# MODEL: /model claude-sonnet-4-6
# Repo: notchfield-track
# DO NOT read CLAUDE_TRACK.md — all context is here

---

## Stack
- Expo SDK 55, React Native, NativeWind (Tailwind), TypeScript
- PowerSync (offline-first SQLite), Zustand stores
- Schema: src/shared/lib/powersync/schema.ts
- Delivery: src/features/delivery/
- Home: src/app/(tabs)/home/
- Bottom tabs: Home | Board | Plans | Docs | More

## Delivery ticket statuses
draft → pending_review → approved → preparing → shipped → delivered → confirmed

Foreman should ONLY see tickets with status: pending_review, shipped, delivered, confirmed.
NOT: draft, approved, preparing (those are PM/warehouse internal).

---

## FEATURE 1: Pending Reviews on Home Dashboard

On the Home tab, add an alert card when delivery tickets need review:

```
┌─────────────────────────────────────────┐
│ 📦 2 Delivery Tickets Need Your Review  │
│ Tap to review and approve               │
│                                    [→]  │
└─────────────────────────────────────────┘
```

Query: delivery_tickets WHERE status = 'pending_review' 
AND project_id = current project.

Tap → navigates to delivery review screen.
Hide card when count = 0.

---

## FEATURE 2: Delivery Review Screen

New screen accessible from Home alert or Docs tab.
Shows tickets with status = 'pending_review':

```
┌─────────────────────────────────────────┐
│ ← Delivery Reviews                      │
├─────────────────────────────────────────┤
│                                         │
│ DT-1000  Washroom 01-032               │
│ Ship: 04/07/26  Priority: Normal        │
│ Requested by: RJJ                       │
│                                         │
│ ITEMS:                                  │
│  CT-04  Florim Montpellier    6,000 SF  │
│  CT-05  Florim Chablis        2,000 SF  │
│                                         │
│ [✅ Approve]  [✏️ Request Changes]      │
│                                         │
├─────────────────────────────────────────┤
│ DT-1001  Floor 3 Tile                   │
│ ...                                     │
└─────────────────────────────────────────┘
```

### "Approve" button
- Updates delivery_ticket status to 'approved' via PowerSync local write
- Toast: "✅ Ticket approved. Sent to warehouse."
- Card disappears from list

### "Request Changes" button
- Opens a text input bottom sheet
- Foreman types: "Need 200 more SF of CT-04"
- Saves note to delivery_tickets.notes (append, don't overwrite)
- Status stays 'pending_review'
- Toast: "📝 Change request sent to PM"

---

## FEATURE 3: Incoming Deliveries (shipped status)

When warehouse ships (status = 'shipped'), foreman sees alert on Home:

```
┌─────────────────────────────────────────┐
│ 🚚 1 Delivery In Transit               │
│ DT-1000 — Expected 04/07               │
│                                    [→]  │
└─────────────────────────────────────────┘
```

And in the delivery list (Docs tab or More tab), shipped tickets appear:

```
INCOMING DELIVERIES
┌─────────────────────────────────────────┐
│ 🚚 DT-1000  Washroom 01-032  In Transit│
│    Expected: 04/07   2 items            │
│                         [📦 Confirm]    │
├─────────────────────────────────────────┤
│ ✅ DT-999  Floor 1 Lobby  Confirmed     │
│    Received: 04/03   All OK             │
└─────────────────────────────────────────┘
```

"Confirm" opens the existing delivery confirmation flow (checklist 
with received/short/damaged per item).

---

## FEATURE 4: Badge on Docs tab

Show a badge count on the Docs bottom tab icon when there are 
pending reviews or incoming deliveries:

```
Docs (3)  ← 2 pending reviews + 1 incoming delivery
```

Query both counts and sum for the badge.

---

## FILES TO CREATE/MODIFY

Create:
- src/features/delivery/components/DeliveryReviewScreen.tsx
- src/features/delivery/components/DeliveryReviewCard.tsx
- src/features/delivery/components/RequestChangesSheet.tsx

Modify:
- Home dashboard: add alert cards for pending reviews + incoming deliveries
- Docs tab or navigation: add route to DeliveryReviewScreen
- Bottom tab layout: add badge count to Docs tab
- delivery store or service: add queries for pending_review and shipped statuses

## UX Rules
- Touch targets 48dp minimum
- Dark mode colors (slate-900 bg, slate-800 cards)
- Haptic feedback on Approve/Confirm
- Optimistic UI for status changes
- Toast notifications 3 seconds

## Verify
1. Home shows "2 Delivery Tickets Need Review" alert
2. Tap opens review screen with ticket details + items
3. "Approve" updates status, card disappears
4. "Request Changes" opens note input, saves to notes
5. Shipped tickets show as "In Transit" with Confirm button
6. Docs tab badge shows count
7. npx tsc --noEmit passes
