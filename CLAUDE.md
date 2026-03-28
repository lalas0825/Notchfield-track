# 🏗️ NotchField Track — Factory OS
> *"Track collects, Web processes. Same database, different doors."*
> Updated: 2026-03-28 | T1 OPERATIONAL, T2 S1-S3 DONE
> Repo: https://github.com/lalas0825/Notchfield-track (13 commits)
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

### Critical: EAS Build (see EAS_BUILD_GUIDE.md)
- Node 20 LTS required (Node 25 breaks metro)
- `eas.json` env block required (EAS ignores .env files)
- Auth routing: use `<Redirect>` not `router.replace()` in layouts
- PowerSync needs `@journeyapps/react-native-quick-sqlite` as explicit dep
- PowerSync sync rules: NO JOINs, NO subqueries, NO aliases in parameters
- Platform-split files (.web.tsx) for native-only modules (react-native-pdf, PowerSync, maps)

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

### Supabase Migrations Applied (Track-owned tables)
| Migration | Tables |
|-----------|--------|
| create_track_t1_tables | crew_assignments, area_time_entries, gps_checkins, gps_geofences, field_photos |
| create_track_t2_tables | daily_reports, field_messages, punch_items |
| add_legal_immutability_trigger | guard_legal_immutability() on legal_documents |
| powersync publication | `CREATE PUBLICATION powersync FOR ALL TABLES` |

---

*Track collects, Web processes.*
*Same database. Same users. Different doors.*
*Offline-first. Camera-native. GPS-stamped. 3 clicks or less.*
*notchfield.io*
