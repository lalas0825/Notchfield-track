# 🏗️ NotchField Track — Factory OS
> *"Track collects, Web processes. Same database, different doors."*
> Updated: 2026-04-29 | T1 OPERATIONAL, T2 S1-S3 + Sprint 42B + 43A + 43B + 45B + 45B-F + 45B-FIX + 47B + PTP + PTP-UX + MANPOWER + TOOLBOX + 52 + CALCULATOR DONE, T3 7/10 | Jantile pilot in the field
> Repo: https://github.com/lalas0825/Notchfield-track (68+ commits, Sprint 52 pilot-ready)
> Supabase: msmpsxalfalzinuorwlg | PowerSync: 69c72137a112d86b20541618
> EAS: @lalas825/notchfield-track (281ade7b-a5d9-4f43-9710-d270ae4c49f4)

---

## 🎯 Identidad

**App:** NotchField Track — Native Field Operations App
**Type:** React Native (Expo SDK 55) + PowerSync (offline-first)
**Purpose:** Field ops — production reporting, safety, GPS, delivery, crew management
**Database:** SAME Supabase as Takeoff (shared tables, shared rows, no sync layer)
**Deploy:** Expo EAS → App Store + Google Play

### Ecosystem Position

| App | Type | Purpose | Repo |
|-----|------|---------|------|
| **Takeoff** (web) | Next.js | Estimating + PM + Warehouse + Shop | notchfield-takeoff |
| **Track** (this repo) | Expo/RN | Field ops — production, safety, GPS, delivery | notchfield-track |

**Principle:** Track collects, Web processes. Both read/write the SAME Supabase tables. There is NO sync between apps — both apps access the same rows directly. PowerSync handles offline for Track only.

### Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Expo SDK 55 (canary) | Managed workflow |
| UI | React Native + NativeWind (Tailwind) | Consistent with web aesthetics |
| Offline | PowerSync | SQLite local → Supabase sync |
| Auth | Supabase Auth (shared with Takeoff) | Same user, same session concept |
| Database | Supabase (SHARED — same project as Takeoff) | Read/write same tables |
| GPS | expo-location | Geofencing, stamps, tracking |
| Camera | expo-camera + expo-image-picker | QC photos, delivery, blocked evidence |
| Push | expo-notifications + Supabase Edge Functions | Delivery alerts, assignments |
| Signatures | react-native-signature-canvas | Digital sign-offs |
| Maps | react-native-maps | Job site visualization |
| State | Zustand | Same pattern as Takeoff |
| Validation | Zod | Same schemas as Takeoff where shared |
| i18n | i18next + react-i18next | Same 6 locales as Takeoff (EN, ES, FR, PT, IT, DE) |
| Deploy | EAS Build + EAS Submit | App Store + Google Play |

---

## 🧠 Role Model — Scope, Not Features

**There is ONE app with ONE set of features. The role controls the SCOPE, not the functions.**

```
FOREMAN  = ALL functions, 1 project (the one he's assigned to)
SUPERVISOR = ALL functions, ALL assigned projects + multi-project switcher

WORKER = Limited functions (check-in/out, view schedule, sign docs)
```

Both foreman and supervisor can:
- Create work tickets, safety docs (JHA, PTP, Toolbox Talk)
- Assign crews to areas (foreman distributes within job, supervisor assigns to jobs)
- Report production progress (checkboxes per surface)
- Mark phases complete
- Report blocked status with reason + photos
- Confirm deliveries (received/short/damaged)
- Take QC photos
- Generate reports
- Attend/document GC meetings
- Communicate with team (notes on areas)

The ONLY difference: foreman sees 1 project, supervisor sees all assigned projects and can switch between them.

### Permission Matrix

| Function | Worker | Foreman | Supervisor |
|----------|--------|---------|------------|
| Check-in/out (GPS) | ✅ | ✅ | ✅ |
| View schedule/areas | ✅ Read | ✅ Read | ✅ Read all projects |
| Sign documents | ✅ | ✅ | ✅ |
| Production progress | ❌ | ✅ His areas | ✅ All areas, all projects |
| Work tickets CRUD | ❌ | ✅ His project | ✅ All projects |
| Safety docs CRUD | ❌ | ✅ His project | ✅ All projects |
| Crew assignment | ❌ | ✅ Distribute within job | ✅ Assign to jobs |
| Delivery confirmation | ❌ | ✅ | ✅ + history all projects |
| QC photos | ❌ | ✅ | ✅ |
| Block reporting | ❌ | ✅ | ✅ |
| Reports to PM | ❌ | ✅ His project | ✅ All projects |
| GC meeting notes | ❌ | ✅ | ✅ |
| Multi-project switch | ❌ | ❌ | ✅ |

---

## 📱 App Structure

### Navigation (Bottom Tabs)

```
┌─────────────────────────────────────────┐
│                                         │
│          [Current Screen]               │
│                                         │
├───────┬───────┬───────┬───────┬─────────┤
│ Home  │ Board │ Plans │ Docs  │  More   │
└───────┴───────┴───────┴───────┴─────────┘
```

**Tab 1 — Home**
- Today's summary: areas assigned, progress %, alerts
- Quick actions: start area, mark complete, take photo
- Supervisor: project switcher at top

**Tab 2 — Production (Board)**
- Ready Board: area list grouped by floor with status colors
- Per area: surface checkboxes, phase status
- Block reporting (reason + photo)
- Crew assignment

**Tab 3 — Plans (Drawing Viewer)**
- Sheet list from `drawing_sets` + `drawings` (synced via PowerSync from Takeoff)
- PDF viewer with pinch-to-zoom (optimized for tablet: full sheet visible)
- Takeoff overlay: see estimator's polygons + measurements (read-only, from `takeoff_objects`)
- Tap area on plan → jump to area detail (surfaces, progress, photos)
- Hyperlinked sheets: tap detail reference → opens referenced sheet (like PlanGrid)
- Current revision indicator + revision history
- Offline: PDFs cached locally via PowerSync + Supabase Storage download
- Photos pinned to plan locations (from `field_photos` with lat/lng mapped to plan coords)

**Tab 4 — Docs**
- Work tickets (create, view, close)
- Safety documents (JHA, PTP, Toolbox Talk)
- Delivery confirmation
- Meeting notes
- Daily report generator

**Tab 5 — More**
- Delivery tracker (supervisor: 3 views)
- GPS check-in/out
- Crew management + time entries
- Settings (language, notifications)
- Profile

### Tablet Support
Track is designed mobile-first but MUST work well on iPad/Android tablets:
- Plans tab: on tablet, the PDF fills the screen — full sheet visible without zooming. On phone, user pinch-zooms.
- Production Board: on tablet, shows 2-column grid of area cards. On phone, single column list.
- Split view: on tablet landscape, Plans left + area detail right (like PlanGrid on iPad).
- Touch targets remain 48dp minimum regardless of screen size.
- Layout uses React Native `Dimensions` + `useWindowDimensions()` for responsive breakpoints.
- Breakpoints: phone (<768dp width), tablet (≥768dp width).

---

## 📐 Plan Viewer — Drawing Management in Track
> PM uploads drawings in Takeoff web. Foreman sees them in Track automatically.
> Same tables (`drawing_sets`, `drawings`, `drawing_revisions`), same rows, zero sync.

### How It Works
```
PM IN TAKEOFF WEB                          FOREMAN IN TRACK
═══════════════                            ════════════════

Uploads PDF plans to project               Plans tab shows sheet list
  → drawing_sets table                     (PowerSync syncs metadata)
  → drawings table (1 per sheet)
  → Supabase Storage (PDF files)           PDF downloaded + cached locally
                                           (works offline after first download)

Estimator draws takeoff polygons           Foreman sees polygons overlay
  → takeoff_objects table                  (read-only, colored by classification)
                                           Tap polygon → see: material, sqft, status

PM adds revision (new PDF)                 Track shows: "⚠️ New revision available"
  → drawing_revisions table                Foreman taps → downloads new version
  → old revision still accessible          Can toggle between revisions
```

### Plan Viewer UI on Phone
```
┌─────────────────────────────────────┐
│ ← Plans    A-201 Floor Plan L3   🔍 │
│ Rev 3 · Mar 25 · [Revisions ▼]     │
├─────────────────────────────────────┤
│                                     │
│    ┌──────────────────────────┐     │
│    │                          │     │
│    │    [PDF Plan View]       │     │
│    │    Pinch to zoom         │     │
│    │    Tap area for details  │     │
│    │                          │     │
│    │  ┌─────┐  ┌─────┐       │     │
│    │  │L3-E2│  │L3-E4│       │     │
│    │  │ 🟢  │  │ 🔴  │       │     │
│    │  └─────┘  └─────┘       │     │
│    │                          │     │
│    └──────────────────────────┘     │
│                                     │
│  [📷 Photo] [📌 Pin Note] [↗ Link] │
├───────┬───────┬───────┬─────┬───────┤
│ Home  │ Board │ Plans │ Docs│ More  │
└───────┴───────┴───────┴─────┴───────┘
```

### Plan Viewer UI on Tablet (Landscape Split View)
```
┌──────────────────────────────────────────────────────────────┐
│ ← Plans    A-201 Floor Plan L3                    Rev 3  🔍  │
├──────────────────────────────┬───────────────────────────────┤
│                              │ L3-E2 — Toilet 0113          │
│                              │ Status: 🟡 In Progress (83%) │
│    [Full PDF Plan View]      │                               │
│    Takeoff overlay visible   │ Phases:                       │
│                              │  ✅ Soundproof                │
│  ┌─────┐  ┌─────┐          │  ✅ Mud Float                  │
│  │L3-E2│  │L3-E4│          │  ✅ Waterproof ⛔ Verified     │
│  │ 🟢  │  │ 🔴  │ ←tapped  │  🟡 Tile Install (current)    │
│  └─────┘  └─────┘          │  🔒 Grout                     │
│                              │                               │
│  ┌─────┐  ┌─────┐          │ Surfaces:                     │
│  │L3-E6│  │L3-E8│          │  ✅ Floor (92 SF)             │
│  │ 🟡  │  │ ⬜  │          │  ✅ Wall A (200 SF)           │
│  └─────┘  └─────┘          │  🟡 Wall B (233 SF)           │
│                              │  🔴 Wall C — blocked          │
│                              │                               │
│                              │ [📷 4 photos] [18h logged]   │
├──────────────────────────────┴───────────────────────────────┤
│  Home  │  Board  │  Plans  │  Docs  │  More                  │
└──────────────────────────────────────────────────────────────┘
```

### Sheet List (entry point)
```
Plans                                    🔍 Search
─────────────────────────────────────────────────
▼ Architectural
  A-201  Floor Plan L3        Rev 3  ⚠️ new
  A-202  Floor Plan L2        Rev 3
  A-301  RCP L3               Rev 2
  A-401  Elevations           Rev 1

▼ Detail Sheets
  A-501  Bathroom Details     Rev 2
  A-502  Lobby Details        Rev 1

▼ MEP
  M-201  Mechanical L3        Rev 1
  P-201  Plumbing L3          Rev 1
```

### Hyperlinked Sheets (PlanGrid-style)
When a detail reference appears on a plan (e.g., "See A-501/3"), the foreman can:
1. Tap the reference bubble on the plan
2. Track opens sheet A-501 and scrolls to detail 3
3. Back button returns to previous sheet at same zoom level

This uses `drawing_revisions` relationships — the estimator/PM sets up hyperlinks in Takeoff web, foreman follows them in Track.

### Offline Support for Plans
- Sheet metadata syncs via PowerSync (small, fast)
- PDF files download to device storage on first view
- Downloaded indicator: "✅ Available offline" vs "☁️ Tap to download"
- Auto-download: when on WiFi, pre-download all sheets for assigned project
- Storage management: show total cached size, option to clear old revisions
- Estimator overlays (takeoff_objects) sync via PowerSync — visible offline
- Settings (language, notifications)
- Profile

---

## 🗄️ Shared Tables (from Takeoff Supabase)

### Tables Track READS (created by Takeoff/PM)

| Table | Created By | Track Reads For |
|-------|-----------|-----------------|
| `projects` | PM (web) | Project list, details |
| `drawing_sets` | PM (web) | Plan sets (multi-page PDFs) |
| `drawings` | PM (web) | Individual sheets with calibration, hyperlinks between sheets |
| `drawing_register` | PM (web) | Drawing versions, current revision per sheet |
| `drawing_revisions` | PM (web) | Revision history per drawing |
| `takeoff_objects` | Estimator (web) | Takeoff measurements overlay (read-only on plan viewer) |
| `production_areas` | PM/Estimator (web) | Area list with labels, floors |
| `production_area_objects` | PM (web) | Surface list for checkboxes |
| `production_templates` | Estimator (web) | Phase definitions |
| `production_template_phases` | Estimator (web) | Phase sequence and hours |
| `classifications` | Estimator (web) | Material info for display |
| `delivery_ticket_items` | PM (web) | Delivery details for confirmation |
| `master_production_targets` | PM Finalize (web) | Immutable production targets |
| `profiles` | Auth (shared) | User names, roles |
| `organizations` | Admin (web) | Company info, settings |

### Tables Track WRITES (field data flowing to PM)

| Table | Track Writes | PM Reads In |
|-------|-------------|-------------|
| `production_area_objects` | status, blocked_reason, completed_at, completed_by | Production Dashboard |
| `production_phase_progress` | started_at, completed_at, actual_hours, skipped | Production Dashboard |
| `work_tickets` | Full CRUD (status: 'draft') | PM Work Tickets |
| `safety_documents` | Full CRUD (JHA, PTP, Toolbox) | PM Safety Docs |
| `document_signoffs` | Signatures (digital) | PM Sign-offs |
| `delivery_ticket_items` | quantity_received, receipt_status, receipt_photos | PM Delivery Kanban |
| `material_consumption` | installed_qty (via production progress) | PM Material Matrix |
| `pm_activity_logs` | INSERT (audit trail) | PM Activity Timeline |

### Tables Track CREATES (Track-owned)

| Table | Purpose | Fase |
|-------|---------|------|
| `gps_checkins` | Check-in/out timestamps + coordinates | T1 |
| `gps_geofences` | Job site boundaries for auto check-in | T1 |
| `crew_assignments` | Which workers are assigned to which area RIGHT NOW (live state) | T1 |
| `area_time_entries` | Time log: worker × area × started_at × ended_at (historical record) | T1 |
| `daily_reports` | Auto-compiled daily summary → PM | T2 |
| `field_photos` | Progress, QC, blocked, delivery photos — linked to area + surface + phase | T1 |
| `field_messages` | Foreman ↔ supervisor notes per area | T2 |

### Time Tracking by Area (The Foreman's 2-Tap Workflow)

The foreman assigns workers to areas. Moving a worker to a new area auto-closes the previous one. No "stop" button needed — the system calculates hours automatically.

```
FOREMAN FLOW:
  7:00 AM  "Mario + Carlos → L3-E2"    (2 taps: select workers, select area)
  10:00 AM "Pedro → L3-E2"              (Pedro joins — 1 tap)
  2:00 PM  "Mario + Carlos → L3-E4"    (auto-closes L3-E2 for them: 7hrs each)
  2:00 PM  "Pedro → L3-E6"              (auto-closes L3-E2 for Pedro: 4hrs)
  5:00 PM  End of day                    (auto-closes all open entries)

RESULT (auto-calculated):
  L3-E2:  Mario 7hrs + Carlos 7hrs + Pedro 4hrs = 18 man-hours
  L3-E4:  Mario 3hrs + Carlos 3hrs = 6 man-hours
  L3-E6:  Pedro 3hrs = 3 man-hours
  DAY TOTAL: 27 man-hours across 3 areas
```

**Two tables work together:**
- `crew_assignments` = LIVE state ("who is working WHERE right now")
- `area_time_entries` = HISTORICAL log ("who worked where, from when to when")

When foreman moves a worker: system closes the `area_time_entries` row (sets `ended_at`) and creates a new one for the new area (sets `started_at`).

```sql
CREATE TABLE area_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  area_id UUID NOT NULL REFERENCES production_areas(id),
  worker_id UUID NOT NULL REFERENCES profiles(id),
  worker_role TEXT DEFAULT 'mechanic',  -- 'mechanic' | 'helper'
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,                 -- NULL = still working
  hours NUMERIC GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600.0
      ELSE NULL
    END
  ) STORED,
  assigned_by UUID REFERENCES profiles(id),  -- foreman who assigned
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Queries the system needs:
-- Total man-hours per area today:
--   SELECT area_id, SUM(hours) FROM area_time_entries WHERE date = today GROUP BY area_id
-- Worker breakdown per area:
--   SELECT worker_id, hours FROM area_time_entries WHERE area_id = ? AND date = today
-- Project total for the day:
--   SELECT SUM(hours) FROM area_time_entries WHERE project_id = ? AND date = today
```

**This feeds the Estimate Feedback Loop:** actual man-hours per area → compare to template estimate → "you bid 25 hrs for this bathroom, actual was 18 hrs."

**This feeds the Labor Cost tracking:** man-hours × daily_rate / hours_per_day = actual labor cost per area.

### Field Photos (Progress + QC + Blocked + Delivery)

Photos are the visual evidence of everything that happens in the field. Every photo is linked to a specific area, and optionally to a specific surface and phase.

```sql
CREATE TABLE field_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  area_id UUID REFERENCES production_areas(id),
  object_id UUID REFERENCES takeoff_objects(id),     -- specific surface (optional)
  phase_id UUID REFERENCES production_template_phases(id),  -- specific phase (optional)
  context_type TEXT NOT NULL,   -- 'progress' | 'qc' | 'blocked' | 'delivery' | 'safety' | 'general'
  caption TEXT,                 -- optional note
  local_uri TEXT,               -- local filesystem path (offline)
  remote_url TEXT,              -- Supabase Storage URL (after upload)
  thumbnail_url TEXT,           -- 200px width thumbnail
  latitude NUMERIC,
  longitude NUMERIC,
  taken_by UUID REFERENCES profiles(id),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT DEFAULT 'pending',  -- 'pending' | 'uploading' | 'uploaded' | 'failed'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Photo flow in the daily report:**
1. Foreman marks surface complete → camera icon appears next to checkbox
2. Tap camera → take photo → photo auto-tagged with area_id + object_id + context_type='progress'
3. Thumbnail shows next to the checkbox immediately (from local file)
4. Photo queued for upload → syncs to Supabase Storage when online
5. PM sees photo in Takeoff web: Production Dashboard → area detail → photo timeline

**Photo types and when they're taken:**
```
context_type    When                              Who sees it
────────────    ─────                             ──────────
progress        After marking surface complete    PM in Production Dashboard
qc              Quality check during/after work   PM + Quality Gate AI
blocked         When reporting a block            PM + Ready Board + NOD evidence
delivery        When confirming delivery          PM + Delivery Kanban
safety          During safety doc creation        PM + Safety module
general         Anytime (area-level, no surface)  PM in area photo gallery
```

### How Track Data Powers Takeoff Web AND Ready Board Standalone

Every write from Track feeds THREE consumers via the same Supabase rows:

```
TRACK (Foreman)          TAKEOFF WEB (PM)           READY BOARD STANDALONE (GC)
═══════════              ═══════════                 ═══════════════════════════

Marks surface complete → Ready Board card: 🟡→🟢     API webhook → GC grid updates
                         Production Dashboard          GC sees trade progress live
                         Predictive Forecast
                         Estimate Feedback

Marks surface blocked  → Ready Board card: 🔴         API webhook → GC sees block
                         Block Analysis                delay_log in GC's system
                         NOD auto-drafted              NOD appears in GC Legal Docs
                         PM alert

Marks gate phase done  → Gate: ⛔ → pending           GC Verification Queue
                         PM gets notification          GC Super gets notification
                                                       Timer: 4h/24h escalation

PM verifies gate       → Next phase unlocks            API webhook → GC sees verified

Takes QC photo         → Quality Gate AI analysis      Evidence for GC verification

Confirms delivery      → Delivery Kanban               GC knows trade has materials

Checks in (GPS)        → Crew Dashboard                GC sees who's on site
```

**Key principle:** Track writes data ONCE. Three systems consume it. The trade doesn't need the GC's app. The GC doesn't need the trade's app. API connects them.

---

## 🟢 Ready Board in Track (Mobile Design)

### Why It Can't Be a Grid on Mobile
The web Ready Board is a grid of cards (floors × areas). On a 6.7" phone, that grid doesn't work — cards would be too small to tap, and horizontal scrolling kills usability with one hand.

### Mobile Design: Vertical List Grouped by Floor

```
📋 Ready Board                 Filter: [All ▼]  🔴 5  🟡 18  🟢 3

🔍 Search areas...

▼ Floor L3                          ▓▓▓▓▓░░░░░ 45%
┌──────────────────────────────────────────────┐
│ 🟢  L3-E2   Toilet 0113     83%    Grout ⛔ │
│──────────────────────────────────────────────│
│ 🔴  L3-E4   Toilet 0114      0%    BLOCKED  │
│      ↳ Other trade                           │
│──────────────────────────────────────────────│
│ 🟡  L3-E6   Toilet 0115     45%    Tile     │
│──────────────────────────────────────────────│
│ ⬜  L3-F2   Lobby            0%    —         │
└──────────────────────────────────────────────┘

▼ Floor L2                          ▓▓▓▓▓▓▓▓░░ 72%
┌──────────────────────────────────────────────┐
│ ✅  L2-F4   Toilet 0201    100%    DONE      │
│──────────────────────────────────────────────│
│ 🔴  L2-J3   Washroom        0%    BLOCKED   │
│      ↳ No delivery                           │
└──────────────────────────────────────────────┘
```

### Component Structure
```
ReadyBoardScreen
├── StatusSummaryBar         — 🔴 5  🟡 18  🟢 3 (tappable filters)
├── SearchBar                — filter by area label
├── FilterChips              — All | Blocked | In Progress | Complete | Not Started
├── FloorSection (collapsible, one per floor)
│   ├── FloorHeader          — "Floor L3" + floor progress bar
│   └── AreaListItem[]       — one per area, swipeable
│       ├── StatusDot (left) — color circle 16dp
│       ├── AreaLabel        — "L3-E2" bold 18sp
│       ├── AreaType         — "Toilet 0113" secondary 14sp
│       ├── ProgressPct      — "83%" bold, color matches status
│       ├── CurrentPhase     — "Grout" 14sp
│       ├── GateIcon (⛔)    — if current phase is a gate
│       └── BlockedReason    — "↳ Other trade" red 14sp (only if blocked)
└── FAB                      — "Submit Report" (same as Production tab)
```

### Interactions
- **Tap area** → navigates to Area Detail (checklist screen with surfaces)
- **Tap filter chip** → filters list to that status only
- **Tap floor header** → collapse/expand floor
- **Swipe right on area** → quick-complete (mark all remaining surfaces done)
- **Swipe left on area** → quick-block (select reason)
- **Pull to refresh** → manual PowerSync sync
- **Status summary bar tappable** → tap 🔴 filters to blocked only

### Where It Lives in Navigation
Ready Board is the **first screen** in the Production tab (Tab 2). The Production tab has two views:

```
Tab 2: Production
├── Ready Board (default view) — the list above
└── Detail View (when you tap an area) — surface checkboxes
```

The foreman lands on Ready Board, sees all his areas at a glance, taps the one he's working on → goes to checklist. This is the most natural workflow: "what's my status?" → "let me update this room."

### Supervisor vs Foreman
- **Foreman:** sees areas from his 1 assigned project. No project switcher needed.
- **Supervisor:** sees project switcher at top. Each project has its own Ready Board list. Can also see "All Projects" aggregate view with areas grouped by project then floor.

---

## ⛔ Gate Tasks in Track

### What the Foreman Sees
When a phase has `is_gate = true`, the foreman sees the gate AFTER completing the gated phase:

```
Area L3-E2 — Toilet 0113

Phases:
  ✅ Soundproof
  ✅ Mud Float
  ✅ Waterproof
  ⛔ AWAITING VERIFICATION — PM must verify waterproof
     [Requested 2h ago]
  🔒 Tile Install (locked until gate clears)
  🔒 Grout (locked)
```

The foreman CANNOT tap "Tile Install" until the gate clears. The locked phases are greyed out with a lock icon. No error message — the UI makes it obvious.

### What Happens When Foreman Completes a Gated Phase
1. Foreman marks last surface in "Waterproof" phase as complete
2. System sets `verification_requested_at = now()`
3. Push notification to PM: "L3-E2 waterproof complete — verification needed"
4. 4 hours: reminder push to PM
5. 24 hours: escalation alert to supervisor + sub PM
6. All timestamps recorded as evidence
7. PM verifies in Takeoff web (or supervisor in Track) → `verified_at` + `verified_by` set
8. Next phase unlocks → foreman can now tap "Tile Install"

### Legal Significance
Every hour the gate stays unverified is documented. If the GC delays verification for 3 days, that's 3 crew-days of documented delay → auto-creates delay_cost_log → feeds NOD if pattern continues.

---

## ⚖️ Legal Documentation in Track

### What the Supervisor/Foreman Sees

When an area is blocked with reason "other_trade" or "access_denied":

```
⚠️ NOD Draft Available

L3-E4 blocked: Other trade (electrical not finished)
Since: March 20, 2026 (5 days)
Crew impact: 2 workers × $1,750/day = $17,500 lost

[📄 Review NOD]  [✍️ Sign & Send]
```

### The Flow in Track
1. Foreman marks area blocked → system auto-drafts NOD in `legal_documents` table
2. Supervisor sees "NOD Draft Available" badge in Docs tab
3. Supervisor taps "Review NOD" → sees PDF preview
4. Supervisor taps "Sign & Send" → finger signature capture
5. System adds SHA-256 hash + generates final PDF
6. PDF sent to GC email (with tracking pixel)
7. Status updates: draft → sent
8. When GC opens email: receipt logged (opened_at, IP)
9. 48h no response: alert to supervisor

### What the Foreman NEVER Sees
- NOD generation or legal documents (supervisor/sub_pm only)
- Cost calculations or delay costs
- Receipt tracking or legal status
- The foreman just reports what happened. The system handles the legal side.

---

## 🚀 Development Phases (Track)

### Dependencies on Takeoff

| Track Needs | Takeoff Creates It In | Track Can Build After |
|-------------|----------------------|----------------------|
| Auth + profiles + orgs | Already exists ✅ | NOW |
| work_tickets, safety_docs, signoffs | Already exists ✅ | NOW |
| production_areas, area_objects | Fase 7B (Sprint 1) | After Takeoff 7B |
| production_templates, phases | Fase 7B (Sprint 1) | After Takeoff 7B |
| delivery_ticket_items | Fase 9 | After Takeoff Fase 9 |
| material_consumption | Fase 9 | After Takeoff Fase 9 |

### Track Phases

| Phase | What | Depends On | Status |
|-------|------|-----------|--------|
| **T1** | Foundation + Safety + GPS | Nothing (tables exist) | ⬜ START NOW |
| **T2** | Production Reporting | Takeoff 7B (production tables) | ⬜ After 7B |
| **T3** | Delivery + Material Flow | Takeoff Fase 9 | ⬜ After Fase 9 |
| **T4** | Polish + App Store | Takeoff Fase 10 (roles) | ⬜ After Fase 10 |

### Phase T1 — Foundation + Safety + GPS (START NOW)
> No dependencies on Takeoff phases — all tables already exist.

**Foundation:**
- Expo project setup (SDK 52+, NativeWind, Zustand, Zod)
- PowerSync configuration (sync rules for shared tables)
- Supabase Auth integration (shared with Takeoff — same user login)
- i18n setup (6 locales, shared translation keys where possible)
- Navigation structure (5 bottom tabs)
- Role-based scope filter (foreman: 1 project, supervisor: all)

**GPS:**
- expo-location: foreground + background tracking
- Geofence: define job site boundary → auto check-in when entering
- GPS check-in/out: manual button + auto-detect
- GPS stamps on photos (lat/lng embedded in metadata)
- `gps_checkins` table + `gps_geofences` table

**Safety (tables already exist in Supabase):**
- JHA (Job Hazard Analysis) — create, edit, view, collect signatures
- PTP (Pre-Task Plan) — daily safety plan per crew
- Toolbox Talk — safety meeting record + attendance
- Digital signatures — in-app signing + QR code for others
- Photo capture for safety documentation
- Cert tracking — worker certifications with expiry alerts

**Work Tickets (table already exists):**
- Create work ticket (photo + note + related area)
- View/edit work tickets
- Status workflow: draft → submitted → reviewed → closed

**Crew Management:**
- `crew_assignments` table: which workers on which areas today
- Foreman view: "my crew today" → assign to areas
- Supervisor view: "all crews across projects" → assign to jobs

### Phase T2 — Production Reporting (After Takeoff 7B)
> Needs: production_areas, production_area_objects, production_templates, production_template_phases, production_phase_progress

**Daily Report (the foreman's 3-click workflow):**
- See assigned areas for today
- Per area: checkboxes for each surface (from production_area_objects)
- Tap checkbox = mark complete (sets completed_at, completed_by)
- **📷 Optional progress photo per surface** — after marking complete, camera icon appears: tap to snap photo. Photo auto-linked to that surface (area_id + object_id + timestamp + GPS). Shows as thumbnail next to the checkbox. Multiple photos per surface allowed.
- **📷 Area progress photos** — camera button at top of area detail: take general progress photo of the whole room. Tagged as context_type = 'progress'.
- Tap "Blocked" = select reason → optional note → **optional photo (evidence)** → sets blocked_reason, blocked_at
- Phase tracking: mark phases complete (from production_phase_progress)
- "Submit Report" saves all changes + photos queued for upload + creates daily_report summary

**Photo Gallery per Area (visible in Track + Takeoff web):**
- Every area accumulates photos over time: progress photos, blocked evidence, QC, delivery
- In Track: swipe through photos on area detail screen
- In Takeoff web: PM sees photo timeline per area in Production Dashboard and Ready Board detail panel
- Photos include: GPS coordinates, timestamp, who took it, which surface/phase it relates to

**Production Dashboard (in-app):**
- Foreman: progress of his areas/floors
- Supervisor: progress across all projects
- Progress bars auto-calculated from sqft
- Blocked areas highlighted in red

**Communication:**
- Notes per area (foreman ↔ supervisor)
- Photo annotations
- `field_messages` table

**Punch List (internal quality control — supervisor → foreman):**
- Supervisor walks the floor, finds defects → creates punch items with photo + location
- Each item linked to production_area + optionally to specific surface + pinned on drawing
- Foreman receives assigned items → corrects defect → takes "after" photo → marks resolved
- Supervisor verifies: approve (closes item) or reject (re-opens with reason)
- Before/after photos side by side for verification
- Items visible as red pins on the plan view
- NOT sent to GC (internal quality control only). GC deficiencies handled by Ready Board standalone.
- `punch_items` table: area_id, object_id, title, description, priority, status (open/in_progress/resolved/verified/rejected), photos[], assigned_to, created_by, coordinates (for plan pinning)

```
SUPERVISOR WALKS FLOOR 3:
  Sees grout missing in L3-E2 corner
    → Opens Track → taps L3-E2 → "Add Punch Item"
    → Takes photo 📷 → "Grout faltante esquina NE"
    → Priority: Medium → Assign to: Carlos
    → Item appears on plan as red pin 📍

FOREMAN CARLOS:
  Opens Track → sees badge "3 punch items"
    → Taps item → sees photo + description
    → Fixes the grout → takes "after" photo 📷
    → Marks "Resolved"

SUPERVISOR:
  Reviews → sees before/after photos side by side
    → Approves ✅ → item closed
    → OR Rejects ❌ + reason → re-opens for Carlos
```

### Phase T3 — Delivery + Material Flow (After Takeoff Fase 9)
> Needs: delivery_ticket_items, material_consumption

**Delivery Confirmation:**
- Push notification: "Delivery arriving for L3-E2"
- Checklist: per item — received / short / damaged
- Quantity received input
- Photo evidence (especially for short/damaged)
- One-tap "Confirm All" for complete deliveries

**Supervisor Delivery Tracker:**
- View 1: Delivery history (by date)
- View 2: Material by floor/area (target vs delivered vs installed)
- View 3: Alerts (no delivery scheduled, material running low, surplus)

### Phase T4 — Polish + App Store (After Takeoff Fase 10)
> Needs: roles system from Fase 10 for proper enforcement

- Role enforcement (worker/foreman/supervisor permissions)
- Push notification system (delivery, assignment, cert expiring)
- App Store assets (screenshots, description, privacy policy URL)
- Google Play assets
- Performance optimization (large project with 600+ areas)
- Offline stress testing (sync with 1000+ objects)
- Biometric auth (Face ID / fingerprint for signatures)

---

## 🤖 AI Agent in Track (Future — Post-Pilot)
> Full-knowledge agent with tool-calling. Lives as floating button on every screen.
> Model: Gemini 2.5 Flash (function calling + thinking). Cost: ~$0.80/user/month.
> Reference: `AI_AGENT.md` for complete architecture (29 tools, example conversations)

### How It Works in Track

```
┌─────────────────────────────────────────┐
│                                         │
│       [Any Screen]                      │
│                                         │
│                         ┌──────────┐    │
│                         │    🤖    │    │ ← Floating button
│                         └──────────┘    │    (bottom-right, above FAB)
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ AI Agent Chat                   │    │ ← Half-screen panel
│  │                                 │    │    (slides up on tap)
│  │ "What's left in this room?"     │    │
│  │                                 │    │
│  │ Agent: "3 surfaces left:        │    │
│  │  Wall C (90 SF), Saddle (4.5),  │    │
│  │  Vanity Top (13 SF). 83%."      │    │
│  │                                 │    │
│  │ [🎤 Voice] [Type here...] [→]  │    │
│  └─────────────────────────────────┘    │
│                                         │
├────────┬────────┬────────┬──────┬───────┤
│  Home  │ Board  │ Safety │ Docs │ More  │
└────────┴────────┴────────┴──────┴───────┘
```

### Two Modes

**READ (instant, no confirmation):**
```
"What's left in this room?"     → queries production_area_objects → "3 surfaces left..."
"Who's on site today?"          → queries crew_assignments → "4 workers: Carlos, Mario..."
"How many hours on Floor 3?"    → queries area_time_entries → "47.5 man-hours"
"Any pending signatures?"       → queries document_signoffs → "PTP needs 1 more signature"
```

**WRITE (confirmation card required):**
```
"Mark Wall A done"              → [✅ Mark Complete: Wall A — 200 SF TL-04] [Confirm] [Cancel]
"Block L3-E4, other trade"      → [🔴 Report Block: L3-E4 — Other trade] [Confirm] [Cancel]  
"Create ticket for cracked sub" → [📋 New Ticket: Cracked substrate — L3-E4] [Create] [Edit] [Cancel]
```

### Voice Integration (Picovoice — Offline)

The agent has TWO input methods:
1. **Type** — keyboard input in the chat panel
2. **Voice** — tap 🎤 button or say wake word "Hey NotchField"

**Offline routing (Picovoice on-device):**
Simple commands are handled locally without internet via Picovoice Rhino speech-to-intent:
- "Wall A done" → `markSurfaceComplete` (local PowerSync write)
- "Blocked other trade" → `markAreaBlocked` (local)
- "Check in" → `createCheckIn` (local)
- "What's left" → `queryStatus` (local SQLite query)

**Online routing (Gemini API):**
Complex questions route to Gemini 2.5 Flash with 29 tool declarations:
- "How are we vs the bid on labor?" → multi-tool query → formatted answer
- "Give me a weekly summary" → aggregates multiple data sources
- "Generate the NOD for L3-E4" → creates legal document → confirmation card

**Hybrid flow:**
```
User speaks → Picovoice wake word detected
  → Picovoice Rhino tries to match intent
    → If matched (4 simple commands) → execute locally (offline OK)
    → If not matched → route to Gemini API (needs internet)
      → If offline → "I'll process that when you're connected."
```

### Picovoice Technical Details

| Package | Purpose | Offline? |
|---------|---------|----------|
| `@picovoice/porcupine-react-native` | Wake word "Hey NotchField" | ✅ Yes |
| `@picovoice/rhino-react-native` | Speech-to-intent (4 commands) | ✅ Yes |

Voice context supports English + Spanish:
- "Wall A done" / "Pared A lista" → markComplete
- "Blocked other trade" / "Bloqueado otro oficio" → reportBlocked
- "Check in" / "Entrada" → checkIn
- "What's left" / "Qué falta" → queryStatus

Cost: Free tier for development (3 models). ~$0.20/user/month production.

### Scope by Role
| What | Foreman | Supervisor |
|------|---------|------------|
| Query area status | His areas | All projects |
| Query hours/crew | His areas | All projects |
| Query costs ($) | ❌ (hours only) | ❌ (hours only) |
| Mark complete/blocked | ✅ | ✅ |
| Create tickets/safety | ✅ | ✅ |
| Generate NOD | ❌ | ✅ |

### What Foreman NEVER Sees from Agent
- Dollar amounts or cost data
- Bid information
- GC-related legal document details
- Other trades' data
- AI briefings or suggestions (agent responds to questions only)

---

## 📐 Reglas Absolutas (Track)

### Architecture
- **Offline-first.** PowerSync handles sync. App MUST work without internet.
- **Same Supabase.** No separate database. No sync API between apps. Direct table access.
- **Role = Scope.** Same features for foreman and supervisor. Role filters projects, not functions.
- **Camera-native.** Always use expo-camera/expo-image-picker. No web fallbacks.
- **GPS-native.** Always use expo-location. Background tracking for geofence.

### NO Hacer
- ❌ Web views inside the app (no WebView for Takeoff features)
- ❌ Duplicate tables that exist in Takeoff (use shared tables)
- ❌ Custom sync logic (PowerSync handles it)
- ❌ Feature-gating by role (scope-gate instead: filter by project_id)
- ❌ Complex forms — keep everything 3 clicks or less for field use
- ❌ Require internet for core functions (offline-first)

---

## 🎨 UX/UI Rules — Field-First Design

> The user has dirty hands, sun on the screen, a hard hat on, and 30 seconds of patience.
> If the app isn't obvious, they go back to pen and paper. Design for the worst conditions.

### The 3-Click Rule
Every core action must complete in 3 taps or less:
```
Mark surface done:    Area list → tap area → tap checkbox           (3 taps)
Report blocked:       Area list → tap area → tap "Blocked" → reason (4 taps max, reason is 1 tap from list)
Take QC photo:        Area list → tap area → tap camera icon        (3 taps)
Confirm delivery:     Notification → tap "Confirm All"              (2 taps if everything OK)
Check in:             Open app → tap "Check In"                     (2 taps, or 0 with geofence)
```

### Touch Targets
- **Minimum 48×48dp** for all interactive elements (Apple/Google guideline is 44pt)
- **Prefer 56×56dp** for primary actions — gloved hands, wet fingers
- **Checkboxes: 64×64dp minimum** — the foreman taps these 50+ times per day
- **Spacing between targets: 12dp minimum** — prevent mis-taps
- No small text links — everything is a button or large tap target

### Visual Hierarchy (Field Conditions)
- **High contrast always** — the screen is in direct sunlight. No subtle grays or light borders.
- **Status colors must be BOLD:**
  - ✅ Complete = solid green (#22C55E) with white checkmark
  - 🔴 Blocked = solid red (#EF4444) with icon
  - 🟡 In Progress = solid amber (#F59E0B)
  - ⬜ Not Started = medium gray (#9CA3AF)
- **Progress bars: 12px height minimum** — visible at arm's length
- **Font sizes:**
  - Area labels: 18sp minimum (readable from 2 feet away)
  - Surface names: 16sp minimum
  - Secondary info (sqft, date): 14sp minimum
  - NEVER below 14sp anywhere in the app
- **Dark mode default** — reduces glare outdoors, saves battery on OLED. Light mode as option.
- **No thin fonts** — always medium (500) or bold (700) weight. Thin fonts are unreadable in sunlight.

### Navigation Patterns
- **Bottom tabs ALWAYS visible** — never hide navigation behind hamburger menus
- **Back button always available** — swipe gesture + visible back arrow
- **Current location always clear** — breadcrumb or header showing: Project > Floor > Area
- **Pull-to-refresh** on every list — the universal "update" gesture
- **No nested navigation deeper than 3 levels** — Tab → List → Detail. That's it.
- **Floating action button (FAB)** for primary action on each screen:
  - Area list: "Submit Report"
  - Safety: "New Document"
  - Work tickets: "New Ticket"

### Form Design (Field-Optimized)
- **No typing when possible** — use tap-to-select, toggles, predefined options
- **Blocked reasons: predefined list, not free text** — tap once, done
- **Photo first, text optional** — camera is faster than typing with gloves
- **Numbers: large numpad** — for quantity received (delivery), not the default keyboard
- **Auto-save on every change** — never lose data because the foreman got called away
- **No "Save" button for individual fields** — auto-save with subtle confirmation toast
- **"Submit Report" is the ONLY explicit save** — compiles everything into daily summary

### Loading & Feedback
- **Haptic feedback on every tap** — the foreman needs to FEEL that the tap registered
- **Optimistic UI** — checkbox fills immediately, syncs in background
- **Skeleton screens** — never a blank white screen while loading
- **Toast notifications: bottom of screen, 3 seconds** — "Surface marked complete" ✅
- **Offline indicator: persistent subtle bar at top** — yellow "Offline — changes will sync when connected"
- **Sync indicator: spinning icon in header** — shows when PowerSync is syncing

### Accessibility for Construction
- **One-handed operation** — all primary actions reachable with thumb on a 6.7" phone
- **Landscape support NOT required** — construction phones are always portrait, one hand holds phone
- **Volume buttons: no function** — prevent accidental actions with gloves
- **Screen timeout: 5 minutes** (longer than default) — foreman puts phone down, picks it back up
- **Keep screen awake during active work** — when on Area Detail, prevent sleep

### Component Library Standards
- Use **React Native Paper** or **Tamagui** for consistent components — NOT custom from scratch
- Every list item must have: **icon (left) + title + subtitle + status badge (right)**
- Every detail screen must have: **header with status + action buttons at bottom (sticky)**
- Cards with **rounded corners (12dp)**, **subtle shadow**, **clear tap feedback (ripple)**
- **Swipe actions on list items:** swipe right = complete, swipe left = blocked (like email apps)

### Design References (Inspirations)
- **Procore mobile** — clean construction app, good hierarchy, but too complex for field workers
- **Slack mobile** — fast navigation, clear status, great offline handling
- **Todoist** — checkbox UX, swipe actions, satisfying completion animation
- **Apple Health** — dashboard with cards, progress rings, clean data visualization
- **NOT like:** SAP, Oracle, or any enterprise app that looks like a desktop form on a phone

### Animation & Delight
- **Checkbox completion: satisfying animation** — checkmark draws in, subtle bounce, green fill
- **Progress bar: animated fill** — smooth transition when percentage changes
- **Blocked stamp: red pulse animation** — draws attention to blocked items
- **Submit report: celebration micro-animation** — confetti or checkmark burst (1 second, subtle)
- **Pull-to-refresh: construction-themed** — hard hat spinning or hammer animation (optional, brand personality)

### Dark Mode (Default)
```
Background:       #0F172A (slate-900)
Card background:  #1E293B (slate-800)
Primary text:     #F8FAFC (slate-50)
Secondary text:   #94A3B8 (slate-400)
Brand accent:     #F97316 (brand-orange)
Success:          #22C55E (green-500)
Danger:           #EF4444 (red-500)
Warning:          #F59E0B (amber-500)
Border:           #334155 (slate-700)
```

### Light Mode (Option)
```
Background:       #F8FAFC (slate-50)
Card background:  #FFFFFF
Primary text:     #0F172A (slate-900)
Secondary text:   #64748B (slate-500)
Brand accent:     #F97316 (brand-orange)
(same status colors — high contrast in both modes)
```

### PowerSync Rules
- Sync rules filter by `organization_id` (same as RLS)
- Foreman sync: only his assigned project's data
- Supervisor sync: all assigned projects
- Conflict resolution: last-write-wins (foreman's field data is authoritative)
- Sync on: app open, every 30 seconds when online, on "Submit Report"

### Photo Rules
- All photos include GPS coordinates in metadata
- Photos uploaded to Supabase Storage bucket `field-photos`
- Thumbnail generated for list views
- Original resolution preserved for QC analysis
- Offline: photos queued locally, uploaded when online

---

## 🔑 ENV Variables

```bash
# Shared (same as Takeoff)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# PowerSync
EXPO_PUBLIC_POWERSYNC_URL=

# Track-specific
EXPO_PUBLIC_GOOGLE_MAPS_KEY=     # For maps
EAS_PROJECT_ID=                   # Expo EAS
```

---

## 📄 Key Documents

| File | Purpose |
|------|---------|
| `CLAUDE_TRACK.md` | This file — Track app brain |
| `TASKS_TRACK.md` | Track development tasks |
| `PRODUCTION_TRACKING.md` | Production model shared with Takeoff |
| `MATERIAL_FLOW.md` | Material flow shared with Takeoff |
| `NOTCHFIELD_FUNCTION_ASSIGNMENT_V2.md` | 95 web + 71 Track = 166 total functions |
| `AI_AGENT.md` | AI agent architecture: 29 tools, Gemini 2.5 Flash, role-scoped, confirmation workflow |
| `WEARABLES_INTEGRATION.md` | Picovoice voice commands, Meta glasses, Apple Watch research |

---

## 🧠 Skills (Track-specific)

| # | Skill | Domain |
|---|-------|--------|
| 13 | **expo-powersync** | Offline sync, sync rules per role, conflict resolution, SQLite local queries |
| 14 | **gps-tracking** | Geofence, check-in/out, GPS stamps in photos, background location, battery optimization |
| 15 | **react-native-safety** | Digital signatures, camera patterns, photo queue, PDF viewing, push notifications, biometric |
| 24 | **field-ux-patterns** | Touch targets (64dp checkboxes), haptic feedback, swipe actions, optimistic UI, dark mode, progress bars, FAB, offline indicator, animations |

All 4 skills are created in `.claude/skills/` with implementation code and patterns.

---

## 📊 Function Count

**71 Track functions** (from NOTCHFIELD_FUNCTION_ASSIGNMENT_V2.md + 3 new material flow)

| Category | Functions | Phase |
|----------|----------|-------|
| GPS + Check-in | 6 | T1 |
| Safety (JHA, PTP, Toolbox) | 12 | T1 |
| Work Tickets | 6 | T1 |
| Digital Signatures | 4 | T1 |
| Crew Management | 5 | T1 |
| Production Reporting | 10 | T2 |
| Phase Tracking | 6 | T2 |
| Block Reporting | 4 | T2 |
| Communication | 4 | T2 |
| Delivery Confirmation | 5 | T3 |
| Delivery Tracker (supervisor) | 3 | T3 |
| Daily Reports | 3 | T2 |
| Settings + Profile | 3 | T1 |
| **TOTAL** | **71** | |

---

---

## 🔧 Build Notes & Lessons Learned

### Critical: Naming conventions (Takeoff Supabase)
- Table `profiles` NOT `users`
- Column `organization_id` NOT `org_id`
- Table `production_areas` NOT `areas`
- RLS helpers: `user_org_id()` and `user_role()` NOT `get_user_org_id()`
- Supabase project: `msmpsxalfalzinuorwlg` NOT `errxmhgqksdasxccumtz` (that's ReadyBoard)
- `production_area_objects` SF column is `total_quantity_sf` NOT `quantity_sf` (the latter does not exist)
- `production_area_objects.name` = surface position ("floor" / "wall" / "base" / "saddle") NOT a material description
- **Always verify column names via `information_schema.columns` before declaring a table in PowerSync schema** — wrong names sync as null silently and you'll chase ghosts

### Critical: EAS Build (see EAS_BUILD_GUIDE.md)
- Node 20 LTS required (Node 25 breaks metro)
- `eas.json` env block required (EAS ignores .env files)
- Auth routing: use `<Redirect>` not `router.replace()` in layouts
- PowerSync needs `@journeyapps/react-native-quick-sqlite` as explicit dep
- PowerSync sync rules: NO JOINs, NO subqueries, NO aliases in parameters
- Platform-split files (.web.tsx) for native-only modules (react-native-pdf, PowerSync, maps)

### Critical: PowerSync `.connect()` — use default WebSocket, NOT HTTP
**Never pass `{ connectionMethod: SyncStreamConnectionMethod.HTTP }` to `powerSync.connect()`.** The HTTP long-polling transport hangs silently in handshake on real devices: `currentStatus.connecting` stays `true` forever, `connected` never flips, no error propagates back, app shows "Offline" banner indefinitely. The default (WebSocket) is the supported path. Correct call: `powerSync.connect(connector).catch(...)`. Also confirm `EXPO_PUBLIC_POWERSYNC_URL` points to the actual PowerSync host (e.g. `https://69c72137a112d86b20541618.powersync.journeyapps.com`) — if it points to the web app domain, the request to the wrong host fails the same silent way.

### Critical: PowerSync Sync Rules
Working pattern (org-scoped, single table per query):
```yaml
by_org:
  parameters:
    - SELECT organization_id FROM profiles WHERE id = token_parameters.user_id
  data:
    - SELECT * FROM table WHERE organization_id = bucket.organization_id
```
Does NOT work: JOINs, subqueries in data, aliases in parameters.

### Critical: NEVER call `forceSync()` right after a `localInsert` on SERIAL-backed tables
Sprint 52 burned this: `createDraftPtp` added `forceSync()` after `localInsert` to close a zombie-draft race. Side effect — the manual flush ran in parallel with PowerSync's own debounced uploader, two concurrent `supabase.upsert()` calls hit the same row, and **Postgres evaluates `DEFAULT nextval(...)` on every upsert attempt even when ON CONFLICT redirects to UPDATE**. Every create burned one serial (PTPs came out #18, #20, #22… with odd numbers missing from the table entirely). Pattern to avoid across any table with a SERIAL column (`safety_documents.number`, `work_tickets.number`, etc.). Safe place to forceSync: right before network operations that REQUIRE the row to exist on the server (preflight in distribute). NOT after a local write in a path the auto-uploader is already about to drain.

### Critical: PM drawings live in `drawing_register`, NOT `drawings` + `drawing_sets`
Takeoff has two disjoint schemas for "drawings": Estimator-side (`drawings` + `drawing_sets` + `drawing_revisions`, for takeoff polygons) and PM-side (`drawing_register`, for PM → Drawings tab uploads). Field needs the PM side. `drawing_register.file_url` is a full public URL (bucket: `documents`), not a bucket-relative path. Track reads via `useDrawings` from drawing_register first; falls back to Supabase if PowerSync hasn't synced. The `drawing_hyperlinks` and `drawing_pins` tables still FK to `drawings.id`, so Sprint 47B features only work for drawings seeded through the Estimator side — cross-schema pins/links is a Takeoff-side follow-up.

### Critical: PowerSync status API — `dataFlow` + `registerListener` (Sprint 53A.1)
Burned a multi-day debug session because `SyncStatusBar` was reading the wrong API:
1. Property is `status.dataFlow.uploading` / `.downloading` — **NOT** `status.dataFlowStatus`. Those fields don't exist; optional chaining silently returned undefined → "active" was always falsy → state computation looked OK but…
2. Subscription API is `powerSync.registerListener({ statusChanged: (status) => {...} })` returning `() => void` unsubscribe directly — **NOT** `powerSync.statusUpdates.subscribe({ next })`. The optional chained `.subscribe?.({...})` silently no-op'd when method didn't exist → handler ran exactly ONCE on mount (capturing whatever transient state existed at the WebSocket handshake moment, typically `connecting: true`) → banner stuck on "Reconnecting…" forever even after PowerSync was fully connected.

When in doubt about PowerSync API shape: check `node_modules/@powersync/common/lib/db/crud/SyncStatus.d.ts` and `node_modules/@powersync/common/lib/client/AbstractPowerSyncDatabase.d.ts`. The DB extends `BaseObserver<PowerSyncDBListener>` — `registerListener` is the canonical observer pattern.

### Critical: Storage RLS path — `{org_id}` MUST be the FIRST folder (Sprint 53A.1)
The `field-photos` bucket policy enforces `(storage.foldername(name))[1]::uuid = profiles.organization_id`. Any upload path that doesn't have the user's `organization_id` as the first folder gets a silent 403, surfaced in the app as "Photos need internet" or "needs internet" generic errors.

Working pattern (from gc-punch-service): `${organizationId}/{kind}/...`
Bug pattern (caused all photo upload failures in Sprint 53A): `{kind}/${organizationId}/...`

When adding any new photo/file upload to `field-photos`, copy the path-building from `gc-punch-service.uploadResolutionPhoto` — it has the right shape.

### Critical: New tab folders under (tabs)/ ALWAYS need `_layout.tsx` (Sprint 53A.1)
Every tab folder in the project has its own `_layout.tsx` (typically a Stack navigator). When adding a new tab (e.g. `messages/`), creating only `index.tsx` is NOT enough — without `_layout.tsx`, expo-router auto-discovers the route but the explicit `<Tabs.Screen name="...">` config in `(tabs)/_layout.tsx` is silently bypassed:
- Tab gets auto-appended at the END of the tab bar (after explicit children)
- Icon falls back to placeholder (box with diagonal lines)
- Title gets truncated to "...messa..." style
- All `tabBarBadge`, `tabBarIcon`, `title` options ignored

No cache clear / force-quit / EAS rebuild fixes this — only adding the missing `_layout.tsx`. Verify before declaring tab "done": every folder under `(tabs)/` should have `_layout.tsx`.

### Critical: Auto sign-out when refresh_token dies (Sprint 53A.1)
`SupabaseConnector.fetchCredentials` calls `supabase.auth.getSession()` which returns the CACHED session, not a refreshed one. If the cached JWT is expired AND the refresh_token is also expired (Supabase default 30-day TTL), `refreshSession()` returns an error. Silent error swallow leaves the user stuck in "Reconnecting…" forever with no escape — auto sign-out + redirect to /login is the right behavior so they can re-auth and get a fresh refresh_token.

The fix lives in two places: (1) `supabase-connector.ts.fetchCredentials` proactively refreshes if expiring within 60s and signs out if refresh fails; (2) `_layout.tsx` AppState 'active' listener does the same on foreground.

### Critical: isSupervisor checks must use `normalizeTrackRole` (Sprint 40C cleanup)
The Sprint 40C role consolidation made `'supervisor'` the canonical role (with `'superintendent'` and `'owner'` as legacy aliases via `ROLE_ALIASES`). Three hooks/screens hardcoded `['superintendent', 'owner', 'admin', 'pm'].includes(role)` and silently locked out everyone with the canonical `'supervisor'` role. Always use `normalizeTrackRole(profile?.role) === 'supervisor'` instead. Affected files cleaned up in commit `35434db`: `useLegalDocs.ts`, `usePunchList.ts`, `docs/punch/[id].tsx`.

### Supabase Migrations Applied (Track-owned tables)
| Migration | Tables |
|-----------|--------|
| create_track_t1_tables | crew_assignments, area_time_entries, gps_checkins, gps_geofences, field_photos |
| create_track_t2_tables | daily_reports, field_messages, punch_items |
| add_legal_immutability_trigger | guard_legal_immutability() on legal_documents |
| create_worker_certifications | worker_certifications (cert tracking + expiry alerts) |
| powersync publication | `CREATE PUBLICATION powersync FOR ALL TABLES` |

### PowerSync Schema — 39 tables synced (as of Sprint 42B)
Takeoff reads: projects, organizations, profiles, units, production_areas, production_area_objects,
production_templates, production_template_phases, production_phase_progress, classifications,
drawing_sets, drawings, drawing_revisions, takeoff_objects, safety_documents, document_signoffs,
work_tickets, room_types, room_type_surfaces, phase_progress

Track-owned: crew_assignments, area_time_entries, gps_checkins, gps_geofences, field_photos,
daily_reports, field_messages, punch_items, production_block_logs, worker_certifications,
delivery_tickets, delivery_ticket_items, material_consumption

GC Platform synced: gc_punch_items (Sprint 42B — synced from Procore/GC platforms, offline-first)

### Key Sprints Applied
| Sprint | What |
|--------|------|
| 25A | room_types, room_type_surfaces, phase_progress tables + new columns |
| 25B | PhaseChecklist UI — sqft-weighted progress with bottom sheet |
| 25C | Phase-linked photos with camera icon + GPS tagging |
| 29-37 | Delivery columns (ticket_number, priority, shipped_by) + status filter |
| 34 | Pilot features: surface camera, photo gallery, sqft progress |
| Delivery Review | pending_review flow, Home alerts, Docs tab badge |
| 41G | Surface checklist 3-state (not_started → in_progress → completed), block with notes, progress propagation to area card |
| 42A | Reserved for Takeoff gc_punch_items table + Edge Functions (gc-pull-items, gc-push-resolution) |
| 42B | Track GC Punchlist UI: PowerSync schema, sync rules, permissions, list screen, detail screen, hours/notes/photos resolution workflow |
| 43A | Surface checklist real SF progress fix — PowerSync schema corrected (`total_quantity_sf`, `name`, `surface_type`); strict SF-weighted calc (1,280 SF wall weighs more than 6 SF saddle, no partial credit); `[material_code]` badge now white-on-dark for contrast; `chk_blocked_has_reason` constraint fix in `propagateAreaStatus` |
| 43B | Track Work Tickets — T&M tickets with digital GC signatures. Work Tickets list / create / edit / detail screens; PowerSync schema for work_tickets (Sprint 43A columns) + document_signatures; Send for Signature modal (email/share/WhatsApp) with last-GC memory per project; PDF generation via expo-print + sharing; status flow draft → pending_signature → signed/declined; sign URL `https://notchfield.com/sign/{token}`; offline-first |
| 45B | Work Tickets REWRITE — aligned with Takeoff Web exactly. Field names now `classification`/`regular_hours`/`overtime_hours`/`quantity` (not `class`/`reg_hrs`/`ot_hrs`/`qty`). Status enum `'pending'` not `'pending_signature'`. `signer_role` lowercase (`gc`/`pm`/...). All CRUD + signature ops switched to DIRECT Supabase (no PowerSync for signatures — battle-tested rule from Jantile Tracker). Added in-app signing route `sign/[id].tsx` (foreman hands phone to GC) with SHA-256 hash via expo-crypto. Signature upload goes to `signatures/{org_id}/{token}.png` — shared convention with Takeoff Web. Added realtime subscriptions via Supabase channels (cross-app: Web signs → Track auto-updates). Replaced SendForSignatureModal with direct `Share.share` + in-app sign flow. Zod schemas mirror Takeoff Web types. |
| 45B-F | Track Feedback Reporting — foremen/supervisors/workers report bugs / feature requests / feedback from the field. `feedback_reports` added to PowerSync schema + sync rules. `FeedbackModal` component with type selector (bug/feature/feedback), severity chips (bugs only), title/description, up to 3 screenshots (camera + gallery), auto-captured context (pathname, device, screen size, role, project). Text saves offline-first via PowerSync; screenshots upload to private `feedback-screenshots/{org_id}/{report_id}/...` bucket (require online, graceful degradation). "Report Issue" + "My Reports" entries added to More menu (universal — all roles). My Reports screen shows user's own submissions with status badges + admin responses. |
| 47B | Track Drawing Viewer — hyperlinks + pins. New PowerSync tables `drawing_hyperlinks` + `drawing_pins` (columns verified via `information_schema`, NOT the sprint doc's invented shape). Services/hooks: `pin-service.ts`, `useHyperlinks`, `usePins` — all PowerSync local-first (offline-safe reads + writes). Components: `HyperlinkOverlay` (semi-transparent blue hotspots), `PinOverlay` (colored pin markers with resolved badge), `PinDetailSheet` (bottom-sheet with photos + resolve/reopen), `AddPinSheet` (type/title/description/up to 3 photos — `drawing-pin-photos` private bucket). Viewer rewrite: `PdfViewerNative` now exposes `onPageBounds` (PDF points) + `onScaleChanged` + `onViewportSize` + `overlay` prop; `plans/[id].tsx` wires hyperlinks + pins + a sheet navigation history stack (`sheetStack`) — tap a blue hotspot → navigate to target sheet (resolves by `target_drawing_id` OR falls back to `drawings.label = target_sheet_number`); custom headerLeft pops the stack first, router.back() only when the stack is empty. **Scope decisions (documented in code):** (a) overlays visible only at fit-to-page (scale≈1) because `react-native-pdf`'s internal pinch-zoom doesn't expose a usable pan/zoom transform — overlays can't reliably track the zoomed PDF. A zoom hint appears when the user zooms in with links/pins to see. (b) Pin-add happens via FAB at page center, not long-press-on-PDF, same reason. (c) Coordinate system: position_x/y/width/height are PDF-point coords; overlays use a fit-inside-viewport scale (`Math.min(vpW/pageW, vpH/pageH)`) with letterbox offsets, so hotspots/pins track the actual rendered page rect, not the whole viewport. Permissions: all Track roles view; only foreman + supervisor can add/resolve pins (`canAddPins = role === 'foreman' \|\| role === 'supervisor'`). |
| 45B-FIX | Work Tickets bug-fix pass. **(1) `title` NOT NULL:** `createWorkTicket` now auto-generates `title = "${trade} — ${area_description}"` and also sets legacy `area` column — the Takeoff-inherited DB still has these columns marked NOT NULL. **(2) `signer_name` NOT NULL:** `createSignatureRequest` defaults `signer_name` to `'Pending'` placeholder (overwritten by the real GC name in `signTicketInApp`). **(3) Real calendar date picker:** new `src/shared/components/DatePickerModal.tsx` — zero-dep pure RN calendar grid with month navigation + quick-pick chips (Today/Yesterday/2d/3d). Replaces the chip-only date selector in Work Ticket create. **(4) GC Notes removed from create form** — GC adds notes when signing, not the foreman when drafting. **(5) Docs tab Tickets removed** — the old `useTickets` list + Work Ticket FAB option were removed from Docs; single source of truth is now `More → Work Tickets` (Sprint 45B). **(6) Signature pad only drew dots:** `SignaturePad.tsx` wrapper View had `onStartShouldSetResponder={() => true}` + `onMoveShouldSetResponder={() => true}` which **starved the WebView child of touchmove events** — the parent View stole the gesture. Fix: remove both responder handlers; add `onBegin`/`onEnd` props that the parent sign screen uses to toggle `scrollEnabled={!drawing}` on the surrounding ScrollView — that's the correct way to prevent ScrollView hijacking without killing the canvas gesture. **(7) Sign URL 404:** `SIGN_BASE_URL` changed from `notch-field-takeoff.vercel.app/sign` → `notchfield.com/en/sign` (the real deployed signing page, with locale prefix). |
| PTP | Track Foreman PTP Flow (Sprint A complement). Foreman creates Pre-Task Plans on mobile in under 3 minutes, offline-first. No new DB tables — PTPs live on existing `safety_documents` with `doc_type='ptp'` and rich JSONB `content` + `signatures`. PowerSync: added `jha_library` (read-only org-wide, 149 seeded tasks across 10 trades); extended `projects` with `emergency_*` + `safety_distribution_emails`; extended `profiles` with `sst_card_number` + `sst_expires_at` (later moved to workers in Sprint MANPOWER); extended `organizations` with `primary_trades`. New feature module `src/features/safety/ptp/` with full Zod types (`PtpContentSchema`, `PtpSignatureSchema`, snapshot pattern), services (`ptpService`, `jhaLibraryService`, `consolidate`, `distributeService` with AsyncStorage offline queue + flush worker, `buildPtpLabels`), hooks (`useJhaLibrary`, `usePtp`, `useTodaysPtp`, `usePtpDistributionFlusher`). Wizard at `/docs/safety/ptp/` with 4 internal steps (tasks → review → signatures → distribute) — all persisting to the same row so PM sees incremental progress in Takeoff web. Each child step persists to the shared DB row via PowerSync; closing & reopening resumes at the right step based on content + signatures. Components: `PtpTaskPicker` (JHA library with search + category chips, deep-copies snapshots on select), `PtpReview` (consolidated hazards/controls/PPE roll-up with friction-y remove confirm), `PtpSignatures` (foreman + crew + walk-in modal; GPS captured only on foreman sign), `PtpDistribute` (multi-recipient picker pre-populated from `projects.safety_distribution_emails`, OSHA citations toggle). Distribution calls Takeoff's existing `/api/pm/safety-documents/[id]/distribute` endpoint (single PDF codepath + SHA-256 + email + audit log in one transaction); offline failures queue to AsyncStorage and retry every 60 s + on app foreground. |
| PTP-UX | Track PTP UX polish + legacy cleanup. **(1) Morning PTP card on Home** — `useTodaysPtp` hook finds today's PTP for this foreman on this project (date match on `content.ptp_date`, refreshes on focus), surfaces a 3-state card right after Quick Actions: orange CTA when no PTP today, amber "Resume" when draft, green "Distributed · HH:MM · N signatures" when sent. 1-tap entry from the app's first screen. **(2) Docs tab surfaced as "Safety"** — the docs route was previously hidden (`tabBarButton: () => null`), burying PTP 4 taps deep. Unhidden with a shield-checkmark icon and positioned between Tickets and Delivery per foreman feedback. Still 6 tabs. Net: PTP is 1 tap from Home (card) OR 2 taps via bottom tab. **(3) Dead code cleanup** — removed the legacy PTP branch from `SafetyForm.tsx` (state, handleSave case, JSX, `updateTask` helper) and `PtpTask`/`PtpContent` from `src/features/safety/types/schemas.ts`. The union in `SafetyDocFormData` is now `JhaContent \| ToolboxContent`. `docType` prop narrowed to `Exclude<DocType, 'ptp'>` so the form refuses PTP at the type level. Deep links with `?type=ptp` now redirect (Redirect + useEffect) to `/docs/safety/ptp/new`. **(4) Detail view upgrade** (`safety/[id].tsx`) — split PTP render into `PtpDetailBody` that auto-detects shape via `Array.isArray(content.selected_tasks)`. New-shape PTPs render date/shift/trade/area/foreman, per-task hazards/controls/PPE chips, emergency snapshot, additional_notes. Legacy-shape PTPs keep the old render for any historical rows. Signatures list normalizes `signer_name` vs `worker_name` and adds FOREMAN / WALK-IN role chips + SST card number when present. |
| MANPOWER | Track crew migration from profiles to workers (Sprint A complement). **Hotfix:** Takeoff commit `5842411` DROPPED `profiles.sst_card_number` + `profiles.sst_expires_at`. Track's PtpSignatures was reading them live → production broken on fresh deploy. Killed both offending SELECTs (`localQuery` + `supabase.from('profiles').select('...sst_card_number')`), removed `sst_*` from `profiles` PowerSync declaration. **Two-tier model** integrated: `profiles` = software users (login, role, locale); `workers` = field HR (trade, rates, certs, ICE, photo). Foremen link profile → worker via `workers.profile_id`. Walk-ins have `profile_id` NULL. **PowerSync:** declared `workers` (34 cols) + `project_workers` (M:N with active flag); sync rules: workers org-wide, project_workers filtered to `active=true`. **New feature module** `src/features/workers/`: `types` (Worker + ProjectWorker Zod + `workerFullName`), `utils/certStatus` (classifyCertStatus valid/expiring/expired/missing + `daysUntilExpiry` + color/label maps — ported from Takeoff's workerService), `services/workerService` (`getWorkerByProfileId`, `getWorkerById`, `getProjectWorkers` via two localQuery + JS join, `createWalkInWorker` with PowerSync localInsert), `hooks/useMyWorker` (resolves current user's workers row, exposes `needsOnboarding` when no match), `hooks/useProjectWorkers`, `components/OnboardingBlocker` (PM-action screen "You're not in Manpower yet"). **PTP rewire:** crew list now pulls from `project_workers` JOIN `workers` (NOT profiles); each candidate carries `sst_card_number` + `sst_expires_at` live from workers. Signatures snapshot SST at tap-sign time; `signature.worker_id` references `workers.id` (not profiles.id). Cert badges inline — amber EXPIRING 28d / red EXPIRED 5d ago with days remaining. Confirm dialog before signing if SST expiring/expired — not a hard block (foreman can proceed in emergencies). Walk-in modal now INSERTs real `workers` row (trade_level `'other'`, profile_id NULL, optional SST). Onboarding blocker on both `/ptp/new` + `/ptp/[id]` prevents orphan drafts when foreman not seeded in Manpower. `content.foreman_id` now stores `workers.id` for consistency. **FK note:** `crew_assignments.worker_id` and `area_time_entries.worker_id` still reference `profiles.id` in DB. Daily area assignment (crew-store.ts) still writes profile_id there. Changing those FKs is Takeoff-side work and will land in a follow-up. |
| TOOLBOX | Track Weekly Toolbox Talks (Takeoff Sprint 50A/50B complement). Mirrors PTP's pattern with a library-sourced topic instead of task selection. **Critical enum hotfix** discovered during this sprint: the `safety_documents` DB CHECK constraint is `doc_type IN ('jha','ptp','toolbox','sign_off')` (NOT `'toolbox_talk'`) and `status IN ('draft','active','completed')` (NOT `'distributed'`). PTP was writing both invalid values — PowerSync localInsert succeeded (SQLite has no CHECK) but sync to Supabase would fail silently. Fixed: DocType enum corrected, `SafetyDocument.status` narrowed, `distributeService` now stamps `content.distribution = { distributed_at, distributed_to, pdf_sha256, emails_sent }` and flips status to `'active'` (valid enum) — UI detects "sent" via `content.distribution.distributed_at`, not the status column. All legacy `'toolbox_talk'` refs renamed to `'toolbox'`. **PowerSync:** declared `toolbox_library` (22 cols, 3-tier global/org/project) + `toolbox_schedule_overrides` (PM weekly override). Sync rules: by_org picks up org+project topics + overrides; new `toolbox_global` bucket keyed on user_id syncs `organization_id IS NULL` topics to every authenticated user (constant-filter data query). **New feature module** `src/features/safety/toolbox/`: types (`ToolboxLibraryTopic`, `ToolboxTopicSnapshot` with `snapshotOf()` deep-copy, `ToolboxScheduleOverride`, `ToolboxContentSchema` with `scheduled_date`/`delivered_date`/`delivered_language`/`photo_urls`/`discussion_notes`/`distribution`), scheduler engine (pure function: override short-circuit → 8-week rotation → score trade+100 / universal+50 / other+20 / PTP-tag+50 / season+20 / decay×2 cap 100 / never-delivered+30 → sort + tie-break by id → `weekStartDate()` for ISO Monday), service (`getToolboxLibrary` global+org offline-first, `getRecentDeliveries` derives from safety_documents rows, `getWeeklyOverride`, `getRecentPtpTags` pulls hazard names from recent PTPs, `getThisWeeksDelivery` already-delivered check, `createDraftToolbox`), `buildToolboxLabels` for PDF endpoint. Hooks: `useThisWeeksToolbox` (one-shot scheduler + delivered state, refetches on focus), `useToolbox` (single-doc load/mutate mirroring usePtp). **Screens** at `/docs/safety/toolbox/`: `new.tsx` runs scheduler, shows suggested topic + "Why this week" reasons, Change topic picker with alternatives, already-delivered banner, empty-library fallback, OnboardingBlocker gate; `[id].tsx` 3-step wizard (Present → Sign → Send) with step indicator, resumes on right step based on photo_urls/signature count/distribution. Components: `ToolboxPresent` (EN/ES toggle tracks if user switched → saves `delivered_language='both'`, photo camera+gallery → `toolbox-photos` bucket), `ToolboxTopicPicker` (bottom-sheet alternatives list), `ToolboxDistribute` (multi-recipient + OSHA toggle + field-notes textarea; reuses `distributeSafetyDoc` — alias of `distributePtp` since the endpoint is doc_type-agnostic), `WeeklyToolboxCard` on Home alongside MorningPtpCard with 3 states (green CTA / amber resume / green delivered). **Signatures reuse:** `PtpSignatures` mounted as-is in toolbox wizard Step 2 (same signer logic, same SST snapshot, same walk-in INSERT). **Legacy cleanup:** `SafetyForm` now JHA-only (LegacyDocType narrowed); removed ToolboxContent Zod + toolbox JSX branch; `safety/[id].tsx` has `ToolboxDetailBody` with auto-detect shape (`topic_snapshot` present = new wizard, fallback to legacy topic/discussion_points). **Caveat:** `toolbox_library` production table is currently empty — PM must seed topics via Takeoff web before Track can schedule a talk; the empty-library fallback handles it gracefully. |
| 52 | **Pilot polish + Zoho email pipeline verification** (2026-04-21, Jantile). 13 commits across email contract alignment, PDF renderer parity, and a batch of UX/data bugs the field test surfaced. **Email migration:** Web migrated Resend → Zoho SMTP via a central `sendEmail()`. Architecturally Track didn't need to change (distribute POSTs to Web's `/api/pm/safety-documents/[id]/distribute` which owns the email send), but 4 cascading bugs surfaced once the new pipeline was live: (a) Web's dual-auth route built a cookie-based Supabase client and ignored the Bearer JWT Track sent → RLS saw `auth.uid()=NULL` → lookup returned 0 rows → 404 "not_found" (fixed Web-side, commit `4a84abf`). (b) PDF crashed on null fields (`jsPDF.text` with `undefined`) — Web added defensive coercion (`3c094a0`). (c) `labels.shiftValues[content.shift]` crashed because Track sent `shift_label` as a pre-resolved string instead of an object map — Web added graceful fallback (`3b0dfd0`). (d) `labels.taskDescription` count injection — Web now strips trailing `(N)` and derives counts from `content.selected_tasks.length` (`274ef6b`). **Track-side aligned the PtpPdfLabels contract** (commit `9511973`) to Web's canonical shape copied verbatim from `ptpPdfRenderer.ts:47-107` — 43 fields including the `shiftValues: { day, night, weekend }` object map, camelCase throughout. Builder signature simplified to `buildPtpLabels({ oshaCitationsIncluded })` since every other field is a pure string template (server reads values from the DB row). Added `category` + `source` label keys (commit `7b859b2`) the Toolbox renderer expects. **Customer letterhead:** new `features/organizations/` module (`useOrganization` hook reads `organizations.logo_url` + `.name` offline-first via PowerSync; `OrgLetterhead` component: logo LEFT + doc type CENTER + status RIGHT + orange accent rule). Mounted on PTP/Toolbox/Work Ticket detail screens. Track's local PDF export (`safety-export.ts`) fully rewritten (commit `4ff2ac0`): 3-column HTML header, single `--font` (removed monospace Courier from the hash line), new-shape PTP body (reads `content.selected_tasks` + derives crew from `signatures[]` where `is_foreman=false`), new-shape Toolbox body (reads `content.topic_snapshot.*`), `worker_name ?? signer_name ?? 'Unknown'` signature fallback, role chips (Foreman/Walk-in/Crew), HTML-escape throughout. Caller fixed: was passing `activeProject.organization_id` (UUID!) into the `orgName` slot — that's why PDFs showed UUID as "Company". Now uses resolved `{ name, logo_url }` from the hook. **Pilot feedback applied** (commits `c98ec71`, `de366f6`, `d3d1a66`, `e5cd5f8`): crew/attendance tables removed (redundant with Signatures — that IS the attendance record, saved as feedback memory `feedback_signatures_are_attendance.md`); all dates MM/DD/YYYY US format (no ISO, no long-form "April 21, 2026" — saved as project memory `project_jantile_pdf_format.md`); `JhaHazardItem.osha_ref` relaxed to `.nullable().optional()` (2 marble tasks "Fill crack with injection epoxy" + "Install bookmatched stone panels" were silently dropped because some hazards had `osha_ref: null` referencing cross-task hazards); `organizations.primary_trades` now authoritative for PTP trade picker (Jantile shows only tile+marble instead of all 10 — saved as project memory `project_primary_trades_authoritative.md`); dev-time debug `console.warn` in `getPtpById` + `appendSignature` removed (they fired on every PTP action, drowning real warnings). **SERIAL burn bug**: Commit `a70cd15` added `forceSync()` to `createDraftPtp`/`createDraftToolbox` to close the race where Distribute fired before the draft uploaded (Bug A). Trade-off was worse: manual forceSync raced with PowerSync's own debounced uploader → two concurrent `.upsert()` calls → Postgres evaluates `DEFAULT nextval()` on every upsert attempt even when ON CONFLICT redirects to UPDATE → burned one serial per create (#18, #20, #22, #24... with 19/21/23 vanishing from the table). Fixed `e5cd5f8` by removing forceSync from create paths; distribute preflight + `flushDistributionQueue` top-of-loop keep the draft-exists guarantee without racing the uploader. Also `flushDistributionQueue` now only re-queues `wasNetworkError` failures + caps at `MAX_ATTEMPTS=20` (commit `edae6ef`), so pre-guard zombie drafts (404 forever) finally drop out of the queue. **Plans rewire** (commit `f085f42`): Takeoff PM uploads drawings to the `drawing_register` table (PM-side), not `drawings` + `drawing_sets` (Estimator-side, for takeoff polygons). Track was reading the wrong side; Jantile's 9 bathroom sheets were invisible. Declared `drawing_register` in PowerSync schema (19 cols verified against `information_schema`), added sync rule, rewrote `useDrawings` to query it with Supabase fallback. `drawing-service.downloadAndCachePdf` now handles both full URLs (drawing_register.file_url points to public bucket `documents`) and storage paths (legacy drawings bucket). Discipline comes native from the row (no more prefix inference). **PDF viewer tuning** (commit `ba0b658`): `fitPolicy={0}` fit-width → ~2× more horizontal pixels at base; `enableAntialiasing`; `minScale=1`/`maxScale=5` caps pinch beyond the re-render ceiling; explicit `scale={1}`. Reduces blur-on-zoom window but doesn't eliminate it — bitmap-based rasterizer is inherent to `react-native-pdf`. **Deferred P1** (documented in TASKS_TRACK.md): switch Plans viewer to PDF.js in WebView for vector re-render on zoom — ~6-8h core + 2-3h pin/hyperlink overlay parity, blocked on pilot confirming priority. **Also:** PtpTaskPicker horizontal chips row had no vertical constraint — RN ScrollView defaults to `flex:1` even in horizontal mode and ate half the screen. Fixed with `flexGrow:0` + `maxHeight:52`. **Handoff to Web**: [TAKEOFF_PDF_ALIGNMENT.md](TAKEOFF_PDF_ALIGNMENT.md) documents the current visual target + 17 remaining gaps on the Web renderer (header "PRE-TASK PLAN (PTP)" → "PRE-TASK PLAN", uppercase info labels → Title Case, OSHA Reference truncated footnote to remove, PPE bullets → pill chips, "WORKER ACKNOWLEDGMENT" → "SIGNATURES", boxed signature cards → flat underline, UTC → local timezone, per-page footer → single, truncated 16-char hash → full 64-char, status DRAFT → ACTIVE race in the distribute endpoint). Web team commit `3b0dfd0` + `274ef6b` partially covered the counts + null guards; rest is their next sprint. **Client sign-off:** "luce increíble" on the Track local export — pilot greenlit a preview APK build for field testing. |
| 69 | **Notifications Hub — Phase 1 UI + mocks** (2026-04-26). Cross-app inbox (PM signs PTP → foreman gets notified, etc.). Track Phase 1: built UI in parallel while Web shipped DB + recipient resolver. **PowerSync:** `notifications` TableV2 (15 cols) + `by_user` bucket query. **Web API client** (`notifyApiClient.ts`): `notifyViaWeb` (POST `/api/notifications/notify`) + `notifyAndForget` fire-and-forget wrapper + `markNotificationRead` (PUT `/{id}/read`). Bearer JWT auto-resolved per call from Supabase session — same pattern as legal/safety distribute. **Event registry** (`eventRegistry.ts`): copied verbatim from Web's spec, 13 NotificationEventType union (later extended to 15 in Sprint 71 Phase 2). **Lucide → Ionicons mapper** (`iconMapper.ts`): Web's `icon` column uses lucide names ('shield-check', 'gavel', 'alert-octagon'); Track maps to Ionicons + MCI without adding lucide-react-native native dep. 4 lucide names fall back to MCI (gavel, alert-octagon, id-card, pen-tool); rest use Ionicons. Unknown lucide name → `notifications-outline` fallback (never crashes). **Hook** `useNotifications` reads from PowerSync local with realtime + focus refresh. `USE_MOCK_NOTIFICATIONS = true` flag surfaces 5 mock rows (block_alert_72h, ptp_distributed, sst_expiring_30d, gate_verification_requested, nod_sent) for UI dev; flip to false when Web confirms backend ready. **UI** (commit `f36beb1`): `NotificationBell` (40dp circle in Home header next to ProjectNotesIcon, red badge with unread count), `NotificationItem` (severity-tinted bg + 1-line body + relative time + unread orange dot), `NotificationsScreen` (grouped Today/Yesterday/This week/Older with pull-to-refresh, route `/(tabs)/notifications` hidden tab via `href: null` + dedicated `_layout.tsx`). **Triggers wired Track-side:** `ptp_signed_to_pm` in `PtpSignatures.captureSignature` after foreman signature succeeds (crew sigs don't trigger); `gate_verification_requested` in `production-store.completePhase` when the completed phase has `requires_inspection: true` on its template. **Read-state UX evolution:** initial impl just dimmed read rows → pilot feedback "they don't disappear" (commit `cb08869`) → filtered them out. Then bell badge stayed stuck (commit `258cac5`) → root cause: bell + screen each called `useNotifications()` independently with their own per-component optimistic state, so the bell didn't see the screen's local mark-read. Fix: **shared Zustand store** `localReadStore.ts` with a `Set<string>` of optimistically-read ids; both surfaces subscribe via selector → tap row → `markLocalRead(id)` → bell unreadCount and screen displayList both filter against the same set in the same render tick. Same pattern reused in Sprint 70 todos. **Phase 2 add-on (Sprint 71):** added 2 new notification types `deficiency_critical` + `deficiency_resolved` to eventRegistry; rewired `NotificationsScreen.onPressItem` from dead-end "mark read only" to entity-based deep-link routing (`entity_type='deficiency'` → `/(tabs)/board/deficiency/<id>`, also handles safety_document + production_area). |
| 70 | **Todos Hub — Phase 1 → Live + 4 auto-complete triggers** (2026-04-26). Cross-app per-user action queue. Web shipped backend (commit `bfdee08`) — DB table + RLS + 4 mutation endpoints + cron jobs + auto-completion engine — same day Track shipped Phase 1 UI; flipped mocks → live in <8h roundtrip. **PowerSync:** `todos` TableV2 + `by_user` bucket query `WHERE owner_profile_id = bucket.user_id AND status != 'done' AND status != 'dismissed'` (chained `!=` because PowerSync's validator rejects `IN(...)` lists — saved as memory `feedback_powersync_no_in_lists.md`; first encounter was right here). Excluding done/dismissed keeps the local payload bounded. **17 canonical types in `todoRegistry.ts`:** 8 PM (rfi_response_due, submittal_review_due, co_approval_due, gate_verification_due, block_resolution_due, ptp_distribute_due, punch_item_due, bid_response_due), 5 foreman (ptp_sign_today, crew_assign_today, surface_progress_stale, block_unresolved_self, daily_report_submit), 4 supervisor (sst_expiring_crew, block_escalation_4h, worker_intake_pending, foreman_missed_report), 1 manual. Renamed mock `foreman_missed_daily_report` → `foreman_missed_report` to match Web's verbatim union; DB CHECK constraint enforces the rename. Sprint 71 Phase 2 added 2 more types (`deficiency_resolution_due`, `deficiency_verification_due`). **API client** (`todoApiClient.ts`): `markDoneAndForget` / `snoozeAndForget` / `dismissAndForget` / `createManualTodoViaWeb` + Sprint 71 Phase 2 added `autoCompleteAndForget(entity, type?)` calling Web's generic `/api/todos/auto-complete`. **Hook** `useTodos` PowerSync local-first with realtime + focus refresh; `USE_MOCK_TODOS` flag. **Optimistic store** `optimisticStore.ts` mirrors the localReadStore pattern from Sprint 69 — pendingDone/Snooze/Dismiss Sets shared across Today screen + header badge so 5s undo + tap-to-snooze re-render together. **UI:** Today screen (priority chips, action sheet with Open/Snooze 1h/EOD/Tomorrow/Dismiss, undo toast 5s with Gmail-style multi-tap flush, manual create modal), TodayHeaderIcon next to NotificationBell with two-tier badge (red for critical, orange for normal/high). Hidden tab via `href:null` + `_layout.tsx`. No swipe gestures — project doesn't bundle `react-native-gesture-handler`; tap+sheet covers same actions, no native rebuild. **4 auto-complete triggers wired Track-side** (commit `a729e8f`): foreman signs PTP → `PtpSignatures.captureSignature` fires `ptp_sign_today` complete (in addition to Sprint 69's notification); foreman marks surface complete → `SurfaceChecklist.handleStatusChange` when `next === 'completed'` fires `surface_progress_stale` complete on `production_area_objects/<surfaceId>`; foreman submits daily report → `report-service.submitReport` after status flips fires `daily_report_submit` on `daily_report/<reportId>`; foreman assigns crew → `crew-store.assignWorker` after first successful insert fires `crew_assign_today` on `project/<projectId>` (one project-scoped todo per cron, not per-area, per Web's matching logic). **Production env migration** (during this sprint): created Prod PowerSync env, deployed sync rules to Prod, updated production EAS profile to point to Prod URL (`69c721378fa42c16d7f5dd25` vs Dev `69c72137a112d86b20541618`). Saved 2 memories: `feedback_powersync_new_env_checklist.md` (Connect DB + Deploy Sync Rules is NOT enough — also configure Client Auth, otherwise every client connection silently rejects → Track Board/Plans empty + offline banner sustained — burned half a TestFlight session figuring this out); `feedback_powersync_dev_then_prod_workflow.md` ("1 commit YAML = 2 deploys", deploy Dev first then Prod, can't auto-promote on free tier — Sprint 71 deployed Prod first, forgot Dev, chased ghosts for 30 min). **First iOS build + TestFlight** also happened mid-sprint: BUILD 1 + 2 (`eas build --platform ios --profile production` → `eas submit --latest` → External Testing review queue). Build 2 went live for Jantile pilot before Sprint 71 features merged; Build 3+ planned for post-pilot to add deficiencies. |
| CALCULATOR | **Smart construction calculator — single tool, 17 helpers, both repos** (2026-04-29). New universal feature for tile/marble field math: a single mixed-unit expression parser + 17 helpers (geometry, materials, time). Lives at `/(tabs)/more/calculator` for everyone (no permission gate) plus a floating FAB on the Plans tab (left side, scope per pilot — only visible there). Sister sprint `SPRINT_TAKEOFF_CALCULATOR.md` ports the same feature to Takeoff Web (header icon between NotificationBell + Settings, modal overlay with `Cmd+Shift+C` shortcut, available from any page). **Pure-TS module** `src/features/calculator/`: `types/{units,schemas,materials}.ts` + `utils/{tokenize,parse,format,coverage}.ts` are zero-RN-imports so they cross-sync byte-identical to Takeoff (`cp -r utils/* types/* ../Notchfield-Takeoff/.../calculator/`). Documented sync rule in both sprint docs. **Parser** (recursive-descent in `parse.ts`): internal storage in mm (lengths) / m² (areas) / m³ (volumes), tagged-union Value type. Supports compound length: `5'3 1/4"`, `5'3 1/4` (implicit trailing inches after ft), `10 1/2"` (NUMBER FRACTION UNIT), `10" 1/2` (bare FRACTION continuation after in), `1/4"`, mixed-unit `5'3" + 250mm`, type promotion `length × length → area`, `length × area → volume`, `length / length → scalar` (ratio), unary minus, parens. Tokenizer (`tokenize.ts`) special-cases dash-after-unit as separator (`5'-3"` is NOT subtraction) and slash-between-digits as fraction (`1/2` vs `1 / 2`). **Two parser bugs caught during pilot review**: (1) original parser only handled implicit-fraction-after-feet, broke on `10" 1/2 - 3" 9/16`; fixed by extracting compound-continuation into `continueCompound()` helper that accepts bare FRACTION after either ft OR in. (2) added `NUMBER FRACTION UNIT` initial-pattern path so `10 1/2"` (the most common notation) works. **Display**: 5-line multi-unit output (imperial fractional snap → decimal in → m → cm → mm) — each row tap-to-copy with toast confirmation. Precision toggle 1/2 → 1/32 (snap-to-fraction logic with carry handling + GCD reduction). **Keypad**: 64dp digit grid + ' " unit shortcuts on the right + secondary metric row (mm cm m, 40dp) + quick fractions row (`1/4 1/2 3/4 1/8 a/b▾`). Original v1 only had `1/2 1/4 1/8 1/16 1/32` (numerator-1 only); pilot pointed out that 3/8, 5/16, 9/16, etc are way more common on plans. New `FractionPicker` modal organizes all 31 common fractions by denominator family (Halves / Quarters / Eighths / Sixteenths / Thirty-seconds). **17 helpers** (Tier 1 + 1.5): geometry — Area (rect/triangle/circle), Volume, Linear feet (6 sides), Slope/pitch, Pythagorean diagonal, Converter; tile-related materials — Tile order, Grout (sanded/unsanded/epoxy chips), Thinset (standard/modified/epoxy + trowel notch lookup table), Stair tile; substrate/membrane materials — Sealer, Self-leveler, Backer board (3'×5' / 4'×8'), Caulk for movement joints, Shower pan slope, Uncoupling membrane; time — Hours between (decimal hours from start/end + break minutes). Long helpers use 2-col paired layout (tile_w + tile_l together, joint_w + joint_d together, bag_size + waste% together) to fit in viewport without scrolling. **HelperDoneButton** at end of every helper — copies primary result to clipboard with check-icon confirmation (`📋 1 bags` → tap → `✓ Copied`); gives users the "I'm done" action moment they expect from traditional calcs while preserving the live reactive update model (no real Calculate button needed since useMemo recalcs on every input change). **Grout formula calibration vs Laticrete** (pilot critical fix): initially had a 5× field-factor based on Mapei chart comparison — wrong. Pulled actual Laticrete coverage tables (PermaColor Select sanded, SpectraLOCK Pro Premium epoxy) from the official PDF; my pure-geometry formula `144 × (W+L) × Jw × Jd / (W×L)` matches Laticrete published numbers within 1-2% when density is calibrated correctly. Updated densities: sanded 100 lb/cuft (was 110), unsanded 95, epoxy 105. Default joint depth changed 1/4" → 3/8" (industry standard / matches typical 12"+ tile thickness / matches Laticrete chart assumption). For Mapei/Custom users (3-5× more conservative than Laticrete) the user can bump waste % to compensate — manufacturer-selector toggle deferred until pilot asks. **History**: AsyncStorage-backed last 10 calcs (`useHistory.ts`), persisted across app restarts, tap to reload, long-press to delete. **Web differences**: Web uses `localStorage` instead of AsyncStorage; uses `next-intl` (capitalized `Calculator` namespace) instead of `i18next` (lowercase `calculator`); has Cmd/Ctrl+Shift+C global shortcut + Esc-to-close + click-outside-to-close on the modal; modal sized `max-w-xl` (576px) + `maxHeight: min(900px, 94vh)` so it auto-shrinks to content (Grout helper ~600px, full keypad ~770px). **i18n**: full namespace × 6 locales (EN/ES/FR/PT/IT/DE) with mirrored shape across both repos: 9 top-level keys + 5 nested groups (units, helpers, fields, grout_types, thinset_types, shapes) + fractions_title. **Integration scope**: foreman role universal (no `feature` gate, no `supervisorOnly`). Plans tab FAB at `bottom: siblings.length > 0 ? 74 : 24`, left side opposite the right-side Pin FAB; uses `Modal` not router push so user keeps their place on the plan. **No backend changes**: zero PowerSync schema, zero migrations, zero API endpoints, zero new packages — pure client feature using existing zustand + AsyncStorage + expo-haptics + NativeWind stack. Sprint docs: `SPRINT_TRACK_CALCULATOR.md` + `SPRINT_TAKEOFF_CALCULATOR.md`. |
| 71 | **Deficiencies (unified Punch List / QC) — Phase 1 + Phase 2 + Compliance v2 + chat bubble** (2026-04-27). Web team replaced internal `punch_items` system with a unified `deficiencies` table covering internal QC, GC inspections, punch list, and warranty callbacks. Track shipped end-to-end for both foreman + supervisor flows in a single sprint with 7 commits. **Phase 1 — foundation** (commit `00c2b36`, +2941 lines, 17 files): `deficiencies` (30-col TableV2) + `deficiency_library` (11-col TableV2) added to PowerSync schema; sync rules in `by_org` bucket (status filter `!= 'closed'` to bound payload) + new `deficiency_library_global` bucket for the ~40-template global library (`organization_id IS NULL`, same constant-marker trick as `toolbox_global` since PowerSync requires every bucket-param data query to reference a bucket param). Types verbatim from Web's `src/features/pm/types.ts` — 4 enum unions (DeficiencyStage, DeficiencySeverity, DeficiencyResponsibility, DeficiencyStatus). API client (`deficiencyApiClient.ts`): create / resolve / verify / reject + fire-and-forget wrappers. Photo upload helper (`deficiencyPhotos.ts`) mirrors `gc-punch-service.uploadResolutionPhoto` exactly — path `{organizationId}/deficiencies/{deficiencyOrTempId}/{ts}.{ext}` with org_id as first folder per the Sprint 53A.1 RLS lesson. Pre-create uploads use `tempDeficiencyId()` (`pending-<uuid>`) since the row doesn't exist yet; URLs are passed to `/api/deficiencies/create` which stores in `photos[]` jsonb verbatim. Hooks: `useDeficiencyLibrary` (org + global merged, dedup, grouped by trade) + `useAreaDeficiencies` (one-area scoped, severity-sorted, realtime). UI: `DeficiencyLibraryPicker` bottom sheet with search + skip-to-manual escape, `ReportDeficiencyModal` single-screen form (template + title + description + severity chips + responsibility chips + photos staging up to 4), `DeficiencyListItem` (severity bar + status pill + meta + first-photo thumb), `DeficiencyDetailScreen` (full detail + before/after photo galleries + rejection-reason banner + Mark-as-Resolved flow with required ≥1 after-photo enforced client-side AND server-side per spec §8 auto-blindaje), `AreaDeficienciesSection` mounts in AreaDetail via new `renderDeficiencies` slot. Route `/(tabs)/board/deficiency/[id]` + `_layout.tsx`. **Phase 2 — Web wiring + Track UX**: Web shipped notify + todo cascade in all 4 endpoints + 2 new notification types (`deficiency_critical`, `deficiency_resolved`) + 2 new todo types (`deficiency_resolution_due`, `deficiency_verification_due`) + auto-completion engine that fans verify→close-all-PMs and rejects re-create fresh `resolution_due` with title prefix "Fix again:". Surface_id picker added to `ReportDeficiencyModal` via new `useAreaSurfaces` hook (reads `production_area_objects` filtered by area_id). Verify + Reject UI with reason modal added to `DeficiencyDetailScreen` for supervisors (role-gated via `normalizeTrackRole`). New types added to Sprint 69 `eventRegistry` + Sprint 70 `todoRegistry`; iconMapper got `wrench` (foreman action) + `clipboard-check` (PM action). **Compliance v2** (commit `5171bb7`): refactored single-tab "To Verify" into 3 sub-tabs (Open / To Verify / Verified) per pilot feedback that supervisors needed full org-wide context; new generic `useOrgDeficiencies({ statuses, sort, limit })` replaces single-purpose `usePendingVerifications`; selection mode with checkboxes + bottom-fixed "Export N to GC" CTA wired to placeholder Alert (Web shipped the export endpoint but contract not yet handed off — placeholder ready to wire). Empty states tailored per tab. NotificationsScreen tap routing rewired to deep-link via `entity_type+entity_id` (was a dead end before — only marked read, no navigation): deficiency / safety_document / production_area routes wired; other entity_types fall through gracefully. **Internal punch_items deprecation** (commits `9e4dce2`, `712d3da`, `132543c`): Web dropped `public.punch_items` from Supabase. Removed sync rule line (kept TableV2 declaration in `schema.ts` so legacy code paths returning `[]` from `useDrawingPunchItems`, `usePunchList`, etc. don't crash with "no such table"). Removed More menu entry. Plans viewer 5 surfaces gated behind `SHOW_INTERNAL_PUNCH_PINS = false` flag (purple FAB, red pin overlay, count badge, zoom hint mention, AddPunchSheet). AreaDetail render order changed: Photo Gallery → Action buttons → Block reason picker → **Deficiencies** → Notes (was Photo Gallery → Deficiencies → Action buttons → Block → Notes; pilot wanted primary actions above the fold). **Floating chat bubble** (commits `cf82f3c`, `4da92b5`): inline Notes section was eating ~300px after deficiencies added; replaced with 56dp floating bubble bottom-right at screen level. Tap → bottom-sheet modal with full MessageThread inside (85% height, KAV with Android-specific `behavior='height'` + `statusBarTranslucent` so the modal's keyboard handling works — `softwareKeyboardLayoutMode: resize` from app.json doesn't apply inside Modal's separate window on Android, that's commit `4da92b5`). New hook `useAreaMessageActivity` mirrors `useGeneralChannelActivity` per-area; AsyncStorage tracks last-visited per (user, project, area); modal close calls `markAreaVisited` + emits `AREA_VISITED` DeviceEventEmitter event so the badge resets to 0 instantly. Always visible — discoverability > saving 56dp. **Open with Web team:** GC PDF export endpoint wiring still pending contract handoff (per-deficiency vs batch, return URL vs send-direct). Compliance footer button shows placeholder Alert until then. |

---

*Track collects, Web processes.*
*Same database. Same users. Different doors.*
*Offline-first. Camera-native. GPS-stamped. 3 clicks or less.*
*notchfield.io*
