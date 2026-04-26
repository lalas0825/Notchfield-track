# Sprint 70 — Takeoff Web Coordination

> **Audience:** Takeoff Web team (Sprint 70 — Todos Hub)
> **Companion to:** [SPRINT_TRACK_TODOS.md](SPRINT_TRACK_TODOS.md)
> **Status (2026-04-26):** Track Phase 1 shipped (commit `645257c`). Mocks-on. Awaiting Web W1 + W36–W39 to flip live.
> **Pattern:** Same as Sprint 69 (Notifications) — Track builds UI + triggers in parallel, mocks fed via a single feature flag, ships live the moment Web posts "Sprint 70 backend ready".

---

## ✅ Track Phase 1 — what shipped (mocks)

| Layer | File | Notes |
|-------|------|-------|
| PowerSync sync rule | `powersync/sync-rules.yaml` | Added to existing `by_user` bucket — see §1 below |
| Schema declaration | `src/shared/lib/powersync/schema.ts` | TableV2 with all 19 columns from spec |
| Type registry | `src/features/todos/services/todoRegistry.ts` | 8 known types + manual; unknown types fall back to neutral default |
| API client | `src/features/todos/services/todoApiClient.ts` | `markDoneAndForget` / `snoozeAndForget` / `dismissAndForget` / `createManualTodoViaWeb` |
| Optimistic store | `src/features/todos/state/optimisticStore.ts` | Zustand-shared so Today screen + header badge stay in sync (Sprint 69 lesson) |
| Hook | `src/features/todos/hooks/useTodos.ts` | Mock branch via `USE_MOCK_TODOS = true` constant |
| UI | `TodayScreen` + `TodoItem` + `PriorityChips` + `TodoActionSheet` + `UndoToast` + `ManualTodoModal` + `TodayHeaderIcon` | All under `src/features/todos/components/` |
| Route | `src/app/(tabs)/today/` | Hidden tab via `href: null`; entry is the checkbox icon in the Home header |

---

## 🔓 Track is blocked on (Web TODO)

| Web task | What it unblocks Track-side | ETA from Web |
|----------|----------------------------|--------------|
| **W1.** `todos` table migration + RLS + CHECK constraint on `type` | PowerSync sync rule activates; `useTodos` reads from local SQLite instead of mocks | ~30 min |
| **W36.** `POST /api/todos/[id]/done` | `markDoneAndForget` hits a real endpoint (currently logs warn on the static mocks) | ~6 h |
| **W37.** `POST /api/todos/[id]/snooze` | Snooze flow live (Track already passes `{ until: ISO }`) | ~6 h |
| **W38.** `POST /api/todos/[id]/dismiss` | Dismiss flow live | ~6 h |
| **W39.** `POST /api/todos/create` | Manual create modal works end-to-end | ~6 h |
| **Section 3 verbatim copy** of `SPRINT_70_TODOS_HUB.md` (the 17 TodoType union) | Track fills the registry with real icons + default priorities | trivial — paste it |

**Coordination signal:** When W1 + W36–W39 land, Web posts:
> "Sprint 70 backend ready — Track integration unblocked."

Track's response is **one line**: flip `USE_MOCK_TODOS = false` in `src/features/todos/hooks/useTodos.ts`, push, ship.

---

## 1. Sync rule — Track picked `by_user`, not `user_todos`

The spec proposed a new `user_todos` bucket. Track instead added the query to the existing **`by_user`** bucket because the project already has that pattern (Sprint 69 notifications was added the same way):

```yaml
by_user:
  parameters:
    - SELECT id AS user_id FROM profiles WHERE id = token_parameters.user_id
  data:
    # ... existing per-user queries ...
    - SELECT * FROM todos
      WHERE owner_profile_id = bucket.user_id
        AND status IN ('pending', 'in_progress', 'snoozed')
```

**Question:** OK with Web? Net effect is identical (per-user filter, RLS still enforces row-level access). Functionally indistinguishable.

**Status filter:** Track includes `'snoozed'` so PowerSync replicates snoozed rows down. Server-side trigger flips them back to `'pending'` when `snooze_until` expires; Track's UI hides them (filter on the screen) until the flip happens. Confirm this is how Web's snooze trigger works (i.e. server flips status, not Track).

---

## 2. Decisions Track made that Web should sanity-check

### 2.1 No swipe gestures — tap+sheet instead

Spec said "swipe right = mark done, swipe left = snooze". The project doesn't bundle `react-native-gesture-handler` (verified — would mean a native APK rebuild). Track's UX:

- **Tap row** → mark done with **5-second undo toast** at the bottom (Gmail pattern: a 2nd tap during the window flushes the 1st).
- **Tap ⋯** (three-dot button on each row) → bottom sheet with: **Open** / **Snooze (1h / EOD 5 PM / Tomorrow 6 AM)** / **Dismiss**.

Same actions, no gesture lib. If pilots specifically ask for swipe later, we'll add `react-native-gesture-handler` in a follow-up sprint.

**Web action:** none — UX choice is Track-internal. Just FYI.

### 2.2 Manual todo `source` field — Track does NOT send it

Per SPRINT_TRACK_TODOS.md §5, Track NEVER sets `source`. The `createManualTodoViaWeb` payload only sends `{ title, description?, dueDate?, priority?, projectId?, linkUrl? }`. **Web's `/api/todos/create` must server-side default `source = 'manual'`** regardless of payload. Confirm this is how W39 is wired.

### 2.3 `link_url` Track-side route conversion is best-effort

Track currently maps these Web URL patterns to local routes (`src/features/todos/components/TodayScreen.tsx` `onOpen`):

| Web URL contains | Track route |
|------------------|-------------|
| `/safety-documents/{id}` | `/(tabs)/docs/safety/{id}` |
| `/ready-board` | `/(tabs)/board` |
| `/manpower/...` | `/(tabs)/more/crew` |
| `/reports/daily` | `/(tabs)/docs` |

Anything else: no-op (the Open action just closes the sheet). A real Web URL → Track route parser is a Phase 2 task.

**Web action:** if you change `link_url` conventions before launch, ping Track so the mapper updates. Adding new URL patterns Web emits is fine — they just won't deep-link until Phase 2.

### 2.4 Type registry has 8 known types, fallback for unknowns

Track only has the 8 types referenced in `SPRINT_TRACK_TODOS.md` (mocks + spec text):

```
Foreman:
  ptp_sign_today, crew_assign_today, surface_progress_stale, daily_report_submit
Supervisor:
  block_escalation_4h, sst_expiring_crew, foreman_missed_daily_report, worker_intake_pending
Any:
  manual
```

Spec says there are 17 Phase 1 types. The other ~9 will arrive via PowerSync as strings; Track renders them with a generic clipboard icon and the row's own `priority` (no styling crash). Need verbatim copy of `SPRINT_70_TODOS_HUB.md §3` so Track can map them to icons + role + default priority.

**Web action:** paste §3 contents into a Slack thread or commit to a shared file.

---

## 3. API contract — confirm shapes match

Track's `todoApiClient.ts` expects exactly this:

| Endpoint | Method | Body | Response | Auth |
|----------|--------|------|----------|------|
| `/api/todos/{id}/done` | POST | _(none)_ | `{ ok: true }` | Bearer JWT |
| `/api/todos/{id}/snooze` | POST | `{ until: ISO }` | `{ ok: true }` | Bearer JWT |
| `/api/todos/{id}/dismiss` | POST | _(none)_ | `{ ok: true }` | Bearer JWT |
| `/api/todos/create` | POST | `{ title, description?, dueDate?, priority?, projectId?, linkUrl? }` | `{ success: true, id: string }` | Bearer JWT |

Auth is the same `Authorization: Bearer <supabase-jwt>` Track uses for `/api/notifications/notify` and `/api/pm/legal-documents/[id]/distribute`. Token resolved per-call from `supabase.auth.getSession().access_token`.

**Web action:** if you have to deviate (e.g. snooze body becomes `{ snoozeUntil }`, or response wraps in `{ data: { ok: true } }`) flag it BEFORE shipping so Track aligns in a single follow-up commit instead of debugging in pilot.

---

## 4. Open questions for Web

1. **Snooze trigger** — confirm Web flips `status: snoozed → pending` server-side when `snooze_until <= now()`. Track relies on PowerSync replicating that update; we never run this logic client-side.
2. **Auto-completion engine** — when the foreman signs a PTP, Track POSTs to `/api/pm/safety-documents/[id]/distribute` (existing). Confirm Web's auto-completion engine subsequently flips the matching `ptp_sign_today` todo to `status='done'`. Track does NOT run any client-side completion logic.
3. **Mark-done debounce window** — Track delays the API call by 5 s (the undo toast). If user undoes within the window the call is cancelled entirely, no round-trip to Web. OK?
4. **`updated_at` semantics** — Track uses local `updated_at` to detect optimistic-vs-real divergence (per SPRINT_TRACK_TODOS.md §5). Confirm Web sets `updated_at = now()` on every status change so Track's "stale by > 30s" check works.
5. **Cron-created todos arriving offline** — when Web's daily-PTP-cron creates a `ptp_sign_today` todo, the foreman might not be online for hours. PowerSync delivers the row when reconnect happens. Confirm cron runs at a stable hour (e.g. 06:00 user-local) so the todo arrives BEFORE the foreman opens the app.
6. **`link_url` for cron-created todos** — confirm cron-side todo creation also sets `link_url`. Track wants the deep-link target on every actionable todo.

---

## 5. What's NOT in Sprint 70 (defer agreed)

- Push notifications when a critical todo arrives → **Phase 2** (Track Sprint 71+; the device_tokens table + fanout function exist, just need the trigger).
- Calendar / timeline view of due dates → Phase 3.
- Bulk multi-select + bulk done → Phase 2.
- Cross-user assignment ("PM creates todo, assigns to specific foreman") → Phase 3.
- Comments / discussion thread on a todo → Phase 3.
- AI-generated todos → Phase 3.
- Real Web URL → Track route parser (general-purpose; Phase 1 ships best-effort) → Phase 2.

---

## 6. Pilot acceptance test (Track + Web together)

When Web posts "Sprint 70 backend ready":

1. **Track:** flip `USE_MOCK_TODOS = false`, deploy a preview APK to Jantile.
2. **Together:** create one manual todo from Track → confirm row appears in Web Todos screen for the same user.
3. **Together:** Web cron creates a `ptp_sign_today` for the foreman → confirm row appears in Track's Today screen within 5 s of next PowerSync window.
4. **Together:** foreman taps row → 5 s undo elapses → confirm Web sees `status='done'` and the row falls out of PowerSync (via the sync rule's status filter).
5. **Together:** foreman snoozes a row to "Tomorrow 6 AM" → confirm Web stores `status='snoozed'`, `snooze_until=<ISO>`. Track's server clock advances past `snooze_until` → confirm trigger flips status back, PowerSync delivers the update, Track row reappears.

Pass all 5 → Sprint 70 done. Push notification trigger ships in Sprint 71 once we've baked Phase 1 with foremen for a week.

---

*Track Phase 1 estimate met (~6 h vs spec's 6 h). Awaiting Web for end-to-end.*
