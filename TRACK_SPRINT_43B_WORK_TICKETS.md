# SPRINT 43B — Track Work Tickets (Foreman Field Use)
# MODEL: /model claude-opus-4-6
# Repo: notchfield-track
# DEPENDS ON: Takeoff Sprint 43A (work_tickets + document_signatures tables)

---

## Context

Read CLAUDE_TRACK.md before starting.

Sprint 43A created work_tickets and document_signatures tables in the shared 
Supabase, plus a public signing page at /sign/{token}. The foreman needs to 
create T&M Work Tickets in Track, send them for GC signature via email, and 
see the status update when the GC signs.

The flow:
1. Foreman opens Track → More → Work Tickets
2. Creates a new ticket (date, description, trade, labor, materials)
3. Taps "Send for Signature" → enters GC email → system generates sign link
4. Opens email client with pre-filled email containing sign link
5. GC receives email, clicks link, signs on public page
6. Foreman sees ticket status change from "Pending" to "Signed" (via PowerSync)

All offline-first. Foreman can create tickets without internet — they sync 
and send when connection is restored.

---

## CHANGE 1: PowerSync Schema

In `src/shared/lib/powersync/schema.ts`, add:

### work_tickets
```typescript
work_tickets: new TableV2({
  organization_id: column.text,
  project_id: column.text,
  ticket_number: column.integer,
  service_date: column.text,
  work_description: column.text,
  trade: column.text,
  labor: column.text,           // JSON string
  materials: column.text,       // JSON string
  gc_notes: column.text,
  status: column.text,
  signature_token: column.text,
  created_by: column.text,
  foreman_name: column.text,
  area_description: column.text,
  floor: column.text,
  priority: column.text,
  created_at: column.text,
  updated_at: column.text,
}),
```

### document_signatures
```typescript
document_signatures: new TableV2({
  organization_id: column.text,
  document_type: column.text,
  document_id: column.text,
  project_id: column.text,
  signer_name: column.text,
  signer_email: column.text,
  signer_role: column.text,
  signature_url: column.text,
  status: column.text,
  token: column.text,
  content_hash: column.text,
  hash_algorithm: column.text,
  hashed_at: column.text,
  ip_address: column.text,
  user_agent: column.text,
  signed_at: column.text,
  declined_at: column.text,
  decline_reason: column.text,
  expires_at: column.text,
  created_at: column.text,
}),
```

Add both to Schema export.

---

## CHANGE 2: Sync Rules

In `powersync/sync-rules.yaml`, add:

```yaml
- SELECT * FROM work_tickets WHERE organization_id = bucket.organization_id
- SELECT * FROM document_signatures WHERE organization_id = bucket.organization_id
```

---

## CHANGE 3: Work Tickets List Screen

Create `src/app/(tabs)/more/work-tickets/index.tsx`

### Layout
```
┌─────────────────────────────────────────┐
│ Work Tickets                [+ New]     │
│ 8 tickets                               │
├─────────────────────────────────────────┤
│                                         │
│ [Drafts] [Pending] [Signed] [All]       │  ← tab filters
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ #1042  Marble patching FL34        │ │
│ │ Apr 8, 2026 · Tile                 │ │
│ │ 2 workers · 18 hrs                 │ │
│ │                        [Draft]  ▸  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ #1041  Grout repair lobby          │ │
│ │ Apr 7, 2026 · Tile                 │ │
│ │ 1 worker · 8 hrs                   │ │
│ │              [Pending Signature] ▸  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ #1040  Stone threshold install     │ │
│ │ Apr 5, 2026 · Stone                │ │
│ │ 3 workers · 24 hrs                 │ │
│ │ Signed by: John Smith  [Signed] ▸  │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Data Query
```sql
SELECT wt.*, ds.status as sig_status, ds.signer_name as sig_signer, ds.signed_at as sig_signed_at
FROM work_tickets wt
LEFT JOIN document_signatures ds ON ds.document_type = 'work_ticket' AND ds.document_id = wt.id
WHERE wt.project_id = ?
ORDER BY wt.created_at DESC
```

### Card Info
- Ticket number: #XXXX
- Description: truncated to 1 line
- Date + trade
- Worker count + total hours (sum of regular + overtime from labor JSON)
- Status badge: Draft (gray), Pending (orange), Signed (green), Declined (red)
- If signed: "Signed by: {name}" below status

### Tab Filters
- Drafts: status = 'draft'
- Pending: status = 'pending_signature'
- Signed: status = 'signed'
- All: no filter

### Pull-to-refresh

---

## CHANGE 4: Create Work Ticket Screen

Create `src/app/(tabs)/more/work-tickets/create.tsx`

### Layout
```
┌─────────────────────────────────────────┐
│ ← New Work Ticket              [Save]   │
├─────────────────────────────────────────┤
│                                         │
│ Service Date                            │
│ [Apr 9, 2026  📅]                       │
│                                         │
│ Trade                                   │
│ [Tile ▼]  (Tile/Stone/Marble/Flooring)  │
│                                         │
│ Area / Location                         │
│ [Floor 34, Unit 3406 Master Bath    ]   │
│                                         │
│ Priority                                │
│ (●) Normal  ( ) Urgent                  │
│                                         │
│ Work Description *                      │
│ ┌─────────────────────────────────────┐ │
│ │ Time and material to complete...    │ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ LABOR                        [+ Add]    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Name: [José Garcia          ]      │ │
│ │ Class: [Mechanic ▼]                │ │
│ │ Reg hrs: [8.0]  OT hrs: [2.0]     │ │
│ │                            [✕]     │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Name: [Miguel Torres        ]      │ │
│ │ Class: [Helper ▼]                  │ │
│ │ Reg hrs: [8.0]  OT hrs: [0  ]     │ │
│ │                            [✕]     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ MATERIALS                    [+ Add]    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Description: [Marble epoxy filler ] │ │
│ │ Quantity: [2]  Unit: [pcs ▼]       │ │
│ │                            [✕]     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ GC Notes / Comments                     │
│ ┌─────────────────────────────────────┐ │
│ │ (optional)                          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [         Save as Draft         ]       │
│                                         │
└─────────────────────────────────────────┘
```

### Fields
- **Service Date**: date picker, defaults to today
- **Trade**: dropdown (Tile, Stone, Marble, Flooring, Polisher)
- **Area/Location**: free text (floor, unit, room description)
- **Priority**: radio (Normal/Urgent)
- **Work Description**: required, multi-line textarea
- **Labor**: array of entries, each with name, classification (Mechanic/Helper/Apprentice), reg hours, OT hours. "+" adds a new entry.
- **Materials**: array of entries, each with description, quantity, unit. "+" adds a new entry.
- **GC Notes**: optional textarea

### On Save
- Write to work_tickets via PowerSync (offline-first)
- Set status = 'draft'
- Set created_by = current user ID
- Set foreman_name = current user's name
- Generate signature_token = crypto.randomUUID()
- Labor and materials stored as JSON strings
- Navigate back to list

### Classification Dropdown Options
- Mechanic
- Helper  
- Apprentice
- Foreman
- Laborer

---

## CHANGE 5: Work Ticket Detail / Edit Screen

Create `src/app/(tabs)/more/work-tickets/[id].tsx`

Shows the full ticket with all details and actions based on status.

### Actions by Status

**Draft:**
- [Edit] — opens edit mode (same form as create, pre-filled)
- [Delete] — confirm dialog, deletes ticket
- [Send for Signature] — opens Send modal
- All fields editable

**Pending Signature:**
- [Resend] — opens Send modal again (new token)
- [Cancel Signature Request] — reverts to draft
- Read-only display
- Shows: "Waiting for {signer_name} to sign"

**Signed:**
- Read-only display
- Shows: signature image, signer name, signed date
- Shows: SHA-256 hash with green checkmark "✅ Integrity verified"
- [Download PDF] — generate and share PDF with signature overlay
- [Verify Hash] — re-compute hash and compare (shows result)

**Declined:**
- Shows: decline reason
- [Edit & Resend] — revert to draft for editing, then resend

---

## CHANGE 6: Send for Signature Modal

Create `src/components/documents/SendForSignatureModal.tsx`

Reusable for any document type (work tickets now, PTP/JHA later).

```
┌─────────────────────────────────────────┐
│ Send for Signature                   ✕  │
├─────────────────────────────────────────┤
│                                         │
│ GC / Signer Name *                      │
│ [John Smith                        ]    │
│                                         │
│ Email *                                 │
│ [jsmith@turnerconstruction.com     ]    │
│                                         │
│ Role                                    │
│ [GC ▼]  (GC/PM/Inspector/Client)       │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ The signer will receive an email with   │
│ a link to review and sign this document │
│ digitally. The link expires in 30 days. │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ [     Open Email Client     ]           │
│ [     Copy Sign Link        ]           │
│ [     Share via WhatsApp    ]           │
│                                         │
└─────────────────────────────────────────┘
```

### Flow
1. User fills signer name + email
2. Taps "Open Email Client":
   a. Create signature request via PowerSync → Supabase
   b. Generate sign URL: `https://notch-field-takeoff.vercel.app/sign/{token}`
   c. Generate mailto link with pre-filled subject/body
   d. Open with Linking.openURL(mailtoLink)
3. Or "Copy Sign Link" — copies URL to clipboard
4. Or "Share via WhatsApp" — opens wa.me link with sign URL in message

### Remember Last GC
Store last used GC name + email per project in AsyncStorage:
`gc_contact_{project_id}` → `{ name, email }`
Pre-fill on next use.

### WhatsApp Share
```typescript
const waLink = `https://wa.me/?text=${encodeURIComponent(
  `Please review and sign Work Ticket #${ticketNumber} for ${projectName}:\n${signUrl}`
)}`;
Linking.openURL(waLink);
```

---

## CHANGE 7: PDF Generation with Signature

Create `src/shared/utils/ticketPdf.ts`

Generates HTML for printing/sharing via expo-print.

The PDF layout matches a professional T&M ticket:

```
┌──────────────────────────────────────────────────┐
│ [Company Logo]          ORDER FOR ADDITIONAL WORK │
│ Company Name                                      │
│ Address                     NO. 1042  DATE: 04/08 │
├──────────────────────────────────────────────────┤
│ JOB: 200 Hamilton Ave                             │
│ TRADE: ■ TILE  □ STONE  □ MARBLE  □ FLOORING     │
│                                                    │
│ TIME AND MATERIAL TO COMPLETE THE FOLLOWING:      │
│ ┌──────────────────────────────────────────────┐  │
│ │ Marble patching at master bath entry...      │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ LABOR:                                            │
│ NAME          │ CLASS    │ REG HRS │ OT HRS       │
│ José Garcia   │ Mechanic │ 8.0     │ 2.0          │
│ Miguel Torres │ Helper   │ 8.0     │ 0            │
│                                                    │
│ MATERIALS:                                        │
│ DESCRIPTION              │ QTY                     │
│ Marble epoxy filler      │ 2                       │
│ Diamond polishing pads   │ 4                       │
│                                                    │
│ GC NOTES:                                         │
│ (none)                                            │
│                                                    │
│──────────────────────────────────────────────────│
│                                                    │
│ APPROVED BY:              AUTHORIZED SIGNATURE:   │
│ John Smith                [signature image]        │
│ ________________          ________________         │
│ Date: 04/08/2026                                  │
│                                                    │
│ SHA-256: a3f2b8c1...e9d4  │ Signed: 04/08/2026    │
│                                                    │
│ Powered by NotchField                              │
└──────────────────────────────────────────────────┘
```

### Function
```typescript
export function generateTicketHtml(params: {
  ticket: WorkTicket;
  signature?: DocumentSignature;
  companyName?: string;
  companyLogo?: string;
  projectName?: string;
}): string
```

- Returns complete HTML string with inline CSS
- If signature exists and status = 'signed': overlay signature image
- If signature has content_hash: show truncated hash at bottom
- Optimized for A4/Letter print
- Use expo-print to print or expo-sharing to share

### Usage in Detail Screen
```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const html = generateTicketHtml({ ticket, signature, projectName });
const { uri } = await Print.printToFileAsync({ html });
await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
```

---

## CHANGE 8: More Menu Update

In `src/app/(tabs)/more/index.tsx`, add "Work Tickets" to the menu:

```typescript
{
  title: 'Work Tickets',
  icon: 'clipboard-text-outline',
  href: '/more/work-tickets',
  badge: pendingTicketCount, // number of pending_signature tickets
}
```

Position: after Deliveries, before Safety Docs.

Gate with permissions:
```typescript
canUseFeature('work_tickets') // true for supervisor + foreman, false for worker
```

Add 'work_tickets' to the feature matrix in trackPermissions.ts:
- supervisor: true
- foreman: true
- worker: false

---

## CHANGE 9: Permissions

Update `src/shared/lib/permissions/trackPermissions.ts`:

Add 'work_tickets' to the feature matrix:
```typescript
work_tickets: { supervisor: true, foreman: true, worker: false },
```

---

## Styling (Field-First)

- Touch targets: 56dp for all buttons and inputs
- Font: 16sp body, 18sp headers, 14sp secondary
- Labor/material cards: swipeable to delete, or X button
- Number inputs (hours, qty): large numeric keypad
- Status badges: bold colors (gray/orange/green/red)
- "Send for Signature" button: prominent, full-width, green
- Signature image in detail: displayed at 200px height with border

---

## Verify

1. work_tickets and document_signatures in PowerSync schema
2. Sync rules updated
3. Work Tickets list screen with tab filters (Draft/Pending/Signed/All)
4. Cards show ticket number, description, date, trade, labor summary, status
5. Create ticket: date, trade, area, description, labor entries, material entries
6. Labor: add/remove workers with name, class, reg hours, OT hours
7. Materials: add/remove with description, qty, unit
8. Save creates ticket in PowerSync (offline-capable)
9. Detail screen shows full ticket with actions by status
10. "Send for Signature" opens modal with name, email, role
11. Opens email client OR copies link OR shares via WhatsApp
12. Last GC email remembered per project
13. Pending tickets show "Waiting for {name} to sign"
14. Signed tickets show signature image + hash + date
15. PDF generation with signature overlay
16. PDF shareable via expo-sharing
17. "Verify Hash" re-computes and shows result
18. Draft: edit + delete + send. Pending: resend + cancel. Signed: PDF + verify.
19. Declined: shows reason + edit & resend
20. Permissions: supervisor + foreman only (not worker)
21. More menu shows Work Tickets with pending count badge
22. npx tsc --noEmit passes
