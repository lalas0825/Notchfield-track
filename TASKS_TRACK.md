# NotchField Track — TASKS_TRACK.md
> Track native app task tracker | 105 tasks | Updated: 2026-04-21
> 4 phases: T1 (DONE) → T2 (DONE + Sprint 42B + 43A + 43B + 45B + PTP + TOOLBOX + 52) → T3 (9/10) → T4 (after Takeoff 10)
> Same Supabase as Takeoff. Expo + PowerSync. Offline-first.
> **Supabase project:** msmpsxalfalzinuorwlg (Notchfield Takeoff — shared)
> **PowerSync:** 69c72137a112d86b20541618.powersync.journeyapps.com (45 tables synced — +drawing_register via Sprint 52)
> **EAS Project:** 281ade7b-a5d9-4f43-9710-d270ae4c49f4 (@lalas825/notchfield-track)
> **Repo:** https://github.com/lalas0825/Notchfield-track (68+ commits, Sprint 52 pilot-ready)
> **APK:** dev-client installed on device (Sprint 52 tested offline + online). Preview APK build pending for Jantile field test.
> **Takeoff:** UNBLOCKED — all Track ↔ Takeoff data loops closed. Web PDF renderer still has 17 remaining gaps tracked in TAKEOFF_PDF_ALIGNMENT.md.
> **Synced through:** Takeoff Sprint 37 + Delivery Review + Sprint 42A + Safety A (JHA library / PTP) + Sprint CREW (workers + project_workers) + Sprint 50A/50B (toolbox_library + overrides + scheduler) + Sprint 52 Web commits (`4a84abf` dual-auth, `3c094a0` jsPDF null guard, `3b0dfd0` shiftValues fallback, `274ef6b` strip+append counts, Zoho SMTP migration `e209404`)

---

## 📊 Summary

| Phase | What | Tasks | Depends On | Status |
|-------|------|-------|-----------|--------|
| **T1 — Foundation + Safety + GPS + Time Tracking + Plans** | Auth, navigation, GPS, safety, work tickets, crew, time entries, drawing viewer | **43** | Nothing (tables exist) | ✅ OPERATIONAL (43/43) |
| **T2 — Production + Ready Board + Legal + Punch List + AI Agent** | Daily report, checkboxes, Ready Board, gates, NOD/REA, punch list, AI agent + voice | **38** | Takeoff Fase 7B | ✅ DONE (S1-S3 + Sprint 25A/B/C + Sprint 34 + Sprint 41G + Sprint 42B) |
| **T3 — Delivery + Material Flow** | Delivery confirmation, supervisor tracker, material consumption | **10** | Takeoff Fase 9 | ✅ 9/10 DONE (1 UI screen pending) |
| **T4 — Polish + App Store** | Role enforcement, push, performance, store submission | **10** | Takeoff Fase 10 | ⬜ After Fase 10 |
| **Audit** | 65-check audit (AUDIT_TRACK.md) | 65 | — | ✅ B- grade, 11 FAILs fixed |
| **EAS Build** | APK on device testing | — | — | 🟡 ~8 builds. Needs dev-client build |
| **Seed Data** | Real production data in Supabase | — | — | ✅ 6 areas, 5 workers, template, geofence, certs |
| **TOTAL** | | **105** | | **~99/105 (94%)** |

### Recent Sprints (since last TASKS update)

| Sprint | What | Status |
|--------|------|--------|
| 25A | PowerSync schema: room_types, room_type_surfaces, phase_progress + new columns | ✅ |
| 25B | PhaseChecklist UI: sqft-weighted progress, bottom sheet, gate locking | ✅ |
| 25C | Phase-linked photos: camera icon per phase, photo count badge, GPS tagging | ✅ |
| 29-37 | Delivery columns sync + status filter (shipped/delivered only) | ✅ |
| 34 | Pilot features: surface camera, photo gallery, sqft progress calc | ✅ |
| Delivery Review | pending_review → approved flow, Home alerts, Docs tab badge | ✅ |
| 41G | Surface checklist 3-state (not_started → in_progress → completed), block with notes, area status propagation | ✅ |
| 42A | Takeoff: gc_punch_items table + Edge Functions (gc-pull-items, gc-push-resolution) | ✅ (Takeoff side) |
| 42B | Track: GC Punchlist UI — PowerSync schema, sync rules, permissions, list screen, detail screen (hours, notes, photos, push_pending) | ✅ |
| 43A | Surface checklist real SF progress + UX polish | ✅ |
| 43B | Track Work Tickets — T&M with digital GC signatures (superseded by 45B) | ✅ |
| 45B | Work Tickets REWRITE — aligned with Takeoff Web, in-app signing, direct Supabase, SHA-256 hash | ✅ |
| 45B-F | Track Feedback Reporting — bugs / features / feedback with screenshots + auto-context | ✅ |
| 45B-FIX | Work Tickets bug-fix pass — title/area NOT NULL, signer_name placeholder, calendar picker, signature pad dots fix, sign URL | ✅ |
| 47B | Track Drawing Viewer — hyperlinks + pins (offline-first, overlay at fit-to-page) | ✅ |
| PTP | Track Foreman PTP Flow — 4-step wizard (tasks → review → signatures → distribute), JHA library consumer, SST/emergency snapshots, distribute via Takeoff endpoint + offline AsyncStorage queue | ✅ |
| PTP-UX | Morning PTP card on Home + Safety tab surfaced + legacy PTP cleanup + detail view auto-shape | ✅ |
| MANPOWER | Hotfix `profiles.sst_*` drops + migrate crew HR reads to `workers` / `project_workers`; walk-in creates real workers row; cert badges + expiry dialog | ✅ |
| TOOLBOX | Weekly Toolbox Talks — scheduler engine + 3-step wizard + EN/ES bilingual + photos + Home card. Critical enum hotfix: `doc_type='toolbox'` (not `'toolbox_talk'`) + `status` enum narrowed + `content.distribution` metadata | ✅ |
| 52 | **Pilot polish + Zoho email verification** (2026-04-21, Jantile). 13 commits: PtpPdfLabels canonical shape aligned with Web renderer (`shiftValues` object map, camelCase, 43 fields); customer letterhead w/ `organizations.logo_url` (new `features/organizations/` module, OrgLetterhead mounted on PTP/Toolbox/Work Ticket detail); `safety-export.ts` full rewrite (new-shape bodies, single font, MM/DD/YYYY, worker_name signer fallback); Plans rewired from `drawings`+`drawing_sets` → `drawing_register` (PM-side, fixes Jantile's 9 invisible sheets); `primary_trades` filter on trade picker (tile+marble only for Jantile); crew/attendance tables removed (signatures are the attendance record); `osha_ref` nullable (2 marble tasks were silent-dropped); SERIAL burn bug fixed (remove forceSync racing PowerSync auto-upload); distribute retry queue drops non-network errors + caps MAX_ATTEMPTS=20; PDF viewer tuning (`fitPolicy=0`, antialias, maxScale=5). Client sign-off "luce increíble" on Track export. Handoff: [TAKEOFF_PDF_ALIGNMENT.md](TAKEOFF_PDF_ALIGNMENT.md) Round 2 gap analysis (17 Web-side items). Deferred P1: PDF.js viewer switch documented. | ✅ |
| STORE RELEASE | Publish to Apple App Store + Google Play — legal (Privacy Policy, ToS, account deletion), technical (Sentry, asset audit, version bump), store ops (accounts, listings, screenshots, Data Safety form, closed testing). Full spec in SPRINT_TRACK_STORE_RELEASE.md. | ⬜ Planned |

### 🐛 Known Device Bugs (need dev-client build to debug)

| Bug | Severity | Root Cause | Fix Status |
|-----|----------|-----------|------------|
| GPS screen crash | P0 | Google Maps API key missing → fallback to text | ✅ Fixed in code, needs build |
| Signature pad dots only | P1 | ScrollView steals touch from WebView canvas | ✅ Fixed in code, needs build |
| Tickets don't sync to Supabase | P1 | Serial `number` column + JSONB serialization | ✅ Fixed in connector, needs build |
| Status values mismatch | P0 | `'complete'` vs `'completed'` in Postgres CHECK | ✅ Fixed in code |
| Blocked reasons mismatch | P1 | `'material'` vs `'material_not_delivered'` | ✅ Fixed in code |

All 5 bugs are fixed in code (commit 79b592a). Need EAS dev-client build to verify on device.

### 🔮 Deferred Priorities (post-pilot)

| Priority | Item | Rationale |
|----------|------|-----------|
| **P1** | **Switch Plans viewer from `react-native-pdf` → PDF.js in WebView** | Current `react-native-pdf` (PdfiumAndroid / PDFKit) rasterizes each page into a pixel buffer. Pinch-zoom stretches that bitmap until the native layer re-rasterizes at the new scale — users see a "blurry → sharp" transition that the pilot (Jantile, 2026-04-21) flagged as bothersome on detail drawings. Tuning commit `ba0b658` (`fitPolicy=0`, antialias, capped maxScale=5) reduces how often users hit the blurry state but doesn't eliminate the re-render window — that's inherent to bitmap-based PDF viewers. PDF.js renders vector primitives on every scale change → crisp at any zoom level, no progressive render artifacts. Tradeoffs: WebView is heavier in memory, offline PDF caching needs reworking (probably download + serve from local file:// URL), touch gestures may need JS↔native bridging for pin-drop coordinates. Estimated work: 6-8 hours for a working viewer + another 2-3 for pin/hyperlink overlay parity with the current implementation. **Blocked on:** pilot confirming "fix is priority" vs "current is acceptable enough." |
| **P2** | **Communication expansion (General channel + activity stream + @mentions + DMs)** | Sprint 53A shipped per-area threads only (deliberate scope cut). Schema (`field_messages.area_id` nullable) already supports a project-wide General channel. Roadmap with triggers documented in [SPRINT_TRACK_53.md §53A — Communication expansion roadmap](SPRINT_TRACK_53.md). Order of expected value: (1) General channel ~1h S, (2) Activity stream ~3h M, (3) @mentions ~3h M, (4) DMs ~6h L, (5) Read receipts (requires shared-schema migration coordinated with Web). **Blocked on:** Jantile pilot feedback. Build #1 the moment a foreman says "where do I put a project-wide announcement?" |

---

## 🎯 LATEST SPRINTS DETAILED

### Sprint 41G — Surface Checklist 3-State + Area Status Propagation ✅
**Objective:** Add in_progress state to surface checklist, enable blocking with notes, and propagate surface changes to parent area card.

**Changes:**
- [x] SurfaceChecklist: 3-state cycle (not_started → in_progress → completed → not_started)
- [x] Long-press modal: block surface with required notes textbox + error validation
- [x] ProgressCalculation: in_progress = 50% credit, completed = 100%, blocked/not_started = 0%
- [x] deriveAreaStatus(): derives parent area status from surface statuses (any blocked → blocked, all complete → complete, etc.)
- [x] propagateAreaStatus(): after each surface update, writes derived status to production_areas + production store
- [x] Ready Board area card now reflects surface-level changes instantly (no refetch required)
- [x] Optimistic UI: local state updates before server sync via PowerSync

**Files Modified:**
- `src/features/production/components/SurfaceChecklist.tsx` — 3-state logic + block modal + propagation
- `src/features/production/utils/progressCalculation.ts` — statusWeight() now counts in_progress = 0.5
- `src/features/production/store/production-store.ts` — already has recalcFloor() for instant Board updates

**Impact:** Foreman can now mark surfaces in_progress (not fully complete) + block individually. Board card updates instantly without refresh.

---

### Sprint 42A — GC Punch Items Platform (Takeoff Side) ✅
**Objective:** Create gc_punch_items table + Edge Functions to pull from Procore/GC platforms and push resolutions back.

**Takeoff Changes (not Track scope, but context):**
- [x] `gc_punch_items` table: platform, item_number, status, external_photos, resolution_photos, hours_logged, push_pending, etc.
- [x] gc-pull-items Edge Function (cron 15min): fetches punch items from Procore API, upserts to gc_punch_items, syncs external_photos
- [x] gc-push-resolution Edge Function: triggered by push_pending = 1, sends status + resolution_photos + hours back to Procore
- [x] RLS: org-scoped, read by Track via PowerSync

**Result:** Polishers can resolve punch items in Track, changes auto-push to Procore without additional steps.

---

### Sprint 42B — GC Punchlist UI (Track Side) ✅
**Objective:** Build polisher workflow in Track to resolve GC punchlist items, upload resolution photos, log hours.

**Changes:**
1. PowerSync Schema:
   - [x] Added gc_punch_items TableV2 to schema.ts (34 columns, synced org-wide)
   - [x] Exported GcPunchItemRecord type

2. Sync Rules:
   - [x] Added `SELECT * FROM gc_punch_items WHERE organization_id = bucket.organization_id` to sync-rules.yaml

3. Permissions:
   - [x] Added `'gc_punchlist'` feature to TrackFeature type
   - [x] All roles (supervisor, foreman, worker) can access gc_punchlist (worker filtered by assignment)

4. More Tab Menu:
   - [x] "GC Punchlist" added as first item (gated by gc_punchlist feature)

5. Service + Hook:
   - [x] `src/features/gc-punch/services/gc-punch-service.ts`
     - fetchGcPunchItems() — localQuery-first, role-aware filtering
     - updateGcPunchStatus() — sets push_pending = 1 to trigger server push
     - saveGcPunchResolution() — saves hours, notes, photos to gc_punch_items
     - uploadResolutionPhoto() — uploads to Supabase Storage field-photos bucket
   - [x] `src/features/gc-punch/hooks/useGcPunchList.ts`
     - Groups by floor + unit
     - Sorts: in_progress → open → ready_for_review → closed
     - Returns groups + closedItems + counts

6. List Screen:
   - [x] `src/app/(tabs)/more/punchlist/index.tsx`
     - KPI bar: Open / Working / Review / Closed
     - Status filter chips (All, Open, In Progress, Ready for Review)
     - Priority filter chips (Any, High, Critical)
     - Groups grouped by floor/unit with PunchCard
     - Closed items in collapsible section
     - Fields displayed: item #, title, location, due date (color-coded), priority (⚡ or 🔴), status badge, platform badge

7. Detail Screen:
   - [x] `src/app/(tabs)/more/punchlist/[id].tsx`
     - Header: item #, title, location, due date (overdue warning), priority, platform badge
     - Description section: read-only from GC
     - GC Photos: external_photos JSON array displayed as horizontal thumbnails
     - Resolution section (if not closed):
       - Status selector (Open → In Progress → Ready for Review)
       - Hours input: +/- buttons (0.5 increments) + numeric input, auto-save on blur (debounced 800ms)
       - Resolution notes: TextInput, save on blur
       - Resolution photos: camera button + horizontal scroll, tap ✕ to remove, optimistic upload with local URI fallback
     - Action button: "Start Work" | "Mark Ready for Review" | "Reopen"
     - All status changes set push_pending = 1

**Files Created:**
- `src/features/gc-punch/services/gc-punch-service.ts`
- `src/features/gc-punch/hooks/useGcPunchList.ts`
- `src/app/(tabs)/more/punchlist/index.tsx`
- `src/app/(tabs)/more/punchlist/[id].tsx`

**Files Modified:**
- `src/shared/lib/powersync/schema.ts` — added gc_punch_items table definition
- `powersync/sync-rules.yaml` — added gc_punch_items sync rule
- `src/shared/lib/permissions/trackPermissions.ts` — added gc_punchlist feature
- `src/app/(tabs)/more/index.tsx` — added GC Punchlist menu item

**Impact:**
- Polisher opens Track → More tab → GC Punchlist
- Sees all open punch items from Procore, grouped by floor/unit
- Taps item → detail screen shows what needs to be fixed (GC photos) + what was done (resolution section)
- Logs hours + notes + resolution photos
- Marks "Ready for Review"
- Push_pending = 1 triggers gc-push-resolution cron 5min later → Procore gets the update
- Supervisor can verify completion in Procore, marks as closed, closed status syncs back to Track

---

### Sprint 43A — Surface Checklist Real SF Progress + UX Polish ✅
**Date:** 2026-04-09
**Objective:** Make the surface checklist progress bar reflect the actual SF-weighted reality (a 1,280 SF wall must weigh more than a 6 SF saddle), show meaningful surface descriptions instead of "Surface", and fix two latent bugs found along the way.

**Root cause discovered:** The PowerSync schema for `production_area_objects` was declaring a column `quantity_sf` that **does not exist** in the actual Supabase DB. The real column is `total_quantity_sf`. PowerSync silently syncs nothing for undeclared columns and returns null for declared-but-nonexistent ones, so every surface had `quantity_sf = null` and the SF-weighted calc returned 0%. We were chasing a ghost. We also tried JOINing `takeoff_objects.label` for a "material description" — but the real per-surface label (`name` = "floor" / "wall" / "base" / "saddle") already lived directly on `production_area_objects`; we just hadn't declared it in the schema either.

**Bugs fixed:**
1. **Progress 0% on every area** — `production_area_objects.quantity_sf` doesn't exist → declared `total_quantity_sf` instead
2. **Surface name showing as "Surface"** — `name` column wasn't in the PowerSync schema → declared it
3. **Material code badge invisible** — gray text on near-transparent dark background → switched to white badge with dark text + bold
4. **`chk_blocked_has_reason` constraint violation on PATCH** — `propagateAreaStatus` was patching `{ status: 'in_progress' }` without clearing `blocked_reason`. The DB constraint requires `blocked_reason IS NULL` whenever status ≠ 'blocked'. Fix: include `blocked_reason: null` + `blocked_at: null` in the update payload whenever the derived status isn't 'blocked'.

**Changes:**
1. PowerSync Schema (`src/shared/lib/powersync/schema.ts`):
   - [x] `production_area_objects`: removed nonexistent `quantity_sf`; added real columns `name`, `surface_type`, `total_quantity_sf`, `quantity_per_unit_sf`, `unit`
2. Progress Calculation (`src/features/production/utils/progressCalculation.ts`):
   - [x] `SurfaceRow` interface: added `total_quantity_sf` and `takeoff_quantity` fallback fields
   - [x] New `surfaceSf()` helper: prefers `quantity_sf → total_quantity_sf → takeoff_quantity` (in that order)
   - [x] `calculateSurfaceProgress()`: strict SF-weighted, only `completed`/`complete` count (no partial credit for `in_progress`); removed PCS fixed-weight fallback
3. Surface Checklist Component (`src/features/production/components/SurfaceChecklist.tsx`):
   - [x] `SurfaceObject` interface aligned with real DB columns
   - [x] `loadSurfaces()` query simplified — no JOIN needed, all data on one table
   - [x] Surface row label uses `name` (e.g., "wall") instead of fallback "Surface"
   - [x] Material code badge: white background (#F8FAFC) + dark bold text (#0F172A) for high contrast
   - [x] Removed per-row "X SF" display (won't fit on mobile, redundant with progress bar)
   - [x] `propagateAreaStatus()`: clears `blocked_reason` + `blocked_at` whenever derived status ≠ 'blocked' (chk_blocked_has_reason fix)
   - [x] Block modal description uses `material_code + name` instead of nonexistent `label`

**Files Modified:**
- `src/shared/lib/powersync/schema.ts`
- `src/features/production/utils/progressCalculation.ts`
- `src/features/production/components/SurfaceChecklist.tsx`

**Verification with real data (VESTIBULE 02-041):**
- 9 surfaces, 4 completed → 47% (SF-weighted, was 0% before fix)
- saddle (3 SF) ✅, floor CT-04 (104 SF) ✅, waterproofing Hydroban (95 SF) ✅, setting_material Pre-float (95 SF) ✅
- Remaining: base CT-05 (19 SF), wall Schluter (2 SF), waterproofing 6" upturn (22 SF), base Schluter Quadec (3 SF), wall CT-05 (288 SF) — note the 288 SF wall is the largest item, so completing it will jump progress significantly

**Auto-blindaje (preventing recurrence):**
- Added CLAUDE.md note in "Critical: Naming conventions": column is `total_quantity_sf`, `name` = surface position not material description
- Added CLAUDE.md rule: **Always verify column names via `information_schema.columns` before declaring a table in PowerSync schema**
- Added persistent memory (`feedback_powersync_schema_must_match_db.md`) describing the failure mode (silent null columns) so future agents don't repeat the same mistake

**⚠️ Migration note:** PowerSync detects the schema change on next app start and re-syncs `production_area_objects` with the new columns. First load after the update may take a few extra seconds.

---

### Sprint 43B — Track Work Tickets (Foreman Field Use) ✅
**Date:** 2026-04-09
**Depends on:** Takeoff Sprint 43A (work_tickets columns + document_signatures table + public sign page)

**Objective:** Build full T&M Work Ticket workflow in Track. Foreman creates a ticket offline, sends to GC for digital signature via email/share/WhatsApp, and sees status update via PowerSync when GC signs on the public web page.

**Verification (per memory rule):** Queried `information_schema.columns` first to confirm real DB columns. Discovered the spec said `ticket_number` but the actual column is `number` (Sprint 43A added `service_date`, `work_description`, `trade`, `labor`, `materials`, `gc_notes`, `foreman_name`, `area_description`, `priority`, `signature_token` to the existing `work_tickets` table). All `jsonb` columns are stored as `column.text` in PowerSync (SQLite has no JSONB type).

**Workaround for missing deps:** `expo-clipboard` and `@react-native-community/datetimepicker` not installed. Used React Native's built-in `Share.share` (system share sheet includes Copy as an option), and a quick-pick date selector (Today / Yesterday / 2d ago / 3d ago) instead of a native date picker.

**Changes:**

1. **PowerSync Schema** (`src/shared/lib/powersync/schema.ts`)
   - [x] Extended `work_tickets` declaration with Sprint 43A columns: `service_date`, `work_description`, `trade`, `labor` (json text), `materials` (json text), `gc_notes`, `foreman_name`, `area_description`, `priority`, `signature_token`
   - [x] Added `document_signatures` TableV2 with all 21 real columns
   - [x] Exported `DocumentSignatureRecord` type

2. **Sync Rules** (`powersync/sync-rules.yaml`)
   - [x] Added `SELECT * FROM document_signatures WHERE organization_id = bucket.organization_id` (work_tickets already synced)

3. **More Tab Menu** (`src/app/(tabs)/more/index.tsx`)
   - [x] "Work Tickets" entry added after Deliveries, gated by `work_tickets` permission (already in matrix)

4. **Types** (`src/features/work-tickets/types.ts`)
   - [x] `WorkTicket`, `DocumentSignature`, `LaborEntry`, `MaterialEntry`, `WorkTicketStatus`, `DocumentSignatureStatus`
   - [x] Constants: `TRADES`, `LABOR_CLASSES`, `MATERIAL_UNITS`

5. **Service** (`src/features/work-tickets/services/work-tickets-service.ts`)
   - [x] `fetchWorkTickets(projectId)` — local-first list with merged signature info per ticket (latest signature wins)
   - [x] `fetchWorkTicket(id)` / `fetchSignatureForDocument(documentId)`
   - [x] `createWorkTicket()` — generates UUID + signature_token, status='draft', JSON-stringifies labor/materials
   - [x] `updateWorkTicket()` — patch handler with selective field updates
   - [x] `deleteWorkTicket()` — hard delete via localDelete
   - [x] `createSignatureRequest()` — inserts pending row in `document_signatures`, flips ticket to `pending_signature`, returns sign URL `https://notchfield.com/sign/{token}`, sets 30-day expiration
   - [x] `cancelSignatureRequest()` — marks pending sig as `expired`, reverts ticket to draft
   - [x] Helpers: `parseLabor`, `parseMaterials`, `parsePhotos`, `totalHours`, `workerCount`

6. **Hook** (`src/features/work-tickets/hooks/useWorkTickets.ts`)
   - [x] List + tab filtering (draft / pending / signed / all) + counts
   - [x] Returns `tickets` (filtered), `allTickets`, `loading`, `filter`, `setFilter`, `counts`, `reload`

7. **SendForSignatureModal** (`src/components/documents/SendForSignatureModal.tsx`)
   - [x] Reusable for any document type (work tickets now, PTP/JHA later)
   - [x] Inputs: signer name, email, role chips (GC/PM/Inspector/Client)
   - [x] Three delivery methods: Open Email Client (mailto), Copy/Share Link (Share.share — uses native share sheet which includes Copy), Share via WhatsApp (wa.me URL)
   - [x] Email pre-fills subject + body with sign URL
   - [x] Last GC contact remembered per project in AsyncStorage (`gc_contact_{project_id}`)
   - [x] Validates email format before generating sign URL

8. **PDF Generator** (`src/shared/utils/ticketPdf.ts`)
   - [x] `generateTicketHtml({ ticket, signature?, projectName?, companyName?, companyLogo? })` returns self-contained HTML with inline CSS
   - [x] Layout matches professional T&M ticket: header with company / "ORDER FOR ADDITIONAL WORK" / NO + DATE; job info; trade checkboxes (■/□); area; foreman; URGENT badge if priority=urgent; work description box; labor table with reg/OT hrs + total; materials table; GC notes; signature section
   - [x] If signature exists and status=signed: overlays signature image, shows SHA-256 integrity hash with green checkmark
   - [x] If unsigned: shows blank signature lines for printing
   - [x] HTML-escaped, formatted for A4/Letter print
   - [x] Used by detail screen via `expo-print` + `expo-sharing`

9. **Work Tickets List** (`src/app/(tabs)/more/work-tickets/index.tsx`)
   - [x] Tab filters: Drafts / Pending / Signed / All with counts
   - [x] TicketCard: #number badge (white-on-dark per Sprint 43A), description, date + trade, worker count + total hours, "Signed by {name}" if signed, "Waiting for {name}" if pending, ⚡ URGENT badge if priority
   - [x] Status badge (gray/orange/green/red)
   - [x] FAB "+ New Ticket" + headerRight + button
   - [x] Pull-to-refresh
   - [x] `useFocusEffect` reload on focus (catches new/edited tickets)

10. **Create / Edit Form** (`src/app/(tabs)/more/work-tickets/create.tsx`)
    - [x] Same screen handles both new (no `?id=`) and edit (`?id={uuid}`) — only drafts editable
    - [x] Service date with quick-pick chips (Today / Yesterday / 2d ago / 3d ago), defaults to today
    - [x] Trade horizontal chip selector (Tile / Stone / Marble / Flooring / Polisher)
    - [x] Area / Location text input (required)
    - [x] Floor optional input
    - [x] Priority radio (Normal / ⚡ Urgent)
    - [x] Work description multiline (required)
    - [x] Labor section: add/remove rows; per row: name, class chips (Mechanic/Helper/Apprentice/Foreman/Laborer), reg hrs + OT hrs numeric inputs
    - [x] Materials section: add/remove rows; per row: description, qty numeric, unit chips (pcs/box/bag/sf/lf/gal/lbs)
    - [x] GC notes optional multiline
    - [x] Save button (header right + sticky bottom) — strips empty rows, validates required fields, navigates back on success
    - [x] Edit mode pre-fills all fields; blocks edit if status ≠ draft

11. **Detail Screen** (`src/app/(tabs)/more/work-tickets/[id].tsx`)
    - [x] Header card with #number badge, area description, date+trade, status badge, URGENT chip
    - [x] Status-specific banners: pending ("Waiting for {name}"), signed (signer + role + date + signature image + integrity hash), declined (decline reason)
    - [x] Sections: work description, labor (with totals), materials, GC notes, foreman name
    - [x] Sticky action bar at bottom — actions vary by status:
      - **draft**: "Send for Signature" (primary) + Edit + Delete
      - **pending_signature**: Resend + Cancel Request
      - **signed**: PDF (downloads + shares via expo-sharing) + Verify Hash (shows hash details)
      - **declined**: Edit & Resend (reverts to draft + opens edit form)
    - [x] Send for Signature → opens SendForSignatureModal → on submit creates signature request + flips status to pending_signature
    - [x] Auto-reload via `useFocusEffect`

**Files Created:**
- `src/features/work-tickets/types.ts`
- `src/features/work-tickets/services/work-tickets-service.ts`
- `src/features/work-tickets/hooks/useWorkTickets.ts`
- `src/components/documents/SendForSignatureModal.tsx`
- `src/shared/utils/ticketPdf.ts`
- `src/app/(tabs)/more/work-tickets/index.tsx`
- `src/app/(tabs)/more/work-tickets/create.tsx`
- `src/app/(tabs)/more/work-tickets/[id].tsx`

**Files Modified:**
- `src/shared/lib/powersync/schema.ts` — extended work_tickets, added document_signatures
- `powersync/sync-rules.yaml` — added document_signatures sync rule
- `src/app/(tabs)/more/index.tsx` — added Work Tickets menu entry

**Permissions:** `work_tickets` already in feature matrix (supervisor: true, foreman: true, worker: false). No changes needed.

**Flow:**
1. Foreman opens Track → More → Work Tickets → +
2. Fills date / trade / area / description / labor / materials → Save
3. Tap ticket → Send for Signature → enters GC name + email → Open Email Client (or Copy/WhatsApp)
4. Signature row created in `document_signatures` (status=pending), ticket flips to pending_signature, push_pending via PowerSync upload
5. GC opens email → clicks `https://notchfield.com/sign/{token}` → signs on public page (Takeoff web side)
6. Server updates `document_signatures.status = 'signed'` + `signed_at` + `signature_url` + `content_hash`, AND updates `work_tickets.status = 'signed'`
7. PowerSync syncs back to Track → foreman sees status change to "Signed" with signer name + signature image + integrity hash
8. Foreman taps PDF → expo-print generates PDF with signature overlay → expo-sharing opens share sheet

**Offline-first:** All ticket creates / edits / signature requests go through PowerSync local SQLite first. Foreman can build tickets without internet — they sync (and the GC email link becomes valid) when connection returns. The mailto link itself works offline (opens in default email client which queues until online).

**TypeScript:** `npx tsc --noEmit` passes clean.

---

### Sprint 45B — Work Tickets REWRITE (Align with Takeoff Web + In-App Signing) ✅
**Date:** 2026-04-10
**Depends on:** Takeoff Sprint 43A (work_tickets columns + document_signatures + public sign page + signatures storage bucket)
**Supersedes:** Sprint 43B (major refactor — different field names, different architecture)

**Objective:** Rewrite the entire Work Tickets system to mirror Takeoff Web exactly. Sprint 43B used wrong field names (`class`/`reg_hrs`/`ot_hrs`/`qty`) and wrong status enums, so tickets created in Track would not interop with Takeoff Web's PDF renderer, Block Analysis, or sign page. Sprint 45B fixes this by mirroring Takeoff Web's `src/shared/types/documents.ts` exactly. It also adds in-app signing (foreman hands phone to GC) and realtime subscriptions.

**Critical rules enforced (from Jantile Tracker / FIXES_WORK_TICKET_SIGNATURES.md):**
1. **NEVER use PowerSync for `document_signatures` or signature uploads.** PowerSync sync delay breaks signing flows. All signature ops go through direct Supabase client. Work ticket CRUD also switched to direct Supabase (bonus: the `number` SERIAL trigger returns the assigned number immediately instead of waiting for sync).
2. **Storage path convention:** `signatures/{organization_id}/{token}.png` — must match Takeoff Web or cross-app signature loading breaks.
3. **Signature upload MUST check error response.** The bug in FIXES_WORK_TICKET_SIGNATURES.md was silent upload failures. `signTicketInApp` throws with a clear message if `storage.upload()` returns an error.
4. **PDF signature embed via `<img src>` tag**, not fetch+base64. The `signatures` bucket is public with `Access-Control-Allow-Origin: *`, so the `expo-print` HTML renderer loads the image directly.
5. **Types match Takeoff Web exactly.** `classification` (not `class`), `regular_hours` (not `reg_hrs`), `overtime_hours` (not `ot_hrs`), `quantity` (not `qty`). Status enum `'pending'` not `'pending_signature'`. `signer_role` lowercase (`gc`/`supervisor`/`foreman`/`pm`/`worker`).
6. **Number is SERIAL** — trigger `trg_work_ticket_number` on `work_tickets` assigns it on INSERT. Don't compute in app, just INSERT and read back.

**Changes:**

1. **Types + Zod schemas** (`src/features/work-tickets/types.ts`) — FULL REWRITE
   - [x] Zod schemas: `LaborEntrySchema`, `MaterialEntrySchema`, `WorkTicketSchema`, `DocumentSignatureSchema`, `SignerRoleSchema`, `WorkTicketStatusSchema`
   - [x] Field names mirror Takeoff Web: `classification`, `regular_hours`, `overtime_hours`, `quantity`
   - [x] Status enum: `'draft' | 'pending' | 'signed' | 'declined'`
   - [x] `SignerRole`: `'gc' | 'supervisor' | 'foreman' | 'pm' | 'worker'`
   - [x] Inferred types exported: `LaborEntry`, `MaterialEntry`, `WorkTicket`, `WorkTicketDraft`, `DocumentSignature`
   - [x] Helpers: `totalHours`, `workerCount`, `TRADES`, `LABOR_CLASSIFICATIONS`, `MATERIAL_UNITS`

2. **Service** (`src/features/work-tickets/services/work-tickets-service.ts`) — FULL REWRITE
   - [x] All methods use direct Supabase client (NO PowerSync)
   - [x] `listWorkTickets(projectId)` — single query + separate signatures query, merged in-memory (latest sig per ticket)
   - [x] `getWorkTicket(id)`, `getSignatureForTicket(ticketId)`
   - [x] `createWorkTicket(input)` — returns `WorkTicket` with `number` populated by the trigger
   - [x] `updateWorkTicket(id, patch)`, `deleteWorkTicketDraft(id)` (safety: only drafts)
   - [x] `createSignatureRequest({ ticketId, signer_role })` — inserts pending row + flips ticket to 'pending'
   - [x] `cancelSignatureRequest(ticketId)` — marks pending sig as declined + reverts to draft
   - [x] **`signTicketInApp({ signatureId, token, organizationId, signerName, signerTitle, signatureDataUrl, gcNotes })`** — decodes base64, uploads to `signatures/{org}/{token}.png`, computes SHA-256 via `expo-crypto`, updates `document_signatures` + parent `work_tickets`, throws on any error
   - [x] `getSigningUrl(token)` — returns `https://notchfield.com/sign/{token}`
   - [x] Helpers: `ensureLabor`, `ensureMaterials`, `base64ToBytes` (with atob fallback)

3. **PDF Generator** (`src/features/work-tickets/services/workTicketPdf.ts`) — NEW
   - [x] `generateWorkTicketPdf(ticket, signature, projectName, company)` → local file URI via `expo-print`
   - [x] `shareWorkTicketPdf(uri, dialogTitle?)` → `expo-sharing`
   - [x] HTML template matches Takeoff Web's `workTicketPdfRenderer.ts` layout: header logo + "ORDER FOR ADDITIONAL WORK" + T&M #, meta grid (project/service date/trade/priority/location/foreman), work description, labor table with reg/OT/total hrs + total, materials table, GC notes, signature section with `<img src crossorigin>` + SHA-256 hash, footer
   - [x] Blank signature lines for unsigned tickets (printable)

4. **List hook** (`src/features/work-tickets/hooks/useWorkTickets.ts`) — REWRITE
   - [x] Uses `listWorkTickets` from service (direct Supabase)
   - [x] Tab filter (all/draft/pending/signed) + search by number/description/area/trade
   - [x] **Realtime subscription** via Supabase channels — listens on `work_tickets` AND `document_signatures` filtered by `project_id=eq.{projectId}`, reloads on any change
   - [x] Unsubscribes on unmount (no leaks)

5. **Single-ticket hook** (`src/features/work-tickets/hooks/useWorkTicket.ts`) — NEW
   - [x] Returns `{ ticket, signature, loading, reload }`
   - [x] Parallel fetches of ticket + signature
   - [x] **Realtime subscription** filtered by `id=eq.{ticketId}` (ticket) + `document_id=eq.{ticketId}` (signature)
   - [x] Cross-app reactive: GC signs on web → Track detail screen auto-updates

6. **Create / Edit form** (`src/app/(tabs)/more/work-tickets/create.tsx`) — REWRITE
   - [x] All field names updated to `classification`/`regular_hours`/`overtime_hours`/`quantity`
   - [x] Labor class chips: Mechanic/Helper/Apprentice/Foreman (4 values matching Takeoff)
   - [x] Material units: pcs/box/bag/sqft/lf/gal/lbs
   - [x] Direct Supabase create/update (waits for `number` from trigger)
   - [x] Edit mode via `?id=xxx` query param (drafts only)
   - [x] Quick-pick date chips (Today/Yesterday/2d ago/3d ago)

7. **List screen** (`src/app/(tabs)/more/work-tickets/index.tsx`) — REWRITE
   - [x] Search input + tab filter chips (All/Drafts/Pending/Signed)
   - [x] Card shows #number badge (white-on-dark), work_description, service_date + trade, floor + area_description, worker count + hours, ⚡ URGENT badge, signer name if signed, "Waiting for..." if pending
   - [x] Status colors gray/amber/green/red
   - [x] ProjectSwitcher inline in empty state
   - [x] FAB hidden when no project; realtime list updates cross-app

8. **Detail screen** (`src/app/(tabs)/more/work-tickets/[id].tsx`) — REWRITE
   - [x] Uses `useWorkTicket` (realtime)
   - [x] Header card with status badge + URGENT chip
   - [x] Pending banner shows "Waiting for {signer_name}" and email if set
   - [x] Signed banner: signer name + role + date + signature image (`<Image>`) + SHA-256 hash box
   - [x] Read-only sections: work description, labor (with regular_hours/overtime_hours display), materials (quantity/unit), GC notes, foreman
   - [x] **Sticky action bar with status-specific buttons:**
     - **draft**: Sign Now (opens signature pad screen) + Send Link (creates pending sig + native Share sheet) + Edit + Delete
     - **pending**: Sign Now + Resend Link + Cancel Request
     - **signed**: PDF (generate + share via expo-sharing) + Verify Hash (shows SHA-256 details)
     - **declined**: Edit & Resend (reverts to draft + opens create form)
   - [x] Removed SendForSignatureModal — no longer needed

9. **SignaturePadScreen** (`src/app/(tabs)/more/work-tickets/sign/[id].tsx`) — NEW
   - [x] Dedicated route for in-app signing (foreman hands device to GC)
   - [x] Amber banner: "Hand phone to GC"
   - [x] Ticket summary (read-only)
   - [x] Signer name input (required) + title (optional)
   - [x] GC notes for foreman (optional multiline)
   - [x] Reuses existing `src/features/safety/components/SignaturePad.tsx` component
   - [x] On Submit:
     - Validates name + signature present
     - Calls `signTicketInApp` (uploads PNG → updates DB)
     - Shows success alert → navigates back
     - Catches network errors with clear offline message
   - [x] Requires online (signature upload cannot be deferred)

10. **Removed old files:**
    - [x] `src/shared/utils/ticketPdf.ts` — replaced by `features/work-tickets/services/workTicketPdf.ts`
    - [x] `src/components/documents/SendForSignatureModal.tsx` — replaced by direct Share.share + in-app sign flow
    - [x] `src/components/documents/` directory removed (empty)

**Files Created:**
- `src/features/work-tickets/hooks/useWorkTicket.ts`
- `src/features/work-tickets/services/workTicketPdf.ts`
- `src/app/(tabs)/more/work-tickets/sign/[id].tsx`

**Files Rewritten:**
- `src/features/work-tickets/types.ts`
- `src/features/work-tickets/services/work-tickets-service.ts`
- `src/features/work-tickets/hooks/useWorkTickets.ts`
- `src/app/(tabs)/more/work-tickets/create.tsx`
- `src/app/(tabs)/more/work-tickets/index.tsx`
- `src/app/(tabs)/more/work-tickets/[id].tsx`

**Files Deleted:**
- `src/shared/utils/ticketPdf.ts`
- `src/components/documents/SendForSignatureModal.tsx`

**Schema changes:** NONE. Takeoff already created the schema in Sprint 43A. PowerSync schema for `work_tickets` + `document_signatures` stays as declared (still synced for read-only offline viewing of existing tickets in case user is offline in the list screen), but all writes now go direct Supabase.

**Flow (end-to-end):**

**Track → Web (cross-app realtime):**
1. Foreman opens Track → More → Work Tickets → +
2. Fills form → Save → direct Supabase INSERT → `number` returned immediately from trigger
3. Tap ticket → status=draft → Sign Now or Send Link

**Sign Now (in-app):**
1. Creates pending signature row (status=pending, token generated by DB default)
2. Navigates to `sign/[id]?sigId=xxx&token=yyy`
3. Foreman hands phone to GC
4. GC signs with finger on `SignaturePad` component
5. GC taps Confirm (locks in signature) → GC taps Submit
6. `signTicketInApp`:
   - Base64 → bytes via atob
   - Upload to `signatures/{org_id}/{token}.png`
   - SHA-256 hash of `{signatureId, signerName, signerTitle, signedAt}`
   - Update `document_signatures` → status=signed + signature_url + content_hash + hash_algorithm + hashed_at
   - Update `work_tickets` → status=signed + gc_notes (if provided)
7. Navigate back to detail → realtime subscription fires → UI updates with signature image + hash

**Send Link (remote GC):**
1. Creates pending signature row
2. Gets sign URL via `getSigningUrl(token)` → `https://notchfield.com/sign/{token}`
3. Opens native `Share.share` sheet (iOS/Android) with message + URL
4. Foreman sends to GC via iMessage/WhatsApp/email
5. GC opens link in browser → signs on public web page (Takeoff Web side)
6. Server updates DB → PowerSync/Realtime channel fires → Track detail screen auto-refreshes → shows signed status

**Web → Track (reverse cross-app):**
1. PM creates ticket in Takeoff Web
2. Track realtime subscription on `work_tickets` fires → list auto-refreshes
3. Ticket visible in Track instantly

**Dependencies used:** expo-print, expo-sharing, expo-crypto, react-native-signature-canvas, zod, @supabase/supabase-js (all already installed).

**TypeScript:** `npx tsc --noEmit` passes clean.

**Testing checklist:**
- [ ] Create ticket in Track → appears in Takeoff Web PM dashboard with correct number + labor (using `classification`/`regular_hours`)
- [ ] In-app sign → signature PNG visible at `signatures/{org}/{token}.png` in Supabase Storage
- [ ] Signed ticket in Track shows signature image + SHA-256 hash
- [ ] PDF from Track opens in native share sheet with signature embedded
- [ ] Track offline + try Sign Now → clear offline error
- [ ] Web signs link → Track detail auto-refreshes (realtime)
- [ ] Ticket created in Web → Track list shows it (realtime)

---

### Sprint 45B-F — Track Feedback Reporting ✅
**Date:** 2026-04-10
**Depends on:** Takeoff Sprint 45A (feedback_reports table + feedback-screenshots bucket)

**Objective:** Let any user (foreman / supervisor / worker) report bugs, request features, or leave feedback directly from the field app. Context (route, device, screen size, role, project) is auto-captured so the admin doesn't need to ask "where / on what device?".

**Verification (memory rule):** Queried `information_schema.columns` first. Real columns match the spec with a few extras (`admin_notes`, `resolved_at`, `resolved_by`). Also confirmed the `feedback-screenshots` bucket exists and is PRIVATE — so screenshots must be served via `createSignedUrl`, not public URLs.

**Changes:**

1. **PowerSync Schema** (`src/shared/lib/powersync/schema.ts`)
   - [x] Added `feedback_reports` TableV2 with all 20 real columns (including `admin_notes`, `resolved_at`, `resolved_by` not in the original spec)
   - [x] `screenshots` stored as `column.text` (JSONB → text in SQLite)
   - [x] Exported `FeedbackReportRecord` type

2. **Sync Rules** (`powersync/sync-rules.yaml`)
   - [x] Added `SELECT * FROM feedback_reports WHERE organization_id = bucket.organization_id`

3. **Service** (`src/features/feedback/services/feedback-service.ts`)
   - [x] `fetchMyReports(userId)` — local-first, falls back to Supabase REST
   - [x] `createFeedbackReport(input)` — PowerSync localInsert (offline-first text writes)
   - [x] `uploadFeedbackScreenshot({ localUri, organizationId, reportId, index })` — direct Supabase storage, returns the storage path (not URL, bucket is private)
   - [x] `getScreenshotSignedUrl(path)` — 1h signed URL for display
   - [x] `parseScreenshots(json)` helper
   - [x] Types: `FeedbackType`, `FeedbackSeverity`, `FeedbackStatus`, `FeedbackReport`

4. **FeedbackModal Component** (`src/shared/components/FeedbackModal.tsx`)
   - [x] Slide-up sheet modal, field-first design
   - [x] **Type selector**: Bug 🐛 / Feature 💡 / Feedback 💬 — large toggle buttons with icon + color
   - [x] **Severity chips** (only when type=bug): Low / Medium / High / Critical — color-coded
   - [x] Title TextInput (required)
   - [x] Description multiline TextInput (required) with smart placeholder per type
   - [x] **Screenshots** (0–3): Take Photo + Gallery buttons; thumbnails with ✕ to remove
   - [x] **Auto-captured context card** (muted): page name from `usePathname`, device = `Platform.OS Platform.Version`, screen size from `Dimensions`, role from `useTrackPermissions`, active project
   - [x] Submit flow:
     - Create report via PowerSync (works offline)
     - Upload screenshots to `feedback-screenshots/{org}/{reportId}/{idx}_{timestamp}.{ext}`
     - Patch row with uploaded paths via direct Supabase
     - Show success alert; on upload failures, note "will retry when online"
     - Reset + close modal
   - [x] Keyboard-avoiding view for text inputs
   - [x] Expo-device NOT required — uses `Platform.OS` + `Platform.Version` (no new dep)

5. **My Reports Screen** (`src/app/(tabs)/more/my-reports/index.tsx`)
   - [x] Query: `fetchMyReports(userId)` → reports where `reported_by = currentUserId`
   - [x] Report card: type icon + label, severity (bugs only), title, time ago, page name, screenshot count, status badge (color-coded)
   - [x] Admin response shown in highlighted box when present
   - [x] Empty state with CTA "Report an Issue" button → opens FeedbackModal
   - [x] FAB "New Report" → opens FeedbackModal
   - [x] `useFocusEffect` reload + pull-to-refresh
   - [x] Embedded FeedbackModal (on close → reload to show new report)
   - [x] `timeAgo()` helper for "2h ago" / "3d ago" / dates

6. **More Menu entries** (`src/app/(tabs)/more/index.tsx`)
   - [x] "Report Issue" 🐛 (bug icon, orange) → opens FeedbackModal directly (no route)
   - [x] "My Reports" 📋 (clipboard icon, purple) → navigates to `/(tabs)/more/my-reports`
   - [x] Both visible to ALL roles (no permission gating — feedback is universal)
   - [x] Wrapped return in fragment to render FeedbackModal alongside ScrollView

**Files Created:**
- `src/features/feedback/services/feedback-service.ts`
- `src/shared/components/FeedbackModal.tsx`
- `src/app/(tabs)/more/my-reports/index.tsx`

**Files Modified:**
- `src/shared/lib/powersync/schema.ts`
- `powersync/sync-rules.yaml`
- `src/app/(tabs)/more/index.tsx`
- `CLAUDE.md`
- `TASKS_TRACK.md`

**Offline behavior:**
- Text fields (type, severity, title, description, context) save via PowerSync → works fully offline, syncs when online
- Screenshot uploads require internet → if offline, the text report is saved without them and the user is notified via the success alert
- Existing reports load from local SQLite → My Reports screen works offline

**Permissions:** Universal feature — no gating. All roles see "Report Issue" and "My Reports" in the More menu.

**TypeScript:** `npx tsc --noEmit` passes clean.

**⚠️ Deploy note:** PowerSync sync rules must be deployed to the PowerSync instance (dashboard or CLI) before the client can sync `feedback_reports`. Until then, local inserts succeed but rows stay queued.

---

### Sprint PTP — Track Foreman PTP Flow ✅
**Date:** 2026-04-15
**Depends on:** Takeoff Safety Sprint A (jha_library seeded + projects.emergency_* + profiles.sst_* + safety_documents content JSONB schema + /api/pm/safety-documents/[id]/distribute endpoint)

**Objective:** Foreman creates, signs, and distributes a Pre-Task Plan from Track in under 3 minutes, offline-first. Data writes to the same Supabase rows Takeoff Web already reads from — zero sync layer. Replaces the legacy manual PTP form (`SafetyForm.tsx` branch) with a JHA-library driven wizard.

**Architecture rules enforced:**
1. **No new tables.** PTPs live on existing `safety_documents` with `doc_type='ptp'` and rich JSONB `content` + `signatures`. Both Track and Takeoff Web read/write the same rows.
2. **Task snapshots, not FKs.** When a foreman selects a JHA library task, the hazards/controls/ppe are DEEP COPIED into `content.selected_tasks`. The PTP stays immutable if the library evolves later.
3. **SST/emergency snapshots at write time.** `content.emergency` freezes the project's emergency info the moment the draft is created; `signature.sst_card_number` freezes the worker's SST the moment they tap Sign.
4. **Server-side PDF generation.** Track does NOT render PDFs — distribution calls Takeoff's existing `/api/pm/safety-documents/[docId]/distribute` endpoint. One code path, one SHA-256 integrity hash, one audit log entry per distribute, zero drift.
5. **Offline queue for distribute.** If the endpoint call fails (offline), `{ docId, labels, recipients }` is persisted to AsyncStorage. A background flusher retries every 60 s + on app foreground. The doc stays `status='draft'` until the server confirms.

**Changes:**

1. **PowerSync Schema** (`src/shared/lib/powersync/schema.ts`)
   - [x] Added `jha_library` TableV2 — read-only, 16 cols (including `hazards` + `controls` + `ppe_required` as JSON text)
   - [x] Extended `projects`: `emergency_hospital_name`, `emergency_hospital_address`, `emergency_hospital_distance`, `emergency_assembly_point`, `emergency_first_aid_location`, `emergency_contact_name`, `emergency_contact_phone`, `safety_distribution_emails` (text[] → JSON text)
   - [x] Extended `profiles` with `sst_card_number` + `sst_expires_at` (LATER moved to workers by Sprint MANPOWER)
   - [x] Extended `organizations` with `primary_trades` (text[] → JSON text)

2. **Sync Rules** (`powersync/sync-rules.yaml`)
   - [x] Added `SELECT * FROM jha_library WHERE organization_id = bucket.organization_id AND active = true`

3. **Types** (`src/features/safety/ptp/types/index.ts`)
   - [x] `Trade` enum (10 values matching seeded jha_library)
   - [x] `JhaLibraryItem`, `JhaHazardItem`, `JhaControlItem`
   - [x] `PtpSelectedTask` (snapshot of a JHA task)
   - [x] `PtpAdditionalHazard`, `PtpEmergencySnapshot`, `PtpWeather`, `PtpGps`
   - [x] `PtpContentSchema` — ptp_date, shift, trade, selected_tasks[], additional_hazards[], emergency, foreman_id, foreman_name, foreman_gps, additional_notes, photo_urls, osha_citations_included
   - [x] `PtpSignatureSchema` — worker_id, worker_name, sst_card_number, signature_data_url, signed_at, is_foreman, is_walk_in, gps
   - [x] `PtpPdfLabels` — display strings passed to `/distribute`
   - [x] `SafetyDocument` envelope Zod

4. **Services** (`src/features/safety/ptp/services/`)
   - [x] `jhaLibraryService.ts` — `getJhaLibraryForTrade(orgId, projectId, trade)`, `getAvailableTradesForOrg(orgId)` (fallback when `profiles.trade` is missing; returns distinct trades present in `jha_library` for this org). Offline-first via `localQuery`.
   - [x] `ptpService.ts` — `createDraftPtp()`, `getPtpById()`, `getYesterdaysPtp(foremanId, areaId, days=2)` (pulls most recent PTP for same foreman + same area within 2 days), `updatePtpContent()`, `appendSignature()` (read-modify-write on JSONB array with race note), `removeSignature()`, `setPtpStatus()`
   - [x] `consolidate.ts` — dedupes hazards/controls/PPE across selected tasks preserving first-seen order, matching Takeoff's `ptpPdfRenderer.ts` consolidate logic
   - [x] `buildPtpLabels.ts` — PDF label strings (title, project_name, foreman_label, date_label, shift_label, trade_label, weather_label, osha_citations_included). English only; will move to i18n namespace later.
   - [x] `distributeService.ts` — `distributePtp(docId, labels, recipients)` POSTs to `${EXPO_PUBLIC_WEB_API_URL}/api/pm/safety-documents/[id]/distribute` with session access token; on failure enqueues `{ queue_id, doc_id, labels, recipients, attempts, last_error, created_at }` to AsyncStorage under `notchfield:ptp:distribute_queue:v1`. `flushDistributionQueue()` drains the queue and retries. `getPendingDistributions()` for debug.

5. **Hooks** (`src/features/safety/ptp/hooks/`)
   - [x] `useJhaLibrary(orgId, projectId, trade)` — loads + refreshes library for a trade
   - [x] `usePtp(docId)` — loads + mutates a single PTP with optimistic local state
   - [x] `useTodaysPtp(foremanId, projectId)` — finds today's PTP for this foreman on this project via date match on `content.ptp_date`. Refreshes on `useFocusEffect`. Used by MorningPtpCard.
   - [x] `usePtpDistributionFlusher(intervalMs=60_000)` — retries queued distributes every 60 s + on `AppState` → `active`. Mounted once on the docs layout.

6. **Components** (`src/features/safety/ptp/components/`)
   - [x] `PtpTaskPicker` — JHA library list with search + category filter chips. Tap to select. Hazard preview under each task. On continue, deep-copies each selected task into `content.selected_tasks`.
   - [x] `PtpReview` — consolidates hazards/controls/PPE from selected tasks. Removable hazards with friction-y "Most foremen leave all hazards in" confirm (intentional for safety).
   - [x] `PtpSignatures` — foreman row (GPS captured on sign) + crew rows + walk-in modal. Uses existing `SignaturePad` component (onBegin/onEnd pattern from 45B-FIX).
   - [x] `PtpDistribute` — multi-recipient picker pre-populated from `projects.safety_distribution_emails`, add ad-hoc recipients, OSHA citations toggle, Send button.

7. **Entry + Wizard routes** (`src/app/(tabs)/docs/safety/ptp/`)
   - [x] `new.tsx` — gathers foreman context (project, area from crew_assignments, trade fallback via `getAvailableTradesForOrg`, emergency info from project row), creates the draft, redirects to `[id]`. Copy-from-yesterday chip pre-fills selected_tasks + additional_hazards + osha toggle from the prior PTP.
   - [x] `[id].tsx` — multi-step wizard with internal state (`tasks` → `review` → `signatures` → `distribute`). Each step persists to the shared DB row via `saveContent` / `addSignature` / `setPtpStatus`. Step indicator at top. Back button routes back through the step stack. Resuming a draft lands the user on the right step based on `content.selected_tasks.length` and `doc.signatures.length`.

8. **Entry rewire** (`src/app/(tabs)/docs/_layout.tsx` + `src/app/(tabs)/docs/index.tsx`)
   - [x] FAB "PTP" button rerouted to the new wizard (was `/docs/safety/new?type=ptp` → legacy `SafetyForm`)
   - [x] Tapping a PTP in the Docs list resumes the wizard when `status=draft`; otherwise opens the read-only detail view
   - [x] `usePtpDistributionFlusher()` mounted on the docs layout

**Files Created:**
- `src/features/safety/ptp/types/index.ts`
- `src/features/safety/ptp/services/jhaLibraryService.ts`
- `src/features/safety/ptp/services/ptpService.ts`
- `src/features/safety/ptp/services/consolidate.ts`
- `src/features/safety/ptp/services/buildPtpLabels.ts`
- `src/features/safety/ptp/services/distributeService.ts`
- `src/features/safety/ptp/hooks/useJhaLibrary.ts`
- `src/features/safety/ptp/hooks/usePtp.ts`
- `src/features/safety/ptp/hooks/usePtpDistributionFlusher.ts`
- `src/features/safety/ptp/components/PtpTaskPicker.tsx`
- `src/features/safety/ptp/components/PtpReview.tsx`
- `src/features/safety/ptp/components/PtpSignatures.tsx`
- `src/features/safety/ptp/components/PtpDistribute.tsx`
- `src/app/(tabs)/docs/safety/ptp/new.tsx`
- `src/app/(tabs)/docs/safety/ptp/[id].tsx`

**Files Modified:**
- `src/shared/lib/powersync/schema.ts` — jha_library + new columns
- `powersync/sync-rules.yaml` — jha_library sync rule
- `src/app/(tabs)/docs/index.tsx` — FAB reroute + list routing for drafts
- `src/app/(tabs)/docs/_layout.tsx` — flusher hook

**TypeScript:** `npx tsc --noEmit` passes clean.

**Flow (end-to-end):**
1. Foreman opens Home → taps Morning PTP card (or More → Safety tab → FAB → PTP)
2. `new.tsx` auto-fills project/foreman/area/trade; foreman taps Start fresh or Copy from yesterday
3. Draft `safety_documents` row created via PowerSync localInsert (offline-safe)
4. Wizard step 1: taps 2-3 tasks from trade-filtered JHA library; Continue deep-copies snapshots into `content.selected_tasks`
5. Wizard step 2: review consolidated hazards/controls/PPE; optional removals with confirm
6. Wizard step 3: foreman signs first (GPS captured); passes device to each crew member; walk-in modal for un-rostered workers
7. Wizard step 4: select recipients from project defaults + ad-hoc; toggle OSHA citations; tap Send & Submit
8. `distributePtp()` POSTs to Takeoff `/distribute` endpoint with bearer token → server generates PDF, computes SHA-256, sends Resend email to each recipient, writes audit log
9. On success → `setPtpStatus('distributed')` → UI navigates home with success toast
10. On offline → request queued to AsyncStorage; foreman sees "Queued — will send when back online"; flusher retries every 60 s

**PowerSync migration note:** The schema change adds columns to `profiles` / `organizations` / `projects` + introduces `jha_library`. PowerSync detects on next app start and re-syncs these tables. First load after the update may take a few extra seconds.

---

### Sprint PTP-UX — Morning Card + Safety Tab + Legacy Cleanup ✅
**Date:** 2026-04-16
**Depends on:** Sprint PTP

**Objective:** Surface PTP as a daily ritual (not a buried admin task), eliminate dead PTP code from the legacy `SafetyForm`, and upgrade the safety detail viewer to render new-shape PTPs cleanly.

**Changes:**

1. **Morning PTP card on Home** (`src/features/safety/ptp/components/MorningPtpCard.tsx`)
   - [x] `useTodaysPtp` hook finds today's PTP for this foreman on this project (date match on `content.ptp_date`, refreshes on `useFocusEffect`)
   - [x] Three visual states on the same card:
     - **No PTP today** → orange CTA "New Pre-Task Plan · Start your morning huddle", opens `/docs/safety/ptp/new`
     - **Draft in progress** → amber "Resume today's PTP · N signatures captured", opens `/ptp/[id]`
     - **Distributed** → green "PTP distributed · HH:MM · N signatures", opens the read-only detail view
   - [x] Mounted right after Quick Actions on `/app/(tabs)/home/index.tsx` so the foreman sees the status the moment the app opens

2. **Docs tab surfaced as "Safety"** (`src/app/(tabs)/_layout.tsx`)
   - [x] The `docs` route was hidden via `tabBarButton: () => null`, burying PTP 4 taps deep (More → Docs → FAB → PTP)
   - [x] Unhidden with a shield-checkmark icon and positioned between Tickets and Delivery per foreman feedback
   - [x] Still 6 tabs visible on the bar — no squeeze on iPhone SE
   - [x] Net: PTP is 1 tap from Home (card) OR 2 taps via bottom tab (Safety → FAB → PTP)

3. **Legacy PTP cleanup**
   - [x] `src/features/safety/types/schemas.ts`: dropped `PtpTask` and legacy `PtpContent`. `SafetyDocFormData.content` union is now `JhaContent | ToolboxContent`. `DocType` enum unchanged (DB still uses `'ptp'` and historical rows exist).
   - [x] `src/features/safety/components/SafetyForm.tsx`: removed `crewMembers` + `tasks` state, the `docType === 'ptp'` branch in `handleSave`, the PTP JSX block, and the `updateTask` helper. `Props.docType` narrowed to `Exclude<DocType, 'ptp'>` so the form refuses PTP at the type level.
   - [x] `src/app/(tabs)/docs/safety/new.tsx`: deep links with `?type=ptp` now redirect (`<Redirect>` + `useEffect`) to `/docs/safety/ptp/new` so old shortcuts keep working.

4. **Safety detail view upgrade** (`src/app/(tabs)/docs/safety/[id].tsx`)
   - [x] Split PTP render into a `PtpDetailBody` component that auto-detects the shape via `Array.isArray(content.selected_tasks)`:
     - **New shape** (post-wizard): renders date/shift/trade/area/foreman + per-task hazards/controls/PPE chips + emergency snapshot (hospital, assembly point, first aid, contact) + additional_notes
     - **Legacy shape**: keeps the old render for any historical rows still in the DB
   - [x] Signatures list normalizes `signer_name` vs `worker_name` and `signature_data` vs `signature_data_url` so legacy and new PTPs render through the same view
   - [x] Added FOREMAN / WALK-IN role chips + SST card number when present

**Files Created:**
- `src/features/safety/ptp/components/MorningPtpCard.tsx`
- `src/features/safety/ptp/hooks/useTodaysPtp.ts`

**Files Modified:**
- `src/app/(tabs)/_layout.tsx` — unhide docs tab, rename to Safety
- `src/app/(tabs)/home/index.tsx` — mount MorningPtpCard
- `src/app/(tabs)/docs/safety/new.tsx` — PTP redirect
- `src/app/(tabs)/docs/safety/[id].tsx` — PtpDetailBody + signature normalization
- `src/features/safety/components/SafetyForm.tsx` — strip PTP branch
- `src/features/safety/types/schemas.ts` — drop PtpContent/PtpTask, simplify union

**Dead code removed:** ~60 lines from `SafetyForm.tsx` + two Zod schemas + one helper.

**TypeScript:** `npx tsc --noEmit` passes clean.

---

### Sprint MANPOWER — Profiles → Workers Migration ✅
**Date:** 2026-04-17
**Depends on:** Takeoff Sprint CREW (workers + project_workers tables + worker-photos storage bucket + DROP profiles.sst_card_number + DROP profiles.sst_expires_at at commit `5842411`)
**Supersedes:** The `profiles.sst_*` extension introduced by Sprint PTP

**Objective:** Migrate Track from the old profiles-based crew model to the new `workers` table. The Takeoff commit DROPPED `profiles.sst_card_number` + `profiles.sst_expires_at` — Track's PtpSignatures was reading them live via direct Supabase + PowerSync localQuery, so production was broken on any fresh deploy. This sprint also integrates the two-tier mental model (profiles = software users, workers = field HR) into the PTP flow and every crew-display surface.

**Hotfix (the production-breaker):**
Two SELECTs in `PtpSignatures.tsx` were explicitly naming `sst_card_number` against `profiles`. Supabase returned `HTTP 400 "column profiles.sst_card_number does not exist"` — PTP sign-off crashed. Fixed by rewiring to `project_workers` JOIN `workers`. The `profiles.sst_*` declarations in the Track PowerSync schema were also removed (they were silently syncing as NULL per the documented PowerSync-column-missing failure mode).

**The two-tier mental model (now reflected in code):**
```
┌──────────────────────────────────┬─────────────────────────────────┐
│  profiles (software users)       │  workers (field crew HR)        │
├──────────────────────────────────┼─────────────────────────────────┤
│  Has auth.users + login           │  No login                       │
│  Role, locale, notifications      │  Trade, level, rate, certs, ICE │
│  PM, Admin, Supervisor, Estimator │  Mechanic, Helper, Apprentice   │
│                                  │  + Foremen (linked via           │
│                                  │    workers.profile_id)          │
└──────────────────────────────────┴─────────────────────────────────┘
```
Walk-in workers have `profile_id = NULL` (no login).

**Changes:**

1. **PowerSync Schema** (`src/shared/lib/powersync/schema.ts`)
   - [x] Removed `sst_card_number` + `sst_expires_at` from `profiles` TableV2
   - [x] Added `workers` TableV2 — 34 cols: identity (first_name, last_name, phone, email, DOB, photo_url, hire_date, active), trade (trade, trade_level, years_experience, daily_rate_cents), certs (SST, OSHA-10, OSHA-30, SWAC, silica, I9), ICE (emergency_contact_name/phone/relation), notes
   - [x] Added `project_workers` TableV2 — M:N with active flag, assigned_at/by, removed_at/by

2. **Sync Rules** (`powersync/sync-rules.yaml`)
   - [x] `SELECT * FROM workers WHERE organization_id = bucket.organization_id` (no active filter — foremen see their own row even if deactivated; PM handles role)
   - [x] `SELECT * FROM project_workers WHERE organization_id = bucket.organization_id AND active = true`

3. **New feature module** (`src/features/workers/`)
   - [x] `types/index.ts` — Zod `Worker` (matches the 34-col shape), `ProjectWorker`, `TradeLevel` enum (foreman/mechanic/helper/apprentice/other), `workerFullName()` helper
   - [x] `utils/certStatus.ts` — `classifyCertStatus(cardNumber, expiresAt)` returning `'valid' | 'expiring' | 'expired' | 'missing'`, `daysUntilExpiry()`, `CERT_STATUS_COLOR` + `CERT_STATUS_LABEL` maps. Ported from Takeoff's workerService.
   - [x] `services/workerService.ts`:
     - `getWorkerByProfileId(profileId)` — resolves current user's workers row; returns null if PM hasn't added them to Manpower yet
     - `getWorkerById(workerId)`
     - `getProjectWorkers(projectId)` — PowerSync-local path does two `localQuery` calls (assignments + workers) and joins in JS (PowerSync SQLite doesn't support foreign JOINs in bucket SELECTs); web fallback uses nested Supabase select
     - `createWalkInWorker({ organizationId, firstName, lastName, sstCardNumber, createdBy })` — PowerSync `localInsert` into `workers` with `profile_id = NULL`, `trade_level = 'other'`, auto-note "Walk-in added by foreman on YYYY-MM-DD"
   - [x] `hooks/useMyWorker` — wraps `getWorkerByProfileId` for the current session user; returns `{ worker, loading, error, reload, needsOnboarding }`
   - [x] `hooks/useProjectWorkers` — wraps `getProjectWorkers`; returns `{ workers, loading, error, reload }`
   - [x] `components/OnboardingBlocker` — PM-action screen shown when foreman has no workers row. "You're not in Manpower yet. Ask your PM to add you with your SST card."

4. **PTP signature capture rewire** (`src/features/safety/ptp/components/PtpSignatures.tsx`)
   - [x] Removed the direct `SELECT id, full_name, sst_card_number FROM profiles` (both localQuery and Supabase fallback)
   - [x] Crew list now from `useProjectWorkers(projectId)` — joined `project_workers` × `workers` with both sides active
   - [x] Each candidate renders `workerFullName()`, trade, photo_url (if present), SST card number, SST expiry badge
   - [x] Cert status badges inline: amber `EXPIRING 28d`, red `EXPIRED 5d ago` with days remaining (via `classifyCertStatus` + `daysUntilExpiry`)
   - [x] Confirm dialog before signing if SST is expiring or expired ("Proceed anyway?") — NOT a hard block, foreman can proceed in emergencies
   - [x] `signature.worker_id` now references `workers.id` (was `profiles.id`)
   - [x] `signature.sst_card_number` is snapshotted from the workers row at tap-sign time (immutability intact — if PM updates SST later, the signature keeps the old value)
   - [x] `signature.is_foreman` derived from `worker.id === foremanWorkerId` (not from auth)
   - [x] GPS captured only on foreman's signature (unchanged)

5. **Walk-in flow rewrite** (PtpSignatures.tsx)
   - [x] Old flow: `signature.worker_id = null`, name only in JSONB. PM couldn't see the walk-in.
   - [x] New flow: modal captures `first_name`, `last_name`, optional SST → `createWalkInWorker` INSERTs a real `workers` row → signature references `workers.id` like any other signer → immediately starts the sign canvas for this worker
   - [x] Walk-in appears in Takeoff web's Manpower list on next sync. PM fills in SST/OSHA/trade from there.

6. **Onboarding blocker on PTP entry**
   - [x] `/docs/safety/ptp/new.tsx` — gates on `useMyWorker` before rendering the form. Shows `OnboardingBlocker` if `needsOnboarding`. Prevents orphan draft rows when the PM hasn't added the foreman to Manpower yet.
   - [x] `/docs/safety/ptp/[id].tsx` — same gate, catches the edge case where a foreman resumed an old draft after being removed from Manpower
   - [x] `content.foreman_id` in new drafts now stores `workers.id` (not `profiles.id`) for consistency with the signature's `worker_id` reference
   - [x] `content.foreman_name` derived from `workerFullName(myWorker)` with fallback to `profile.full_name` and `user.email`

**Files Created:**
- `src/features/workers/types/index.ts`
- `src/features/workers/utils/certStatus.ts`
- `src/features/workers/services/workerService.ts`
- `src/features/workers/hooks/useMyWorker.ts`
- `src/features/workers/hooks/useProjectWorkers.ts`
- `src/features/workers/components/OnboardingBlocker.tsx`

**Files Modified:**
- `src/shared/lib/powersync/schema.ts` — drop profiles.sst_*, add workers + project_workers
- `powersync/sync-rules.yaml` — workers + project_workers sync rules
- `src/features/safety/ptp/components/PtpSignatures.tsx` — full rewire to workers
- `src/app/(tabs)/docs/safety/ptp/[id].tsx` — `useMyWorker` gate + new signature props
- `src/app/(tabs)/docs/safety/ptp/new.tsx` — `useMyWorker` gate + workers.id as foreman_id

**TypeScript:** `npx tsc --noEmit` passes clean. Zero remaining `profiles.sst_*` reads verified via grep.

**⚠️ FK note (Takeoff-side follow-up):**
`crew_assignments.worker_id` and `area_time_entries.worker_id` STILL have FK → `profiles.id` in the DB. Daily area assignment in Track's `crew-store.ts` still writes profile_id there because inserting a workers.id would violate the FK. Changing those FKs is Takeoff-side work (ALTER TABLE ... DROP CONSTRAINT + ADD CONSTRAINT ... REFERENCES workers) and will land in a follow-up Track sprint that also migrates `assignWorker` / `endDay` to write workers.id. Until then, walk-ins created during PTP cannot be assigned to an area via the daily crew flow (they're invisible to crew-store because they have no profile).

**Testing plan:**
- [ ] Foreman without workers row → blocker screen on /ptp/new and /ptp/[id]
- [ ] Foreman with valid workers row → full PTP flow, signature captures workers.id
- [ ] Walk-in flow → new workers row visible in Takeoff Manpower on next sync
- [ ] SST expired → confirm dialog on sign, foreman can proceed
- [ ] SST updated in Manpower AFTER distribute → PDF still shows the old value (snapshot immutability)
- [ ] Offline: createWalkInWorker + appendSignature both go through PowerSync local, sync when online

---

### Sprint TOOLBOX — Weekly Toolbox Talks ✅
**Date:** 2026-04-19
**Depends on:** Takeoff Sprint 50A (toolbox_library + toolbox_schedule_overrides tables + scheduler engine spec) + Sprint 50B (toolbox-photos bucket + distribute endpoint extension)

**Objective:** Foreman delivers a weekly safety talk in under 3 minutes with zero typing. Library-sourced topics (not free-form), 3-step flow (Present → Sign → Send), EN/ES bilingual, optional huddle photo, offline-first. Mirrors the PTP pattern — `safety_documents` row with `doc_type='toolbox'` + content snapshot of the library row. Distribute reuses the PTP endpoint and offline queue.

**Critical enum hotfix (discovered during this sprint):**
Verification against `information_schema` revealed the DB CHECK constraint on `safety_documents` is narrower than what the PTP flow was writing:
- `doc_type IN ('jha','ptp','toolbox','sign_off')` — NOT `'toolbox_talk'`
- `status IN ('draft','active','completed')` — NOT `'distributed'`

Track's legacy SafetyForm used `'toolbox_talk'` and the PTP distributeService called `setPtpStatus('distributed')`. Both went through PowerSync localInsert (SQLite has no CHECK, local writes succeeded) but would have silently failed to sync to Supabase forever. Fixed:
1. DocType enum: `'toolbox_talk'` → `'toolbox'`
2. SafetyDocument.status narrowed to `{draft, active, completed}`
3. `distributeService` stamps `content.distribution = { distributed_at, distributed_to, pdf_sha256, emails_sent }` and sets status to `'active'` via new `patchPtpContent()` + `setPtpStatus()` helpers
4. MorningPtpCard + safety detail view detect "already sent" via `content.distribution.distributed_at`, not the status column
5. All legacy `'toolbox_talk'` refs renamed to `'toolbox'`
6. `safety/new.tsx` now redirects `?type=toolbox|toolbox_talk|ptp` to the respective wizards

**Changes:**

1. **PowerSync Schema** (`src/shared/lib/powersync/schema.ts`)
   - [x] Added `toolbox_library` TableV2 (22 cols — all ARRAY cols as `column.text` JSON since SQLite has no native arrays)
   - [x] Added `toolbox_schedule_overrides` TableV2 (9 cols — PM weekly override)

2. **Sync Rules** (`powersync/sync-rules.yaml`)
   - [x] `by_org` bucket: toolbox_library filtered to `organization_id = bucket.organization_id AND active = true`, toolbox_schedule_overrides filtered to org
   - [x] **New `toolbox_global` bucket** keyed on user_id (dummy param) syncs `organization_id IS NULL` topics to every authenticated user. PowerSync's constant-filter data queries allow this without requiring bucket param binding.

3. **Types** (`src/features/safety/toolbox/types/index.ts`)
   - [x] `ToolboxLibraryTopic` — matches DB shape with `trade`/`key_points`/`key_points_es`/`discussion_questions`/`discussion_questions_es`/`tags`/`season` as string arrays
   - [x] `ToolboxTopicSnapshot` — frozen copy stored in `content.topic_snapshot` with `snapshotOf(topic)` helper
   - [x] `ToolboxScheduleOverride` — PM's weekly forced topic
   - [x] `ToolboxContentSchema` — `topic_snapshot`, `scheduled_date` (week Monday ISO), `delivered_date`, `shift`, `weather`, `foreman_id` (workers.id per Sprint MANPOWER), `foreman_name`, `foreman_gps`, `photo_urls[]`, `discussion_notes`, `delivered_language` (`'en' | 'es' | 'both'`), `distribution` metadata block
   - [x] `ToolboxDelivery` + `RankedTopic` + `ScheduleResult` for scheduler I/O

4. **Scheduler Engine** (`src/features/safety/toolbox/services/schedulerEngine.ts`) — pure function, zero imports
   - [x] `scheduleToolboxTopic({ library, history, primaryTrades, currentDate, override, ptpSignal })`
   - [x] Priority: **PM override** short-circuits → **8-week rotation filter** skips topics delivered recently → **score** by trade match (+100) / universal (empty trade[]) (+50) / other-trade (+20) / PTP tag overlap (+50) / season match via current quarter + season (q1/q2/q3/q4/winter/spring/summer/fall) (+20) / decay (weeks_since_last × 2, cap 100) / never-delivered (+30) → **sort desc, tie-break by id**
   - [x] Output: `{ suggested, alternatives (top 5), explanation[], wasOverridden, ranked }`
   - [x] Also exports `weekStartDate(date)` → ISO Monday of the week for consistent weekly grouping

5. **Service** (`src/features/safety/toolbox/services/toolboxService.ts`)
   - [x] `getToolboxLibrary(orgId)` — offline-first, joins global + org rows via `WHERE organization_id IS NULL OR organization_id = ?`; web fallback uses Supabase `.or()` filter
   - [x] `getRecentDeliveries(projectId, weeksBack)` — derives from `safety_documents` rows with `doc_type='toolbox'`, extracts `topic_snapshot.toolbox_library_id` + delivered_date
   - [x] `getWeeklyOverride(projectId, weekStartIso)` — looks up PM override for the current week
   - [x] `getRecentPtpTags(projectId, weeksBack)` — pulls `content.selected_tasks[].hazards[].name` from recent PTPs as scheduler signal
   - [x] `getThisWeeksDelivery(projectId, weekStartIso)` — already-delivered check (returns `{ id, status, content }` or null)
   - [x] `createDraftToolbox({ organizationId, projectId, foremanProfileId, content })` — PowerSync localInsert with parsed content; `created_by` = profiles.id (FK requirement), `content.foreman_id` = workers.id (wizard convention)
   - [x] `patchToolboxContent` + `setToolboxStatus` — thin wrappers over `patchPtpContent` / `setPtpStatus` (the JSONB merge + status column are doc_type-agnostic)

6. **Label Builder** (`src/features/safety/toolbox/services/buildToolboxLabels.ts`)
   - [x] `buildToolboxLabels({ title, projectName, projectAddress, foremanName, dateIso, shift, language, oshaCitationsIncluded })`
   - [x] Reuses the `PtpPdfLabels` shape: `tasks_header='Why It Matters'`, `hazards_header='Key Points'`, `controls_header='Discussion Questions'`, `ppe_header='Field Notes'`, `emergency_header='Distribution'`, `trade_label='Language: EN/ES/Both'` (borrowing the trade slot since toolbox topics can span trades)

7. **Hooks** (`src/features/safety/toolbox/hooks/`)
   - [x] `useThisWeeksToolbox(orgId, projectId, primaryTrades)` — one-shot scheduler run + delivered-check. Parallel fetches library, history (16 weeks), override (current week), PTP tags (last week), this week's delivery. Refetches on `useFocusEffect`.
   - [x] `useToolbox(docId)` — single-document load + mutate mirroring PTP's `usePtp`. `saveContent(partial)` does shallow merge via `patchToolboxContent`. `addSignature`/`removeSignatureAt` delegate to PTP's signature helpers (same JSONB shape).

8. **Screens** (`src/app/(tabs)/docs/safety/toolbox/`)
   - [x] **`new.tsx`** — Screen 1 entry. Runs scheduler, shows the suggested topic card (orange border if PM-overridden) with "Why this week" reasons (trade match / PTP hazard / season / never-delivered / weeks-since-last), **Change topic** button opens `ToolboxTopicPicker` bottom-sheet. **Already-delivered banner** when a talk exists for this week (links to resume draft or view distributed). **Empty-library fallback** when zero topics in the library. **OnboardingBlocker** gate if foreman has no workers row.
   - [x] **`[id].tsx`** — 3-step wizard with step indicator (Present → Sign → Send). Resume logic picks the right step based on photo count / signature count / `content.distribution` presence.

9. **Components** (`src/features/safety/toolbox/components/`)
   - [x] **`ToolboxPresent`** — Screen 2. EN/ES toggle (only surfaces when `title_es` + `key_points_es` populated); tracks whether the foreman switched between languages during delivery → saves `delivered_language='both'`. Renders Why It Matters / Key Points / Discussion Questions in the active language. Camera + Gallery buttons upload to `toolbox-photos/{orgId}/{docId}/{idx}_{ts}.{ext}` via direct Supabase storage; preview strip with remove button.
   - [x] **`ToolboxTopicPicker`** — bottom-sheet modal with full library minus the current suggestion; each row shows title + category + trade chip (or "Universal") + hazard preview.
   - [x] **`ToolboxDistribute`** — Screen 4. Multi-recipient picker (defaults from `projects.safety_distribution_emails`), ad-hoc email input, OSHA citations toggle, field-notes textarea that writes to `content.discussion_notes` on every keystroke. Submit calls `distributeSafetyDoc` (generic alias of `distributePtp`) — the endpoint is doc_type-agnostic, server branches PDF renderer.
   - [x] **`WeeklyToolboxCard`** — Home card with 3 states (green CTA / amber resume / green delivered). Mounted in `src/app/(tabs)/home/index.tsx` right after `MorningPtpCard`.

10. **Signature reuse** (`PtpSignatures` → Screen 3 of toolbox wizard)
    - [x] Mounted as-is; same props (projectId, foremanWorkerId, foremanWorkerName, foremanSstCardNumber, signatures, addSignature, removeSignatureAt). Crew list pulls from `project_workers` JOIN `workers`, signatures snapshot SST, walk-in INSERTs real workers row — all Sprint MANPOWER behaviour preserved.

11. **Distribute reuse** (`distributeSafetyDoc` alias)
    - [x] Added `export const distributeSafetyDoc = distributePtp` to `distributeService.ts`. The function is doc_type-agnostic — it POSTs to `/api/pm/safety-documents/[docId]/distribute` with labels + recipients and stamps `content.distribution` on success. Server switches PDF renderer by `doc_type`. Offline queue (AsyncStorage) + flusher (`usePtpDistributionFlusher` on docs layout) cover both PTP and Toolbox transparently.

12. **Legacy cleanup**
    - [x] `SafetyForm.tsx`: narrowed `LegacyDocType` to `'jha'`; removed toolbox branch from handleSave + JSX; removed `topic`/`discussionPoints`/`attendance` state
    - [x] `src/features/safety/types/schemas.ts`: DocType enum drops `'toolbox_talk'`, `SafetyDocFormData.content` simplified to `JhaContent` only (no more union), `DOC_TYPE_LABELS.toolbox` instead of `toolbox_talk`
    - [x] `src/app/(tabs)/docs/safety/new.tsx`: redirect map now covers `ptp | toolbox | toolbox_talk` → respective wizard routes
    - [x] `src/app/(tabs)/docs/safety/[id].tsx`: added `ToolboxDetailBody` with auto-detect shape (`topic_snapshot` present = new wizard render with language toggle applied statically based on `delivered_language`; fallback to legacy topic/discussion_points for any historical rows). Also handles `doc_type === 'toolbox' || 'toolbox_talk'` for back-compat with any pre-hotfix rows.
    - [x] `src/app/(tabs)/docs/index.tsx`: FAB Toolbox button now routes to `/docs/safety/toolbox/new` (was `/docs/safety/new?type=toolbox_talk`); list tap routes toolbox drafts to the wizard, others to the detail view

**Files Created:**
- `src/features/safety/toolbox/types/index.ts`
- `src/features/safety/toolbox/services/schedulerEngine.ts`
- `src/features/safety/toolbox/services/toolboxService.ts`
- `src/features/safety/toolbox/services/buildToolboxLabels.ts`
- `src/features/safety/toolbox/hooks/useThisWeeksToolbox.ts`
- `src/features/safety/toolbox/hooks/useToolbox.ts`
- `src/features/safety/toolbox/components/ToolboxPresent.tsx`
- `src/features/safety/toolbox/components/ToolboxTopicPicker.tsx`
- `src/features/safety/toolbox/components/ToolboxDistribute.tsx`
- `src/features/safety/toolbox/components/WeeklyToolboxCard.tsx`
- `src/app/(tabs)/docs/safety/toolbox/new.tsx`
- `src/app/(tabs)/docs/safety/toolbox/[id].tsx`

**Files Modified (enum hotfix + wiring):**
- `src/shared/lib/powersync/schema.ts` — toolbox tables, doc_type comment
- `powersync/sync-rules.yaml` — toolbox sync rules + global bucket
- `src/features/safety/ptp/types/index.ts` — status enum narrowed, `content.distribution` added, `DistributionMeta` exported
- `src/features/safety/ptp/services/ptpService.ts` — `setPtpStatus` enum narrowed, new `patchPtpContent` helper
- `src/features/safety/ptp/services/distributeService.ts` — stamps distribution meta, `distributeSafetyDoc` alias
- `src/features/safety/ptp/components/MorningPtpCard.tsx` — detect sent via `content.distribution.distributed_at`
- `src/features/safety/types/schemas.ts` — DocType value swap + union simplified
- `src/features/safety/components/SafetyForm.tsx` — JHA-only, toolbox branch removed
- `src/app/(tabs)/docs/safety/new.tsx` — redirect map
- `src/app/(tabs)/docs/safety/[id].tsx` — ToolboxDetailBody
- `src/app/(tabs)/docs/index.tsx` — FAB route + list routing
- `src/app/(tabs)/home/index.tsx` — WeeklyToolboxCard mounted

**Deploy checklist:**
- [x] Code committed + pushed
- [ ] `powersync/sync-rules.yaml` deployed to PowerSync dashboard/CLI
- [ ] (optional) Seed 2-3 topics in `toolbox_library` for testing while PM builds the full catalog in Takeoff web
- [ ] Sprint 50D (Takeoff) — `toolboxPdfRenderer` + `buildToolboxPdfLabels` server-side so `/distribute` actually produces a toolbox PDF (until then the endpoint would fall back to PTP renderer or 400)

**Backend state (as of Sprint TOOLBOX commit):**
- ✅ `toolbox_library` table exists (22 cols, RLS correct — SELECT allows NULL org or own org)
- ✅ `toolbox_schedule_overrides` table exists (9 cols, RLS gates to user's org)
- ✅ `toolbox-photos` public storage bucket exists
- ⚠️ `toolbox_library` has **0 rows seeded** in production — empty-library fallback handles it

**TypeScript:** `npx tsc --noEmit` clean across all 25 changed files.

---

## 📱 PHASE T1 — Foundation + Safety + GPS — ✅ OPERATIONAL
> 39 of 43 tasks complete. 4 deferred to T2 (require data from Takeoff 7B).
> 5 Supabase migrations applied. PowerSync sync rules deployed. 6 locales.

### Foundation
- [x] TT1.1 Expo project init — SDK 55, TypeScript, NativeWind v4, Zustand v5, Zod v4
- [x] TT1.2 PowerSync setup — connection to shared Supabase (msmpsxalfalzinuorwlg), sync rules deployed
- [x] TT1.3 Supabase Auth integration — SecureStore session persistence, shared auth with Takeoff
- [x] TT1.4 i18n setup — 6 locales (EN, ES, FR, PT, IT, DE), 150+ keys, construction terminology
- [x] TT1.5 Navigation — 5 bottom tabs (Home, Board, Plans, Docs, More)
- [x] TT1.6 Role-based scope — foreman auto-selects 1 project, supervisor gets ProjectSwitcher modal
- [x] TT1.7 Home screen — dashboard with modular DashboardCards, quick actions, alerts, crew/safety/ticket stats
- [x] TT1.8 Offline indicator — SyncStatusBar (amber syncing, muted offline, hidden when connected)
- [x] TT1.9 Photo service — expo-camera + expo-image-picker, photo-queue outbox pattern, photo-worker background upload
- [x] TT1.10 Branding — brand colors (colors.ts), dark mode default, touch targets, font sizes, app.json configured

### GPS + Check-in
- [x] TT1.11 expo-location setup — foreground permissions, high accuracy + last known fallback
- [x] TT1.12 Geofence — Haversine distance check against gps_geofences, isInsideGeofence()
- [x] TT1.13 Manual check-in/out — 120dp circle button, manual override for GPS failure
- [x] TT1.14 `gps_checkins` table — created via migration, RLS: org_id + user_id
- [x] TT1.15 `gps_geofences` table — created via migration, RLS: org_id + field leaders only
- [x] TT1.16 GPS stamps on photos — gps_lat/gps_lng in field_photos table

### Safety Documents
- [x] TT1.17 JHA — dynamic form: hazards[], risk levels, controls, PPE chips. Zod validated
- [x] TT1.18 PTP — Sprint PTP: 4-step wizard (tasks → review → signatures → distribute) backed by shared `safety_documents` row. JHA library consumer (149 seeded tasks), task snapshots in content, emergency/SST snapshots, multi-signature (foreman GPS-stamped + crew + walk-in), server-side PDF via Takeoff `/distribute` endpoint + offline AsyncStorage queue. Home Morning PTP card + Safety tab surfaced. Sprint MANPOWER migrated signatures to `workers.id`.
- [x] TT1.19 Toolbox Talk — Sprint TOOLBOX: 3-step wizard (Present → Sign → Send) backed by shared `safety_documents` row. `toolbox_library` consumer (3-tier global/org/project), scheduler engine (rotation + trade match + PTP tag signal + decay), EN/ES bilingual with auto-detected `delivered_language='both'`, optional huddle photos to `toolbox-photos` bucket, one talk per week enforced, Home WeeklyToolboxCard. Server-side PDF via Takeoff `/distribute` endpoint (same as PTP). Sprint MANPOWER applies to signatures. Critical enum hotfix: `doc_type='toolbox'` + narrow status enum.
- [x] TT1.20 Safety doc list — grouped by type, status badges, FAB create button
- [x] TT1.21 Signature collection — SignaturePad (react-native-signature-canvas), base64 capture
- [x] TT1.22 QR signature — document_signoffs table exists with token field (web route pending)
- [x] TT1.23 Cert tracking — worker_certifications table, useCertAlerts hook, cert dots on WorkerCard, assignment validation Alert

### Work Tickets
- [x] TT1.24 Create work ticket — TicketForm with camera, crew auto-fill from crew-store
- [x] TT1.25 Work ticket list — unified Docs tab with Tickets + Safety tabs, status filters
- [x] TT1.26 Work ticket detail — header card, location, description, photo gallery
- [x] TT1.27 Status workflow — draft/submitted/reviewed/closed chips, completed requires photo

### Crew Management + Time Tracking by Area
- [x] TT1.28 `crew_assignments` table — UNIQUE(worker_id), RLS org_id, field leaders only
- [x] TT1.29 `area_time_entries` table — hours GENERATED ALWAYS, RLS org_id
- [x] TT1.30 Assign workers to area — 2-tap flow: select workers → pick area
- [x] TT1.31 Move workers to new area — auto-closes previous time entries, creates new
- [x] TT1.32 End of day — "End Day" button closes all open entries + clears assignments
- [x] TT1.33 Today's crew view — WorkerCard with current area, assignment status
- [x] TT1.34 Daily hours summary — todayHours computed live from time entries

### Plans / Drawing Viewer
- [x] TT1.35 Plans tab + sheet list — grouped by discipline (A=Arch, S=Struct, M=Mech), search, collapse
- [x] TT1.36 PDF plan viewer — react-native-pdf, pinch-to-zoom, horizontal paging, platform-split (.web.tsx)
- [x] TT1.37 PDF offline caching — expo-file-system legacy API, signed URL download, progress bar, cache-first
- [ ] TT1.38 Takeoff overlay — ⬜ T2 (needs takeoff_objects data from Estimator)
- [ ] TT1.39 Hyperlinked sheets — ⬜ T2 (needs cross-references in drawing_register)
- [x] TT1.40 Revision indicator — amber badge for sheets with multiple revisions, cloud status icon
- [ ] TT1.41 Tap area → jump to detail — ⬜ T2 (needs production_areas data + area detail screen)
- [ ] TT1.42 Tablet split view — ⬜ T2 (needs TT1.41 + tablet testing)
- [ ] TT1.43 Field markups — ⬜ T2 (needs field_markups migration)

---

## 🏭 PHASE T2 — Production Reporting — ✅ S1-S3 + Sprints 25/34 DONE
> Takeoff 7B tables confirmed. Sprint 23 added room_types, room_type_surfaces, phase_progress.
> Sprint 25: PhaseChecklist with sqft-weighted progress. Sprint 34: pilot features.
> Delivery Review: pending_review → approved flow with Home alerts + Docs badge.

### Daily Report (3-click workflow) — Sprint T2-S1 ✅
- [x] TT2.1 Area list — ReadyBoard component: grouped by floor, progress bars, status dots, search, filter chips
- [x] TT2.2 Area detail — AreaDetail component: phase list with gates/locks, status header, time entries
- [x] TT2.3 Mark surface complete — markAreaStatus() with optimistic UI + gate validation
- [x] TT2.5 Area progress photo — camera button on AreaDetail → enqueuePhoto() via photo-queue
- [x] TT2.7 Mark surface blocked — 7 predefined reasons (other_trade, material, etc.), block reporting flow
- [x] TT2.8 Unblock surface — "Unblock — Resume Work" button, clears blocked_reason
- [x] TT2.9 Phase tracking — ordered phase list from template, completePhase() with userId audit
- [x] TT2.11 Submit daily report — report-service.ts: draft/submit lifecycle, upsert on UNIQUE, area checkboxes, auto man-hours
- [x] TT2.4 Progress photo per surface — Sprint 34: SurfaceChecklist with camera icon per surface, photo count badge
- [x] TT2.6 Photo gallery per area — Sprint 34: PhotoGallery horizontal strip + PhotoViewer full-screen modal
- [x] TT2.10 Auto-progress calculation — Sprint 34: calculateSurfaceProgress() sqft-weighted, PCS items get 20 SF weight

### Production Dashboard (in-app) — Sprint T2-S1 ✅
- [x] TT2.9 Foreman dashboard — Ready Board is the dashboard: floors, areas, progress, blocked
- [x] TT2.11 Floor progress view — collapsible floor sections with progress bars
- [x] TT2.12 Blocked areas highlight — red status dots + blocked reason text + badge in floor header
- [ ] TT2.10 Supervisor dashboard — ⬜ cross-project comparison (T2-S3)

### Ready Board Mobile — Sprint T2-S1 ✅
- [x] TT2.13 Ready Board list view — vertical list, floor groups, status chips filter, search, tap→detail
- [x] TT2.14 Ready Board supervisor aggregate — gate health per floor (shield icon), blocked count badge, progress bars

### Gate Tasks — Sprint T2-S2 ✅
- [x] TT2.15 Gate phase UI — phases with requires_inspection show "Gate" badge, locked phases greyed + lock icon, canCompleteArea() validates gates
- [x] TT2.16 Supervisor gate verification — completePhase() works for any role with access, recalcFloor() updates instantly
- [x] Gate health metrics — computeGateHealth() per floor: totalGates, completedGates, gateHealthPct
- [x] Auto field_message on gate block — blockPhase() auto-inserts blocker message

### Legal Documentation (supervisor only)
- [ ] TT2.17 NOD draft notification — ⬜ T2-S3
- [ ] TT2.18 NOD review + sign — ⬜ T2-S3
- [ ] TT2.19 Legal docs list — ⬜ T2-S3

### Crew Assignment (extended)
- [x] TT2.15 Link time entries to production areas — AreaDetail shows "X man-hours today" from crew time entries
- [ ] TT2.16 Supervisor: assign foreman to project — ⬜ T2-S3
- [ ] TT2.17 Labor cost per area — ⬜ T2-S3

### Communication
- [x] TT2.17 `field_messages` table — created via migration, auto-populated by blockPhase()
- [x] TT2.18 `daily_reports` table — created via migration, used by report-service.ts
- [ ] TT2.15 Area notes UI — ⬜ T2-S3
- [ ] TT2.16 Photo annotations — ⬜ T2-S3

### Punch List (GC Platform Integration — Sprint 42B) ✅
- [x] TT2.26 `gc_punch_items` table — synced from Procore/GC platforms via Sprint 42A
- [x] TT2.27 GC Punchlist view — Sprint 42B: grouped by floor/unit, status filters (open, in_progress, ready_for_review, closed)
- [x] TT2.28 Polisher workflow — Sprint 42B: Start Work → log hours + notes + resolution photos → Mark Ready for Review
- [x] TT2.29 Resolution photos — Sprint 42B: camera button, upload to field-photos bucket, append to resolution_photos JSON
- [x] TT2.30 Push to Procore — Sprint 42B: status change sets push_pending = 1, cron triggers gc-push-resolution Edge Function
- [x] TT2.31 Hours logging — Sprint 42B: numeric input (0.5 increments), auto-save debounced, does NOT push to Procore (internal only)
- [x] TT2.32 Punch summary KPIs — Sprint 42B: KPI bar on list screen (Open / Working / Review / Closed)

**Note:** Internal punch_items table from T2-S3 is SEPARATE from GC punch items. GC items flow Procore → Track → Procore. Internal items are supervisor-to-foreman QC notes.

### AI Agent + Voice Commands (Future — Post-Pilot)
- [ ] TT2.20 AI Agent chat UI — ⬜ T2-S4
- [ ] TT2.21 Picovoice wake word — ⬜ T2-S4
- [ ] TT2.22 Picovoice speech-to-intent — ⬜ T2-S4
- [ ] TT2.23 Voice context file — ⬜ T2-S4
- [ ] TT2.24 AI Agent online mode — ⬜ T2-S4
- [ ] TT2.25 Hybrid voice routing — ⬜ T2-S4

---

## 📦 PHASE T3 — Delivery + Material Flow — ✅ 9/10 DONE
> Tables exist: delivery_tickets, delivery_ticket_items, material_consumption.
> PowerSync schema + sync rules updated. Delivery service + UI built.
> Delivery Review: pending_review → approved flow with Home alerts.

### Delivery Confirmation
- [x] TT3.0 Delivery Review — pending_review tickets: approve or request changes, Home alerts, Docs tab badge
- [ ] TT3.1 Delivery notification — ⬜ push notification (T4 — needs expo-notifications)
- [x] TT3.2 Delivery checklist — per item: received / short / damaged / rejected buttons in expandable panel
- [x] TT3.3 Quantity received input — numeric input with over-delivery warning Alert
- [ ] TT3.4 Photo evidence — ⬜ camera integration on item confirm (quick add)
- [x] TT3.5 One-tap "Confirm All" — green button confirms all pending items as received
- [x] TT3.6 Update delivery_ticket_items — receipt_status, quantity_received, receipt_notes via PowerSync local-first

### Supervisor Delivery Tracker
- [x] TT3.7 Delivery history view — chronological list with supplier, PO, status badges, KPI bar
- [ ] TT3.8 Material by area view — ⬜ needs UI screen (data in material_consumption table)
- [ ] TT3.9 Material alerts view — ⬜ needs UI screen

### Material Consumption
- [x] TT3.10 Auto-update material_consumption — updateDeliveredQty() on item confirm, updateInstalledQty() on surface complete. Creates consumption row if not exists.

---

## ✨ PHASE T4 — Polish + App Store — ⬜ AFTER TAKEOFF FASE 10
> Depends on: role system from Takeoff Fase 10 for proper enforcement

### Role Enforcement
- [ ] TT4.1 Worker mode — limited UI: check-in/out, view schedule, sign docs only
- [ ] TT4.2 Scope enforcement — foreman: filter all queries by assigned project_id. Supervisor: show project switcher.
- [ ] TT4.3 PowerSync sync rules by role — worker syncs minimal data, foreman syncs 1 project, supervisor syncs all

### Push Notifications
- [ ] TT4.4 Delivery arriving notification
- [ ] TT4.5 New area assignment notification
- [ ] TT4.6 Cert expiring notification (30 days before)
- [ ] TT4.7 PM message/request notification

### Performance + Testing
- [ ] TT4.8 Large project stress test — 600+ areas, 1000+ objects, offline sync
- [ ] TT4.9 Offline resilience test — full workflow without internet, then sync

### App Store Submission — see Sprint STORE RELEASE
- [ ] TT4.10 App Store + Google Play — full plan in **SPRINT_TRACK_STORE_RELEASE.md**
  - Legal: Privacy Policy, Terms of Service (notchfield.com hosting)
  - In-app account deletion (Apple + Google mandate, via Supabase Edge Function)
  - Sentry crash reporting + source map upload in EAS build
  - Version bump automation, asset audit (no-alpha icon, splash, adaptive)
  - Apple Developer enrollment ($99/yr) + Google Play Console ($25 one-time)
  - Screenshots x 7 views x 3 sizes (iPhone 6.7", 5.5", iPad 12.9")
  - App listing EN + ES descriptions, keywords, categories
  - Data Safety form (Play) + Privacy Nutrition Labels (App Store)
  - Background location declaration + demo video (both stores)
  - Closed testing cohort (Android mandate: 12 testers x 14 days)
  - Demo account + App Review notes for reviewers
  - Prereq: TAKEOFF_PENDING.md items 1 (distribute endpoint auth) + 4 (toolbox seed)

---

## 📋 Priority Execution Order

### NOW — Phase T1 (parallel with Takeoff Fase 7B + 8)
1. TT1.1–TT1.10 Foundation (Expo, PowerSync, Auth, i18n, navigation)
2. TT1.11–TT1.16 GPS + check-in
3. TT1.17–TT1.23 Safety documents
4. TT1.24–TT1.27 Work tickets
5. TT1.28–TT1.34 Crew management + time tracking
6. TT1.35–TT1.43 Plans / Drawing Viewer (PlanGrid-style, tablet split view)

### After Takeoff 7B completes — Phase T2
1. TT2.1–TT2.11 Daily report (checkboxes, blocked, phases, submit)
2. TT2.12–TT2.14 Production dashboard + Ready Board mobile
3. TT2.15–TT2.19 Gate tasks + Legal (NOD/REA)
4. TT2.15–TT2.18 Communication
5. TT2.20–TT2.25 AI Agent + Picovoice voice commands (post-pilot)

### After Takeoff Fase 9 completes — Phase T3
1. TT3.1–TT3.6 Delivery confirmation
2. TT3.7–TT3.9 Supervisor delivery tracker
3. TT3.10 Material consumption update

### After Takeoff Fase 10 completes — Phase T4
1. TT4.1–TT4.3 Role enforcement
2. TT4.4–TT4.7 Push notifications
3. TT4.8–TT4.9 Performance testing
4. TT4.10 App Store submission

---

## 🔗 Parallel Development Timeline

```
WEEK    TAKEOFF (Web)              TRACK (Native)
─────   ─────────────────────      ──────────────────────
1-2     Fase 7B: production        T1: Expo setup, Auth,
        tables, procurement        PowerSync, navigation
        fields, seeds
                                   
3-4     Fase 8 Sprint 1:           T1: GPS + check-in,
        Estimator foundation       safety docs
        (labor rates, assemblies)
                                   
5-6     Fase 8 Sprint 2:           T1: Work tickets,
        Estimator dashboard,       crew management
        bid output
                                   
7-8     Fase 8 Sprint 3:           T2: Daily report ← 7B tables ready
        Scope sheet view,          (checkboxes, blocked,
        import/export              phase tracking)
                                   
9-10    Fase 8 Sprint 4-5:         T2: Production dashboard,
        Power tools,               communication
        production tracking
                                   
11-12   Fase 9: Material flow      T3: Delivery confirmation ← Fase 9 tables ready
                                   
13-14   Fase 10: Ship blockers     T4: Role enforcement, ← Fase 10 roles ready
                                   push, app store
```

---

*105 tasks. 4 phases. Offline-first. Camera-native. 3 clicks or less.*
*Punch List: supervisor creates → foreman resolves → before/after photos.
*Plans tab: PlanGrid-style drawing viewer with takeoff overlay + tablet split view.*
*Time tracking by area: 2 taps to assign, auto-close on move.*
*Ready Board mobile + Gate verification + Legal engine (NOD/REA).*
*AI Agent: Picovoice offline voice + Gemini online tool-calling.*
*Same database. Same users. Different doors.*
*Start building NOW — Phase T1 has zero dependencies.*
