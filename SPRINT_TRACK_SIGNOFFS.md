# SPRINT_TRACK_SIGNOFFS — Track team handoff (Sprint 72)

> **Last updated:** 2026-04-28 — added 6 polish-round contract changes (see §12 CHANGELOG at bottom).

> **TL;DR:** Web shipped Sign-Offs Phase 1+2+selected Phase 3+2 polish rounds. Track can flip mocks → real API NOW. ~6h of UI work for FAB + library picker + photo evidence + sign-in-person screen. Phase 2 wiring (auto-spawn, notifications, todos, Ready Board flip) is automatic — no Track work needed. Library is global-seeded with 14 templates filterable by trade.

> **Goal:** Foreman walks site → taps "+ Sign-Off" on area card → picks template (Waterproofing Approval / Vanity Top Acceptance / etc.) → adds photo evidence to specific slots + optional notes → submit → PM sees in /pm/sign-offs → PM sends to GC OR signs in-person on iPad. Fully digital replacement for Jantile's 6 paper templates.

---

## 0. What's NOT yours

❌ **Workflow logic** — Web service has create / send / decline / in-person-sign / finalize endpoints. Track just calls them.
❌ **Library management** — Web seeds + serves the global `signoff_templates` (14 templates). Track reads from PowerSync.
❌ **PDF rendering** — Web renders the signed PDF with letterhead + evidence + signature + SHA-256. Track shows the URL.
❌ **Email distribution** — Web's hybrid sender + polished email template handle this when PM hits "Send for Signature".
❌ **Auto-spawn trigger** — DB trigger fires when `production_area_objects.status` flips to `'completed'` AND template has matching `auto_spawn_on_surface_type`. Track just sees the new draft signoff in PowerSync.
❌ **Notifications + Todos** — Web's notify() + createTodo() handle this. Track sees the resulting rows automatically (signoff_signature_due in foreman's todo list, signoff_followup_due in PM's todo list).
❌ **Ready Board auto-flip** — Web's onSignoffSigned() updates `production_area_objects.status` to 'completed' when template's status_after_sign='unlocks_next_trade'. Track sees the ready-board change in PowerSync.

✅ **Yours:** PowerSync sync rules, "+ Sign-Off" FAB on area screens, library picker UI, photo evidence capture, sign-in-person screen for the foreman/PM facilitator role.

---

## 1. PowerSync sync rule

```yaml
bucket_definitions:
  org_signoffs:
    parameters:
      - SELECT organization_id AS org_id FROM profiles WHERE id = request.user_id()
    data:
      # Pending + signed signoffs (skip cancelled/expired/declined for inbox cleanliness)
      - SELECT * FROM signoff_documents WHERE organization_id = bucket.org_id
          AND status IN ('draft', 'pending_signature', 'signed')
      # All signoff_areas joined to those signoffs
      - SELECT * FROM signoff_areas WHERE signoff_id IN (
          SELECT id FROM signoff_documents WHERE organization_id = bucket.org_id
            AND status IN ('draft', 'pending_signature', 'signed')
        )
      # Library: org-specific + globals (NULL org_id = NotchField-seeded)
      - SELECT * FROM signoff_templates WHERE organization_id = bucket.org_id OR organization_id IS NULL
```

All 3 tables are in `supabase_realtime` publication ✅.

---

## 2. Copy types verbatim

From `src/features/signoffs/types.ts`:

```typescript
export type SignoffSignerRole = 'contractor' | 'gc' | 'either'

export type SignoffEvidenceType = 'photo' | 'video' | 'numeric_reading' | 'checkbox'

export type SignoffEvidenceRule = {
  type: SignoffEvidenceType
  label: string
  required: boolean
}

export type SignoffStatusAfterSign = 'unlocks_next_trade' | 'closes_phase' | 'archives'

export type SignoffDocStatus =
  | 'draft' | 'pending_signature' | 'signed' | 'declined' | 'expired' | 'cancelled'

export type SignoffEvidencePhoto = {
  url: string
  type: SignoffEvidenceType
  label: string
  taken_at?: string | null
  taken_by?: string | null
  reading_value?: number | null
}

export type SignoffTemplate = {
  id: string
  organization_id: string | null
  trade: string
  name: string
  description: string | null
  body_template: string  // ${areas} ${trade} ${gc} ${contractor} ${date} ${project} placeholders
  signer_role: SignoffSignerRole
  required_evidence: SignoffEvidenceRule[]
  auto_spawn_on_surface_type: string | null
  allows_multi_area: boolean
  default_status_after_sign: SignoffStatusAfterSign
  active: boolean
  created_at: string
  updated_at: string
}

export type SignoffDocument = {
  id: string
  organization_id: string
  project_id: string
  number: number
  template_id: string | null
  title: string
  body: string
  notes: string | null  // Sprint 72 polish R2 — optional extra context shown in PDF + signing page
  signer_role: SignoffSignerRole
  trade: string | null
  status: SignoffDocStatus
  evidence_photos: SignoffEvidencePhoto[]
  required_evidence_snapshot: SignoffEvidenceRule[]
  status_after_sign: SignoffStatusAfterSign
  created_by: string | null
  sent_at: string | null
  sent_to_email: string | null
  signed_at: string | null
  signed_by_name: string | null
  signed_by_company: string | null
  declined_at: string | null
  declined_reason: string | null
  pdf_url: string | null
  sha256_hash: string | null
  spawned_from_object_id: string | null
  created_at: string
  updated_at: string
}

export type SignoffArea = {
  signoff_id: string
  area_id: string
  surface_id: string | null
  area_label_snapshot: string | null
  created_at: string
}
```

DB CHECK constraints reject any new enum values not in this list.

---

## 3. API client (5 endpoints)

```typescript
const WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://notchfield.com'

// 1. Create
export async function createSignoffViaWeb(payload: {
  projectId: string
  templateId?: string  // omit for ad-hoc
  areas: { areaId: string; surfaceId?: string; label?: string }[]
  evidence?: { url: string; type: 'photo' | 'video' | 'numeric_reading' | 'checkbox'; label: string; reading_value?: number }[]
  // Sprint 72 polish R2 — optional extra notes shown to GC at sign time + in PDF
  notes?: string | null
  // Sprint 72 polish R1 — pass body override if recipient name was filled in UI;
  // body should be pre-rendered with renderSignoffBody() substituting ${gc} with
  // recipient name. If omitted, server renders with template + ____ blank.
  body?: string
  // For ad-hoc only:
  title?: string
  signerRole?: 'contractor' | 'gc' | 'either'
  trade?: string
  requiredEvidence?: { type: string; label: string; required: boolean }[]
  statusAfterSign?: 'unlocks_next_trade' | 'closes_phase' | 'archives'
}, bearer: string) {
  const res = await fetch(`${WEB_BASE}/api/signoffs/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`create failed: ${res.status}`)
  return res.json() as Promise<{ success: true; id: string; number: number }>
}

// 2. Send for signature (generates token + emails GC)
export async function sendSignoffViaWeb(
  id: string,
  payload: { recipientEmail?: string; recipientName?: string; recipientCompany?: string; expiresInDays?: number },
  bearer: string,
) {
  const res = await fetch(`${WEB_BASE}/api/signoffs/${id}/send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`send failed: ${res.status}`)
  return res.json() as Promise<{ ok: true; token: string }>
}

// 3. Decline (signer rejects with reason)
export async function declineSignoffViaWeb(id: string, reason: string, bearer: string) {
  const res = await fetch(`${WEB_BASE}/api/signoffs/${id}/decline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) throw new Error(`decline failed: ${res.status}`)
  return res.json() as Promise<{ ok: true }>
}

// 4. In-person sign (PM/foreman hands iPad to GC)
export async function signInPersonViaWeb(
  id: string,
  payload: { signerName: string; signerCompany?: string; signatureDataUrl: string },
  bearer: string,
) {
  const res = await fetch(`${WEB_BASE}/api/signoffs/${id}/sign-in-person`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`in-person sign failed: ${res.status}`)
  return res.json() as Promise<{ ok: true }>
}

// 5. Bulk export (cookie auth only — Web PM uses this)
// Track skips this — Track users won't be exporting bundles in the field.
```

Same Bearer token pattern as Sprint 69/70/71.

---

## 4. UI surfaces (your work)

### "+ Sign-Off" FAB on Area screen
Tap → 2-step modal:

1. **Step 1 — Library picker** (group by trade).
   - **🆕 Polish R2:** filter templates by `org.primary_trades + 'general'` BEFORE rendering. Jantile (`primary_trades=['tile','marble']`) sees 11 of 14 templates (hides drywall + paint). If org has no primary_trades set, fall back to showing all.
   - Tap a template card → preview body + required evidence list. Confirm → Step 2.

2. **Step 2 — Recipient + Body + Evidence + Notes** (in this vertical order):
   - **🆕 Polish R1: Recipient name + company inputs** at top. As foreman types, body preview live-updates substituting the `${gc}` blank with the actual name. If left blank, body keeps `_______________` underline (signer name woven in at sign time).
   - **Body preview** — read-only textarea showing the template body with substitutions applied
   - **🆕 Polish R2: Optional notes textarea** — extra context shown in PDF + signing page (e.g. "Verify between 9-11 AM" / "Note: minor scratch on lower-left, not affecting integrity")
   - **Multi-select areas grouped by floor** (radio if template has `allows_multi_area=false`)
   - **🆕 Polish R1: Slot-based evidence** — render ONE upload card per `required_evidence` rule. Each card shows the rule label (e.g. "Flood test photo *"). Tap → camera/picker → photo gets the rule label automatically. **Critical:** uploads MUST use exact-match label from rule, otherwise server validation rejects on send. "Add other photo" button at bottom for ad-hoc evidence beyond the rules.
   - Submit → `createSignoffViaWeb()` with `body` (rendered) + `notes` + `evidence[]` (each photo with exact rule label)

### Today screen → "Sign sign-off" widget (Sprint 70 todo integration)
Each `signoff_signature_due` todo → tap → opens deep-link to in-person sign screen. Foreman finger-signs → submits → `signInPersonViaWeb()`. PowerSync auto-updates the parent doc.

### Compliance / Sign-Offs list screen
For PM/Supervisor primary. List of all sign-offs in their projects with status filter pills (Draft / Pending / Signed / Declined). Tap → detail view with workflow buttons (Send / In-Person Sign / Cancel / Delete).

**🆕 Polish R1: per-rule "Attach" buttons in detail view (draft state only).** If signoff is auto-spawned with empty evidence, show each `required_evidence_snapshot` rule with an "Attach photo" button next to it. Tap → upload → patch via `updateSignoffEvidenceViaWeb` (or local PowerSync mutation). Avoids forcing PM to delete + recreate.

**🆕 Polish R2: Preview PDF link.** Add a "Preview formal PDF" button anywhere in the detail/sign UI that opens `${WEB_BASE}/api/sign/signoff/${token}/preview-pdf` in WebView/external browser. Returns unsigned PDF with diagonal "PREVIEW — UNSIGNED" watermark. Helps the signer review the formal document before committing.

---

## 5. Photo handling

Reuse existing field-photos bucket pattern:
1. Camera → temp file
2. Upload to `field-photos/{org_id}/signoffs/{YYYY-MM-DD}/{uuid}.jpg`
3. Get public URL
4. Build evidence object: `{ url, type: 'photo', label: 'Flood test photo', taken_at, taken_by }`
5. Pass in `evidence: [...]` to create endpoint

For numeric readings (e.g. ohm meter on heat mat approval), set `reading_value` on the evidence object alongside the photo URL.

---

## 6. Phase 2 wiring — DONE on Web side (no Track work needed)

> **All side-effects fire automatically on existing API calls Track makes.** Track team: nothing to add — your existing `createSignoffViaWeb / sendSignoffViaWeb / signInPersonViaWeb / declineSignoffViaWeb` now trigger:

**Auto-spawn (DB trigger):**
- When `production_area_objects.status` flips to `'completed'` AND a `signoff_template` has `auto_spawn_on_surface_type = surface_type` for the org → auto-create a draft signoff with the area pre-linked.
- 3 templates currently auto-spawn (per global library): Waterproofing Approval (waterproofing), Vanity Top Acceptance + Tub Deck + Kitchen Top (top), Heat Mat Approval (floor).
- Idempotent — won't re-create if a draft/pending exists for the same template+surface combo.

**Notifications added** (Sprint 69 integration):
| Event type | Triggered when | Recipients | Channels |
|---|---|---|---|
| `signoff_request_sent` | sendSignoffViaWeb called | All PMs of org (audit trail) | in-app |
| `signoff_signed` | Sign completed (any path) | Creator + project PMs | in-app + email + **push** |
| `signoff_declined` | declineSignoffViaWeb called | Creator + supervisors | in-app + email + **push** |

**Todos added** (Sprint 70 integration):
| Todo type | Created when | Owner | Auto-completes when |
|---|---|---|---|
| `signoff_signature_due` | sendSignoffViaWeb if recipient is internal profile | the recipient | status → signed/declined/cancelled |
| `signoff_followup_due` | sendSignoffViaWeb (any recipient) | creator (PM) | status changes from pending_signature |

**Cron (every hour):**
- After 48h no response, `signoff_followup_due` todos surface to PM
- Also expires `pending_signature` rows whose `expires_at` passed

**Ready Board auto-flip:**
- When status flips to `signed` AND template has `default_status_after_sign='unlocks_next_trade'` → linked surfaces flip to `'completed'` in `production_area_objects` → Ready Board auto-updates.
- For `closes_phase` templates: same effect (marks linked surfaces complete).
- For `archives` templates: no Ready Board side-effect (just records the signoff).

### Track Phase 2 implementation tasks (your side)
1. **Today widget for `signoff_signature_due`** — render foreman todos with `pen-tool` icon. Tap → in-person sign screen.
2. **Compliance UI for PM** — list view + detail panel with Send/In-Person/Cancel/Delete buttons. API client ready.
3. **Push handler for `signoff_signed` + `signoff_declined`** — both have `push: true` in default channels. Wire to your Expo push handler.

---

## 7. Phase 3 features Web shipped (selected; Track can leverage)

**1. In-person signing** (`signInPersonViaWeb`) — PM/foreman hands iPad to GC standing there. Reuses Sprint 48 SignatureCanvas. PM authenticates, GC just signs. PDF gets generated immediately.

**2. Polished email** — when `sendSignoffViaWeb` fires with `recipientEmail`, GC gets a beautifully styled email with prominent "Review & Sign" CTA → opens `/sign/{token}` in mobile-optimized signing form. Hybrid Sender pattern (PM as sender, NotchField as transport). 30-second flow on phone: tap link → review evidence → finger sign → done.

**3. Bulk PDF export** — PM-only feature on Web (no Track equivalent needed). Selects N signed sign-offs → exports as one bundle PDF for arbitration packages. SHA-256 of each preserved.

---

## 8. ⚠️ Phase 2 Gotchas — read before flipping the switch

These are subtle behaviors baked into Web wiring that affect what Track sees in PowerSync. Reading this saves you a debug session.

1. **Auto-spawned signoffs have `created_by = NULL`.** When DB trigger creates a signoff (vs human-created), `created_by` is null. Track UI should handle this — don't crash if creator is missing. Display as "Auto-created" or "System".

2. **Status flip on send vs in-person sign.** `sendSignoffViaWeb` flips status `draft → pending_signature` and creates a token. `signInPersonViaWeb` flips status `draft|pending_signature → signed` directly with NO token (PM is the auth). Don't assume there's a token after signing — for in-person, there isn't (well, there's an `inperson-{uuid}` but it's never delivered).

3. **Body has placeholders pre-rendered at create time.** When the signoff is created (manual OR auto-spawn), the body template's `${areas}`, `${trade}`, etc. are substituted with snapshot values and stored as the final body. **🆕 Polish R1:** if no recipient name is provided at create time, `${gc}` and `${date}` substitute with `_______________` (15 underscores) — paper-template style fill-in line. Foreman should pre-fill recipient name in their UI to avoid the blank. At sign time, `fillBlanksWithSignerInfo()` weaves the actual signer name into the first remaining `_______________`. Track UI should display `signoff.body` directly — no further substitution needed.

4. **Required evidence is enforced server-side AND label-exact.** `sendSignoffViaWeb` will REJECT with 500 + error message if `required_evidence_snapshot` items are not satisfied by `evidence_photos` with **exact-string-matching labels**. **🆕 Polish R1 critical:** if you upload a photo with `label: "Evidence 1"` but the rule requires `label: "Flood test photo"`, validation FAILS even though there are enough photos. Use slot-based UI (one upload card per rule, label injected automatically) so labels always match. Generic "Evidence N" labels are safe ONLY for ad-hoc photos beyond the required rules.

5. **Signed PDF URL appears asynchronously.** When `signInPersonViaWeb` returns success, the PDF rendering happens in the side-effect handler (fire-and-forget). The `pdf_url` field on the signoff_documents row updates seconds later. Track UI should listen for PowerSync update on the row and show "Generating..." → `pdf_url is set` → "Download PDF" button.

6. **`status_after_sign` decides what Ready Board does.** Templates with `unlocks_next_trade` or `closes_phase` will auto-update linked production_area_objects to `'completed'`. If a foreman doesn't want this side-effect for a specific signoff, the template needs `archives` instead. Don't expose this to foreman — it's a template author's choice.

7. **PowerSync sync rule for `signoff_areas`.** The areas table is the M:N link. Make sure your sync rule fetches it (see section 1) — without it, Track will show signoffs but no linked areas.

8. **`document_signoffs` table vs `signoff_documents` table.** Confusing naming, sorry. `document_signoffs` is the polymorphic SIGNATURE artifact (Sprint 48). `signoff_documents` is the new container table (Sprint 72). They link via `document_signoffs.document_id = signoff_documents.id` when `document_type = 'signoff_document'`. Track only needs to read `signoff_documents` directly — `document_signoffs` is the public-token signing pipeline that Web handles.

9. **NEVER call Web service action from Track.** Use the API endpoints. Service actions in `signoffService.ts` and `signoffSideEffects.ts` already fire Phase 2 side effects (notifications + todos + Ready Board flip). Calling them via Track would double-fire everything.

10. **Decline is final but cancellable by re-create.** When GC declines, status flips to `declined` and stays. Foreman can't "un-decline" — they create a new signoff (potentially cloning the old one's body + evidence). Old declined signoff stays in history with the decline reason for audit.

11. **Pre-signed signature URLs in PDF.** The signed PDF embeds the signature image via fetch. If the signature was uploaded with `upsert: true` (which it is in `submitInPersonSignature`), the URL is stable. Don't expose this URL externally — it's internal to PDF rendering.

12. **iOS clipboard for `linkCopied` doesn't work in standalone PWAs.** If Track ships a PWA wrapper, `navigator.clipboard.writeText` may fail silently. Use `Share API` (`navigator.share`) instead for the "share link" feature.

13. **🆕 Polish R1 — Public RLS allows anon GC read.** `signoff_documents` and `signoff_areas` now have public_read_via_token policies — anon GCs visiting `/sign/{token}` can now SELECT the doc + areas. Before this fix, your in-app token-signing flow would have failed silently. If your Track app uses an anon Supabase client to fetch signoff context for the sign screen, it now works.

14. **🆕 Polish R2 — Notes field is optional but renderable.** New `signoff_documents.notes` column. If populated, renders as an "ADDITIONAL NOTES" section in the signed PDF, preview PDF, public signing page, and detail panel. Track UI should:
    - Show an optional textarea when creating (mirror Web's `notesPlaceholder` / `notesFieldHint` UX)
    - Display the notes block prominently in the signing screen so the GC sees it BEFORE finger-signing
    - Display in the detail/list view if present

15. **🆕 Polish R2 — Template filter pattern.** Web filters templates client-side by `org.primary_trades + 'general'`. Hides templates from trades the org doesn't do. Track should mirror this pattern in the FAB library picker — load `org.primary_trades` from `organizations` table, filter `signoff_templates` where `trade IN primary_trades OR trade === 'general'`. Fallback: if `primary_trades = []` show all (no opinion = no filter).

16. **🆕 Polish R2 — In-person sign no longer needs SUPABASE_SERVICE_ROLE_KEY.** `submitInPersonSignature` was refactored to use the authenticated session client (cookie-auth on Web, Bearer JWT for Track). Public token sign (anon GC via `/sign/{token}`) still uses service role internally because GC has no session. This doesn't affect your Track API client — just means your local dev doesn't need the service role key for in-person flows.

17. **🆕 Polish R2 — Preview PDF endpoint available.** `GET /api/sign/signoff/[token]/preview-pdf` returns the unsigned signoff as a formal PDF with `PREVIEW — UNSIGNED` watermark. No auth (token is the auth). Track can offer a "Preview formal PDF" button in their signing UI — opens in WebView/external browser. If signoff is already signed, the endpoint redirects to the signed PDF URL.

18. **🆕 Polish R2 — Verify QR code in signed PDFs.** Signed PDFs now include a SHA-256 verify URL + QR code in the footer (last page). QR opens `${siteUrl}/verify/{hash}`, which is a public unauthenticated page that confirms document integrity. Track doesn't need to do anything — the QR is embedded in the PDF the user downloads. Just be aware it's there for chain-of-custody questions.

---

## 9. Definition of Done

- [ ] PowerSync sync rule deployed (3 tables)
- [ ] FAB on area screen creates signoff end-to-end (template picker + recipient name + notes + multi-area + slot-based photo evidence)
- [ ] **🆕 Library picker FILTERED by `org.primary_trades + 'general'`** (not all 14 templates)
- [ ] **🆕 Recipient name + company inputs in Step 2** (live-substitute `${gc}` blank in body preview)
- [ ] **🆕 Optional notes textarea in Step 2** (rendered in PDF + signing page)
- [ ] **🆕 Slot-based evidence UI** (one upload card per `required_evidence` rule, label exact-match)
- [ ] Photo capture + upload to field-photos works
- [ ] In-person sign screen (PM hands iPad to GC) works → `signInPersonViaWeb`
- [ ] **🆕 Per-rule "Attach" button in detail view** (draft state, for auto-spawned signoffs without evidence)
- [ ] **🆕 "Preview formal PDF" button** opens `/api/sign/signoff/[token]/preview-pdf` in WebView
- [ ] **🆕 Notes block displayed prominently in signing screen** before signature canvas
- [ ] Today todo → tap → sign flow works
- [ ] Compliance screen for PM (list + detail + send/cancel buttons)
- [ ] Push notif `signoff_signed` and `signoff_declined` arrive on phone

---

## 10. Auto-blindaje rules

- ❌ NEVER insert directly into `signoff_documents` from Track. Use `/api/signoffs/create`. RLS doesn't have a public INSERT policy for Track's role.
- ❌ NEVER mark signed without uploading required evidence. The server enforces this on `send` for remote signing — for in-person, Track must enforce client-side BEFORE calling `signInPersonViaWeb`.
- ❌ NEVER let foreman invent free-form templates. Use library picker; only fall back to ad-hoc if NO template matches (rare, but supported).
- ✅ ALWAYS send the foreman to in-person flow if no recipient email available. Don't make them collect emails in the field.
- ✅ ALWAYS show evidence checklist with red-bordered missing items so foreman knows what's still needed before submit.
- ✅ ALWAYS pass surface_id when known — auto-spawn relies on it for de-duping, and Ready Board auto-flip needs it to flip the right surface.

---

## 11. Phase 2 verification (smoke tests Track can run after wiring)

```sql
-- 1. Auto-spawn fires when waterproofing surface marked complete
UPDATE production_area_objects
SET status = 'completed'
WHERE id = '<test_waterproof_surface_id>';

-- Check:
SELECT * FROM signoff_documents
WHERE spawned_from_object_id = '<test_waterproof_surface_id>'
ORDER BY created_at DESC LIMIT 1;
-- Should show 1 draft signoff with template = 'Waterproofing Approval'.

-- 2. Send creates token + fires notification
-- (Use API endpoint, not SQL, since notification fan-out only fires from API path)

-- 3. Sign flips status + auto-flips production_area_objects to completed
-- Check after PM signs:
SELECT id, status, completed_at FROM production_area_objects
WHERE id IN (SELECT surface_id FROM signoff_areas WHERE signoff_id = '<signed_signoff_id>');
-- Should show status='completed', completed_at recently set.
```

---

*Sprint 72 Track estimate: ~6h parallel for FAB + library + photo evidence. Compliance UI ~3h. In-person sign screen ~2h. Backend + Phase 2 + selected Phase 3 features ready, no blockers.*

---

## 12. CHANGELOG

### 2026-04-28 — Polish round 1+2 (after initial Sprint 72 ship)

These changes happened DURING pilot dogfooding and added contract changes you may have already coded against the original spec. Read carefully — some may require small UI rework.

**Polish R1 — UX refinements (from pilot testing):**
- ✅ **Slot-based evidence pattern** — original FAB design had "upload N photos with auto-labels Evidence-1, Evidence-2..." which broke server validation (label mismatch). New pattern: one upload SLOT per `required_evidence` rule, label injected automatically. **Impact:** redesign your evidence UI as cards (not a flat list).
- ✅ **Recipient name + company inputs** added to Step 2 of FAB, before the body preview. As foreman types, body preview live-substitutes `${gc}` placeholder. If left blank, body keeps `_______________` underline. **Impact:** add 2 inputs to your FAB Step 2.
- ✅ **Public RLS via token** — `signoff_documents` + `signoff_areas` got new policies allowing anon SELECT when a `document_signoffs` row exists for the token. **Impact:** if your in-app sign screen used anon Supabase client + previously failed silently, it now works.
- ✅ **SendForSignatureModal consolidation** — Web removed inline form pattern; one button opens a clean modal with the form. Track should mirror — single "Send for Signature" button → opens modal → form → submit (no two-step inline-form).
- ✅ **Per-rule "Attach" buttons in detail view** — when signoff is in draft state with empty evidence (e.g. auto-spawned), each `required_evidence_snapshot` rule has an inline "Attach photo" button. **Impact:** add this affordance to your detail screen so PM doesn't have to delete + recreate.

**Polish R2 — content + polish:**
- ✅ **Optional `notes` column** added to `signoff_documents`. Track create payload now accepts `notes?: string | null`. Renders as "ADDITIONAL NOTES" section in PDF + signing page + detail panel. **Impact:** add optional textarea to your FAB Step 2 + display block in signing/detail screens.
- ✅ **Template filter by `org.primary_trades + 'general'`** — Web filters templates client-side. **Impact:** add same filter to your library picker (load org's `primary_trades` array, filter templates by trade match OR `'general'`).
- ✅ **Logo aspect ratio fix in PDFs** — used to be hardcoded 90×40 squashed wide logos. Now uses `fitImageInBox(120, 50)`. **Impact:** none for Track — Track doesn't render PDFs, but the PDFs you download via API now look right.
- ✅ **Preview PDF endpoint** — `GET /api/sign/signoff/[token]/preview-pdf` returns formal unsigned PDF with watermark. **Impact:** add a "Preview formal PDF" button in your signing UI.
- ✅ **SHA-256 verify URL + QR code in signed PDF footer** — last page has QR pointing to `/verify/{hash}` public page. **Impact:** none — automatic, just be aware for chain-of-custody questions.
- ✅ **In-person sign no longer requires `SUPABASE_SERVICE_ROLE_KEY`** — refactored to use authenticated session client. **Impact:** none for Track API client (still uses Bearer JWT), but local dev is simpler.

### 2026-04-27 — Initial Sprint 72 ship

Sections 0–11 above. Read in order if starting from scratch.
