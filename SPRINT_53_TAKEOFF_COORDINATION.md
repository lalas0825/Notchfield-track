# Sprint 53 — Takeoff Web Coordination

> **Audience:** Takeoff Web team
> **Companion to:** [SPRINT_TRACK_53.md](SPRINT_TRACK_53.md)
> **Status (updated 2026-04-25, end of day):** Track shipped 53A + 53B + 53C Track-side code. **Web shipped both blockers in commit `cc16f75`** — `/api/pm/legal-documents/[docId]/distribute` and `/api/legal/[token]/pixel` are live. Track Sprint 53 is now **end-to-end unblocked**.
> **Pattern:** Same as Sprint 50A/B → TOOLBOX, 43A → 45B, CREW → MANPOWER. Track ships v1, Web mirrors. For Legal, the call was inverted: Web shipped the send pipeline first, Track already had the render/sign/record side ready. Tight coordination, single sprint cycle.

---

## ✅ Blockers — RESOLVED (Web commit `cc16f75`, 2026-04-25)

Both endpoints live in production. Track's `sendLegalDocument.signAndSendNod` calls them directly with no further changes needed (the URL was already pointed at `WEB_API_URL` since the Option B refactor — same APK works the moment the Web deploy lands).

| Track feature state | Web endpoint | Status |
|---------------------|--------------|--------|
| Legal NOD drafts + cost engine + PDF render + UI | **§2.1 `POST /api/pm/legal-documents/[docId]/distribute`** | ✅ Live (cc16f75) |
| Legal open-receipt tracking via `tracking_token`/`opened_at` | **§2.2 `GET /api/legal/{token}/pixel`** | ✅ Live (cc16f75) |

**Web confirmed implementation details (matches §2.1 + §2.2 spec exactly):**
- Dual-auth Bearer JWT (Sprint 52H pattern)
- 409 on non-draft status (Track now surfaces a clear "already sent" message — see `sendLegalDocument.ts`)
- `tracking_token = randomUUID()` generated server-side, embedded in email HTML body, returned to Track
- Track keeps `applySignAndSend` as the single source of truth for the DB transaction (Web does NOT touch `legal_documents`) ✓
- Pixel endpoint: 1×1 transparent PNG (43-byte hardcoded), no auth (token IS the auth), service-role UPDATE with `WHERE opened_at IS NULL AND status='sent'` first-read-wins ✓
- Cache-Control: no-store + Pragma: no-cache for corporate email clients ✓
- Audit log to `pm_activity_logs` with `action='legal_distributed'`

End-to-end test path:
1. Foreman/supervisor creates a NOD draft in Track (auto from blocked >24h area)
2. Tap "Sign & Send" → SignaturePad → modal submit
3. Track renders PDF locally → uploads to Storage → POSTs to Web `/distribute`
4. Web fetches PDF, sends email via Zoho SMTP `sendEmail()`, returns `tracking_token`
5. Track writes `applySignAndSend` transaction (status='sent', signed_at, sent_at, tracking_token, sha256_hash, pdf_url, recipient_email, signed_by)
6. GC opens email → tracking pixel hits Web `/api/legal/{token}/pixel` → server flips `status='opened'`, fills `opened_at`/`receipt_ip`/`receipt_device`
7. PowerSync syncs the row → Track UI shows "Opened HH:MM" timeline event

---

## TL;DR for Web team

| Feature | Track v1 ships | Web TODO | Status |
|---------|----------------|----------|--------|
| Communication | Direct UI on `field_messages` + Edge Function for push notifications | Web UI for messages thread (Production Dashboard area panel + global "Messages" tab) | Post-Sprint 62 backlog |
| Punch List plan pinning | First writes to `plan_x`/`plan_y`/`drawing_id` | Plan viewer with pin overlay alongside `drawing_pins` | Post-Sprint 62 backlog |
| **Legal email pipeline** | PDF render (expo-print) + upload + SHA-256 + draft UI + send orchestrator (Option B — calls Web endpoint) | **`POST /api/pm/legal-documents/[docId]/distribute` (via Zoho sendEmail wrapper)** | ✅ **Live (Web cc16f75, 2026-04-25)** |
| **Legal tracking pixel** | Track writes `tracking_token` returned by the distribute endpoint + observes `status`/`opened_at` changes | **`GET /api/legal/{token}/pixel` — 1×1 PNG + UPDATE on `legal_documents`** | ✅ **Live (Web cc16f75, 2026-04-25)** |
| Cost engine | Track writes `delay_cost_logs` client-side at sign time | None — Track is source of truth (Web confirmed) | Never (Track owns this) |
| Boilerplate body | Hardcoded NY DOB / NYC Local Law in Track | `legal_templates` per-jurisdiction table | Web v2 |
| Recipients | Single email field at send time | `project_legal_recipients` table + selector | Web v2 |
| Server-side NOD PDF renderer | Track renders locally via expo-print for v1 | `legalDocPdfRenderer.ts` (server) to replace Track's local render; Track passes pre-rendered URL in the meantime | Web v2 |

---

## Section 1 — What Web does NOT need to do during Track Sprint 53

These are explicit *no-ops* — Track handles them. Listed here so Web doesn't start parallel work and create conflicts.

1. **No schema changes for Communication.** `field_messages` table is final for v1. Track will leave `read_at`/`read_by`/`updated_at` for a future joint sprint when usage demands it.
2. **No PowerSync rule changes for `field_messages`/`punch_items`/`legal_documents`/`delay_cost_logs`** — already published (Track added Legal tables in Sprint 53C).
3. **No server-side NOD PDF renderer for v1.** Track is using local `expo-print` (mirror of `safety-export.ts`). Web can build a proper server renderer in v2 — no rush.
4. **No `delay_cost_logs` server-side computation.** Track computes from `area_time_entries` + `workers.daily_rate_cents` and writes the row at sign time. Web endpoint should trust the row Track wrote (reachable via `legal_documents.related_delay_log_id`).
5. **No new DB schema for Legal distribute.** Track's Sprint 53C migration (`add_legal_tracking_token`) added the only columns Web needs: `legal_documents.tracking_token TEXT` + `recipient_name TEXT`.

---

## Section 2 — Web endpoints Track needs (BLOCKERS)

Track chose Option B for email: **no duplicated Zoho credentials**. The
`send-legal-document` Supabase Edge Function was removed from the Track
codebase (commit log has the reference). Track now calls Web's endpoint
directly. The email pipeline + tracking pixel are Web's responsibility
from v1 onward — not a post-v1 migration.

### 2.1 — BLOCKER: `POST /api/pm/legal-documents/[docId]/distribute` (Web-side)

**Track's call site:** [`src/features/legal/services/sendLegalDocument.ts`](../notchfield-track/src/features/legal/services/sendLegalDocument.ts) stage 4.

**Auth:** dual-auth pattern from Sprint 52H (`4a84abf`). Accept bearer JWT
in `Authorization` header, fall back to cookie. Supabase client built from
the resolved session so RLS sees `auth.uid()` correctly. Reject if the
signed-in user can't access the `legal_documents` row.

**Request (sent by Track):**
```json
POST /api/pm/legal-documents/{docId}/distribute
Authorization: Bearer {session.access_token}
Content-Type: application/json

{
  "recipientEmail":         "gc-contact@example.com",
  "recipientName":          "ABC General Contractor",
  "senderName":             "John Supervisor",
  "senderTitle":            "Project Supervisor",
  "projectName":            "Residence Tower A",
  "gcCompany":              "ABC General Contractor",
  "areaLabel":              "L3-E2 — Toilet 0113",
  "pdfUrl":                 "https://msmpsxalfalzinuorwlg.supabase.co/storage/v1/object/public/field-photos/legal-documents/{org_id}/{doc_id}.pdf",
  "pdfSha256":              "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  "oshaCitationsIncluded":  false
}
```

**Server responsibilities (Takeoff side):**

1. **Validate access.** Fetch `legal_documents` by `docId` — confirm org matches user org, status is `'draft'`.
2. **Generate tracking_token** — `crypto.randomUUID()`. This goes both in the response AND embedded in the email HTML body as a tracking pixel.
3. **Fetch PDF** — Track uploaded it to public Storage at `pdfUrl`. Fetch bytes, use as email attachment.
4. **Build email HTML body** with an inline tracking pixel:
   ```html
   <img src="https://notchfield.com/api/legal/{tracking_token}/pixel" width="1" height="1" alt=""/>
   ```
5. **Send via `sendEmail()`** — the central Zoho wrapper from `src/lib/email/emailService.ts`. Use `resolveBusinessSender()` for the Hybrid Sender pattern → "John Supervisor (Jantile) <noreply@notchfield.com>".
   - Subject: `Notice of Delay — {projectName}`
   - Attachment: `NOD-{projectName-slug}.pdf` (from the fetched bytes)
6. **Return** the tracking_token + sent_at timestamp:

**Response (success):**
```json
{
  "success":        true,
  "sent_at":        "2026-04-25T10:00:00.000Z",
  "tracking_token": "c7a1f700-ad03-4524-a367-3f6dcc01d391"
}
```

**Response (error):**
```json
{
  "success": false,
  "error":   "description of what went wrong"
}
```

**Do NOT update `legal_documents` from this endpoint.** Track owns the
single-point-of-truth UPDATE transaction (`applySignAndSend`). Web just
returns the two values Track needs (`sent_at`, `tracking_token`); Track
writes them atomically along with `status='sent'`, `signed_at`, `signed_by`,
`sha256_hash`, `pdf_url`, `recipient_email`, `recipient_name`. This keeps
the guard_legal_immutability trigger semantics clean.

**Known gotchas from Sprint 52:**
- Dual-auth bearer FIRST, cookie fallback. See commit `4a84abf`.
- Defensive null coercion on request body (the `jsPDF.text(undefined)` crash lesson from `3c094a0`).
- Do NOT re-render the PDF on this endpoint — trust Track's `pdfUrl` in v1. Verify SHA-256 if paranoid.

### 2.2 — BLOCKER: `GET /api/legal/{tracking_token}/pixel` (Web-side)

**Why Track can't do this from a Supabase Edge Function:** the pixel URL
ends up in the email body. A customer-facing `notchfield.com` domain is
more professional than `msmpsxalfalzinuorwlg.supabase.co`. Also — if
Track-owned infrastructure got decommissioned, years-old NODs would
lose their open-receipt tracking.

**Behavior:**
- Accept GET at `/api/legal/{tracking_token}/pixel`
- Return a 1×1 transparent PNG (inline bytes — no external fetch)
- Fire-and-forget DB update:
  ```sql
  UPDATE legal_documents
  SET status       = 'opened',
      opened_at    = NOW(),
      receipt_ip   = $1,
      receipt_device = $2
  WHERE tracking_token = $3
    AND opened_at IS NULL  -- first-read-wins
  ```
  - `$1` = `X-Forwarded-For` or `X-Real-IP` header
  - `$2` = `User-Agent` header (truncated to 500 chars)
  - `$3` = token from URL segment
- Return headers: `Content-Type: image/png`, `Cache-Control: no-store, no-cache, must-revalidate`, `Content-Length: <n>`
- **No auth** — tracking token is the auth (unguessable UUID). Use service-role client internally to bypass RLS for the update.
- Don't await the DB update before returning the pixel — email clients shouldn't hang on DB writes.

Track has reference implementations that were deleted along with the
Edge Functions — if useful, the git history at commit `4f17adf` →
`supabase/functions/legal-tracking-pixel/index.ts` has the exact PNG
bytes and update logic.

### 2.3 — DEFERRED: Server-side `nodPdfRenderer.ts` (post v1)

Track v1 renders PDFs locally (`src/features/legal/services/nodPdfRenderer.ts`).
Web will eventually replace this with a server-side renderer using the
same pattern as `ptpPdfRenderer.ts` / `workTicketPdfRenderer.ts`. When
that lands, Track switches from "render locally + upload + pass URL" to
"pass labels, server renders". For now **trust Track's pre-rendered PDF**.

**Canonical labels shape** (will be added to Track's request body when
Web ships its renderer — for v1, ignore and use `pdfUrl`):

```ts
type NodPdfLabels = {
  title:          string;  // "NOTICE OF DELAY"
  projectName:    string;
  organizationName: string;
  gcName:         string;
  areaLabel:      string;
  blockedAt:      string;  // MM/DD/YYYY
  duration:       string;  // "5 workdays (40 hours)"
  blockedReason:  string;
  legalBasis:     string;  // boilerplate paragraph
  acknowledgment: string;  // "Please acknowledge within 48 hours..."
  signedAt:       string;  // MM/DD/YYYY HH:mm local TZ
  signerName:     string;
  signerTitle:    string;
  costSummary: {
    crewSize:         number;
    avgDailyRateUsd:  string;  // "$1,750.00"
    daysLost:         number;
    totalImpactUsd:   string;  // "$17,500.00"
  };
};
```

The 17 PDF gaps from Sprint 52 ([TAKEOFF_PDF_ALIGNMENT.md](TAKEOFF_PDF_ALIGNMENT.md))
apply to this renderer too — Title Case headers, MM/DD/YYYY dates, full
64-char SHA-256, ACTIVE not DRAFT race, customer letterhead via
`OrgLetterhead` pattern.

---

## Section 3 — Web TODO list (post-Sprint 62 backlog)

Items that are NOT blockers for Track but should land in Web eventually for full parity.

### 3.1 — Communication UI (Web-side)

**Where it goes:**
- `Production Dashboard → Area detail panel`: inline message thread (mirror Track's `MessageThread`)
- New global `PM Shell → Messages` tab: stream view across all areas in a project, filterable by area

**Read pattern:**
```sql
SELECT fm.*, p.full_name, pa.label AS area_label
FROM field_messages fm
JOIN profiles p ON fm.sender_id = p.id
LEFT JOIN production_areas pa ON fm.area_id = pa.id
WHERE fm.project_id = ?
ORDER BY fm.created_at DESC
LIMIT 100
```

**Auto messages from Track:** rendered with "auto" badge (Web's choice) or 🔒 icon (Track's convention). Distinguished by `message_type='blocker'` AND `sender_id` matching the system user that `production-store.blockPhase()` uses. Web team free to identify by either signal.

**Reactions/replies:** v1 NO. Single linear thread. Reactions later.

### 3.2 — Plan viewer pin overlay (Web-side)

When Web builds its drawing/plan viewer, overlay both `drawing_pins` (Sprint 47B, uses `position_x`/`position_y`) AND `punch_items` (uses `plan_x`/`plan_y`).

```ts
// Pseudo-code for Web viewer
const allPins = [
  ...drawingPins.map((p) => ({ kind: 'drawing_pin', x: p.position_x, y: p.position_y, ...p })),
  ...punchItems.map((p) => ({ kind: 'punch', x: p.plan_x, y: p.plan_y, ...p })),
];
```

Visual differentiation: drawing_pins use Track's color scheme by `pin_type`, punch_items color by priority (low gray → critical red).

### 3.3 — `legal_templates` table (post-Sprint 53)

**Reason:** Track v1 hardcodes NY DOB / NYC Local Law boilerplate. As soon as Track is used outside NYC, this needs jurisdiction-aware templates.

**Suggested schema:**

```sql
CREATE TABLE legal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),  -- NULL = global default
  jurisdiction TEXT NOT NULL,           -- 'NY-NYC', 'NY-State', 'CA', 'global'
  document_type TEXT NOT NULL CHECK (document_type IN ('nod', 'rea', 'evidence')),
  language TEXT NOT NULL DEFAULT 'en',
  template_body TEXT NOT NULL,          -- handlebars-style {{var}} placeholders
  legal_basis_clause TEXT,
  acknowledgment_clause TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Track integration:** when Web table exists, replace `nodBoilerplate.ts` with `getLegalTemplate(orgId, jurisdiction, 'nod')`.

### 3.4 — `project_legal_recipients` table (post-Sprint 53)

**Reason:** Track v1 forces supervisor to type GC email each time. Repetitive, error-prone.

**Suggested schema:**

```sql
CREATE TABLE project_legal_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('gc_pm', 'gc_super', 'gc_legal', 'owner_rep', 'other')),
  primary BOOLEAN DEFAULT false,        -- one primary per project
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Track integration:** `NodSignModal` recipient field becomes a picker pre-populated from this table when Web ships it.

### 3.5 — 48-hour auto-escalation cron (Web-side)

**Behavior:**
```sql
-- Runs every 1 hour via Vercel Cron
UPDATE legal_documents
SET status = 'no_response'
WHERE status = 'sent'
  AND sent_at < NOW() - INTERVAL '48 hours'
  AND opened_at IS NULL;
```

**Notification:** when status flips to `no_response`, Web triggers an email to the supervisor + a push notification (via the same Edge Function pattern Track sets up in 53A for `field_messages`).

**Track integration:** none required — Track just observes the new status via PowerSync sync.

### 3.6 — Web punch_items create/manage (Web-side polish)

**Already exists:** Web has `PunchListView` + `punchListService.createPunchItem()` from Sprint 61.1.

**Add post-Track-Sprint-53:**
- Plan-anchored creation in Web Plan Viewer (uses Track's coords)
- Bulk operations (assign multiple to same worker, close multiple verified)
- Closeout PDF integration: `closeoutAggregator` from Sprint 60 already reads `punch_items` — verify it picks up the new plan-anchored items correctly when the area is finalized

---

## Section 4 — Schema additions Track ships in 53C (Web should be aware)

These changes hit shared tables. Web will sync naturally via PowerSync, but Web team should be aware so any in-flight Web migration doesn't conflict.

### 4.1 — `legal_documents.tracking_token TEXT` + `recipient_name TEXT` (applied)

Migration: `add_legal_tracking_token` (already applied to prod DB 2026-04-24).

```sql
ALTER TABLE legal_documents ADD COLUMN tracking_token TEXT;
CREATE INDEX legal_documents_tracking_token_idx
  ON legal_documents (tracking_token)
  WHERE tracking_token IS NOT NULL;

ALTER TABLE legal_documents ADD COLUMN recipient_name TEXT;
```

**Used by:**
- `POST /api/pm/legal-documents/[docId]/distribute` (§2.1, Web) — generates the token and returns it to Track. Track writes it to this column in the sign-and-send transaction.
- `GET /api/legal/{tracking_token}/pixel` (§2.2, Web) — looks up the document on open via this column.

**`recipient_name`** supports the Hybrid Sender pattern ("John Supervisor
(Jantile) <noreply@notchfield.com>") — Track writes the GC company name
at send time.

### 4.2 — `device_tokens` table (Track-owned, NEW)

```sql
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
```

**Owned by:** Track (only Track has push notification needs for now).

**Web can use later:** if Web ever needs to send web push (browser notifications), the same table works — just add `platform IN ('web')` to the CHECK constraint via a follow-up migration.

### 4.3 — `delay_cost_logs` PowerSync declaration (NOT a schema change)

The table exists already. Track 53C just adds it to `src/shared/lib/powersync/schema.ts` and `powersync/sync-rules.yaml`. No DB change.

---

## Section 5 — Open questions for Web team (NICE-to-know, not blocking)

These don't block Track's work, but answers will shape v2 priorities.

1. **Communication search:** when Web builds the global Messages tab, do you want full-text search? If yes, Track can add `tsvector` GIN index on `field_messages.message` in a follow-up.

2. **Punch closeout:** when an area finishes (`production_areas.status = 'completed'`), should `punch_items` for that area auto-close to `verified` if no open ones exist? Or always require explicit supervisor verification?

3. **Legal evidence bundles:** `legalEvidencePdfRenderer.ts` exists in Web (per your message). When does it run — on demand from a "Generate Evidence Package" button, or auto on certain triggers (e.g. project closeout)? Track may want to surface a "Download evidence bundle" button on the Legal list screen that calls Web's renderer.

4. **REA workflow:** Track 53C only covers NOD. REA is in the `document_type` enum but Track doesn't build a sign+send flow for REA in v1. Do you have a Web design for REA we should mirror, or is REA also Track-first?

5. **GC view:** any plan to build a GC-facing portal where the GC can mark NODs as acknowledged (vs just opening the email pixel)? If yes, Track might want to surface "GC acknowledged at HH:MM" in addition to "Opened at HH:MM".

---

## Section 6 — Communication channel

Same as Sprint 52 follow-ups: post questions/responses in the agreed Slack channel (or open a GitHub issue against `lalas0825/Notchfield-Takeoff` referencing this doc + the specific section).

When Web is ready to take over any of the Track-owned infrastructure (Sections 2.1-2.3), open a coordination ticket and we'll handle the migration in a paired Track + Web sprint.

---

*Track collects, Web processes. Same database, different doors.*
*Track first, Web mirrors. Sprint 50A/B → TOOLBOX pattern.*
