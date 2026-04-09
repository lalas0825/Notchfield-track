# SPRINT 42B — Track Punchlist UI
# MODEL: /model claude-opus-4-6
# Repo: notchfield-track
# DEPENDS ON: Takeoff Sprint 42A (gc_punch_items table + Edge Functions)

---

## Context

Read CLAUDE_TRACK.md before starting.

Sprint 42A created gc_punch_items in the shared Supabase. These are punchlist 
items synced from GC platforms (Procore first). Polishers need to see their 
assigned items in Track, mark them complete, upload resolution photos, and 
log hours. All offline-first via PowerSync.

The polisher workflow:
1. Open Track → Punchlist tab
2. See assigned items grouped by location (floor/unit)
3. Tap item → see details (description, GC photos, location)
4. Mark "In Progress" when starting
5. Take resolution photos
6. Log hours worked
7. Mark "Ready for Review" when done
8. Data syncs to Supabase → Edge Function pushes to Procore

---

## CHANGE 1: PowerSync Schema

In `src/shared/lib/powersync/schema.ts`, add:

```typescript
gc_punch_items: new TableV2({
  organization_id: column.text,
  gc_project_id: column.text,
  project_id: column.text,
  external_item_id: column.text,
  platform: column.text,
  title: column.text,
  description: column.text,
  item_number: column.text,
  location_description: column.text,
  floor: column.text,
  unit: column.text,
  status: column.text,
  external_status: column.text,
  priority: column.text,
  assigned_to_user_id: column.text,
  assigned_to_name: column.text,
  external_assignee_id: column.text,
  external_assignee_name: column.text,
  due_date: column.text,
  created_externally_at: column.text,
  closed_at: column.text,
  hours_logged: column.real,
  resolution_notes: column.text,
  completed_at: column.text,
  completed_by: column.text,
  external_photos: column.text,       // JSON string
  resolution_photos: column.text,     // JSON string
  external_data: column.text,         // JSON string
  synced_at: column.text,
  push_pending: column.integer,       // boolean as int
  last_push_at: column.text,
  last_push_status: column.text,
  created_at: column.text,
  updated_at: column.text,
}),
```

Add to Schema export.

---

## CHANGE 2: Sync Rules

In `powersync/sync-rules.yaml`, add:

```yaml
- SELECT * FROM gc_punch_items WHERE organization_id = bucket.organization_id
```

---

## CHANGE 3: Punchlist Tab

Add a new tab to the bottom navigation OR add Punchlist as a section 
in the existing "More" tab. Given this is a primary workflow for polishers,
it should be prominent.

**Recommended: Replace or augment the "Board" tab**

Option A: Add "Punch" as a 6th bottom tab (if the design allows it)
Option B: Add it under "More" menu as the first item
Option C: Make it a toggle on the Board screen (Board | Punch)

Pick whichever is simplest to implement. The key is the polisher can 
reach it in 1-2 taps.

### Punchlist List Screen

Route: `src/app/(tabs)/more/punchlist/index.tsx` (or wherever placed)

```
┌─────────────────────────────────────────┐
│ Punchlist                    [Filter ▼] │
│ 24 items · 3 in progress               │
├─────────────────────────────────────────┤
│                                         │
│ FLOOR 34 — UNIT 3406                    │
│ ┌─────────────────────────────────────┐ │
│ │ PL-127  Marble chip near entry     │ │
│ │ 📍 Master Bath · Due: Apr 15       │ │
│ │ ⚡ High              [Open]        │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ PL-128  Scratch on vanity top      │ │
│ │ 📍 Master Bath · Due: Apr 15       │ │
│ │                      [In Progress] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ FLOOR 34 — UNIT 3407                    │
│ ┌─────────────────────────────────────┐ │
│ │ PL-130  Grout haze on floor        │ │
│ │ 📍 Kitchen · Due: Apr 18           │ │
│ │                      [Open]        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ COMPLETED (12)                     [▼]  │
│ └─ collapsed section                    │
└─────────────────────────────────────────┘
```

### Data Query
```sql
SELECT * FROM gc_punch_items 
WHERE project_id = ? 
  AND (assigned_to_user_id = ? OR assigned_to_user_id IS NULL)
ORDER BY 
  CASE status 
    WHEN 'in_progress' THEN 1 
    WHEN 'open' THEN 2 
    WHEN 'ready_for_review' THEN 3 
    WHEN 'closed' THEN 4 
  END,
  floor ASC, unit ASC, item_number ASC
```

### Grouping
- Group by floor + unit (from gc_punch_items.floor and .unit)
- If floor/unit are null, group under "Unlocated"
- In Progress items at top, then Open, then Ready for Review
- Completed/Closed items in collapsible section at bottom

### Filter Options
- Status: All, Open, In Progress, Ready for Review
- Priority: All, High, Critical
- Floor: dropdown from distinct floors

### Card Design
- Item number: PL-{item_number} or #{external_item_id} if no number
- Title: truncated to 2 lines max
- Location: floor + unit + location_description
- Due date: show in amber if overdue, red if past due
- Priority: show icon only for High (⚡) and Critical (🔴)
- Status badge: color-coded (Open=gray, In Progress=amber, Ready=blue, Closed=green)
- Platform badge: small "Procore" text in muted color (informational only)

---

## CHANGE 4: Punchlist Item Detail Screen

Route: `src/app/(tabs)/more/punchlist/[id].tsx`

```
┌─────────────────────────────────────────┐
│ ← PL-127                    [Procore]   │
├─────────────────────────────────────────┤
│                                         │
│ Marble chip near entry                  │
│ 📍 Floor 34 · Unit 3406 · Master Bath  │
│ Due: Apr 15, 2026                       │
│ Priority: ⚡ High                       │
│ Status: [Open ▼]                        │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ DESCRIPTION                             │
│ Small chip on marble threshold at       │
│ bathroom entry. Approximately 2" x 1".  │
│ Needs patching and polishing.           │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ GC PHOTOS (2)                           │
│ [📷 photo1] [📷 photo2]                │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ RESOLUTION                              │
│ Status: [Mark In Progress →]            │
│                                         │
│ Hours: [___0___] hrs                    │
│ Notes: [________________________]       │
│                                         │
│ Resolution Photos:                      │
│ [📸 Take Photo]  [📁 Upload]           │
│ (no photos yet)                         │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ [       Mark Ready for Review       ]   │
│                                         │
└─────────────────────────────────────────┘
```

### Sections:

**Header:** Item number, platform badge, title, location, due date, priority

**Description:** From gc_punch_items.description. Read-only (comes from GC).

**GC Photos:** From gc_punch_items.external_photos (JSON array of URLs).
Display as horizontal scrollable thumbnails. Tap to view full size.
These are photos the GC took when creating the punchlist item — they show 
the polisher WHAT needs to be fixed.

**Resolution Section:** This is what the polisher fills in.
- Status selector: Open → In Progress → Ready for Review
- Hours input: numeric, tracks time spent (gc_punch_items.hours_logged)
- Notes: text input for resolution description
- Resolution Photos: camera button to take before/after photos
  Store in Supabase Storage, URLs in gc_punch_items.resolution_photos

**Action Button:** Large bottom button changes based on current status:
- Open → "Start Work" (changes to in_progress)
- In Progress → "Mark Ready for Review" (changes to ready_for_review)
- Ready for Review → "Reopen" (if GC rejects, polisher can reopen)
- Closed → no action (read-only, show "Closed by GC")

### On Status Change:
1. Update gc_punch_items.status locally (PowerSync)
2. Set gc_punch_items.push_pending = true
3. If marking ready_for_review: set completed_at = now(), completed_by = userId
4. PowerSync syncs to Supabase
5. A database trigger or cron detects push_pending = true
6. Calls gc-push-resolution Edge Function to push to Procore

### Photo Upload:
1. Use existing photo service (enqueuePhoto or similar)
2. Upload to Supabase Storage bucket (e.g., 'punch-item-photos')
3. Get public URL
4. Append URL to gc_punch_items.resolution_photos JSON array
5. Set push_pending = true (photos will be pushed to Procore)

### Hours Logging:
- Simple numeric input, increments by 0.5
- Updates gc_punch_items.hours_logged
- This does NOT push to Procore (hours stay internal for Jantile reporting)
- Save on blur or with a small debounce

---

## CHANGE 5: Push Trigger

When gc_punch_items are updated with push_pending = true, we need to 
trigger the gc-push-resolution Edge Function.

Option A: Database trigger that calls the Edge Function via pg_net
Option B: Cron that checks for push_pending items every 5 minutes
Option C: Client-side call after PowerSync sync completes

**Recommended: Option B (cron)** — simplest and most reliable with offline.

Create a Supabase cron or use the existing pull cron to also check for 
push_pending items:

```sql
-- Add to the pull cron or create separate
-- Check every 5 minutes for items needing push
SELECT id FROM gc_punch_items 
WHERE push_pending = true 
  AND (last_push_at IS NULL OR last_push_at < now() - interval '5 minutes');
```

For now, the Edge Function gc-push-resolution already exists (Sprint 42A).
Just make sure push_pending items get processed. The simplest approach:

Add to gc-pull-items Edge Function (runs every 15 min already):
```typescript
// After pulling items, also push any pending resolutions
const { data: pendingPush } = await supabase
  .from('gc_punch_items')
  .select('id')
  .eq('push_pending', true)
  .eq('organization_id', conn.organization_id);

for (const item of pendingPush || []) {
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/gc-push-resolution`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ punch_item_id: item.id }),
  });
}
```

---

## CHANGE 6: Permissions Integration

Use the permission system from Sprint 40C:

- Supervisor: sees ALL punch items across assigned projects
- Foreman: sees punch items for their 1 project
- Worker: sees only items assigned to them (assigned_to_user_id = userId)
  OR all items if no assignment filtering exists yet

Gate the Punchlist screen:
```typescript
// Only show if user has punchlist feature access
if (!canUseFeature('punchlist')) return null;
```

Add 'punchlist' to the feature matrix in trackPermissions.ts:
- supervisor: true
- foreman: true  
- worker: true (but filtered to assigned items)

---

## Styling (Field-First)

Follow existing Track UX rules:
- Touch targets: 56dp minimum for action buttons
- Font: 16sp body, 18sp titles, 14sp secondary
- High contrast status colors
- Cards: full width, 16px padding, clear tap area
- Photos: 80x80 thumbnails, tap to expand
- Hours input: large numeric keypad, 48dp input height
- Action button: full width, 56dp height, bold text

---

## Verify

1. gc_punch_items table added to PowerSync schema
2. Sync rules updated
3. Punchlist screen accessible from bottom nav or More menu
4. Items grouped by floor/unit
5. Items sorted: in_progress first, then open, then ready_for_review
6. Filter by status, priority, floor works
7. Completed items in collapsible section
8. Item detail shows description, location, due date, priority
9. GC photos displayed (from external_photos)
10. Status change: Open → In Progress → Ready for Review
11. Hours logging saves to gc_punch_items.hours_logged
12. Resolution notes save to gc_punch_items.resolution_notes
13. Resolution photos upload to Supabase Storage
14. push_pending set to true on status change and photo upload
15. Pending pushes processed (via cron or pull function)
16. Permission: supervisor sees all projects, foreman 1 project, worker assigned items
17. Offline works: can view items and mark status without connection
18. npx tsc --noEmit passes
