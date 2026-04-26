# SPRINT_TRACK_NOTIFICATIONS — Track team handoff (parallel work)

> **TL;DR for Track team:** You can start NOW. Web is building the same feature in parallel. ~5h of UI + client work fits while Web ships the DB schema and API endpoint (~3h on their side). Final integration test happens when both are done.

> **Goal:** Track shows a bell icon with unread count. Tapping opens the notifications screen. Tapping a notification navigates to the source (PTP, area, RFI, etc.). All notifications come from a shared Supabase table that Web also reads/writes — zero duplicated logic between apps.

> **Reference:** Full sprint spec is in `SPRINT_69_NOTIFICATIONS_HUB.md` (Web side). This doc extracts the parts you need, in the order you should build them.

---

## 0. What's NOT yours to build (avoid duplication)

❌ **Recipient resolution** — who gets each event. Web owns this 100%. You just POST intent.
❌ **Email delivery** — Web sends via Zoho. You don't touch email.
❌ **The notifications table itself** — Web owns the schema, migrations, RLS, CHECK constraints. You read it; you never write directly.
❌ **Cron-based events** (block alerts > 24h/72h, SST expiring) — Web has Vercel cron jobs. You don't compute these.

✅ **Yours:** PowerSync read config, bell UI, notifications screen, Expo push registration (Phase 2), and POST'ing event intents from Track-side actions (foreman signs PTP, etc.).

---

## 1. What you can build NOW (parallel work, with mocks)

### T1. PowerSync sync rule (~20min)

Add to `sync_rules.yaml`:

```yaml
bucket_definitions:
  user_notifications:
    parameters:
      - SELECT id AS user_id FROM profiles WHERE id = request.user_id()
    data:
      - SELECT * FROM notifications WHERE recipient_id = bucket.user_id
```

This is per-user — each foreman/PM gets only their own notifications synced locally. Once Web W1 ships (table exists), you can validate the sync. Until then, the rule sits in config.

### T2. Notification type contract (copy verbatim — ~10min)

Create `services/notifications/eventRegistry.ts` in Track. **Copy this exactly** (must match Web — DB CHECK constraint will reject mismatched types):

```typescript
export type NotificationEventType =
  | 'ptp_distributed'
  | 'ptp_signed_to_pm'
  | 'safety_doc_distributed'
  | 'rfi_created'
  | 'rfi_responded'
  | 'block_alert_24h'
  | 'block_alert_72h'
  | 'gate_verification_requested'
  | 'report_ready'
  | 'field_message_in_my_area'
  | 'sst_expiring_30d'
  | 'sst_expired'
  | 'nod_sent'

export type EventDefinition = {
  type: NotificationEventType
  icon: string
  severity: 'info' | 'warning' | 'critical'
  defaultChannels: { in_app: boolean; email: boolean; push: boolean }
  titleKey: string
  bodyKey: string
}

export const EVENTS: Record<NotificationEventType, EventDefinition> = {
  ptp_distributed: {
    type: 'ptp_distributed',
    icon: 'shield-check',
    severity: 'info',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'ptpDistributedTitle',
    bodyKey: 'ptpDistributedBody',
  },
  ptp_signed_to_pm: {
    type: 'ptp_signed_to_pm',
    icon: 'pen-tool',
    severity: 'info',
    defaultChannels: { in_app: true, email: false, push: false },
    titleKey: 'ptpSignedTitle',
    bodyKey: 'ptpSignedBody',
  },
  safety_doc_distributed: {
    type: 'safety_doc_distributed',
    icon: 'shield',
    severity: 'info',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'safetyDocDistributedTitle',
    bodyKey: 'safetyDocDistributedBody',
  },
  rfi_created: {
    type: 'rfi_created',
    icon: 'help-circle',
    severity: 'info',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'rfiCreatedTitle',
    bodyKey: 'rfiCreatedBody',
  },
  rfi_responded: {
    type: 'rfi_responded',
    icon: 'message-square',
    severity: 'info',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'rfiRespondedTitle',
    bodyKey: 'rfiRespondedBody',
  },
  block_alert_24h: {
    type: 'block_alert_24h',
    icon: 'alert-triangle',
    severity: 'warning',
    defaultChannels: { in_app: true, email: true, push: true },
    titleKey: 'block24hTitle',
    bodyKey: 'block24hBody',
  },
  block_alert_72h: {
    type: 'block_alert_72h',
    icon: 'alert-octagon',
    severity: 'critical',
    defaultChannels: { in_app: true, email: true, push: true },
    titleKey: 'block72hTitle',
    bodyKey: 'block72hBody',
  },
  gate_verification_requested: {
    type: 'gate_verification_requested',
    icon: 'shield-alert',
    severity: 'warning',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'gateVerifyTitle',
    bodyKey: 'gateVerifyBody',
  },
  report_ready: {
    type: 'report_ready',
    icon: 'file-text',
    severity: 'info',
    defaultChannels: { in_app: true, email: false, push: false },
    titleKey: 'reportReadyTitle',
    bodyKey: 'reportReadyBody',
  },
  field_message_in_my_area: {
    type: 'field_message_in_my_area',
    icon: 'message-circle',
    severity: 'info',
    defaultChannels: { in_app: true, email: false, push: true },
    titleKey: 'fieldMessageTitle',
    bodyKey: 'fieldMessageBody',
  },
  sst_expiring_30d: {
    type: 'sst_expiring_30d',
    icon: 'id-card',
    severity: 'warning',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'sstExpiring30Title',
    bodyKey: 'sstExpiring30Body',
  },
  sst_expired: {
    type: 'sst_expired',
    icon: 'x-circle',
    severity: 'critical',
    defaultChannels: { in_app: true, email: true, push: true },
    titleKey: 'sstExpiredTitle',
    bodyKey: 'sstExpiredBody',
  },
  nod_sent: {
    type: 'nod_sent',
    icon: 'gavel',
    severity: 'warning',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'nodSentTitle',
    bodyKey: 'nodSentBody',
  },
}
```

**If Web changes this list, Track gets 24h notice via this doc updated.**

### T3. API client wrapper (~30min)

Create `services/notifications/notifyApiClient.ts`:

```typescript
import { NotificationEventType } from './eventRegistry'

export type NotifyPayload = {
  type: NotificationEventType
  entity: { type: string; id: string }
  projectId?: string
  organizationId: string
  actorId?: string  // current user — they get excluded from recipients
}

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://notchfield.com'

/**
 * Posts a notification intent to Web. Web's recipient resolver decides who
 * gets the in-app row + email. Track does NOT compute recipients itself.
 *
 * Returns { ok: boolean, inAppCount: number, emailQueued: number } on success.
 * Throws on network error or non-2xx response.
 */
export async function notifyViaWeb(
  payload: NotifyPayload,
  bearerToken: string,
): Promise<{ ok: true; inAppCount: number; emailQueued: number }> {
  const res = await fetch(`${WEB_BASE_URL}/api/notifications/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`notifyViaWeb failed: ${res.status} ${err}`)
  }
  return res.json()
}
```

Use the same Bearer JWT that Track already uses for other Web API calls (Sprint 52H pattern — supabase session token).

### T4. Bell + screen UI (~3h)

Build with mock data so design + nav flow are locked before integration:

```typescript
// Mock notification for UI dev
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'block_alert_72h',
    severity: 'critical',
    title: 'Floor 03 - Bathroom 042 blocked 73h',
    body: 'Reason: other_trade · By: Carlos M.',
    icon: 'alert-octagon',
    link_url: '/projects/abc/pm/ready-board?area=xyz',
    read_at: null,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    project_id: 'abc',
  },
  // ...
]
```

**Components to build:**
- `<NotificationBell />` — header bell icon, red badge for unread count, hides at 0
- `<NotificationsScreen />` — list grouped by date (Today / Yesterday / This week / Older), tap → navigate via `link_url`
- `<NotificationItem />` — icon (lucide-react-native), title, body, relative time, unread dot
- Pull-to-refresh on screen
- Empty state ("No notifications yet")

**Severity colors** (match Web):
- `info` — gray dot, default text
- `warning` — amber dot, amber-tinted bg on unread
- `critical` — red dot, red-tinted bg on unread

### T5. Mark-as-read client (~30min)

```typescript
async function markAsReadInTrack(notificationId: string, bearerToken: string) {
  await fetch(`${WEB_BASE_URL}/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  })
  // PowerSync Realtime will replicate the read_at update back to local state.
  // No need to mutate local state manually — let PowerSync handle it.
}
```

### T6. Wire trigger calls in Track-side actions (~1h)

Add these `notifyViaWeb()` calls AFTER each Track-side action succeeds:

#### Foreman signs PTP via Track
File: wherever Track inserts into `safety_documents.signatures` or equivalent
```typescript
// AFTER signature successfully written to Supabase:
await notifyViaWeb({
  type: 'ptp_signed_to_pm',
  entity: { type: 'safety_document', id: safetyDocId },
  projectId,
  organizationId,
  actorId: currentForemanProfileId,
}, bearerToken).catch(err => console.warn('notify failed (non-fatal)', err))
```

**Don't fail the user action if notify fails.** Wrap in `.catch()` and log. Notification is auxiliary — not blocking.

#### Foreman marks gate phase complete
File: wherever Track writes to `phase_progress` or `production_area_objects.status='completed'` for `requires_inspection: true` phases
```typescript
if (phase.requires_inspection) {
  await notifyViaWeb({
    type: 'gate_verification_requested',
    entity: { type: 'phase_progress', id: phaseProgressId },
    projectId,
    organizationId,
    actorId: currentForemanProfileId,
  }, bearerToken).catch(err => console.warn('notify failed', err))
}
```

#### Foreman creates field message
**DO NOT call notify here.** Web has a DB trigger / service hook that fires on `field_messages` INSERT. Same DB row → same fan-out. Avoiding duplicate sends.

#### Foreman marks surface blocked
**DO NOT call notify here.** Web's cron job (every 6h) scans for blocked areas crossing 24h/72h thresholds. You just write the DB row; cron picks up.

---

## 2. What you need from Web (and when it'll be ready)

| Web task | What it gives you | ETA |
|----------|-------------------|-----|
| **W1.** `notifications` table migration | PowerSync sync rule starts working; you can read live data | ~30min after Web kickoff |
| **W2.** `profiles.notification_preferences` column | Track Settings → Notifications can also save prefs | Same migration |
| **W3.** TS types regenerated | Cleaner Supabase client types in Track if you import them | +15min after W1 |
| **W29.** `POST /api/notifications/notify` endpoint live | Your `notifyViaWeb()` calls actually work end-to-end | ~3h after Web kickoff |
| **W30.** `PUT /api/notifications/:id/read` endpoint live | Mark-as-read works | Same time as W29 |

**Coordination signal:** When Web finishes W1-W3 + W29-W30, Web team posts in your shared channel: "Sprint 69 backend ready — Track integration unblocked." From that point, switch from mocks to real API calls.

---

## 3. Phase 2 — Push notifications (defer to next Track sprint)

These are NOT in Sprint 69. Document but don't build yet:

### Future T9. Register Expo push token
```typescript
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'

async function registerForPush() {
  if (!Device.isDevice) return
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return
  const token = (await Notifications.getExpoPushTokenAsync()).data

  // Save to profile
  await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', currentUserId)
}
```

Web will read `profiles.expo_push_token` and call Expo Push API for events with `push: true`. No work on your side except the registration above + tap handler that opens `link_url`.

### Future T10. Tap handler for push deep-links
```typescript
Notifications.addNotificationResponseReceivedListener(response => {
  const linkUrl = response.notification.request.content.data?.link_url
  if (linkUrl) {
    // Parse Web URL → Track route
    // E.g. /projects/abc/pm/ready-board?area=xyz → router.push('/area/xyz')
    routeFromWebUrl(linkUrl)
  }
})
```

---

## 4. Coordination checklist

### Track's Definition of Done for Sprint 69
- [ ] PowerSync sync rule deployed (`user_notifications` bucket)
- [ ] Bell icon visible in Track top tab/header on every screen
- [ ] Unread badge shows count, hides at 0
- [ ] Notifications screen shows real data (not mocks) once Web ships W1
- [ ] Tap notification → marks read + navigates to source
- [ ] T6 wired (PTP signed, gate verification) — POSTs to Web API
- [ ] Tested with `severity: critical` notification (block_alert_72h) end-to-end with a real PM in Web

### Track's Definition of Done for Phase 2 (later sprint)
- [ ] Expo push token registered + saved to `profiles.expo_push_token`
- [ ] Push tap handler navigates correctly
- [ ] Background push received with app closed (test with `block_alert_72h`)

---

## 5. Auto-blindaje (rules locked from this design)

❌ NEVER insert directly into `notifications` from Track. Always go through Web's API. RLS would reject anyway since Track uses authenticated client (no INSERT policy granted to it). Direct insert from Track = security hole.

❌ NEVER duplicate the recipient resolver. If you find yourself writing "if PTP signed, notify PM and supervisor", STOP — you're doing Web's job. POST the event, let Web resolve.

❌ NEVER add a new event type without coordinating with Web. The DB CHECK constraint will reject INSERT silently from Web's `notify()` if your event type isn't in the enum. Both teams must agree, both must update.

❌ NEVER make `notifyViaWeb()` blocking for the user action. Wrap in `.catch()`. If notification API is down, foreman can still sign PTP — just no PM gets notified that one time.

✅ ALWAYS pass `actorId = currentUser.profileId` so the actor is excluded from recipients. Otherwise the foreman who signed PTP gets a notification about their own signature.

✅ ALWAYS reuse the same `bearerToken` your existing API calls use (Sprint 52H pattern). Don't fetch a fresh token for notifications.

✅ ALWAYS test with mock data first. Web won't be ready for ~3h. Build the UI with `MOCK_NOTIFICATIONS` so design is locked before integration.

---

## 6. Mock data shape (use this for UI dev until Web ships)

```typescript
type Notification = {
  id: string
  organization_id: string
  recipient_id: string
  type: NotificationEventType
  entity_type: string | null
  entity_id: string | null
  project_id: string | null
  title: string
  body: string | null
  icon: string
  severity: 'info' | 'warning' | 'critical'
  link_url: string | null
  read_at: string | null
  archived_at: string | null
  email_sent_at: string | null
  push_sent_at: string | null
  created_at: string
}

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    organization_id: 'org-jantile',
    recipient_id: 'me',
    type: 'block_alert_72h',
    entity_type: 'production_area',
    entity_id: 'area-abc',
    project_id: 'demo-project',
    title: 'Floor 03 - Bathroom 042 blocked 73h',
    body: 'Reason: other_trade · By: Carlos M.',
    icon: 'alert-octagon',
    severity: 'critical',
    link_url: '/projects/demo-project/pm/ready-board?area=area-abc',
    read_at: null,
    archived_at: null,
    email_sent_at: '2026-04-25T18:00:00.000Z',
    push_sent_at: null,
    created_at: '2026-04-25T18:30:00.000Z',
  },
  {
    id: 'n2',
    organization_id: 'org-jantile',
    recipient_id: 'me',
    type: 'ptp_distributed',
    entity_type: 'safety_document',
    entity_id: 'doc-123',
    project_id: 'demo-project',
    title: 'PTP #1042 distributed by John Smith',
    body: 'Floor 03 - Bathroom rough-in - 4 signers',
    icon: 'shield-check',
    severity: 'info',
    link_url: '/projects/demo-project/pm/safety-documents/doc-123',
    read_at: '2026-04-25T17:50:00.000Z',
    archived_at: null,
    email_sent_at: '2026-04-25T17:30:00.000Z',
    push_sent_at: null,
    created_at: '2026-04-25T17:30:00.000Z',
  },
  {
    id: 'n3',
    organization_id: 'org-jantile',
    recipient_id: 'me',
    type: 'sst_expiring_30d',
    entity_type: 'worker',
    entity_id: 'worker-mario',
    project_id: null,
    title: 'Mario Rodriguez SST expires in 28 days',
    body: 'Card #SST-12345 - exp 2026-05-23',
    icon: 'id-card',
    severity: 'warning',
    link_url: '/manpower/worker-mario',
    read_at: null,
    archived_at: null,
    email_sent_at: null,
    push_sent_at: null,
    created_at: '2026-04-25T07:00:00.000Z',
  },
]
```

---

## 7. Questions for Web team

If you hit any of these while building, ping Web team:

1. **What URL format does Track expect for `link_url`?** Web defaults to `/projects/{id}/pm/ready-board?area={areaId}`. If Track router can't parse this, Web can change the format — but tell us BEFORE we wire 13 events.
2. **Track auth: is `bearerToken` available globally?** Web assumes yes. Confirm.
3. **What's Track's mechanism for showing toast on Realtime new notification?** Web uses Sonner. Track probably has its own — confirm so we align UX (1.5s preview before disappear).
4. **Does Track want push for all `severity: critical` events automatically, or per-user opt-in via Settings?** Web defaults to opt-in via Settings → Notifications matrix.

---

*Sprint 69 Track estimate: ~5h parallel work + ~1h integration test once Web backend is live.*
*Phase 2 (push): ~3h additional in next Track sprint.*
