# Sprint 53 — Takeoff Web Coordination

> **Audience:** Takeoff Web team
> **Companion to:** [SPRINT_TRACK_53.md](SPRINT_TRACK_53.md)
> **Status:** Track is first mover. Items below are what Web should add to backlog (post-Sprint 62) or build in parallel if priorities change.
> **Pattern:** Same as Sprint 50A/B → TOOLBOX, 43A → 45B, CREW → MANPOWER. Track ships v1, Web mirrors and replaces Track-owned infrastructure later.

---

## TL;DR for Web team

| Feature | Track v1 ships | Web TODO (no urgency) | Web replaces Track when |
|---------|----------------|------------------------|-------------------------|
| Communication | Direct UI on `field_messages` + Edge Function for push | Web UI for messages thread (Production Dashboard area panel + global "Messages" tab) | Web UI ready post-Sprint 62 |
| Punch List plan pinning | First writes to `plan_x`/`plan_y`/`drawing_id` | Plan viewer with pin overlay | Web Plan Viewer feature |
| Legal sign + send + tracking | Track-owned Edge Functions (`send-legal-document`, `legal-tracking-pixel`) + local PDF render | Server-side `nodPdfRenderer` + `/api/pm/legal-documents/[id]/distribute` + tracking pixel + 48h cron | Web endpoint feature-complete |
| Cost engine | Track writes `delay_cost_logs` client-side at sign time | None — Track is source of truth (Web confirmed) | Never (Track owns this) |
| Boilerplate body | Hardcoded NY DOB / NYC Local Law in Track | `legal_templates` per-jurisdiction table | Web templates ready |
| Recipients | Single email field at send time | `project_legal_recipients` table + selector | Web v2 |

---

## Section 1 — What Web does NOT need to do during Track Sprint 53

These are explicit *no-ops* — Track handles them. Listed here so Web doesn't start parallel work and create conflicts.

1. **No schema changes for Communication.** `field_messages` table is final for v1. Track will leave `read_at`/`read_by`/`updated_at` for a future joint sprint when usage demands it.
2. **No PowerSync rule changes for `field_messages`/`punch_items`/`legal_documents`** — already published.
3. **No new server-side renderer for NOD/REA in Web.** Track is using local `expo-print` for v1, same pattern as `safety-export.ts`.
4. **No `delay_cost_logs` server-side computation.** Track computes from `area_time_entries` + `workers.daily_rate_cents` and writes the row at sign time.

---

## Section 2 — Track-owned infrastructure that Web should plan to replace

These are the v1 escape hatches. Track is taking on responsibilities that conceptually belong to Web (server-side PDF, distribute endpoints) because they don't exist in Web yet. When Web is ready, Track gets refactored to call Web instead.

### 2.1 — Edge Function `send-legal-document` (Track-owned)

**Replace with:** `POST /api/pm/legal-documents/[docId]/distribute`

**Suggested contract** (mirror of `/api/pm/safety-documents/[docId]/distribute` from Sprint 52H):

```ts
// Request
POST /api/pm/legal-documents/{docId}/distribute
Authorization: Bearer {jwt}  // dual-auth: cookie OR bearer
Content-Type: application/json

{
  recipientEmail: string;       // single recipient v1; v2 array
  pdfLabels: NodPdfLabels;      // canonical label shape — see TAKEOFF_PDF_ALIGNMENT.md
  oshaCitationsIncluded: boolean;
  // server resolves: org name, project name, gc info from joins
}

// Response
{
  success: true,
  sent_at: ISO,
  tracking_token: UUID,
  pdf_sha256: string,
}
```

**Pattern to copy from Sprint 52H (Web `4a84abf` commit):**
- Build Supabase client with bearer JWT first, fall back to cookie
- RLS sees `auth.uid()` correctly
- Defensive null coercion (the `jsPDF.text(undefined)` crash from Sprint 52)
- `labels` carries pre-resolved object maps, not raw enum keys
- Strip trailing `(N)` from any text counts before appending count from `selected_tasks.length`

**Track-side change required when Web ships this:**

```ts
// src/features/legal/services/sendLegalDocument.ts
- await fetch(`${SUPABASE_URL}/functions/v1/send-legal-document`, ...);
+ await fetch(`${WEB_API_URL}/api/pm/legal-documents/${docId}/distribute`, {
+   headers: { Authorization: `Bearer ${session.access_token}` },
+   body: JSON.stringify({ recipientEmail, pdfLabels, oshaCitationsIncluded }),
+ });
```

The Edge Function `send-legal-document` can stay deployed as a fallback for offline-flush queue retry (until Web endpoint is verified stable).

### 2.2 — Edge Function `legal-tracking-pixel` (Track-owned)

**Replace with:** `GET /api/legal/{trackingToken}/pixel`

**Behavior identical:** 1×1 transparent PNG, UPDATE `legal_documents` SET `opened_at`, `receipt_ip`, `receipt_device`, `status='opened'` WHERE `tracking_token = ?` AND `opened_at IS NULL`.

**Why migrate to Web:** the pixel URL gets embedded in the email body. Long-term, the URL on the customer-facing domain `notchfield.com/api/legal/.../pixel` looks more professional than a Supabase functions URL.

**Schema column added by Track in 53C:** `legal_documents.tracking_token TEXT` (UUID). Web should keep this column when implementing the server-side pixel.

### 2.3 — Server-side `nodPdfRenderer.ts`

**Replace:** Track's local `expo-print` HTML template.

**Pattern:** mirror Track's HTML structure. The 17 PDF gaps from Sprint 52 (TAKEOFF_PDF_ALIGNMENT.md) apply here too — Title Case headers, MM/DD/YYYY dates, full 64-char SHA-256, ACTIVE not DRAFT race, customer letterhead via `OrgLetterhead` pattern.

**Canonical labels shape** (Track will pass these in the distribute body):

```ts
type NodPdfLabels = {
  title: string;             // "NOTICE OF DELAY"
  projectName: string;
  organizationName: string;
  gcName: string;
  areaLabel: string;
  blockedAt: string;         // MM/DD/YYYY
  duration: string;          // "5 workdays (40 hours)"
  blockedReason: string;     // free text
  legalBasis: string;        // boilerplate paragraph
  acknowledgment: string;    // "Please acknowledge within 48 hours..."
  signedAt: string;          // MM/DD/YYYY HH:mm local TZ
  signerName: string;
  signerTitle: string;       // e.g. "Project Supervisor"
  costSummary: {
    crewSize: number;
    avgDailyRateUsd: string; // "$1,750.00"
    daysLost: number;
    totalImpactUsd: string;  // "$17,500.00"
  };
};
```

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

### 4.1 — `legal_documents.tracking_token TEXT`

```sql
ALTER TABLE legal_documents ADD COLUMN tracking_token TEXT;
CREATE INDEX legal_documents_tracking_token_idx ON legal_documents (tracking_token) WHERE tracking_token IS NOT NULL;
```

**Used by:** `legal-tracking-pixel` Edge Function to find the document when GC opens the email.

**Web replaces by:** keeping the column when migrating to `/api/legal/{trackingToken}/pixel`. Same column, different handler.

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
