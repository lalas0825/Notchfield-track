# Sprint 53 — Communication + Punch Polish + Legal Engine v1

> **Status:** Approved 2026-04-24 · scoped after alignment with Takeoff Web team
> **Estimated:** ~14-18h across 3 sub-sprints, sequential, one commit per sub-sprint
> **Dependencies:** Tables `field_messages`, `punch_items`, `legal_documents`, `delay_cost_logs` already exist in Supabase (`msmpsxalfalzinuorwlg`) and are in the `powersync` publication. Verified against `information_schema` 2026-04-24.
> **Alignment:** Web team confirmed Track is first mover on all 3 features. Web will mirror after their Sprint 62. Coordination items in [SPRINT_53_TAKEOFF_COORDINATION.md](SPRINT_53_TAKEOFF_COORDINATION.md).

---

## Sub-sprint 53A — Communication v1 + push notifications (~6-8h)

**Scope:** Build full UI on existing `field_messages` table + add push notifications via Edge Function. v1 fire-and-forget (no read receipts).

### Decisions (from Web team alignment)

| Topic | Decision |
|-------|----------|
| Schema changes | None. Table already complete for v1. `read_at`/`read_by`/`updated_at` deferred to a future sprint when usage demands it. |
| Write path | Direct Supabase + PowerSync local-first. No API wrapper. RLS handles security. |
| Realtime | PowerSync sync + Supabase realtime channel as fallback for cross-app reactivity (cheap, same pattern as `useWorkTickets`). |
| `area_id IS NULL` | Supported — renders as a virtual "General" channel for project-level notes. |
| `blockPhase` auto-messages | Visible alongside manual messages. Distinguished by `message_type='blocker'` + a 🔒 icon. No `system_user` filtering. |
| `message_type` enum | `info | blocker | safety | question` (DB constraint, do not modify unilaterally). |
| Push notifications | **Included in 53A.** Edge Function on `field_messages` INSERT → fanout to relevant device tokens. Track owns the infrastructure (token registration, permissions, expo-notifications). |

### Architecture

```
FOREMAN/SUPERVISOR sends a note from AreaDetail
      │
      ▼
  PowerSync localInsert (offline-safe)
      │
      ▼ on next sync window
  Supabase field_messages row created
      │
      ▼ ROW INSERT trigger
  Edge Function: fanout-field-message
      │
      ├─ Query device_tokens for users in same project
      ├─ Filter out sender's own tokens
      └─ POST to Expo Push API in batches of 100
                │
                ▼
        Recipient's device gets push
                │
                ▼ tap notification
        Deep link → /(tabs)/production/[areaId]
        MessageThread auto-scrolls to bottom
```

### New tables (Track-owned, NOT in Web yet)

```sql
-- Migration: create_track_t2_device_tokens.sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  expo_push_token TEXT NOT NULL,
  device_id TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  app_version TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, expo_push_token)
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own device tokens"
  ON device_tokens FOR ALL
  USING (user_id = auth.uid());

-- Add to powersync publication so Track can read its own tokens
ALTER PUBLICATION powersync ADD TABLE device_tokens;
```

### Files to create

```
src/features/messages/
├── types/index.ts
│   └── FieldMessage Zod schema, MessageType enum
├── services/messagesService.ts
│   ├── listAreaMessages(areaId, limit=50)  — local-first
│   ├── createMessage({ projectId, areaId, type, message, photos[] })
│   └── createSystemMessage(...) — used by blockPhase, marks message_type='blocker'
├── hooks/useAreaMessages.ts
│   └── PowerSync watch + Supabase realtime channel
└── components/
    ├── MessageThread.tsx          — vertical list, auto-scroll on new
    ├── MessageBubble.tsx           — avatar + sender name + timestamp + body + photo grid
    ├── MessageComposer.tsx         — text + type chips (info/blocker/safety/question) + camera
    └── MessageTypeBadge.tsx        — colored chip per type + 🔒 for system

src/features/notifications/
├── services/pushTokenService.ts
│   ├── registerDeviceToken() — runs on app foreground if permission granted
│   ├── unregisterDeviceToken() — on sign out
│   └── refreshIfStale() — re-registers if last_seen_at > 7d
├── hooks/usePushPermission.ts
│   └── prompt + record state; called from app root
└── handlers/messageNotificationHandler.ts
    └── deep-link routing on notification tap

supabase/functions/
└── fanout-field-message/
    ├── index.ts
    └── deno.json
```

### Files to modify

```
src/features/production/components/AreaDetail.tsx
  └─ Mount <MessageThread areaId={area.id}/> below phase list

src/features/production/components/AreaCard.tsx
  └─ Activity badge (💬 + count) for messages in last 24h

src/features/production/store/production-store.ts
  └─ blockPhase auto-insert: switch to messagesService.createSystemMessage with type='blocker'

src/app/_layout.tsx
  └─ Mount push permission prompt + token registration on auth ready

src/shared/lib/powersync/schema.ts
  └─ Add device_tokens TableV2

powersync/sync-rules.yaml
  └─ Add device_tokens (user-scoped, not org)
```

### Edge Function: `fanout-field-message`

```ts
// supabase/functions/fanout-field-message/index.ts
// Triggered by Postgres webhook on field_messages INSERT.
// Body: { record: { id, project_id, area_id, sender_id, message_type, message, ... } }

import { createClient } from 'jsr:@supabase/supabase-js';

Deno.serve(async (req) => {
  const { record } = await req.json();
  const supabase = createClient(/* service role */);

  // 1. Find recipients: all profiles in same project except sender
  const { data: recipients } = await supabase
    .from('project_workers')
    .select('worker:workers(profile_id)')
    .eq('project_id', record.project_id)
    .eq('active', true);

  const recipientIds = recipients
    ?.map((r) => r.worker?.profile_id)
    .filter((id) => id && id !== record.sender_id) ?? [];

  // 2. Get sender name for the body
  const { data: sender } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', record.sender_id)
    .single();

  // 3. Get area label if any
  let areaLabel = 'Project';
  if (record.area_id) {
    const { data: area } = await supabase
      .from('production_areas')
      .select('label')
      .eq('id', record.area_id)
      .single();
    areaLabel = area?.label ?? 'Area';
  }

  // 4. Get device tokens for recipients
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('expo_push_token, user_id')
    .in('user_id', recipientIds)
    .eq('active', true);

  if (!tokens?.length) return new Response('no recipients', { status: 200 });

  // 5. Fanout to Expo Push API
  const messages = tokens.map((t) => ({
    to: t.expo_push_token,
    sound: 'default',
    title: `${sender?.full_name ?? 'Someone'} · ${areaLabel}`,
    body: record.message.length > 100 ? record.message.slice(0, 97) + '...' : record.message,
    data: {
      kind: 'field_message',
      message_id: record.id,
      area_id: record.area_id,
      project_id: record.project_id,
    },
    priority: record.message_type === 'blocker' || record.message_type === 'safety' ? 'high' : 'default',
  }));

  // Batch in 100s per Expo limit
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
  }

  return new Response('ok', { status: 200 });
});
```

### Wire-up: Postgres webhook on `field_messages` INSERT

```sql
-- Set up after edge function is deployed:
-- Supabase Dashboard → Database → Webhooks → New Webhook
--   Name: fanout-field-message-on-insert
--   Table: field_messages
--   Events: INSERT
--   Type: HTTP Request
--   URL: https://msmpsxalfalzinuorwlg.functions.supabase.co/fanout-field-message
--   Headers: Authorization: Bearer {service_role_key}
```

### Permission flow on first app open

```
User signs in
   ↓
Auth ready event in _layout.tsx
   ↓
usePushPermission() checks expo-notifications status
   ├─ undetermined → show explainer modal "Get notified when your team messages you"
   │                  ↓
   │                  Tap allow → request system permission
   │                  ↓
   │                  granted → registerDeviceToken() → INSERT into device_tokens
   │                  ↓
   │                  denied → no push, app continues
   ├─ granted → registerDeviceToken() → upsert if not present
   └─ denied → no-op (user can re-enable in Settings)
```

### Success criteria

- [x] Foreman writes a message in AreaDetail, supervisor sees it on their device within 3s while online
- [x] Offline message saves locally, syncs + triggers push when online
- [x] `blockPhase` auto-inserts now go through `createSystemMessage`, render with 🔒 icon
- [x] Push notification tap deep-links to the right area + scrolls to message (and to /messages for area_id=NULL — Sprint 53A.1)
- [x] Sign out clears device_tokens row (no orphan tokens after device handoff)
- [x] TypeScript clean (`npx tsc --noEmit`)
- [x] **53A.1 follow-ups (post-field-test fixes):** General channel UI shipped, RLS path fixed, missing tab `_layout.tsx` fixed, SyncStatusBar root cause fixed (wrong PowerSync API), keyboard avoidance fixed (JS partial + native config pending next rebuild)

### Communication expansion roadmap (post-pilot, NOT scoped here)

The decision was deliberate: ship **per-area threads only** for v1 and wait for
real Jantile usage feedback before adding any of these. Schema already
supports them via `area_id` nullability — only UI work is needed.

#### Design rationale: per-area vs global

Threads stay anchored to physical areas because that's how foremen work
in the field — they're in the bathroom, they snap a photo, they type a
note about that bathroom. Mixing "rebar exposed in L3-E2" with "we ran
out of thinset" in one stream creates noise. The Web team's planned
global Messages tab in PM Shell (per [SPRINT_53_TAKEOFF_COORDINATION.md
§3.1](SPRINT_53_TAKEOFF_COORDINATION.md)) covers the cross-area
visibility need from the PM side; Track stays focused on the foreman's
physical-location-anchored workflow.

#### Roadmap (in order of expected value, all post-pilot)

##### #1 — Project-level "General" channel (~1h, S)

**What:** A single project-wide thread for announcements that aren't
tied to one area ("we're out of thinset", "GC walkthrough at 2pm tomorrow").

**Schema:** Already supported. `field_messages.area_id IS NULL` is the
General channel. No DB change needed.

**UI plan:**
- Header chat icon on Home (top-right) with badge of recent general count
- New full-screen route `/(tabs)/messages/general`
- Reuses `<MessageThread projectId={projectId} areaId={null} />` (the
  existing component already handles `area_id IS NULL` in its read query)
- Header titled "Project Notes" with project name underneath
- Composer defaults to `messageType='info'`, no area picker (always project-level)
- Per-area threads stay exactly as they are — General is purely additive

**Files to create when triggered:**
```
src/features/messages/components/ProjectNotesIcon.tsx       — header chat icon w/ badge
src/features/messages/hooks/useGeneralChannelActivity.ts    — count of last-24h general msgs
src/app/(tabs)/messages/general.tsx                          — route mounting MessageThread
```

**Modify:**
```
src/app/(tabs)/home/index.tsx — mount ProjectNotesIcon in Stack.Screen header
```

**Trigger to build:** Pilot foreman says "where do I put a project-wide
announcement?" or "I don't know which area to anchor this to."

##### #2 — Activity stream (~2-3h, M)

**What:** Cross-area scroll on Home showing last 20 messages with an
area chip on each. Read-only view; tap a message → navigates to the
area's thread to reply.

**Trigger to build:** Supervisor says "I want to scan everything that
happened today without entering each area one by one." (Web's global
Messages tab covers this for PMs; Track activity stream would be for
multi-project supervisors who don't want to switch projects to see
recent activity.)

##### #3 — `@mentions` (~3h, M)

**What:** Type `@Pedro` → autocomplete from project_workers list →
mentioned worker gets a high-priority push regardless of the message
type, and the message highlights for them in the UI.

**Schema:** No change. `@username` parsed from `message` body
client-side; recipient list resolved at fanout-field-message Edge
Function time (parse `@\w+` patterns, lookup against project_workers).

**Trigger to build:** Foreman says "I asked someone but the wrong
person saw it" or "I want to ping Pedro specifically without him
having to scan every area thread."

##### #4 — Direct messages (~6h, L)

**What:** 1-on-1 private channel between two users, distinct from the
project's area threads.

**Schema:** Requires new table or new column. Likely a
`message_threads` table with `(user_a_id, user_b_id)` unique pair, and
`field_messages.thread_id` nullable foreign key. Or a separate
`direct_messages` table.

**RLS:** Only sender + recipient can read.

**Trigger to build:** Foreman/supervisor explicitly asks "I want to
talk privately, not in front of the crew" — most construction crews
already use WhatsApp for this, so the value is lower. Unlikely to be
prioritized unless competitive feedback demands it.

##### Read receipts / edit history (~2h, but DB change)

**What:** `read_at`, `read_by`, `updated_at` columns on `field_messages`.

**Trigger to build:** When pilot demands "did the supervisor see my
message?" feedback. Today fire-and-forget is sufficient for the field
ops use case.

**Coordination needed:** This is a shared-table schema change — must
align with Web team before the migration. See
[SPRINT_53_TAKEOFF_COORDINATION.md §1](SPRINT_53_TAKEOFF_COORDINATION.md).

---

## Sub-sprint 53B — Punch List polish + plan pinning (~3-4h)

**Scope:** Cerrar el 80% existente + agregar plan pinning sobre el viewer del Sprint 47B.

### Decisions

| Topic | Decision |
|-------|----------|
| Status enum | `{open, in_progress, resolved, verified, rejected}` — DB CHECK confirmed, Track already aligned. |
| Priority enum | `{low, medium, high, critical}` — DB CHECK confirmed. |
| `assigned_to` FK | → `profiles.id` (FK formal, despite Web team mentioning auth.users — they're 1:1 UUIDs). Use `profile.id`. |
| Coord system | PDF points (matches Sprint 47B `drawing_pins`). |
| Naming | Live with `plan_x`/`plan_y` on punch_items vs `position_x`/`position_y` on drawing_pins. Don't migrate. |
| GC vs internal | Already separated by route (`/docs/punch` internal vs `/more/punchlist` GC). No theme changes. |

### Files to create

```
src/features/punch/components/
├── AddPunchSheet.tsx          — bottom sheet for plan-anchored punch creation
└── PunchPinOverlay.tsx        — overlay layer for the PDF viewer, similar to PinOverlay
```

### Files to modify

```
src/app/(tabs)/plans/[id].tsx
  ├─ Add FAB "Add Punch" (only for supervisor + foreman roles)
  ├─ Mount PunchPinOverlay alongside existing PinOverlay
  └─ Tap pin → bottom sheet with item details + resolve/verify actions

src/features/punch/components/PunchItemForm.tsx
  └─ Verify assigned_to writes profile.id; verify photo upload via photo-queue

src/features/punch/services/punch-service.ts
  └─ Add createPunchFromPin({ areaId, drawingId, planX, planY, ... }) — same logic as createPunchItem but with coords

src/app/(tabs)/docs/punch/[id].tsx
  └─ Verify resolve/verify/reject buttons render correctly per role + status

src/features/production/components/AreaCard.tsx
  └─ Add open punch count badge (red dot + count)
```

### Plan-anchored creation flow

```
Supervisor on Plans tab
   ↓
FAB "Add Punch" → enters pin-drop mode (visual hint at top: "Tap on plan to drop a pin")
   ↓
Tap on PDF at (px, py) in PDF points
   ↓
AddPunchSheet opens with:
   • Title (required)
   • Description (optional)
   • Priority chips (low/medium/high/critical)
   • Assigned to (worker picker from project_workers)
   • Photo (camera or gallery, required — defect evidence)
   • plan_x, plan_y, drawing_id pre-filled, area_id resolved from current sheet's primary area
   ↓
Save → localInsert into punch_items + photo via photo-queue
   ↓
Pin appears on plan immediately (optimistic). Foreman who opens Plans tab sees it after sync.
```

### Success criteria

- [x] Supervisor creates a punch item from Plans tab, pin appears on plan, foreman sees it after sync
- [x] Tap pin → bottom sheet with details, foreman can mark in_progress, take after photo, mark resolved
- [x] Supervisor opens resolved item → can verify (closes) or reject with reason (re-opens)
- [x] Area cards in Ready Board show red dot + count when open punch items exist
- [x] Resolution photos load correctly in detail screen alongside original photos (post-Sprint 53A.1 RLS path fix for `uploadPunchPhoto`)
- [x] TypeScript clean
- [x] `isSupervisor` check uses `normalizeTrackRole` so role='supervisor' canonical users aren't locked out (Sprint 53A.1 commit `35434db`)

---

## Sub-sprint 53C — Legal Engine fix + complete v1 (~6-8h)

**Scope:** Fix critical status enum bug + complete sign + send pipeline. Email
goes through Takeoff Web's `/api/pm/legal-documents/[docId]/distribute` endpoint
(Option B, chosen 2026-04-25). Web reuses their Zoho SMTP `sendEmail()`
wrapper. Track renders the PDF locally and uploads to Storage; Web fetches,
attaches, and sends. Tracking pixel is 100% Web-side.

### The fix (PRIORITY #1 — current code would fail in prod)

```diff
// src/features/legal/services/legal-service.ts

- export type LegalDocStatus = 'draft' | 'signed' | 'sent' | 'opened';
+ export type LegalDocStatus = 'draft' | 'sent' | 'opened' | 'no_response';

- await supabase.from('legal_documents').update({
-   status: 'signed',
-   signed_by,
-   signed_at,
-   sha256_hash: hash,
- }).eq('id', docId);
+ // sign + send is ONE transaction (Web team Hipótesis A confirmed)
+ // signed_at + signed_by are columns, NOT a status state
+ await supabase.from('legal_documents').update({
+   status: 'sent',                       // direct draft → sent
+   signed_at: new Date().toISOString(),
+   signed_by: supervisorProfileId,
+   sha256_hash: hash,                    // SHA-256 of PDF bytes
+   pdf_url: uploadedPdfUrl,
+   recipient_email: gcEmail,
+   sent_at: new Date().toISOString(),
+ }).eq('id', docId);
```

### Decisions

| Topic | Decision |
|-------|----------|
| Status enum | `{draft, sent, opened, no_response}`. NO `'signed'` state. |
| Sign + send | One transaction. `signed_*` columns fill at the same moment as `sent_*`. |
| Offline pending-send | Client-side queue in AsyncStorage. DB never sees an intermediate state. |
| PDF rendering v1 | Track local via `expo-print` (mirror of `safety-export.ts`). Web will replace with server renderer later. |
| Email pipeline | **Option B (chosen 2026-04-25):** Track calls Takeoff Web's `POST /api/pm/legal-documents/[docId]/distribute`, which uses Web's existing `sendEmail()` wrapper over Zoho SMTP. No credential duplication. **Blocker:** Web must ship this endpoint before Legal send is usable (draft creation works either way). See [SPRINT_53_TAKEOFF_COORDINATION.md §2.1](SPRINT_53_TAKEOFF_COORDINATION.md#21--blocker-post-api-pm-legal-documentsdocid-distribute-web-side). |
| Tracking pixel | **Web-side** — `GET /api/legal/{token}/pixel` returns 1×1 PNG + UPDATEs `opened_at`/`receipt_ip`/`receipt_device`. Web embeds the pixel URL in the email HTML body they build. Track does zero pixel work. |
| Cost engine | Client-side. Track writes to `delay_cost_logs` at sign time. Source of truth (Web confirmed). |
| Boilerplate body | Hardcoded NY DOB / NYC Local Law in v1. Abstract to `legal_templates` later. |
| Recipients v1 | Single `recipient_email` field in send modal. `project_legal_recipients` table is v2. |
| 48h auto-escalation | Skipped. Web cron later flips `status='no_response'`. |

### New tables (none — `delay_cost_logs` already exists, verified)

### Files to create

```
src/features/legal/
├── services/
│   ├── nodPdfRenderer.ts
│   │   └─ generateNodPdf({ doc, area, cost, project, org, signer, ... })
│   │       → local expo-print URI + SHA-256 + upload to Storage.
│   │       NO pixel embed (pixel is email-body only, Web owns it).
│   ├── costEngine.ts
│   │   └─ computeDelayCost + persistDelayCostLog
│   └── sendLegalDocument.ts
│       └─ signAndSendNod pipeline → POST to Web /api/pm/legal-documents/[id]/distribute
├── components/
│   ├── NodSignModal.tsx
│   │   └─ SignaturePad + cost preview + recipient email + submit
│   └── DelayCostCard.tsx
│       └─ crew × rate × days — rendered in modal preview AND detail screen
└── hooks/
    └── useLegalDocs.ts (existing; status enum aligned in service)
```

**No Track-owned Supabase Edge Functions for Legal.** The email pipeline +
tracking pixel are Takeoff Web responsibilities. See
[SPRINT_53_TAKEOFF_COORDINATION.md §2.1](SPRINT_53_TAKEOFF_COORDINATION.md)
for the full endpoint contract.

### Files to modify

```
src/app/(tabs)/docs/legal/[id].tsx
  └─ Wire NodSignModal trigger from "Sign & Send" button on draft status
  └─ Show NodSendStatusBanner on top
  └─ PDF download button on sent/opened status

src/features/legal/services/legal-service.ts
  └─ FIX: status enum, signNod → renamed signAndSend, full transaction update

src/shared/lib/powersync/schema.ts
  └─ Add delay_cost_logs TableV2 (currently not declared)

powersync/sync-rules.yaml
  └─ Add delay_cost_logs (org-scoped)
```

### Cost engine spec

```ts
// src/features/legal/services/costEngine.ts

export async function computeDelayCost(params: {
  areaId: string;
  blockedAt: string;  // ISO timestamp from production_areas.blocked_at
  projectId: string;
  organizationId: string;
}): Promise<DelayCost> {
  const blockedDate = new Date(params.blockedAt);
  const now = Date.now();
  const hoursBlocked = (now - blockedDate.getTime()) / 3600000;
  const days_lost = Math.ceil(hoursBlocked / 8); // 8h workday

  // 1. Distinct workers who worked this area before/around the block
  const { data: entries } = await supabase
    .from('area_time_entries')
    .select('worker_id')
    .eq('area_id', params.areaId)
    .gte('started_at', new Date(blockedDate.getTime() - 14 * 86400000).toISOString());

  const workerIds = [...new Set((entries ?? []).map((e) => e.worker_id))];

  // 2. Pull daily_rate_cents for each
  // NOTE: area_time_entries.worker_id still references profiles.id (Sprint MANPOWER FK note)
  // We need to join through workers via workers.profile_id to get daily_rate_cents
  const { data: workers } = await supabase
    .from('workers')
    .select('id, profile_id, daily_rate_cents')
    .in('profile_id', workerIds);

  const ratesSum = (workers ?? []).reduce((sum, w) => sum + (w.daily_rate_cents ?? 0), 0);
  const crew_size = workers?.length ?? 0;
  const daily_rate_cents = crew_size > 0 ? Math.round(ratesSum / crew_size) : 0; // average for display
  const total_cost_cents = (workers ?? []).reduce(
    (sum, w) => sum + (w.daily_rate_cents ?? 0) * days_lost,
    0
  );

  return { crew_size, daily_rate_cents, days_lost, total_cost_cents };
}
```

### Web endpoint contract (Track calls this)

Track does **not** own the email pipeline or tracking pixel. Both live on
Takeoff Web. Track's `sendLegalDocument.ts` calls this endpoint once the PDF
has been rendered locally and uploaded to Storage:

**`POST {WEB_API_URL}/api/pm/legal-documents/{docId}/distribute`** (Web-side)

Headers: `Authorization: Bearer {session.access_token}` · `Content-Type: application/json`

Request body:
```json
{
  "recipientEmail": "gc@example.com",
  "recipientName": "ABC General Contractor",
  "senderName": "John Supervisor",
  "senderTitle": "Project Supervisor",
  "projectName": "Residence Tower A",
  "gcCompany": "ABC General Contractor",
  "areaLabel": "L3-E2 — Toilet 0113",
  "pdfUrl": "https://.../legal-documents/{org_id}/{doc_id}.pdf",
  "pdfSha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  "oshaCitationsIncluded": false
}
```

Expected response (success):
```json
{
  "success": true,
  "sent_at": "2026-04-25T10:00:00Z",
  "tracking_token": "c7a1f700-ad03-4524-a367-3f6dcc01d391"
}
```

Web implementation (Takeoff side) is responsible for:
1. Dual-auth bearer/cookie (Sprint 52H pattern).
2. Fetching the PDF from the public Storage URL.
3. Generating `tracking_token` (UUID) + embedding the tracking pixel URL
   `https://notchfield.com/api/legal/{token}/pixel` in the email HTML body.
4. Calling `sendEmail()` via Zoho SMTP with the PDF attached.
5. Returning `{ sent_at, tracking_token }`. Track writes both values to
   `legal_documents` in a single UPDATE (via `applySignAndSend`).

Full blocker details + implementation notes are in
[SPRINT_53_TAKEOFF_COORDINATION.md §2.1](SPRINT_53_TAKEOFF_COORDINATION.md).

### Boilerplate v1 hardcoded

```ts
// src/features/legal/services/nodBoilerplate.ts

export function buildNodBody(params: {
  area_label: string;
  blocked_at: string;
  blocked_reason: string;
  hours_blocked: number;
  cost: DelayCost;
  organization_name: string;
  gc_name: string;
  project_name: string;
}): string {
  return `
NOTICE OF DELAY

Project: ${params.project_name}
Area Affected: ${params.area_label}
Blocked Since: ${formatUSDate(params.blocked_at)}
Duration: ${Math.round(params.hours_blocked)} hours (${params.cost.days_lost} workday${params.cost.days_lost !== 1 ? 's' : ''})

REASON FOR DELAY:
${params.blocked_reason}

CREW IMPACT:
- Crew size impacted: ${params.cost.crew_size} workers
- Daily labor rate (avg): $${(params.cost.daily_rate_cents / 100).toFixed(2)}
- Days lost to date: ${params.cost.days_lost}
- Total documented impact: $${(params.cost.total_cost_cents / 100).toFixed(2)}

LEGAL BASIS:
This Notice is issued pursuant to the General Conditions of the contract
between ${params.organization_name} (Subcontractor) and ${params.gc_name}
(General Contractor), and applicable provisions of New York City Local Law
and NY DOB Industrial Code Section 23 governing impacted construction work.

ACKNOWLEDGMENT REQUIRED:
Please acknowledge receipt of this Notice within forty-eight (48) hours.
Failure to respond will be documented as non-response and incorporated
into a future Request for Equitable Adjustment (REA).

This document is digitally signed and tamper-evident via SHA-256 hash.
Modification after signature is prevented at the database level.
  `.trim();
}
```

### Success criteria

- [x] Status enum fix applied (no 'signed' state; `sign + send` is one tx)
- [x] `delay_cost_logs` declared in PowerSync + sync rules; `persistDelayCostLog` writes at sign-time
- [x] `nodPdfRenderer` renders locally, uploads to Storage, computes SHA-256
- [x] `sendLegalDocument.signAndSendNod` orchestrator calls Web distribute endpoint
- [x] Detail screen: draft → "Sign & Send" modal → sent/opened timeline + PDF actions
- [x] TypeScript clean
- [x] **Web blocker shipped:** `/api/pm/legal-documents/[docId]/distribute` (Web commit `cc16f75`, 2026-04-25)
- [x] **Web blocker shipped:** `/api/legal/{token}/pixel` (Web commit `cc16f75`, 2026-04-25)
- [x] Track 409 handler: surfaces "already sent" message when Web rejects non-draft status
- [ ] End-to-end field test: supervisor signs → GC receives email → opens → status flips to `'opened'` (pending preview APK install)

All Track-side code is done. The "Sign & Send" button is now fully wired
end-to-end. `EXPO_PUBLIC_WEB_API_URL` was always pointing at
`https://notchfield.com`, so no Track redeploy was needed when Web shipped —
the next dev-client APK build picks up the live endpoints automatically.

---

## Sequencing & Commits

| Order | Sub-sprint | Commit message prefix |
|-------|-----------|------------------------|
| 1 | 53A — Communication + Push | `feat(messages): area threads + push notifications` |
| 2 | 53B — Punch polish + plan pinning | `feat(punch): plan-anchored punch items + flow polish` |
| 3 | 53C v1 — Legal (Track Edge Functions) | `feat(legal): NOD sign+send flow + cost engine + tracking pixel` |
| 4 | 53C v2 — Switch email pipeline to Web endpoint | `refactor(legal): route email pipeline through Takeoff Web distribute endpoint (Option B)` |

Each sub-sprint:
1. Implementation
2. `npx tsc --noEmit` (clean before commit)
3. Update `TASKS_TRACK.md` with sprint summary
4. Commit + tag with sprint identifier
5. Verify nothing else regresses (manual smoke test on dev-client APK after rebuild)

After 53C v2, Communication + Push + Punch pinning can be field-tested with
Jantile on the next preview APK build. Legal can be drafted immediately;
end-to-end send requires Web endpoint ship (tracked in coordination doc).

---

## Coordination with Takeoff Web team

See [SPRINT_53_TAKEOFF_COORDINATION.md](SPRINT_53_TAKEOFF_COORDINATION.md) for the list of Web-side items that depend on or follow this sprint.
