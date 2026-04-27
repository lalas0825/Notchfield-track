# SPRINT_TRACK_DEFICIENCIES — Track team handoff

> **TL;DR:** Web shipped Sprint 71 backend (commit pending). Track can flip mocks → real API NOW. ~6h of UI work. PowerSync sync rule + 4 API client calls + "Report Deficiency" FAB.

> **Goal:** Foreman walks site → taps "+ Report Deficiency" on area card → photo + category + severity → submitted. Today screen shows assigned deficiencies → tap → resolve with after-photo. Same shared `deficiencies` table that Web reads — zero duplicated logic.

---

## 0. What's NOT yours

❌ **Workflow logic** — Web service has create / resolve / verify / reject endpoints. Track just calls them.
❌ **Library management** — Web seeds + serves the `deficiency_library` (~40 templates × 5 trades). Track reads from PowerSync.
❌ **Notification + todo creation** — Web's notify() + createTodo() handle this. Track sees the resulting rows automatically.

✅ **Yours:** PowerSync read config, "Report Deficiency" FAB on area screens, resolve UI with after-photo capture, library picker.

---

## 1. PowerSync sync rule

```yaml
bucket_definitions:
  org_deficiencies:
    parameters:
      - SELECT organization_id AS org_id FROM profiles WHERE id = request.user_id()
    data:
      - SELECT * FROM deficiencies WHERE organization_id = bucket.org_id AND status != 'closed'
      - SELECT * FROM deficiency_library WHERE organization_id = bucket.org_id OR organization_id IS NULL
```

`deficiency_library` synced too — needed for the FAB picker (offline support).

---

## 2. Copy types verbatim

From `src/features/pm/types.ts`:

```typescript
export type DeficiencyStage = 'internal_qc' | 'gc_inspection' | 'punch_list' | 'warranty_callback'
export type DeficiencySeverity = 'cosmetic' | 'minor' | 'major' | 'critical'
export type DeficiencyResponsibility = 'own' | 'other_trade' | 'gc' | 'unknown'
export type DeficiencyStatus = 'open' | 'in_progress' | 'resolved' | 'verified' | 'closed'

export type Deficiency = {
  id: string
  organization_id: string
  project_id: string
  area_id: string
  surface_id: string | null
  title: string
  description: string | null
  severity: DeficiencySeverity
  stage: DeficiencyStage
  responsibility: DeficiencyResponsibility
  trade: string | null
  category: string | null
  library_id: string | null
  status: DeficiencyStatus
  photos: string[]
  resolution_photos: string[]
  assigned_to: string | null
  created_by: string
  resolved_at: string | null
  resolved_by: string | null
  verified_at: string | null
  verified_by: string | null
  rejected_reason: string | null
  closed_at: string | null
  estimated_cost_cents: number | null
  billed_amount_cents: number | null
  plan_x: number | null
  plan_y: number | null
  drawing_id: string | null
  created_at: string
  updated_at: string
}

export type DeficiencyLibrary = {
  id: string
  organization_id: string | null
  trade: string
  category: string
  default_title: string
  default_severity: DeficiencySeverity
  description: string | null
  acceptance_criteria: string | null
  typical_resolution: string | null
  active: boolean
  created_at: string
  updated_at: string
}
```

DB CHECK constraints will reject any new enum values not in this list.

---

## 3. API client (4 endpoints)

```typescript
const WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://notchfield.com'

// Create
export async function createDeficiencyViaWeb(
  payload: {
    projectId: string
    areaId: string
    surfaceId?: string
    title: string
    description?: string
    severity?: DeficiencySeverity
    stage?: DeficiencyStage
    responsibility?: DeficiencyResponsibility
    trade?: string
    category?: string
    libraryId?: string
    photos?: string[]   // remote_url paths
  },
  bearer: string,
) {
  const res = await fetch(`${WEB_BASE}/api/deficiencies/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`create failed: ${res.status}`)
  return res.json() as Promise<{ success: true; id: string }>
}

// Resolve (foreman uploads after-photos)
export async function resolveDeficiencyViaWeb(
  id: string,
  resolutionPhotos: string[],
  bearer: string,
) {
  const res = await fetch(`${WEB_BASE}/api/deficiencies/${id}/resolve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolutionPhotos }),
  })
  if (!res.ok) throw new Error(`resolve failed: ${res.status}`)
  return res.json() as Promise<{ ok: true }>
}

// Verify (PM/supervisor closes)
export async function verifyDeficiencyViaWeb(id: string, bearer: string) {
  const res = await fetch(`${WEB_BASE}/api/deficiencies/${id}/verify`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearer}` },
  })
  if (!res.ok) throw new Error(`verify failed: ${res.status}`)
  return res.json() as Promise<{ ok: true }>
}

// Reject (PM/supervisor rejects with reason)
export async function rejectDeficiencyViaWeb(id: string, reason: string, bearer: string) {
  const res = await fetch(`${WEB_BASE}/api/deficiencies/${id}/reject`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) throw new Error(`reject failed: ${res.status}`)
  return res.json() as Promise<{ ok: true }>
}
```

Same Bearer token pattern as Sprint 69/70.

---

## 4. UI surfaces

### "+ Report Deficiency" FAB on Area screen
Tap → modal:
1. Library picker (group by trade)
2. Title (pre-filled from library, editable)
3. Severity dropdown (cosmetic/minor/major/critical)
4. Photo capture (camera → upload to field-photos bucket → pass URL in `photos[]`)
5. Submit → `createDeficiencyViaWeb()`

### Today screen → "Resolve assigned deficiency" (Sprint 70 todo integration)
Each row tap → deficiency detail → "Mark Resolved" button → camera (after-photos) → submit → `resolveDeficiencyViaWeb()` with photos.

### Compliance screen (Supervisor)
- "Verify resolved deficiency" todos (Sprint 70 integration coming Phase 2)
- For now: Compliance section shows resolved deficiencies pending verification → tap → verify or reject with reason

---

## 5. Photo handling

Reuse existing field-photos bucket pattern:
1. Camera → temp file
2. Upload to `field-photos/{org_id}/deficiencies/{deficiencyId}/{uuid}.jpg`
3. Get public URL
4. Pass in `photos: [url1, url2, ...]` to create endpoint

For resolution photos, same bucket but store URLs in `resolutionPhotos[]` on resolve call.

The `deficiencies.photos` column is jsonb array of URL strings. No separate table.

---

## 6. What's NOT in Sprint 71 (defer)

- Drawing pin coords UI (`plan_x`, `plan_y`, `drawing_id` columns exist in DB but UI to set them = Phase 2 with drawing viewer integration)
- Back-charge auto-doc (`estimated_cost_cents`, `billed_amount_cents` are stub Phase 2)
- Photo annotation (Fabric.js arrows) — Phase 2
- AI category suggestion — Phase 3
- Surface_id picker — Phase 2 (for now nullable, just area-level)

---

## 7. Definition of Done

- [ ] PowerSync sync rule deployed
- [ ] FAB on area screen creates deficiency end-to-end
- [ ] Photo capture + upload to field-photos works
- [ ] Library picker shows ~40 templates grouped by trade
- [ ] Resolve flow uploads after-photos and posts to `/resolve`
- [ ] Today todo → tap → resolve flow works (once Sprint 70 todo integration ships in Phase 2)
- [ ] Critical severity deficiency creates notification (Sprint 69 integration coming Phase 2)

---

## 8. Auto-blindaje rules

- ❌ NEVER insert directly into `deficiencies` from Track. Use `/api/deficiencies/create`. RLS doesn't have a public INSERT policy for Track's role.
- ❌ NEVER mark resolved without uploading at least 1 after-photo. Resolution must have evidence.
- ❌ NEVER let foreman invent free-form categories. Use library picker; only fall back to free-text if library has no match (rare).
- ✅ ALWAYS pass severity from library default, but let foreman override if they think it's worse.
- ✅ ALWAYS pass `responsibility = 'unknown'` if foreman can't tell. Don't guess. PM can update later.

---

*Sprint 71 Track estimate: ~6h parallel. Backend ready, no blockers.*
