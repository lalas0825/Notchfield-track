# Sprint Track — Toolbox Talks (Foreman Flow)

> **Context:** Takeoff Sprint 50A + 50B ship the Toolbox Talk infrastructure — library table (3-tier with ~30 curated global topics, quality-over-quantity after an initial bulk pass produced low-quality content), scheduler engine, PM override UI, distribute endpoint. Track owns the foreman delivery flow.
>
> **What Track builds:** 4 mobile screens that let a foreman deliver a weekly safety talk in under 3 minutes with zero typing. Reuses most patterns from Track's PTP sprint — signatures, distribute queue, workers integration.
>
> **Est:** 3-4 days (simpler than PTP because content is pre-authored, no task selection step).
>
> **Prereq:** Track's PTP sprint + Manpower migration must be live. Those two sprints set up the foundations (workers table, PowerSync, signature capture component, distribute queue).

---

## 1. TL;DR — what's ready on the backend

```
READY (Takeoff Sprint 50A + 50B):
  ✅ toolbox_library           — ~30 curated topics, 3-tier (global/org/project)
  ✅ toolbox_schedule_overrides — PM force-assign a topic to a week
  ✅ scheduler engine           — pure function, port it to Track verbatim
  ✅ distribute endpoint        — reuse /api/pm/safety-documents/[docId]/distribute
  ✅ PDF renderer               — server-side via distribute endpoint

TRACK BUILDS:
  🔴 4 mobile screens           — see §6
  🔴 toolbox service            — thin Supabase wrapper
  🔴 PowerSync config update    — new tables
  🔴 scheduler wiring           — fetch inputs + run engine + cache result
```

---

## 2. Two-Tier Data Model (recap)

Toolbox Talk = same pattern as PTP:
- **Library row** (`toolbox_library`) = pre-authored topic with EN+ES content
- **Delivered talk** = `safety_documents` row with `doc_type='toolbox'` + content snapshot of the library row

Immutability rule from PTP carries over: **snapshot library content into delivery**. If the library topic is edited later, the delivered talk's PDF still reflects what was presented that day.

---

## 3. What changed vs Track's current toolbox handling

If Track has any placeholder toolbox flow today — rewrite. The old `ToolboxContentSchema` was:
```typescript
{ topic, key_points, hazards, additional_notes }
```

New rich schema (already shipped in Takeoff `src/features/pm/types.ts`):
```typescript
ToolboxContent {
  // Legacy (back-compat — ignore in Track)
  topic, key_points, hazards, additional_notes

  // NEW — what Track writes
  topic_snapshot: ToolboxTopicSnapshot   // full library row snapshotted
  scheduled_date, delivered_date         // ISO dates
  shift, weather                          // same as PTP
  foreman_id, foreman_name, foreman_gps   // same as PTP
  photo_urls: string[]                    // optional photo of huddle
  discussion_notes: string                // optional free text
  delivered_language: 'en' | 'es' | 'both'
  distribution: { distributed_at, distributed_to[], pdf_sha256 }
}
```

---

## 4. Port the Scheduler Engine (10 min)

Copy `src/features/pm/services/toolboxSchedulerEngine.ts` from Takeoff to Track. **Zero imports, fully portable.**

### Inputs

```typescript
const result = scheduleToolboxTopic({
  library: visibleToolboxTopics,         // from Supabase (RLS returns global + org)
  history: recentToolboxDeliveries,      // last 16 weeks
  primaryTrades: ['tile', 'marble'],     // from org.primary_trades
  currentDate: new Date(),
  override: thisWeeksOverride,           // or null
  ptpSignal: { tags: recentPtpHazardTags }, // or null
})
```

### Output

```typescript
result = {
  suggested: ToolboxLibrary,      // top pick
  alternatives: ToolboxLibrary[], // next 5 options for picker
  explanation: string[],          // ["Trade match: tile", "Never delivered"]
  wasOverridden: boolean,         // true if PM forced it
  ranked: RankedTopic[],          // debug / richer UI
}
```

### Priority algorithm (in order)

1. **PM override present** → return that topic, skip algorithm
2. **Rotation filter** → skip topics delivered in last 8 weeks
3. **Score each remaining topic:**
   - Trade match (primary_trades ∩ topic.trade) = +100
   - Universal topic (empty trade array) = +50
   - Other-trade topic = +20
   - PTP tag overlap with topic.tags = +50
   - Season match (current quarter ∈ topic.season) = +20
   - Decay: weeks_since_last_delivery × 2 (capped at 100)
   - Never delivered before = +30
4. Sort by score, tie-break by id

---

## 5. PowerSync Sync Groups — ADD

```yaml
# Add to Track's PowerSync config
toolbox_library:
  sync: bi-directional  # Track needs WRITE for future "custom topic from field" feature
                        # For v1, down-only is fine — foreman only reads
  filter: >
    organization_id IS NULL           # global topics (RLS already gates)
    OR organization_id = :userOrgId

toolbox_schedule_overrides:
  sync: down-only
  filter: >
    organization_id = :userOrgId
    AND project_id IN :foremanProjects

# safety_documents already syncs (PTP sprint); it includes doc_type='toolbox' rows
# automatically since it's filtered by project_id, not doc_type
```

---

## 6. The 4 Screens

### Screen 1 — This Week (Entry Point)

```
┌─────────────────────────────────────┐
│  ← Home        Weekly Safety        │
├─────────────────────────────────────┤
│  📅 Week of Apr 21, 2026            │
│                                     │
│  This Week's Toolbox Talk           │
│  ┌───────────────────────────────┐  │
│  │ 🛡️  Silica Dust from           │  │
│  │    Tile Cutting                │  │
│  │                                │  │
│  │ "Cutting tile creates dust     │  │
│  │  small enough to reach deep    │  │
│  │  into the lungs..."            │  │
│  │                                │  │
│  │  Why this week:                │  │
│  │  • Trade match: tile           │  │
│  │  • Last covered 11 weeks ago   │  │
│  └───────────────────────────────┘  │
│                                     │
│  [ 📖 Start Talk ]                  │
│  [ 🔄 Change topic ]  (alternatives) │
│                                     │
│  ─── Already delivered this week ── │
│  ✓ Apr 21 · Signed by 5            │
│  (hidden if not yet delivered)      │
└─────────────────────────────────────┘
```

**Logic:**
```typescript
// On screen mount:
const [library, history, override, ptpSignal] = await Promise.all([
  fetchToolboxLibrary(orgId),           // via PowerSync local cache
  fetchRecentDeliveries(projectId, 16), // 16 weeks lookback
  fetchWeeklyOverride(projectId, currentWeek),
  fetchRecentPtpTags(projectId, 1),     // last week's PTP hazard tags
])

const result = scheduleToolboxTopic({
  library, history,
  primaryTrades: org.primary_trades,
  currentDate: new Date(),
  override,
  ptpSignal,
})

// Display result.suggested + result.explanation
// "Change topic" button reveals result.alternatives (up to 5)
```

**Already-delivered check:**
```typescript
const weekStart = weekStartDate(new Date())
const deliveredThisWeek = await supabase
  .from('safety_documents')
  .select('id')
  .eq('project_id', projectId)
  .eq('doc_type', 'toolbox')
  .gte('created_at', weekStart)
  .limit(1)

if (deliveredThisWeek.length > 0) {
  // Show "Already delivered ✓" — can't submit twice
}
```

### Screen 2 — Present Content

```
┌─────────────────────────────────────┐
│  ← Back      Silica Dust Awareness  │
├─────────────────────────────────────┤
│  [ EN ]  [ ES ]  toggle             │
│                                     │
│  WHY IT MATTERS                     │
│  ┌───────────────────────────────┐  │
│  │ "Cutting or grinding tile     │  │
│  │  creates dust small enough    │  │
│  │  to reach deep into the       │  │
│  │  lungs. One day's exposure    │  │
│  │  can exceed the OSHA limit."  │  │
│  └───────────────────────────────┘  │
│                                     │
│  KEY POINTS                         │
│  • Wet cutting ALWAYS (no dry saw)  │
│  • N95 minimum, P100 for demo       │
│  • HEPA vacuum — never broom        │
│  • Wash hands BEFORE eating         │
│  • Change clothes before going home │
│                                     │
│  DISCUSSION                         │
│  - Anyone see dry cutting on this   │
│    job?                             │
│  - N95 fit feeling tight? Report    │
│    for fit-test                     │
│                                     │
│  📷 [Attach photo of huddle] (opt)  │
│                                     │
│  [ Continue to Sign → ]             │
└─────────────────────────────────────┘
```

**EN/ES toggle:**
- Default to English
- If topic has `title_es` populated, show ES toggle
- Store chosen language in component state → save to `delivered_language` on submit
- If user toggled between both during delivery, save `'both'`

**Photo capture:**
- Reuse expo-image-picker pattern from PTP sprint
- Upload to Supabase Storage `toolbox-photos` bucket
  - **NOTE:** This bucket doesn't exist yet. Either Takeoff adds it in a follow-up migration, OR Track reuses the `worker-photos` bucket with a different path prefix (`toolbox/{project_id}/{doc_id}.jpg`). Recommend the former — cleaner.
- Optional: foreman can add 0, 1, or multiple photos

### Screen 3 — Crew Signatures

**Identical pattern to PTP Screen 4.** Reuse the component.

```typescript
// Same signature capture component from Track's PTP sprint
<CrewSignatureScreen
  crew={assignedWorkers}
  onForemanSign={(sig) => append({ ...sig, is_foreman: true })}
  onWorkerSign={(workerId, sig) => append({ ...sig, worker_id: workerId, is_foreman: false })}
  onSubmit={goToDistribute}
/>
```

Key difference: **weekly vs daily** urgency. Toolbox talks are less time-pressured than PTP. Still pass the device around, still snapshot SST into each signature JSONB.

### Screen 4 — Distribute

```
┌─────────────────────────────────────┐
│  ← Back         Send Talk           │
├─────────────────────────────────────┤
│  ✓ 5 signatures captured            │
│                                     │
│  Send to (from project defaults):   │
│  ☑ safety@tishman.com               │
│  ☑ super@tishman.com                │
│  ☑ subsuper@tishman.com             │
│  [ + Add recipient ]                │
│                                     │
│  Include OSHA citations?            │
│  ☑ Yes (recommended)                │
│                                     │
│  📝 Discussion notes (optional)     │
│  ┌───────────────────────────────┐  │
│  │ Mario mentioned N95 tight,    │  │
│  │ scheduling fit-test next week │  │
│  └───────────────────────────────┘  │
│                                     │
│  [ 📤 Submit & Send ]               │
└─────────────────────────────────────┘
```

**Submit logic:**

```typescript
async function submitToolbox() {
  // 1. Build content JSONB
  const content: ToolboxContent = {
    topic_snapshot: {
      toolbox_library_id: selectedTopic.id,
      title: selectedTopic.title,
      title_es: selectedTopic.title_es,
      slug: selectedTopic.slug,
      why_it_matters: selectedTopic.why_it_matters,
      why_it_matters_es: selectedTopic.why_it_matters_es,
      key_points: selectedTopic.key_points,
      key_points_es: selectedTopic.key_points_es,
      discussion_questions: selectedTopic.discussion_questions,
      discussion_questions_es: selectedTopic.discussion_questions_es,
      osha_ref: selectedTopic.osha_ref,
      category: selectedTopic.category,
      source: selectedTopic.source,
    },
    scheduled_date: weekStartDate(new Date()),
    delivered_date: new Date().toISOString().slice(0, 10),
    shift: 'day',
    weather: capturedWeather,
    foreman_id: myWorker.id,
    foreman_name: `${myWorker.first_name} ${myWorker.last_name}`,
    foreman_gps: capturedGps,
    photo_urls: uploadedPhotoUrls,
    discussion_notes: discussionNotesText,
    delivered_language: chosenLanguage,
    additional_notes: '',
  }

  // 2. Insert safety_documents row
  const { data: doc } = await supabase
    .from('safety_documents')
    .insert({
      project_id,
      organization_id: orgId,
      doc_type: 'toolbox',
      title: selectedTopic.title,
      status: 'draft',
      content,
      signatures: capturedSignatures,  // PtpSignature[] — same shape
      created_by: foremanProfileId,    // note: profiles.id, not workers.id
    })
    .select()
    .single()

  // 3. Call the existing distribute endpoint (SAME endpoint as PTP)
  const result = await fetch(
    `${WEB_URL}/api/pm/safety-documents/${doc.id}/distribute`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        labels: buildToolboxPdfLabels(t, includeOshaCitations),
        recipients: selectedEmails,
      }),
    },
  )

  // 4. On offline → push to distribution queue (from PTP sprint)
  if (!result.ok) {
    await distributionQueue.enqueue({ docId: doc.id, labels, recipients })
  }
}
```

**Note on PDF labels:** Takeoff currently has `buildPtpPdfLabels`. A `buildToolboxPdfLabels` helper will need to be added to Takeoff in Sprint 50D (PDF renderer). Until then, Track can call with `doc_type='toolbox'` and the server will branch the renderer. Or Sprint 50D adds the toolbox renderer + labels in one commit.

---

## 7. Services to Build in Track

### 7.1 `toolboxService.ts`

```typescript
// Get visible library (PowerSync local query, RLS handles tiers)
export async function getToolboxLibrary(orgId: string): Promise<ToolboxLibrary[]>

// Get recent deliveries for scheduler's rotation/decay logic
export async function getRecentDeliveries(
  projectId: string,
  weeks: number,
): Promise<ToolboxDelivery[]>

// PM override for the current week (or null)
export async function getWeeklyOverride(
  projectId: string,
  weekStart: string,
): Promise<ScheduleOverride | null>

// Extract recent PTP tags as signal for scheduler
export async function getRecentPtpTags(
  projectId: string,
  weeksBack: number,
): Promise<string[]>
```

### 7.2 Reuse from PTP sprint

- `signatureCapture.ts` — no changes needed
- `distributionQueueService.ts` — no changes; the doc row shape is the same
- GPS capture — same pattern

---

## 8. The Photo Bucket Decision

Toolbox optionally attaches photos of the huddle. Two options:

**Option A — New dedicated bucket (cleaner):**
- Takeoff adds migration: `INSERT INTO storage.buckets ('toolbox-photos', ...)` with the same policies as `worker-photos`
- Path: `{org_id}/{safety_doc_id}/{timestamp}.jpg`

**Option B — Reuse `worker-photos` bucket:**
- Path namespacing: `toolbox/{project_id}/{safety_doc_id}/{timestamp}.jpg`
- Pro: no new migration
- Con: mixing worker HR photos and huddle photos in same bucket is messy for audit

**Recommend Option A.** One-line migration; request it from Takeoff before starting Track screen 2.

---

## 9. Testing Checklist

### Phase 1 — Scheduler correctness
- [ ] Fresh project, no history → scheduler returns a suggestion + explanation
- [ ] Jantile (tile/marble org) → scheduler surfaces tile/marble or universal topics FIRST, never concrete/electrical
- [ ] Deliver a topic → next week that topic is NOT suggested (rotation works)
- [ ] 9 weeks later → same topic becomes eligible again
- [ ] PM sets override for week X → Track sees the forced topic, `wasOverridden=true`
- [ ] Recent PTP has 'silica' tag → silica toolbox topic scores higher

### Phase 2 — Delivery flow
- [ ] Screen 1 loads in under 2s (PowerSync-cached library)
- [ ] EN/ES toggle renders content from the respective fields
- [ ] Photo attach works online + offline (offline queues for upload)
- [ ] Crew signature capture: foreman GPS only, each sig snapshots SST
- [ ] Already-delivered check: if TB already submitted this week, show banner + disable Start

### Phase 3 — Distribution
- [ ] Submit online → `safety_documents` row created, distribute endpoint returns 200
- [ ] Submit offline → queued, retries when reconnected
- [ ] PDF delivered to recipients matches library content (snapshot correct)
- [ ] SHA-256 in PDF footer validates on `/verify/[hash]` page

### Phase 4 — PM visibility
- [ ] PM opens Takeoff Web → sees the toolbox in Safety Documents list
- [ ] PM can re-download PDF
- [ ] If foreman delivered ES version, PDF header reflects that

---

## 10. Task Breakdown

| # | Task | Est |
|---|------|-----|
| 1 | Port `toolboxSchedulerEngine.ts` to Track | 0.5h |
| 2 | Add PowerSync sync groups (library, overrides) | 0.5h |
| 3 | Build `toolboxService.ts` (4 query helpers) | 1h |
| 4 | Request `toolbox-photos` bucket from Takeoff (or reuse) | 0.5h |
| 5 | Screen 1: This Week entry — fetch + run scheduler + render suggestion | 3h |
| 6 | Screen 2: Present content + EN/ES toggle + photo attach | 3h |
| 7 | Screen 3: Crew signatures — reuse PTP component | 1h |
| 8 | Screen 4: Distribute — reuse PTP queue + endpoint | 2h |
| 9 | Home tab integration ("This week's safety" card alongside PTP) | 1h |
| 10 | Offline edge cases + re-entry (saved draft, deep link) | 2h |
| 11 | i18n: Toolbox namespace keys (reuse Takeoff's Python script) | 1h |
| 12 | Testing Phase 1-4 on staging | 1d |

**Total: ~3-4 days focused work + 1 day testing = 4-5 days.**

---

## 11. Sprint 50D Dependency (from Takeoff, not Track)

Takeoff still needs to ship before Track's distribute flow is fully functional:

- [ ] `toolboxPdfRenderer.ts` — port from `ptpPdfRenderer` with topic-snapshot layout
- [ ] `buildToolboxPdfLabels()` helper (like `buildPtpPdfLabels`)
- [ ] Extend distribute endpoint to branch: `if (doc.doc_type === 'toolbox') renderToolboxPdf(...)`
- [ ] New bucket `toolbox-photos` if going with Option A
- [ ] i18n: Toolbox-PDF namespace (PDF section headers in 6 locales)

These land in parallel with Track's sprint so both ship together.

---

## 12. Done When

- [ ] Foreman in Jantile opens Track → "This week's toolbox: Silica" auto-suggested
- [ ] Foreman taps Start → presents bilingual content to crew
- [ ] All 5 workers sign, foreman signs with GPS
- [ ] Submit → GC receives PDF within 10 seconds (online)
- [ ] PM opens Takeoff → sees the toolbox in Safety Documents list, can download
- [ ] `/verify/[hash]` confirms document integrity
- [ ] Rotation prevents same topic being suggested next week
- [ ] PM sets override → Track shows forced topic next Monday

**When those 8 items pass, Track's Toolbox sprint ships.**

---

*Three safety flows now live in the field:*
*• PTP — daily, task-driven (Sprint 48-49)*
*• Toolbox Talk — weekly, topic-driven (this sprint)*
*• Manpower — supervisor-driven roster (Sprint 49)*
*Three documents, three cadences, one database, one PDF renderer pattern. The safety module is done when Track's toolbox ships.*
