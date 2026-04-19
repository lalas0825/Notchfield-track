# Sprint Track — Manpower Integration (post-PTP)

> **Status:** Track's PTP foreman flow is LIVE in production. This sprint migrates Track from the old `profiles`-based crew model to the new `workers` table introduced in Takeoff Sprint CREW.
>
> **Urgency:** Ship before the next Jantile field day. Takeoff commit `5842411` DROPPED `profiles.sst_card_number` and `profiles.sst_expires_at`. Any Track code path still reading those columns is **broken in production right now**.
>
> **Scope:** schema absorb + PowerSync reconfigure + PTP signature rewire + Crew tab refactor. No UX redesign — same 4 PTP screens, new data source.
>
> **Est:** 3-5 days, one engineer.

---

## 1. TL;DR — what broke, what to fix

```
DROPPED (as of Takeoff 5842411):
  ❌ profiles.sst_card_number
  ❌ profiles.sst_expires_at

NEW TABLES (ready to consume):
  ✅ workers (24 cols: identity, certs, rates, photo, emergency)
  ✅ project_workers (M:N assignments, soft-delete)

NEW BUCKET:
  ✅ worker-photos (public read)

SEMANTIC SHIFT:
  ⚠️  crew_assignments.worker_id  → now references workers.id (was profiles.id)
  ⚠️  area_time_entries.worker_id → now references workers.id
  ⚠️  ptp_signatures[].worker_id  → now references workers.id
```

Everything in `§3 code patches` below is a surgical change. No greenfield work.

---

## 2. The two-tier mental model

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

Foreman in Track IS both: a profile (for login) AND a worker (for HR data). Link is `workers.profile_id = profiles.id`.

---

## 3. Code patches (ordered by urgency)

### 3.1 ⚠️ HOTFIX — find and kill any read of `profiles.sst_*`

```bash
# Run these in Track repo root. Any hit must be rewritten:
grep -rn "sst_card_number" src/ | grep -vi "workers"
grep -rn "sst_expires_at"  src/ | grep -vi "workers"
grep -rn "'profiles'"      src/ | xargs -I{} grep -l "sst" {} 2>/dev/null
```

If the only hits are in Track's fallback UI or debug screens — delete them. These columns no longer exist. Supabase will throw on SELECT.

### 3.2 PowerSync sync groups — ADD workers + project_workers

```yaml
# powersync.yaml or wherever Track configures sync groups

workers:
  sync: bi-directional
  # Track needs WRITE access for the walk-in worker flow below
  filter: organization_id = :userOrgId

project_workers:
  sync: down-only
  # Foreman reads his assigned crew. Supervisor writes from Takeoff Web.
  filter: >
    organization_id = :userOrgId
    AND project_id IN :foremanProjects
    AND active = true

# Keep profiles sync — but remove sst_card_number / sst_expires_at from
# any projections that selected specific columns.
profiles:
  # no schema change, just verify no code selects dropped columns
  sync: down-only
  filter: organization_id = :userOrgId
```

### 3.3 Crew tab — repoint to workers

**Before** (assumed):
```typescript
const { data } = await supabase
  .from('crew_assignments')
  .select('*, worker:profiles(full_name, ...)')
  .eq('foreman_id', userId)
  .eq('active', true)
```

**After**:
```typescript
const { data } = await supabase
  .from('project_workers')
  .select(`
    id,
    worker:workers(
      id, first_name, last_name, photo_url,
      trade, trade_level,
      sst_card_number, sst_expires_at,
      osha_10_expires_at, swac_expires_at,
      silica_trained, i9_verified
    )
  `)
  .eq('project_id', foremanProjectId)
  .eq('active', true)

// Derive full name in Track
const workerFullName = (w: { first_name: string; last_name: string }) =>
  `${w.first_name} ${w.last_name}`.trim()
```

### 3.4 PTP signature capture — snapshot SST from workers

**Before** (assumed — read SST live from profiles at sign time):
```typescript
const sig = {
  worker_id: profileId,
  worker_name: profile.full_name,
  sst_card_number: profile.sst_card_number,  // ❌ column dropped
  ...
}
```

**After**:
```typescript
// Resolve the worker (foreman reads their own, crew reads their own)
const { data: worker } = await supabase
  .from('workers')
  .select('id, first_name, last_name, sst_card_number')
  .eq('id', selectedWorkerId)
  .single()

const sig: PtpSignature = {
  worker_id: worker.id,              // references workers.id now
  worker_name: `${worker.first_name} ${worker.last_name}`,
  sst_card_number: worker.sst_card_number,  // snapshot — frozen at sign time
  signature_data_url: canvasDataUrl,
  signed_at: new Date().toISOString(),
  is_foreman: worker.id === foremanWorkerId,
  is_walk_in: false,
}
```

**Snapshot ≠ live reference.** The value of `sst_card_number` goes INTO the signature JSONB. If worker's SST is later updated, the PDF still shows what was valid at sign time. That's the point — immutability.

### 3.5 Foreman's own worker row — profile_id lookup

The foreman logging into Track has a `profile` (for auth). They also need a `worker` row for HR data. Resolve it once on app boot:

```typescript
// In Track's AuthContext or session init
const { data: myWorker } = await supabase
  .from('workers')
  .select('*')
  .eq('profile_id', session.userId)
  .eq('active', true)
  .maybeSingle()

if (!myWorker) {
  // PM hasn't added this foreman to Manpower yet.
  // Show a blocking onboarding message:
  //   "Ask your PM to add you in Manpower with your SST card."
  // Don't allow PTP creation until myWorker is resolved.
  return <OnboardingBlocker />
}

// Cache myWorker in context for the whole session
```

Then in the PTP flow, `myWorker.id` is what goes into the foreman's signature.

### 3.6 Walk-in worker flow — create a workers row (don't pass null)

Takeoff's PtpSignature Zod allows `worker_id: null` for walk-ins, but the clean approach is to **create a real `workers` row** so PM sees them next sync.

```typescript
async function addWalkInWorker(firstName: string, lastName: string, orgId: string) {
  const { data: walkIn, error } = await supabase
    .from('workers')
    .insert({
      organization_id: orgId,
      profile_id: null,
      first_name: firstName,
      last_name: lastName,
      active: true,
      trade_level: 'other',
      notes: `Walk-in added by foreman on ${new Date().toISOString().slice(0, 10)}`,
    })
    .select()
    .single()

  if (error) throw error

  // Use walkIn.id in the signature, mark is_walk_in=true so PDF distinguishes
  return walkIn
}
```

PM then fills in SST/OSHA/trade later from Takeoff Web's `/manpower/[id]`.

### 3.7 SST expiring warning on crew list

Use the `classifyCertStatus` logic from Takeoff's workerService (port it to Track):

```typescript
// utils/certStatus.ts — copy from Takeoff workerService.ts
export type CertStatus = 'valid' | 'expiring' | 'expired' | 'missing'

export function classifyCertStatus(
  cardNumber: string | null | undefined,
  expiresAt: string | null | undefined,
): CertStatus {
  if (!cardNumber) return 'missing'
  if (!expiresAt) return 'valid'
  const expiry = new Date(expiresAt).getTime()
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  if (expiry < now) return 'expired'
  if (expiry - now < thirtyDays) return 'expiring'
  return 'valid'
}
```

On crew tab card:
```
┌──────────────────────────────┐
│ 📷  Mario Rodriguez          │
│     Mechanic · tile          │
│     SST ✓ Valid              │    ← green if 'valid'
└──────────────────────────────┘

┌──────────────────────────────┐
│ 📷  Carlos Mendez            │
│     Mechanic · tile          │
│     SST ⚠️ Expiring (28 days) │    ← yellow if 'expiring'
└──────────────────────────────┘

┌──────────────────────────────┐
│ 📷  Pedro Lopez              │
│     Helper · tile            │
│     SST ❌ Expired — 5 days   │    ← red if 'expired'
└──────────────────────────────┘
```

When foreman tries to include a worker with expired SST in a PTP:
```
Dialog:
  "Pedro's SST expired 5 days ago.
   Proceed without blocking?"
   [ Cancel ]  [ Proceed anyway ]
```
Don't HARD block. Foreman needs the option for emergencies. Just make them confirm.

---

## 4. Data migration — pick ONE before deploying

### Option A — Clean slate (recommended for Jantile pilot)
Data in `crew_assignments` and `area_time_entries` is disposable. Easiest and safest.

Run once on production DB (via Supabase SQL editor):
```sql
BEGIN;
TRUNCATE crew_assignments RESTART IDENTITY;
TRUNCATE area_time_entries RESTART IDENTITY;
-- If there are other tables with worker_id → profiles FKs, truncate those too
COMMIT;
```

Then:
1. Supervisor/PM opens `/manpower` in Takeoff Web
2. Adds workers via Add Worker or CSV import
3. Assigns workers to projects
4. Foreman opens Track → sees fresh crew in Crew tab

### Option B — Backfill (if pilot data matters)
```sql
BEGIN;

-- 1. Create workers rows from existing field-role profiles
INSERT INTO workers (
  organization_id, profile_id, first_name, last_name, email,
  trade_level, active
)
SELECT
  p.organization_id,
  p.id,
  COALESCE(NULLIF(split_part(p.full_name, ' ', 1), ''), p.full_name, '—'),
  COALESCE(NULLIF(trim(regexp_replace(p.full_name, '^[^ ]+\s*', '')), ''), '—'),
  (SELECT email FROM auth.users WHERE id = p.id),
  CASE WHEN p.role = 'foreman' THEN 'foreman' ELSE 'other' END,
  COALESCE(p.is_active, true)
FROM profiles p
WHERE p.role IN ('foreman', 'worker', 'supervisor')
  AND NOT EXISTS (SELECT 1 FROM workers w WHERE w.profile_id = p.id);

-- 2. Repoint crew_assignments.worker_id
UPDATE crew_assignments ca
SET worker_id = w.id
FROM workers w
WHERE w.profile_id = ca.worker_id;

-- 3. Repoint area_time_entries.worker_id
UPDATE area_time_entries ate
SET worker_id = w.id
FROM workers w
WHERE w.profile_id = ate.worker_id;

-- 4. Sanity check — count should be zero
SELECT COUNT(*) AS orphaned_crew FROM crew_assignments ca
  LEFT JOIN workers w ON w.id = ca.worker_id WHERE w.id IS NULL;

SELECT COUNT(*) AS orphaned_time FROM area_time_entries ate
  LEFT JOIN workers w ON w.id = ate.worker_id WHERE w.id IS NULL;

-- If both zero → COMMIT. If not → ROLLBACK and investigate.
COMMIT;
```

**TEST ON A STAGING DUMP FIRST.** This is a schema migration with FK semantic change — production is not the place to discover edge cases.

### For PTP signatures already distributed
Existing `safety_documents` rows with `doc_type='ptp'` that have signatures pointing at profiles UUIDs — **leave them alone**. The signatures are snapshots anyway (worker_name + sst_card_number are in the JSONB). The worker_id inside each signature JSONB pointed at a profile ID historically; it doesn't need to be rewritten. Future PTPs will use workers.id.

---

## 5. Testing plan (run in order)

### Phase 1 — smoke after migration
- [ ] Run migration (A or B) on staging
- [ ] Supabase SQL: `SELECT COUNT(*) FROM workers` — expected count
- [ ] `SELECT COUNT(*) FROM crew_assignments WHERE worker_id IS NOT NULL` — all resolve to a workers row
- [ ] No Track build errors with new schema types

### Phase 2 — Takeoff Web side (PM)
- [ ] PM opens `/manpower` → sees workers
- [ ] PM assigns worker to project → `project_workers` row created with active=true
- [ ] PM uploads photo → visible in list

### Phase 3 — Track side (Foreman)
- [ ] Foreman opens Track → Crew tab loads
- [ ] Crew tab shows `first_name + last_name` (derived, not `full_name`)
- [ ] Photo thumbnails render (from worker-photos bucket, public URL)
- [ ] SST badge shows correct color per cert status

### Phase 4 — PTP end-to-end
- [ ] Foreman starts new PTP in Track
- [ ] Task selection loads JHA library for foreman's trade
- [ ] Crew signature screen shows assigned workers (from project_workers)
- [ ] Walk-in flow creates a real `workers` row in DB
- [ ] PTP submit succeeds, PDF generated
- [ ] PDF shows correct SST card numbers (snapshotted at sign time)
- [ ] PM reviews in Takeoff Web → all metadata correct

### Phase 5 — edge cases
- [ ] Foreman without a workers row → blocked with clear message
- [ ] Worker with expired SST → yellow/red badge + confirm dialog on PTP include
- [ ] SST updated AFTER distribute → PDF still shows old value (snapshot works)
- [ ] Walk-in from previous PTP appears in PM's Manpower list next day

---

## 6. Task breakdown — order of work

| # | Task | Est | Blocked by |
|---|------|-----|------------|
| 1 | Hotfix: grep/kill `profiles.sst_*` references | 1h | — |
| 2 | PowerSync config: add workers + project_workers sync groups | 1h | 1 |
| 3 | Decide migration Option A vs B; run on staging | 1h | 2 |
| 4 | Port `classifyCertStatus` utility to Track | 0.5h | — |
| 5 | Rewrite Crew tab query (profiles → workers) | 2h | 3 |
| 6 | Update Crew card UI (first_name + last_name + SST badge) | 2h | 4, 5 |
| 7 | Add AuthContext myWorker resolution (profile_id lookup) | 2h | 3 |
| 8 | Onboarding blocker when foreman has no workers row | 1h | 7 |
| 9 | Update PTP signature capture to snapshot from workers | 2h | 5, 7 |
| 10 | Walk-in flow creates `workers` row | 1.5h | 5 |
| 11 | SST expiring warning + confirm dialog on PTP include | 1h | 4, 9 |
| 12 | Run Phase 1–5 testing checklist on staging | 0.5d | 1–11 |
| 13 | Deploy to prod | 0.5d | 12 |

**Total: ~3 days of focused work + 1 day for testing + 1 day buffer = 5 days.**

---

## 7. Done when

- [ ] No Track code references `profiles.sst_card_number` or `profiles.sst_expires_at`
- [ ] Track's Crew tab reads from `project_workers` JOIN `workers`
- [ ] Foreman's own `workers` row resolves on app boot via `profile_id`
- [ ] PTP signatures capture `worker_id` from `workers`, snapshot SST from same
- [ ] Walk-in flow creates a real `workers` row (not null worker_id)
- [ ] PowerSync syncs `workers` bi-directional + `project_workers` down
- [ ] Staging regression: foreman creates PTP, signs, distributes, PDF valid
- [ ] Production migration run (Option A or B)
- [ ] Jantile's Jose (foreman) tests one real PTP end-to-end on prod

---

## 8. Gotchas + rollback

### If things go wrong
Option A (truncate) is reversible in concept only — you've lost `crew_assignments` history. Restore from your nightly Supabase backup if that data turns out to matter.

Option B is safer but has edge cases:
- **Profiles with missing full_name** → `first_name` becomes `—`. Fix manually in Takeoff's `/manpower/[id]` post-migration.
- **Duplicate workers** if migration runs twice. The `NOT EXISTS` clause guards against this, but verify with: `SELECT profile_id, COUNT(*) FROM workers GROUP BY profile_id HAVING COUNT(*) > 1;` — should be empty.

### Don't do this
- ❌ Re-add `sst_card_number` to `profiles`. It's gone. Workers own it now.
- ❌ Write to `workers.sst_card_number` from Track without updating the worker's row — snapshot into signature JSONB only.
- ❌ Use `profiles.id` as `worker_id` in a new PTP. Always resolve via `workers` first.

---

*Track's PTP flow is production-tested. This sprint makes the underlying data model match Takeoff's. Once done, Jantile has the full chain working: Supervisor seeds workers in Takeoff → Foreman sees crew in Track → Foreman PTPs reference workers → PM sees same data in Takeoff → GC gets PDF with valid SST numbers.*
