# SPRINT_TRACK_TODOS — Track team handoff (parallel work)

> **TL;DR for Track team:** You can start NOW. Web is building Sprint 70 (Todos Hub) in parallel. ~6h of UI work fits while Web ships DB schema (~30min) + API endpoints (~6h). Final integration test at the end.

> **Goal:** Track shows the foreman / supervisor a "Today" screen with their action queue. Tap a todo → marks done + navigates. Swipe right = done, swipe left = snooze. Same shared `todos` Supabase table that Web reads — zero duplicated logic.

> **Reference:** Full sprint spec is in `SPRINT_70_TODOS_HUB.md` (Web side). This doc extracts what Track needs.

---

## 0. What's NOT yours (avoid duplication)

❌ **Recipient resolution** — who gets each todo. Web owns 100%. Track does NOT compute "is this PM the right one for this RFI?" — Web's `createTodo()` knows.
❌ **Auto-completion logic** — when an RFI is responded, Web's service-layer calls `completeTodos()`. You don't track entity state.
❌ **Cron-based todo creation** — daily PTP, daily report checks, SST expiring scans run on Vercel cron. Not in Track.
❌ **The `todos` table itself** — Web owns schema/RLS. You read via PowerSync.

✅ **Yours:** PowerSync read config, Today screen, swipe gestures, mark-done / snooze API client calls, manual todo create UI (optional Phase 1).

---

## 1. What you can build NOW (parallel work, with mocks)

### T1. PowerSync sync rule (~20min)

Add to `sync_rules.yaml`:

```yaml
bucket_definitions:
  user_todos:
    parameters:
      - SELECT id AS user_id FROM profiles WHERE id = request.user_id()
    data:
      - SELECT * FROM todos
        WHERE owner_profile_id = bucket.user_id
          AND status IN ('pending', 'in_progress', 'snoozed')
```

Per-user bucket. Excludes `done` and `dismissed` so Track only syncs the active list (smaller payload).

Sync starts working once Web ships W1 (table exists). Until then, the rule sits in config.

### T2. Type registry — copy verbatim (~10min)

Copy from `SPRINT_70_TODOS_HUB.md` Section 3 → `services/todos/todoRegistry.ts`. Track must use the same `TodoType` union as Web. The DB CHECK constraint rejects unknown types — if you invent one, INSERT fails.

The registry has 17 Phase 1 types + `manual`. Each entry has:
- `type` — string identifier
- `role` — 'pm' | 'foreman' | 'supervisor' | 'any'
- `icon` — lucide name (use `lucide-react-native` icons)
- `defaultPriority` — 'critical' | 'high' | 'normal' | 'low'
- `titleKey` / `bodyKey` — i18n key references

Filter by `role` to show foreman screen vs supervisor screen.

### T3. API client wrapper (~30min)

Create `services/todos/todoApiClient.ts`:

```typescript
const WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://notchfield.com'

export async function markTodoDoneViaWeb(todoId: string, bearerToken: string) {
  const res = await fetch(`${WEB_BASE}/api/todos/${todoId}/done`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  })
  if (!res.ok) throw new Error(`mark done failed: ${res.status}`)
  return res.json() as Promise<{ ok: true }>
}

export async function snoozeTodoViaWeb(
  todoId: string,
  until: string,             // ISO timestamp
  bearerToken: string,
) {
  const res = await fetch(`${WEB_BASE}/api/todos/${todoId}/snooze`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ until }),
  })
  if (!res.ok) throw new Error(`snooze failed: ${res.status}`)
  return res.json() as Promise<{ ok: true }>
}

export async function dismissTodoViaWeb(todoId: string, bearerToken: string) {
  const res = await fetch(`${WEB_BASE}/api/todos/${todoId}/dismiss`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  })
  if (!res.ok) throw new Error(`dismiss failed: ${res.status}`)
  return res.json() as Promise<{ ok: true }>
}

// Optional Phase 1 — manual todo create from Track
export async function createManualTodoViaWeb(
  params: {
    title: string
    description?: string
    dueDate?: string
    priority?: 'critical' | 'high' | 'normal' | 'low'
    projectId?: string
    linkUrl?: string
  },
  bearerToken: string,
) {
  const res = await fetch(`${WEB_BASE}/api/todos/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`create failed: ${res.status}`)
  return res.json() as Promise<{ success: true; id: string }>
}
```

Use the same `bearerToken` you already use for other Web API calls (Sprint 52H pattern).

### T4. Today screen (Foreman) — with mocks (~3h)

Build the primary screen with mock data first. Layout:

```
Today · Wed Apr 26
─────────────────────
[Critical: 1]  [High: 2]  [Normal: 1]

🔴 Sign today's PTP
   Floor 03 — Bath rough-in
   Expires in 4h                                    →

🟡 Assign crew to L3-W4
   Tile install starting today
   Due today                                        →

🟡 Update L3-W2 (tile install — 2 days no progress)
   Last update: 2 days ago                          →

⚪ Submit daily report
   Due 5:00 PM                                      →

[+ New manual todo]
```

Each row:
- Wraps content in tappable area → marks done OR opens detail
- Swipe right → mark done (with 5-second undo toast)
- Swipe left → snooze menu (1h / End of day / Tomorrow)
- Long-press → details + edit (manual only)
- Right side has chevron `>` indicating navigable

**Sort order:** priority (critical → high → normal → low), then due_date ASC NULLS LAST, then created_at ASC.

**Mock data shape** — use this until Web ships W1:

```typescript
type Todo = {
  id: string
  organization_id: string
  owner_profile_id: string
  type: TodoType
  entity_type: string | null
  entity_id: string | null
  project_id: string | null
  title: string
  description: string | null
  link_url: string | null
  status: 'pending' | 'in_progress' | 'done' | 'snoozed' | 'dismissed'
  priority: 'critical' | 'high' | 'normal' | 'low'
  due_date: string | null
  snooze_until: string | null
  done_at: string | null
  done_by: string | null
  dismissed_at: string | null
  source: 'auto_event' | 'auto_cron' | 'manual'
  created_by: string | null
  created_at: string
  updated_at: string
}

export const MOCK_TODOS: Todo[] = [
  {
    id: 'mock1',
    organization_id: 'org',
    owner_profile_id: 'me',
    type: 'ptp_sign_today',
    entity_type: 'safety_document',
    entity_id: 'doc-abc',
    project_id: 'demo',
    title: "Sign today's PTP",
    description: 'Floor 03 — Bath rough-in. Expires in 4h.',
    link_url: '/projects/demo/pm/safety-documents/doc-abc',
    status: 'pending',
    priority: 'critical',
    due_date: new Date().toISOString().slice(0, 10),
    snooze_until: null,
    done_at: null,
    done_by: null,
    dismissed_at: null,
    source: 'auto_cron',
    created_by: null,
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'mock2',
    organization_id: 'org',
    owner_profile_id: 'me',
    type: 'crew_assign_today',
    entity_type: 'project',
    entity_id: 'demo',
    project_id: 'demo',
    title: 'Assign crew to L3-W4',
    description: 'Tile install starting today',
    link_url: '/projects/demo/pm/ready-board?area=area-w4',
    status: 'pending',
    priority: 'high',
    due_date: new Date().toISOString().slice(0, 10),
    snooze_until: null,
    done_at: null,
    done_by: null,
    dismissed_at: null,
    source: 'auto_cron',
    created_by: null,
    created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    id: 'mock3',
    organization_id: 'org',
    owner_profile_id: 'me',
    type: 'daily_report_submit',
    entity_type: 'daily_report',
    entity_id: 'rpt-today',
    project_id: 'demo',
    title: 'Submit daily report',
    description: 'Due 5:00 PM',
    link_url: '/projects/demo/pm/reports/daily',
    status: 'pending',
    priority: 'normal',
    due_date: new Date().toISOString().slice(0, 10),
    snooze_until: null,
    done_at: null,
    done_by: null,
    dismissed_at: null,
    source: 'auto_cron',
    created_by: null,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
]
```

### T5. Compliance screen (Supervisor) — with mocks (~2h)

Same layout pattern, filter `role === 'supervisor'`. Show:
- 🔴 Block escalations (> 4h on supervisor's projects)
- 🟡 SST expiring on supervisor's crews
- 🟡 Foreman missed daily report yesterday
- ⚪ New worker pending intake

### T6. Manual todo create UI — optional Phase 1 (~1h)

If you have time, add a `+` FAB on Today screen. Opens a modal:
- Title (required)
- Description (optional)
- Due date (optional)
- Priority (optional, default 'normal')

Calls `createManualTodoViaWeb(params, bearerToken)`.

If you defer this to Phase 2, foremen can still create manual todos from Web.

### T7. Mark-done / snooze UX (~30min)

After swipe-right (mark done):
1. Local optimistic update — fade row out
2. Show 5-second undo toast at bottom: "Marked done · Undo"
3. After 5s with no undo → call `markTodoDoneViaWeb(id, bearerToken)`
4. If user taps undo → cancel the call, restore row

After swipe-left (snooze menu):
- 4 options: "1 hour", "End of today (5 PM)", "Tomorrow 6 AM", "Custom..."
- Selected option → call `snoozeTodoViaWeb(id, until_iso, bearerToken)` → row disappears

PowerSync syncs the change back automatically — Web sees it, supervisor sees it (for shared accountability), todo stays in DB for audit.

---

## 2. What you need from Web (timing)

| Web task | What it gives you | ETA from Web start |
|----------|-------------------|--------------------|
| **W1.** `todos` table migration | PowerSync sync rule activates | ~30min |
| **W36.** `POST /api/todos/[id]/done` | Mark-done client works | ~6h |
| **W37.** `POST /api/todos/[id]/snooze` | Snooze client works | ~6h |
| **W38.** `POST /api/todos/[id]/dismiss` | Dismiss works | ~6h |
| **W39.** `POST /api/todos/create` | Manual todo create works | ~6h |

**Coordination signal:** When Web finishes W1 + W36-W39, Web team posts: "Sprint 70 backend ready — Track integration unblocked." Switch from mocks to real API calls.

---

## 3. What's NOT in Sprint 70 (defer)

- Push notifications when a critical todo arrives → Phase 2 (Track Sprint 71+)
- Calendar / timeline view of due dates → Phase 3
- Bulk actions (multi-select + bulk done) → Phase 2
- Cross-user assignment ("PM creates todo, assigns to specific foreman") → Phase 3
- Comments / discussion thread on a todo → Phase 3
- AI-generated todos → Phase 3

---

## 4. Coordination checklist

### Track's Definition of Done for Sprint 70
- [ ] PowerSync sync rule deployed (`user_todos` bucket)
- [ ] Today screen renders mock data correctly
- [ ] Compliance screen renders mock data correctly
- [ ] Sort order matches: critical → high → normal → low → due date asc
- [ ] Swipe right = mark done with 5s undo
- [ ] Swipe left = snooze menu (4 options)
- [ ] Tap row → navigates via `link_url` (parse Web URL → Track route)
- [ ] After Web ships W1 + W36-W39: switch from mocks to real API; manually test creating + completing one todo end-to-end

---

## 5. Auto-blindaje (rules)

❌ NEVER `INSERT INTO todos` directly from Track. Always `POST /api/todos/create` (manual todos) — the table has RLS that only allows manual inserts via the user's own session, and you'd want the Web validation layer anyway.
❌ NEVER recompute auto-completion in Track. When the foreman signs a PTP, Track POSTs to `/api/pm/safety-documents/[id]/distribute` (existing); Web's auto-completion engine marks the related todo done. Track just sees the todo disappear from PowerSync sync.
❌ NEVER call `markTodoDone` / `snooze` / `dismiss` if PowerSync hasn't synced the latest todo state. Use the local `updated_at` to detect optimistic-vs-real divergence; if local is stale by > 30s, refresh before mutating.
❌ NEVER add a new TodoType without coordinating with Web. The DB CHECK constraint will reject INSERTs from Web's `createTodo()` if Track somehow gets a row of unknown type into the table.
✅ ALWAYS show due date when set. Hiding it makes a todo informational, not actionable.
✅ ALWAYS preserve `link_url` and use it for tap navigation. Web URLs work in Track via the same parse-and-route logic you use for notification deep-links.
✅ ALWAYS use the same `bearerToken` your existing API calls use (Sprint 52H pattern). Don't fetch a fresh token per todo action.

---

## 6. Mock data — extra examples for variety

```typescript
// Critical block escalation (supervisor)
{
  id: 'mock-supervisor-1',
  type: 'block_escalation_4h',
  priority: 'critical',
  title: 'Block on L3-E2 (Demo Project) > 4h',
  description: 'Reason: other_trade. Reported by Carlos at 12:30 PM.',
  link_url: '/projects/demo/pm/ready-board?area=area-e2',
  // ...
}

// SST expiring (supervisor)
{
  id: 'mock-supervisor-2',
  type: 'sst_expiring_crew',
  priority: 'high',
  title: 'Mario R. SST expires in 5 days',
  description: 'Card #SST-12345 — exp 2026-05-01',
  link_url: '/manpower/worker-mario',
  // ...
}

// Stale surface (foreman)
{
  id: 'mock-foreman-stale',
  type: 'surface_progress_stale',
  priority: 'normal',
  title: 'Update L3-W2 — tile install',
  description: 'Started 2 days ago, no progress logged',
  link_url: '/projects/demo/pm/ready-board?area=area-w2',
  // ...
}
```

---

## 7. Questions for Web team

If anything is unclear while building, ping Web team:
1. **link_url format** — Web defaults to `/projects/{id}/pm/...`. If Track router can't parse, Web can change BEFORE we wire 17 trigger sites.
2. **Snooze granularity** — Web supports any `snooze_until` ISO timestamp. Track UI offers 4 presets but advanced users could enter custom. OK?
3. **What happens on undo of mark-done?** — current design: Track delays the API call by 5s (debounce). If user undoes, just cancel the timeout. No round-trip to Web. Confirm.
4. **Manual todo source field** — Track manual todos should set `source = 'manual'`. Web `/api/todos/create` enforces this server-side. Confirm.

---

*Sprint 70 Track estimate: ~6h parallel + ~1h integration test once Web ships backend.*
*Phase 2 (push for critical todos): ~2h additional in next Track sprint after push channel exists.*
