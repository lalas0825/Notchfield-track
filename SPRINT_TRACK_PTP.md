# Sprint Track — PTP Foreman Flow

> **Goal:** Foreman creates, signs, and distributes a Pre-Task Plan from Track (mobile) in under 3 minutes, offline-first. Data writes to the same Supabase tables Takeoff Web already reads from — zero sync needed.
>
> **Prereq:** Sprint A (Safety Module infrastructure) done in Takeoff Web. Commit `deaa469`. Tables `jha_library`, `safety_documents` (with rich PTP content JSONB), and `profiles.sst_card_number` live in production.
>
> **Not in scope:** JHA library management (PM does this in Web). Re-designing the PDF (same `ptpPdfRenderer` runs on device). Supervisor dashboards beyond PTP visibility.

---

## 1. Context: What Takeoff Web Already Did

Takeoff Web built the **entire PM side and backend** of the PTP system. Track's job is to fill in the foreman creation flow — the single gap between "PM curates library" and "GC receives PDF".

### What's live in production right now

| Layer | What exists | Where |
|-------|-------------|-------|
| DB: `jha_library` | 149 tasks across 10 trades, OSHA-cited, controls categorized | Seeded in Jantile org |
| DB: `safety_documents` | Existing table with `doc_type='ptp'` rows, rich JSONB content schema | Already in use |
| DB: `profiles.sst_card_number` | NYC Local Law 196 tracking | Settable from Web settings |
| DB: `projects.emergency_*` | Hospital, assembly, first aid, contact fields | Settable from Web settings |
| Services: `ptpPdfRenderer` | jsPDF renderer with SHA-256 integrity | `src/features/pm/services/ptpPdfRenderer.ts` |
| API: `POST /distribute` | Freeze → PDF → email → audit | `/api/pm/safety-documents/[docId]/distribute` |
| UI: JHA library CRUD | PM curates tasks | `/pm/safety-documents/library` |
| UI: Verify page | Public SHA-256 verification | `/verify/[hash]` |

### The only hole Track fills

**Foreman creation flow on mobile.** Everything downstream (PDF generation, email distribution, integrity verification, PM read-only review) is ready and waiting.

---

## 2. Shared Documents Principle (non-negotiable)

Track does **NOT** sync to Takeoff. Both apps read/write the **same Supabase rows directly**.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Supabase (single source of truth)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  jha_library  (PM writes, foreman reads)             │   │
│  │  safety_documents  (foreman writes, PM reads)        │   │
│  │  profiles  (both write their own)                    │   │
│  │  projects  (PM writes, foreman reads emergency info) │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
       ▲                                          ▲
       │                                          │
   PowerSync                                    @supabase/supabase-js
       │                                          │
       ▼                                          ▼
┌──────────────┐                         ┌──────────────────┐
│    TRACK     │                         │  TAKEOFF WEB     │
│   (Expo)     │                         │  (Next.js)       │
│              │                         │                  │
│  Foreman     │                         │  PM              │
│  Supervisor  │                         │  Estimator       │
└──────────────┘                         └──────────────────┘
```

**Rules:**
- Never add a `ptp_*` table in Track's repo. Use the existing `safety_documents` row with `doc_type='ptp'`.
- Never duplicate the JHA library locally. PowerSync streams it down; Track queries it read-only.
- When Track creates a PTP, the same row the PM sees in Web is the one Track wrote.

---

## 3. Sprint Goal + Definition of Done

### Goal
A foreman with a mobile device standing in a bathroom at 7:00 AM can:
1. Start a new PTP in 1 tap (or copy from yesterday)
2. Select 2-3 tasks in 30 seconds
3. Pass the device around to 4-6 crew members for signatures (~1 minute)
4. Distribute to GC safety officer + super + sub-super in 1 tap
5. Have the GC receive the PDF in their inbox within 10 seconds (online) or next sync (offline)

### Definition of Done

- [ ] All 4 screens implemented (see §7)
- [ ] Offline-first: foreman can create + sign PTP with airplane mode, submit when reconnected
- [ ] Signatures write to `safety_documents.signatures` JSONB as `PtpSignature[]`
- [ ] Content writes to `safety_documents.content` JSONB matching `PtpContentSchema`
- [ ] Distribute from Track calls the same `/distribute` endpoint Takeoff Web uses
- [ ] Trade filter works — foreman only sees tasks matching `profiles.trade` (or org trade if profile null)
- [ ] "Copy from yesterday" pre-fills when same foreman + same area yesterday
- [ ] SST card numbers snapshot into signatures at capture time
- [ ] GPS captured only on foreman signature (not workers)
- [ ] Multi-recipient email pre-populates from `projects.safety_distribution_emails`, overrideable at send
- [ ] Submit works offline — writes to local PowerSync queue, syncs when online
- [ ] i18n EN/ES minimum (match Track's existing locale coverage)
- [ ] No new tables; no Web changes needed to support Track

---

## 4. Data Contracts (what Track writes)

### 4.1 Creating a PTP = one INSERT into `safety_documents`

```typescript
// Pseudo-code. Full Zod types already in Takeoff at src/features/pm/types.ts —
// copy them to Track's shared types package.

await supabase.from('safety_documents').insert({
  project_id: currentProjectId,
  organization_id: currentOrgId,
  doc_type: 'ptp',
  title: `${trade} PTP — ${areaLabel} — ${today}`,  // human-readable
  status: 'draft',
  created_by: foremanUserId,
  content: {
    // Context
    area_id: areaId,               // FK to production_areas (optional)
    area_label: 'Floor 3 · Bathroom E2',
    ptp_date: '2026-04-18',         // ISO date
    shift: 'day',                   // 'day' | 'night' | 'weekend'
    weather: {                      // optional, from weather API or manual
      temp_f: 52,
      conditions: 'Partly cloudy',
      wind_mph: 8,
    },
    trade: 'tile',                  // from profile or project

    // Selected JHA tasks — SNAPSHOTS (immutable once captured)
    selected_tasks: [
      {
        jha_library_id: 'uuid-of-task',
        task_name: 'Install large format tile on wall',
        category: 'Wall Installation',
        hazards: [
          { name: 'Silica dust exposure', osha_ref: '29 CFR 1926.1153' },
          ...
        ],
        controls: [
          { name: 'Wet cutting method', category: 'engineering' },
          ...
        ],
        ppe_required: ['Hard hat', 'N95 respirator', ...],
      },
      ...
    ],

    // Foreman-added (rare safety valve — outside JHA library)
    additional_hazards: [
      { description: 'Wet floor from earlier leak', mitigation: 'Cordoned off' },
    ],

    // Snapshot of project emergency info at creation time
    emergency: {
      hospital_name: 'NYU Langone',
      hospital_address: '550 1st Ave, NY',
      hospital_distance: '0.8 mi',
      assembly_point: 'South corner of site',
      first_aid_location: 'Trailer',
      contact_name: 'Juan · Super',
      contact_phone: '917-555-0123',
    },

    // Foreman context
    foreman_id: 'uuid',
    foreman_name: 'Jose Martinez',
    foreman_gps: { latitude: 40.7505, longitude: -74.0027 },

    // Additional free-form notes
    additional_notes: '',

    // PDF rendering options
    osha_citations_included: true,   // default true
  },
  signatures: [],   // filled progressively as workers sign — see §4.2
})
```

### 4.2 Each worker signature = one item appended to `safety_documents.signatures`

```typescript
// Pseudo-code for adding a signature (pattern below)
const sig: PtpSignature = {
  worker_id: 'uuid' | null,           // null for walk-in
  worker_name: 'Mario Rodriguez',
  sst_card_number: '4401532',          // snapshot from profile at sign time
  signature_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
  signed_at: new Date().toISOString(),
  is_foreman: false,
  is_walk_in: false,
}

// Pattern: fetch current signatures array, append, write back
// (Supabase doesn't have native JSONB array append from the client SDK
//  without a stored function. Simplest approach = read-modify-write.)
const { data: doc } = await supabase
  .from('safety_documents')
  .select('signatures')
  .eq('id', docId)
  .single()

const nextSignatures = [...(doc.signatures ?? []), sig]

await supabase
  .from('safety_documents')
  .update({ signatures: nextSignatures })
  .eq('id', docId)
```

**Concurrency note:** multiple workers won't sign simultaneously on the same device (device passes around sequentially). No conflict. If two devices somehow sign at once, last-write-wins — acceptable tradeoff for this workflow.

### 4.3 Distribute = call existing endpoint, don't reimplement

```typescript
// POST to Takeoff Web's existing distribute endpoint
await fetch(
  `${process.env.EXPO_PUBLIC_WEB_API_URL}/api/pm/safety-documents/${docId}/distribute`,
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${supabaseAccessToken}`,   // Track's auth
    },
    body: JSON.stringify({
      labels: buildPtpPdfLabels(t, oshaCitationsIncluded),
      recipients: selectedEmails,
    }),
  },
)
```

**Why call the Web endpoint and not do it in Track:**
1. jsPDF server rendering = one code path, zero drift
2. SHA-256 integrity + audit log + email all in one transaction with rollback
3. Track doesn't need Resend SDK, jsPDF, or logo-fetching

**Offline fallback:** if the endpoint call fails (offline), mark the doc as `distribution_pending = true` in a local PowerSync table. A background task retries when online. The doc stays `status='draft'` until the endpoint succeeds.

---

## 5. Architecture Decisions (inherit from sprint A)

| Decision | Why | Implication for Track |
|----------|-----|----------------------|
| JHA library = org-level | PM curates once, not per project | Track queries `organization_id = orgId AND (project_id IS NULL OR project_id = currentProjectId)` |
| Task snapshots in PTP content | PTPs must be immutable; library can evolve | When user selects a task, DEEP COPY hazards/controls/ppe into content — don't store just the FK |
| Signatures pass on device | Offline-first; foreman can't chase workers | Single signature canvas, sequential workers, no QR scan |
| GPS = foreman only | Reduces friction for crew | Only capture GPS when `is_foreman: true` signature lands |
| SST snapshot at signing time | Profile can change later | Read `profiles.sst_card_number` at moment of sign, freeze into signature row |
| OSHA citations toggle | Some GCs want clutter-free PDF | Show toggle on distribute screen, default `true` |
| Hard-freeze on distribute | Legal record requires immutability | After distribute, block all edits in Track UI (read-only viewer for historical PTPs) |

---

## 6. Auto-Fill Logic: The "Foreman Writes Nothing" Promise

User requirement verbatim: **"el foreman no debe escribir nada, waste of time"**. Every field should either auto-populate or be a single tap.

| Field | Source | Fallback |
|-------|--------|----------|
| Date | Device clock (`new Date()`) | N/A |
| Shift | Last selected shift from this foreman | default `'day'` |
| Weather | Weather API (OpenWeatherMap, cache 15min) by project GPS | skip field, renders `—` in PDF |
| Foreman name | `profiles.full_name` | session user email |
| Foreman GPS | Device GPS on sign | skip; PDF shows name only |
| Project | `crew_assignments.project_id` (where this foreman is active now) | manual select if multi-project |
| Area | `crew_assignments.area_id` | manual select from project's areas |
| Trade | `profiles.trade` | `organizations.primary_trade` |
| Emergency info | `projects.emergency_*` copied into `content.emergency` snapshot | skip; PDF hides section |
| Default recipients | `projects.safety_distribution_emails` | none, foreman types on send |

**Copy-from-yesterday logic:**
```sql
-- Find foreman's most recent PTP for the same area, within last 2 days
SELECT * FROM safety_documents
WHERE doc_type = 'ptp'
  AND created_by = :foremanId
  AND content->>'area_id' = :areaId
  AND created_at >= now() - interval '2 days'
ORDER BY created_at DESC
LIMIT 1;
```
If found, prefill `selected_tasks`, `additional_hazards`, `shift`, `trade`, `osha_citations_included`. Reset signatures (new crew signs). Update `ptp_date` to today. Show ONE tap: "Use yesterday's plan — 3 tasks, 4 hazards".

---

## 7. The 4 Screens (detailed)

### Screen 1 — Morning Huddle (Entry)

```
┌─────────────────────────────────────┐
│  ←               Today's PTP        │
├─────────────────────────────────────┤
│  📋 New Pre-Task Plan               │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 📍 200 Hamilton Ave           │  │   ← from crew_assignments
│  │ 🏢 Floor 3 · Bathroom E2      │  │   ← selectable if multi-area
│  │ 📅 Apr 18, 2026 · 7:15 AM    │  │   ← device clock
│  │ ☁️  52°F · Partly cloudy      │  │   ← weather API (optional)
│  │ 👤 Jose Martinez (Foreman)    │  │   ← profile
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  📋 Copy from yesterday       │  │   ← visible if found
│  │     Tile install - Floor 3    │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │      ➕ Start fresh PTP        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Interactions:**
- Tap "Copy from yesterday" → goes to Screen 3 with pre-filled data, Screen 2 skipped
- Tap "Start fresh" → Screen 2

**Data:** Create the `safety_documents` row in `status='draft'` here. Screens 2-3 mutate `content` until submit.

### Screen 2 — Task Selection

```
┌─────────────────────────────────────┐
│  ←         What are we doing?       │
├─────────────────────────────────────┤
│  🔍 [Search tasks...]               │
│  Filter: [All] [Wall] [Floor] [Prep]│
│                                     │
│  ─── Tile Tasks (only YOUR trade) ──│
│                                     │
│  ☑ Install large format tile        │
│     ⚠️ silica · cuts · falls        │
│                                     │
│  ☑ Cut tile with wet saw            │
│     ⚠️ silica · lacerations         │
│                                     │
│  ☐ Mix thinset mortar               │
│     ⚠️ silica · skin irritation     │
│     ...                             │
│                                     │
│  [+ Add project-specific task]      │
│  [+ Add custom hazard]              │
├─────────────────────────────────────┤
│  3 tasks selected                   │
│  [ Continue → ]                     │
└─────────────────────────────────────┘
```

**Query:**
```sql
SELECT id, task_name, category, hazards, controls, ppe_required, notes
FROM jha_library
WHERE organization_id = :orgId
  AND trade = :foremanTrade
  AND active = true
  AND (project_id IS NULL OR project_id = :projectId)
ORDER BY category, task_name;
```

**Preview strings** shown under each task = first 3 hazard names joined by ` · `.

**On Continue:** deep-copy selected tasks into `content.selected_tasks` (snapshots).

### Screen 3 — Auto-Generated Review

```
┌─────────────────────────────────────┐
│  ←         Review & Sign            │
├─────────────────────────────────────┤
│  ✅ Tasks selected (3)               │
│  ├─ Install large format tile        │
│  └─ ...                              │
│                                     │
│  ⚠️ HAZARDS (auto-filled, 6)        │
│  ✓ Silica dust exposure             │
│  ✓ Cut/laceration injuries          │
│  ...                                │
│                                     │
│  🛡️ CONTROLS (auto-filled, 7)       │
│  ✓ Wet cutting method               │
│  ...                                │
│                                     │
│  🥽 PPE REQUIRED                    │
│  ✓ Hard hat · ✓ N95 respirator · …  │
│                                     │
│  📷 Attach photo (optional)          │
├─────────────────────────────────────┤
│  [ Continue to Signatures → ]       │
└─────────────────────────────────────┘
```

**Consolidation:** use `consolidate()` from `ptpPdfRenderer.ts` logic — dedupe by name, preserve first-seen order, union across all selected tasks.

**Tap ✓ to remove:** updates `content.selected_tasks[n].hazards` by removing. Rare but possible. Show warning "Most foremen leave all hazards in." (intentional friction for safety).

**"Attach photo"** stored as `content.photo_urls: string[]` — optional, not in renderer yet but reserve the field.

### Screen 4 — Crew Signatures

```
┌─────────────────────────────────────┐
│  ←          Crew Sign-Off           │
├─────────────────────────────────────┤
│  📋 3 tasks · 6 hazards · 6 PPE     │
│  Pass the device to each worker     │
│                                     │
│  ─── FOREMAN ───                    │
│  ┌───────────────────────────────┐  │
│  │ Jose Martinez                 │  │
│  │ [ Tap Sign ]                  │  │   ← captures GPS here
│  └───────────────────────────────┘  │
│                                     │
│  ─── CREW (4) ───                   │
│  ┌───────────────────────────────┐  │
│  │ Mario Rodriguez               │  │
│  │ ✓ Signed 7:19 AM              │  │
│  │ [signature preview]           │  │
│  └───────────────────────────────┘  │
│  ...                                │
│                                     │
│  [+ Add walk-in worker]             │
├─────────────────────────────────────┤
│  2 of 5 signed                      │
│  [ Submit PTP — waiting 3 more ]    │
└─────────────────────────────────────┘
```

**Crew list source:** `crew_assignments` where `project_id = :projectId AND active = true`.

**Walk-in flow:** modal asks for name (required) + SST card (optional). Creates a signature with `worker_id: null`, `is_walk_in: true`.

**Signature canvas:** use `react-native-signature-canvas`. On save, base64 PNG data URL → append to `signatures` array.

**GPS capture:** only on foreman's sign. Use `expo-location`, request permission once, cache.

### Screen 5 — Distribute (after all sign)

```
┌─────────────────────────────────────┐
│  ←           Send PTP               │
├─────────────────────────────────────┤
│  ✓ All 5 signatures captured        │
│                                     │
│  📄 PDF Ready  [Preview]            │
│                                     │
│  ─── Send to ────                   │
│  ☑ safety@tishman.com               │
│  ☑ super@tishman.com                │
│  ☑ subsuper@tishman.com             │
│  [+ Add recipient]                  │
│                                     │
│  ☑ Include OSHA citations           │
│                                     │
│  [ 📤 Send & Submit ]               │
└─────────────────────────────────────┘
```

**Recipients source:** `projects.safety_distribution_emails` (default-checked). Foreman can uncheck, add, or replace.

**Preview:** render PDF client-side using `ptpPdfRenderer.ts` (port from Takeoff — check if jsPDF works in React Native; if not, show a text preview screen instead and skip visual preview).

**Send & Submit:**
1. POST to `/api/pm/safety-documents/[docId]/distribute`
2. On success: show success toast, navigate home
3. On offline: save `{docId, labels, recipients}` to PowerSync `ptp_distribution_queue` local table, show "Queued — will send when online"
4. Background task polls queue every 30s when online, retries failed sends

---

## 8. Services to Build in Track

All live in `src/features/safety/` (or wherever Track organizes features). Signatures match Takeoff patterns.

### 8.1 `jhaLibraryService.ts`
```typescript
export async function getJhaLibraryForTrade(
  orgId: string,
  projectId: string,
  trade: Trade,
): Promise<JhaLibrary[]>
```
Read-only wrapper. One query. Cache in PowerSync for offline.

### 8.2 `ptpService.ts`
```typescript
export async function createDraftPtp(params: PtpDraftParams): Promise<SafetyDocument>
export async function updatePtpContent(id: string, content: PtpContent): Promise<void>
export async function appendSignature(id: string, sig: PtpSignature): Promise<void>
export async function getYesterdaysPtp(foremanId: string, areaId: string): Promise<SafetyDocument | null>
export async function distributePtp(id: string, labels: PtpPdfLabels, recipients: string[]): Promise<DistributeResult>
```

### 8.3 `signatureCaptureService.ts`
Thin wrapper around `react-native-signature-canvas` that:
- Returns base64 data URL (`data:image/png;base64,...`)
- Optionally captures GPS (foreman only)
- Snapshots SST card number from profile at capture time

### 8.4 `weatherService.ts` (optional)
```typescript
export async function getWeatherForProject(projectId: string): Promise<PtpWeather | null>
```
OpenWeatherMap free tier. Cache 15min in AsyncStorage. Null on any failure (PDF section gracefully degrades).

### 8.5 `distributionQueueService.ts`
PowerSync-backed queue for offline distributes. Table schema:
```sql
-- Lives in Track's PowerSync local DB, does NOT sync to Supabase
CREATE TABLE ptp_distribution_queue (
  id TEXT PRIMARY KEY,
  doc_id UUID NOT NULL,
  labels TEXT NOT NULL,        -- JSON
  recipients TEXT NOT NULL,    -- JSON array
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);
```
Retry with backoff: 30s, 2m, 10m, then give up + alert foreman.

---

## 9. PowerSync Sync Groups

Configure PowerSync to stream down (read-only for most):

| Table | Direction | Filter |
|-------|-----------|--------|
| `jha_library` | Down | `organization_id = :userOrgId AND active = true` |
| `safety_documents` (doc_type='ptp') | Up+Down | `project_id IN :foremanProjects` |
| `profiles` | Down | `organization_id = :userOrgId` (for crew names + SST) |
| `projects` | Down | `id IN :foremanProjects` |
| `crew_assignments` | Up+Down | `foreman_id = :userId` |
| `production_areas` | Down | `project_id IN :foremanProjects` |

**Conflict strategy:** last-write-wins on all `safety_documents` updates. In practice, only one foreman edits a PTP at a time.

---

## 10. i18n

Reuse the keys Takeoff added. Track should load from the same `messages/` translations (via shared package or duplicate the PTP namespace). At minimum add:

- `PM.ptp*` keys (~100 already in Takeoff)
- `PM.jhaLibrary*` keys (~26 already)
- `PM.trades.*` (10 trade names)

For the mobile-specific strings not in Takeoff (e.g. "Tap Sign", "Pass the device to each worker"), add to a new `Track.ptp*` namespace.

---

## 11. Testing Checklist

### Unit
- [ ] `consolidate()` — dedupes hazards/controls/PPE across tasks
- [ ] `getYesterdaysPtp` — returns correct row, null if >2 days old
- [ ] Signature append is idempotent on retry (foreman double-taps Sign)

### Integration
- [ ] Insert PTP draft → check `safety_documents` row in Supabase via Takeoff Web
- [ ] Capture 3 signatures → verify all 3 appear in `signatures` JSONB
- [ ] Distribute online → GC receives email, Takeoff Web shows distributed_at
- [ ] Distribute offline → queue row created, syncs on reconnect

### Manual (device)
- [ ] Fresh PTP from empty state (new project, no yesterday's PTP)
- [ ] Copy from yesterday works
- [ ] Offline full flow: airplane mode, create, sign 4, submit, reconnect, see success
- [ ] Trade filter: foreman with trade='tile' sees 28 tile tasks, 0 others
- [ ] Walk-in worker flow (no crew row)
- [ ] Distribute with 0 recipients (show error)
- [ ] Distribute with 3 recipients (all receive email)
- [ ] Post-distribute UI is read-only (can't edit)

### Cross-app (Web + Track)
- [ ] Foreman creates PTP in Track → PM sees it instantly in Web (Supabase realtime)
- [ ] PM opens Web detail view → "Download PDF" button shows correct hash
- [ ] GC visits `/verify/{hash}` → sees "Document verified"

---

## 12. Task Breakdown (in order)

### Phase 1 — Plumbing (2-3 days)
1. Copy Zod types from Takeoff `src/features/pm/types.ts` → Track `src/features/safety/types.ts`
2. Configure PowerSync sync groups per §9
3. Build `jhaLibraryService.ts` + verify query returns Jantile's 149 tasks in dev
4. Build `ptpService.ts` with `createDraftPtp` + verify one row appears in Supabase

### Phase 2 — Screens (3-4 days)
5. Screen 1 (Morning Huddle) + auto-fill from crew_assignments + weather
6. Screen 2 (Task Selection) with trade filter + hazard preview + multi-select state
7. Screen 3 (Review) with consolidate() logic + optional hazard toggle
8. Screen 4 (Signatures) with `react-native-signature-canvas` + GPS capture on foreman

### Phase 3 — Distribution (2 days)
9. Screen 5 (Distribute) with recipient multi-select + default from project
10. Port `ptpPdfLabels.ts` + wire to Takeoff's `/distribute` endpoint
11. Build `distributionQueueService.ts` for offline retry

### Phase 4 — Polish + Testing (1-2 days)
12. Copy-from-yesterday logic + 1-tap prefill
13. Walk-in worker modal
14. i18n for Track-specific strings
15. Run full testing checklist (§11)

**Estimated total:** 8-11 days for one engineer, assuming Track's auth + PowerSync + i18n scaffolding already exists.

---

## 13. Out of Scope (defer to Sprint C)

- Supervisor dashboard showing all foremen's PTPs (read-only card grid)
- Re-distribute from Track (PM handles this in Web if needed)
- AI hazard detection from photos
- Voice input for custom hazards
- Quick duplicate from another foreman's PTP (only same-foreman copy-yesterday in this sprint)
- Multi-language auto-translation in signature modal
- SST expiration warnings (already tracked in `profiles.sst_expires_at`, surface later)

---

## 14. Risk Register

| Risk | Mitigation |
|------|-----------|
| jsPDF doesn't run in RN | Skip preview in-app; render server-side via distribute endpoint. Foreman sees confirmation after send. |
| PowerSync conflict on `safety_documents.signatures` race | Last-write-wins accepted. Real-world: one device, sequential workers. |
| Weather API outage | Optional field, PDF hides if null. No blocker. |
| Supabase realtime slow | PM can refresh. Not critical path. |
| Foreman loses phone mid-PTP | Signatures already in DB as they're captured. PM can see partial PTP, finish from Web if needed (but this sprint keeps PM read-only). |
| GC email bounces | `/distribute` already returns `emailsFailed` count. Show in Track. Foreman can re-send. |

---

## 15. Handoff Checklist

When Sprint Track is done, validate:

- [ ] Jantile foreman creates first real PTP on production Jantile org
- [ ] PM sees it in Takeoff Web within 5 seconds
- [ ] GC receives email with attached PDF, footer shows SHA-256 hash
- [ ] GC visits verify URL → green "Document verified"
- [ ] All 149 seeded JHA tasks accessible by trade filter
- [ ] SST card numbers from 5 Jantile workers' profiles appear in PDF
- [ ] Emergency info from project settings appears in PDF
- [ ] Post-distribute, Track shows "Distributed" badge, no edits allowed

**When those 8 items pass, Sprint Track ships.**

---

*Cloud-first. Revenue primero. AI tercero. Field intelligence cuando haya clientes.*
*Track's PTP flow is "field intelligence" — the first native-app-only feature that justifies Track's existence beyond shared documents.*
