# SPRINT 73 — Track Handoff: Payroll Module

> **Web team is shipping a Payroll module that consumes `area_time_entries`. This doc covers what Track needs to ship in parallel for the data quality to be production-grade.**
>
> **None of this blocks Web from shipping.** Web has fallbacks for every gap. But the more Track ships, the cleaner the paychecks.

---

## TL;DR for Track team

**Four asks**, ranked by urgency:

| # | Ask | Urgency | Effort |
|---|---|---|---|
| **1** | "End Shift" button on Crew screen → bulk-close all open `area_time_entries` for foreman's crew | 🔴 BLOCKER for clean payroll data | ~2 hrs |
| **2** | Per-shift `worker_role` override at assignment time (mechanic/helper/foreman) | 🟡 Required for union pay differential | confirm only — likely already supported |
| **3** | Confirm `area_time_entries.project_id` stays accurate when foreman switches projects mid-week | 🟢 Confirm only | confirm only |
| **4** | Foreman Weekly Timesheet screen — Saturday AM push notif, summary view, edit + submit button → POST to `foreman_weekly_submissions` | 🟡 Required to digitize current paper workflow | ~6 hrs |

---

## Workflow we're digitizing (currently paper)

```
FOREMAN              SUPERVISOR             OFFICE (Owner/Admin)        PM
───────              ──────────             ────────────────────       ────
Tracks daily         Reviews each foreman   Receives approved         Read-only
time in Track        weekly submission      payroll batch             view of
(area_time_entries)  individually                                      labor cost
                                                                       per project
End of week:         Approves OR disputes   Generates paystubs
submits weekly       per submission          (PDF per worker)
timesheet            
(per crew per        "Sends to office" =     Exports CSV to
project)             flips state to          external accountant
                     supervisor_approved     
                                            Generates WH-347 for
                                            prevailing wage projects
                                            
                                            Marks as 'paid' when
                                            external check issued
```

**Critical role separation:**
- **PM has NO payroll authority** — read-only view of labor cost on their project
- **Supervisor is the SINGLE approver** between foreman submission and office processing
- **Supervisor is paid SEPARATELY** (overhead, not field-worker payroll). Their own pay is NOT in this module — handled by existing manual process. Phase 2 may add salaried-employee paystubs.
- **Foreman submits their crew's hours**, including their own hours if they're tracking work alongside the crew

---

## Context

NotchField Takeoff (Web) is building Sprint 73: a full Payroll module that:
1. Reads `area_time_entries` that Track writes (already done ✅)
2. Aggregates per worker per pay period (Friday cutoff, Wednesday payday)
3. Foreman submits weekly timesheet (NEW — digitizes paper)
4. Supervisor approves each submission individually OR disputes with reason
5. Office (Owner/Admin) processes approved batch → generates paystubs
6. Applies overtime rules per union contract (1.5x weekday OT, 1.5x Sat, 2x Sun, 2x holidays, 1.25x off-shift differential for prevailing wage projects)
7. Generates paystubs (PDF) + certified payroll reports (WH-347 federal + NY State)
8. Exports CSV for accountant

The DATA contract Web depends on is exactly what Track is already writing today:

```
area_time_entries:
  worker_id     → who
  area_id       → where (and via area, the project)
  project_id    → which project (CRITICAL for multi-project allocation)
  worker_role   → 'mechanic' | 'helper' | 'foreman' (CRITICAL for pay rate)
  started_at    → clock-in (Track tap)
  ended_at      → clock-out (Track auto-close on reassign, OR end-of-day)
  hours         → GENERATED column = (ended - started) / 3600
  assigned_by   → supervisor UUID
```

This works today. Web can build the engine + UI + PDFs entirely against this contract without any Track changes.

---

## Ask #1: End-of-Day Clock-Out (BLOCKER for clean data)

### The problem

Today, when a foreman taps "Carlos → Toilet 0113" at 7:00 AM, Track INSERTs a row with `started_at = now()`, `ended_at = NULL`. When the foreman taps "Carlos → Toilet 0115", the OLD row gets `ended_at = now()` and a new row INSERTs. Clean.

**But what happens at end of day?** Foreman taps the last assignment at 4:45 PM. Carlos goes home at 5:00 PM. Nothing closes that row. Tomorrow at 7 AM the foreman taps "Carlos → new area" → only THEN does the previous row get `ended_at = next_morning_7am`. Result: Carlos shows as working **14 hours** (4:45 PM → 7 AM next day), all of which would default to OT.

Real example from production today (2026-04-29 00:07 UTC):

```sql
SELECT worker_name, started_at, ended_at, hours
FROM area_time_entries WHERE ended_at IS NULL;
-- carlos ruiz       | 2026-04-29 00:07:23 | NULL | NULL  ← still open hours later
-- Google Reviewer   | 2026-04-29 00:07:23 | NULL | NULL  ← still open hours later
```

### What Web does without you

1. **Cron at 23:59 daily** auto-closes any entry > 18 hrs old with `auto_closed_at = now()` flag
2. **Banner in `/payroll/[periodId]`** at the top: "⚠️ X workers have entries > 12 hrs unclosed — review before approving" with quick-close per-row button
3. PM is responsible for catching it manually

This works but creates friction at every weekly payroll review.

### What we want from Track

**Add an "End Shift" button** to the Crew View (or wherever foreman manages today's roster). Tap it at end of day → SQL:

```sql
UPDATE area_time_entries
SET ended_at = now()
WHERE ended_at IS NULL
  AND assigned_by = <current_foreman_user_id>
  AND area_id IN (
    SELECT area_id FROM crew_assignments
    WHERE assigned_by = <current_foreman_user_id>
    -- restrict to today's project(s)
  );
```

That's it. No new endpoint, no schema change, just an UPDATE on the existing table.

**Bonus: push notification to foreman at 5:00 PM local time** — "Don't forget to end shift for your crew" with a tap-to-open button. Reduces forgotten clock-outs by ~80% based on industry data.

### `auto_closed_at` flag (Web will add)

Web will add this column to `area_time_entries`:

```sql
ALTER TABLE area_time_entries ADD COLUMN auto_closed_at timestamptz;
```

When Web's safety-net cron auto-closes a stale entry, it sets `auto_closed_at = now()` so payroll UI can flag it for PM review. Track doesn't need to read or write this column — it's purely a payroll review aid.

---

## Ask #2: Per-shift `worker_role` override (confirm only)

### Context

Workers have a default `trade_level` in `workers` table ('mechanic', 'helper', 'foreman', 'apprentice', 'other'). Pay rate depends on this:
- Mechanic: $1,000/day (or prevailing wage rate)
- Helper: $750/day
- Foreman: typically mechanic + foreman differential ($25-50/hr extra)

But on construction sites, **roles flex daily**:
- Carlos is normally a helper but Pedro the mechanic called in sick → Carlos acts as mechanic for the day
- A regular mechanic gets temporarily promoted to foreman for a 2-week run
- A foreman drops back to mechanic when there's no crew to lead that week

### What we need

`area_time_entries.worker_role` is already set per-entry (defaults to 'mechanic'). When foreman assigns a worker to an area in Track, **can foreman override the role for that specific shift before creating the entry?**

Example UI: When tapping "Carlos → Area X", show a chip/dropdown:
- ☐ Mechanic (default from `workers.trade_level`)
- ☐ Helper
- ☐ Foreman

Default = the worker's `trade_level`, but foreman can change before confirming.

### Confirm one of:

- ✅ "Yes, Track already lets foreman override role per assignment" → Web is good, no change needed.
- ⚠️ "Today, Track auto-pulls `worker_role` from `workers.trade_level` and there's no override UI." → We need this UI. Estimate ~3 hrs Track work. If you can't ship it in time for pilot, Web falls back to using `workers.trade_level` (less precision for one-off role swaps; PM can manually adjust in payroll review).

---

## Ask #3: `project_id` accuracy (confirm only)

### Context

Web payroll uses `area_time_entries.project_id` for multi-project allocation:

> Carlos worked Mon-Tue on Project A (16 hrs), Wed-Fri on Project B (24 hrs) → his single paystub for the week shows 40 hrs total, but the cost-accounting CSV shows $X allocated to A, $Y to B.

This requires `project_id` to be SET CORRECTLY on every time entry. Sample data we see today shows DEMO PROJECT correctly tagged ✅.

### Confirm

When foreman switches between projects mid-week (taps an area in Project B after working in Project A), each new `area_time_entries` row has the correct `project_id` for the area being assigned (NOT cached from the previous project).

If Track derives `project_id` from `areas.project_id` at INSERT time, this is automatically correct ✅. If Track caches the "current project" in app state, double-check it refreshes when foreman switches projects.

---

## Ask #4: Foreman Weekly Timesheet (NEW — digitizes paper workflow)

### Context

Today, foremen at Jantile fill out a paper weekly timesheet at end of week. They list each worker, hours per day, and sign at the bottom. That paper goes to the supervisor who reviews/signs, then to the office.

We're digitizing this. The foreman should review what's already in the system (auto-aggregated from his daily Track taps) and explicitly **submit** the week. This creates a chain-of-custody snapshot the supervisor can approve against, replacing the paper signature.

### What we need from Track

A new screen: **"This Week's Timesheet"** in the foreman's Crew View navigation.

**Triggered by:** Push notification at **Saturday 8:00 AM local time** (after Friday cutoff): "Confirma horas de la semana — listo para enviar al supervisor"

**Screen contents (read-mostly with edit affordance):**

```
┌─────────────────────────────────────────────────────────────┐
│ Weekly Timesheet — Sat Apr 25 → Fri May 1                  │
│ Project: 200 Hamilton Ave                                   │
│                                                             │
│ Worker      Mon  Tue  Wed  Thu  Fri  Sat  Sun  TOTAL       │
│ ──────────────────────────────────────────────────────      │
│ Carlos R.   8.0  8.0  7.5  8.0  8.0  -    -    39.5  [✏️] │
│ Pedro M.    8.0  8.0  8.0  -    8.0  -    -    32.0  [✏️] │  ← sick Thu
│ Juan G.     8.0  8.0  8.0  8.0  8.0  4.0  -    44.0  [✏️] │  ← Sat OT
│                                                             │
│ Total crew hours: 115.5                                     │
│                                                             │
│ Notes (optional):                                           │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Pedro left Thu morning for medical appointment         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│   [ Save Draft ]    [ Submit to Supervisor ]               │
└─────────────────────────────────────────────────────────────┘
```

### Edit affordance

Tap any cell → modal shows the underlying `area_time_entries` for that worker on that day:

```
Carlos R. — Tuesday Apr 28
─────────────────────────
07:00 - 11:30  →  Toilet 0113     4.5h
12:00 - 15:30  →  Toilet 0115     3.5h
                                  ─────
                                   8.0h paid (after 30min lunch deduction)

[ Adjust hours: -30min ] [ Reason: ___________ ]
```

If foreman adjusts: write to `time_adjustments` table with `adjustment_type = 'foreman_correction'`, `reason` from the modal input, `adjusted_by = foreman_user_id`. Web's payroll engine reads adjustments alongside raw entries.

### Submit action

Tap "Submit to Supervisor" → confirmation dialog → POST to:

```
POST /api/payroll/foreman-submissions
Body: {
  project_id: uuid,
  week_ending: "2026-05-01",  // Friday cutoff date
  hours_summary: { ... full snapshot of what foreman saw },
  foreman_notes: "Pedro left Thu morning..."
}
```

Web responds with:
```
{
  success: true,
  submission_id: uuid,
  status: 'pending_supervisor_review'
}
```

Track shows confirmation screen + locks the timesheet (read-only badge "Submitted ✓ — pending supervisor review").

### Edge cases

- **Foreman covers multiple projects in same week**: one submission per (project, foreman, week). Foreman sees a tab/picker for each project.
- **Foreman tries to submit incomplete week** (missing days for a worker): allow it, but flag in the UI ("⚠️ No hours for Pedro on Thu — confirm intentional?"). Don't block submission.
- **Supervisor disputes**: Web sends push notif to foreman: "Supervisor flagged your submission". Foreman can re-edit (modal returns) and re-submit.
- **Late submission**: After Saturday 8AM push notif, daily reminders Mon-Wed if not submitted. After that, supervisor can manually submit on foreman's behalf via Web (with audit log).

### What Web is providing

- Endpoint `/api/payroll/foreman-submissions` (POST + GET)
- All approval logic (supervisor approves via Web, foreman just submits)
- Push notification trigger to supervisor when foreman submits

### Effort estimate

~6 hrs Track work:
- 2 hrs: Weekly Timesheet screen UI
- 1 hr: Edit modal with adjustment write-back
- 1 hr: Submit action + confirmation flow
- 1 hr: Push notif setup (Saturday 8AM trigger)
- 1 hr: Multi-project tab support + edge case handling

### What if Track can't ship in time?

**Web fallback:** Supervisor uses Web `/payroll/[periodId]` to manually mark "submission received from foreman" with a note ("received paper timesheet from John on May 4"). Less smooth UX, but pilot is unblocked. We can backfill the proper Track flow in next sprint.

---

## Permission Matrix

| Action | Foreman | Supervisor | PM | Admin | Owner |
|---|---|---|---|---|---|
| View payroll list | His crew only | All projects | All (read-only) | All | All |
| View pay statements | His own | All workers | All (read-only) | All | All |
| Submit weekly timesheet | ✅ his crew | ❌ | ❌ | ❌ | ❌ |
| **Approve foreman submissions** | ❌ | **✅ KEY ROLE** | ❌ | ✅ | ✅ |
| **Send to office** (state flip) | ❌ | ✅ | ❌ | ✅ | ✅ |
| Generate paystubs | ❌ | ❌ | ❌ | ✅ | ✅ |
| Export to accountant CSV | ❌ | ❌ | ❌ | ✅ | ✅ |
| Generate WH-347 | ❌ | ❌ | ❌ | ✅ | ✅ |
| Mark as 'paid' | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit org payroll rules | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit project prevailing wage | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage prevailing wage schedules | ❌ | ❌ | ❌ | ✅ | ✅ |

**Key takeaway for Track:** PM has zero write authority on payroll. The only Web role Track interacts with for payroll is Foreman (creates `foreman_weekly_submissions` via Track's submit action) and Supervisor (approves via Web — Track team doesn't need to build the supervisor approval UI; it's web-only).

---

## What Web is shipping (FYI for Track)

So you know the consumer surface:

**10 new tables** (all RLS, all `organization_id` isolated):
1. `pay_periods` — Saturday-to-Friday work weeks (Friday cutoff, Wednesday payday)
2. `payroll_runs` — one per period × org, with state machine: `draft` → `foreman_pending` → `supervisor_pending` → `supervisor_approved` → `office_processed` → `paid` (+ `cancelled`)
3. **`foreman_weekly_submissions` (NEW)** — one per (project, foreman, week). Captures foreman's signed snapshot + supervisor's per-submission approval status (pending/approved/disputed)
4. `time_adjustments` — manual edits with audit trail (NEVER mutates `area_time_entries`). New types: `foreman_correction`, `supervisor_correction`, `office_correction`
5. `payroll_line_items` — per worker × period: hours buckets + gross + net + project_allocations JSONB
6. `pay_statements` — generated paystubs
7. `prevailing_wage_schedules` — NY DOL / NYC Comptroller / Davis-Bacon rate tables
8. `prevailing_wage_rates` — sub-table: classification × rate (e.g., "Tile Layer - Setter" = $64.62/hr base + $36.51/hr supplemental)
9. `project_prevailing_wage` — junction: project ↔ schedule applied
10. `certified_payroll_reports` — WH-347 federal + NY State equivalents

**Column additions to existing tables:**
- `organizations.payroll_rules JSONB` — org-level OT defaults (regular_hours_per_day, OT multipliers, holidays list)
- `projects.is_prevailing_wage BOOLEAN`, `projects.payroll_rules_override JSONB`
- `area_time_entries.auto_closed_at TIMESTAMPTZ NULL` — flag for safety-net cron

**5 pure engines:**
- `payrollEngine.ts` — orchestrator (reads area_time_entries + foreman_submissions + adjustments → buckets + pay)
- `unionOvertimeEngine.ts` — `max(day_mult, shift_mult)` rule
- `lunchDeductionEngine.ts` — auto-deduct 30min after 6+ hrs
- `prevailingWageEngine.ts` — resolve rate by (worker, project, date, classification)
- `certifiedPayrollEngine.ts` — WH-347 output shape

**Cron:**
- Friday 23:59 → close pay_period, create payroll_run in `draft`, transition to `foreman_pending`, push notif to all foremen ("Submit your week")
- Daily 23:59 → safety-net auto-close entries > 18 hrs old (sets `auto_closed_at` flag)

**Routes:**
- `/payroll` — list of pay periods + runs (role-aware: foreman sees his crew only, supervisor+ see all)
- `/payroll/[periodId]` — detail per run with submission status grid (X/N foremen submitted, Y/N supervisor-approved)
- `/payroll/[periodId]/submission/[submissionId]` — supervisor reviews ONE foreman submission, approves or disputes
- `/payroll/[periodId]/edit/[workerId]` — owner/admin payroll review with line-item adjustments
- `/payroll/settings` — org-level pay rules (owner/admin only)
- `/payroll/prevailing-wages` — schedule manager (owner/admin only)
- `/projects/[id]/pm/labor-costs` — PM read-only per-project labor cost view

**3 PDF formats:**
- Standard paystub (logo, period, hours breakdown, gross, net)
- WH-347 federal certified payroll
- NY State certified payroll

**1 API endpoint for Track:**
- `POST /api/payroll/foreman-submissions` — Track posts here when foreman taps "Submit Week"
- `GET /api/payroll/foreman-submissions?week=YYYY-MM-DD` — Track reads to show submission status badge ("Submitted ✓" / "Disputed by supervisor")

---

## Sync rules (data contract)

**Track NEVER:**
- ❌ Touches `payroll_*` tables directly (always via API endpoint)
- ❌ Touches `prevailing_wage_*` tables
- ❌ Touches `pay_statements`, `time_adjustments`, `certified_payroll_reports`
- ❌ Touches `auto_closed_at` column
- ❌ UPDATEs `foreman_weekly_submissions.supervisor_status` (supervisor approval is web-only)

**Track MAY:**
- ✅ POST to `/api/payroll/foreman-submissions` to create a submission
- ✅ GET `/api/payroll/foreman-submissions` to read status (for Track UI badge)
- ✅ Read its own `auto_closed_at` flag (optional Track UI badge)
- ✅ Write `time_adjustments` rows with `adjustment_type='foreman_correction'` via the submission API (the endpoint creates them as a side effect)

**Web NEVER:**
- ❌ Touches `area_time_entries.started_at` / `worker_id` / `area_id` (Track owns these)
- ❌ Mutates `area_time_entries` rows except the documented safety-net cron flow
- ❌ Touches `crew_assignments` (Track owns)

**Web MAY:**
- ✅ Set `area_time_entries.ended_at` if (a) it's NULL AND (b) `started_at > 18 hrs ago` AND (c) sets `auto_closed_at` simultaneously. This is the safety-net cron.
- ✅ INSERT / UPDATE all payroll_* tables, foreman_weekly_submissions (UPDATE only for supervisor_status), prevailing_wage_*, certified_payroll_reports.

---

## Test fixtures Web will use

Web's payroll engine tests use these scenarios. If Track wants to validate end-to-end, these are the cases:

```
Scenario A — Simple weekday RT
  Carlos, mechanic, Mon 7am-2:30pm = 7.5 elapsed - 30min lunch = 7 paid RT
  Expected: 7 RT @ $64.62 = $452.34 base

Scenario B — Weekday with OT
  Carlos, mechanic, Mon 7am-5pm = 10 elapsed - 30min lunch = 9.5 paid hrs
  Project has 8-hr RT: 8 RT + 1.5 OT
  Expected: 8 × $64.62 + 1.5 × $96.93 = $516.96 + $145.40 = $662.36

Scenario C — Saturday
  Carlos, mechanic, Sat 8am-4pm = 8 elapsed - 30min lunch = 7.5 paid hrs at 1.5x
  Expected: 7.5 × $96.93 = $726.98

Scenario D — Sunday
  Carlos, mechanic, Sun 8am-4pm = 7.5 paid at 2x
  Expected: 7.5 × $129.24 = $969.30

Scenario E — Off-shift differential (prevailing wage only)
  Carlos, mechanic, Tue 11pm-7am next day = 8 elapsed - 30min lunch = 7.5 paid
  - Tuesday portion (11pm-midnight = 1 hr) → off-shift, max(1.0x, 1.25x) = 1.25x
  - Wednesday portion (midnight-7am = 7 hr - 30min lunch = 6.5 paid) → off-shift first 7 hrs all at 1.25x
  Expected: 7.5 × $80.78 (1.25x) = $605.81

Scenario F — Holiday
  Carlos, mechanic, July 4 (Friday) 7am-2:30pm = 7 paid at 2x
  Expected: 7 × $129.24 = $904.68

Scenario G — Multi-project week
  Carlos worked: Mon-Tue Project A (16h), Wed-Fri Project B (24h) = 40 RT
  Single paystub: 40 RT × $64.62 = $2,584.80
  CSV allocation: Project A = $1,033.92 (16h), Project B = $1,550.88 (24h)

Scenario H — Foreman differential (per worker_role override)
  Pedro, normally helper but acted as foreman this week
  All entries have worker_role = 'foreman' (Track set the override)
  Pay rate = mechanic rate + foreman differential
  Web pulls foreman rate from `prevailing_wage_rates` if prevailing wage project,
  else `workers.daily_rate_cents` override OR org default
```

---

## Timeline & coordination

**Web (this sprint, ~5 days):**
- Day 1: DB migrations (9 tables + 4 column adds + RLS) + types + Zod
- Day 2: Engines + tests (covers all scenarios above)
- Day 3: Cron + payroll_run creator + UI list/detail
- Day 4: Settings + prevailing wage manager + PDFs
- Day 5: Per-project labor costs view + i18n + audit-blindaje docs

**Track (your call, parallel):**
- **Ask #1** ("End Shift" button): whenever you can ship → immediately improves data quality. No coordination needed.
- **Ask #4** (Foreman Weekly Timesheet): ship before pilot if possible — replaces the paper workflow. Web has a degraded-mode fallback (supervisor manually marks "received paper timesheet" with note) if Track can't make it in time.
- No new endpoints to build on Track side — just call Web's `/api/payroll/foreman-submissions`.

**Pilot ready:** Web ships when Web is done. First paystub run = next Wednesday after pilot project goes live (after the first full Sat-Fri week of data).

---

## Questions for Track

Reply in Slack/email with:

1. **Ask #2 confirmation:** Does Track already let foreman override `worker_role` per shift assignment? (Yes / No / Will ship)
2. **Ask #1 commitment:** Can you ship the "End Shift" button before pilot launches? (Yes by date / Need timeline / Defer to phase 2)
3. **Ask #3 confirmation:** Is `area_time_entries.project_id` always accurate when foreman switches projects mid-week? (Yes / Need to verify / There's a known bug)
4. **Ask #4 commitment:** Can you ship the Foreman Weekly Timesheet screen before pilot launches? (Yes by date / Need timeline / Will defer — Web uses fallback)

That's it. Web is unblocked on all 4 asks (degraded fallbacks for #1 and #4). Build payroll in parallel — ship when ready.

---

**Web contact:** Web team in #notchfield-engineering (Slack)
**Track contact:** Track team
**Coordination doc:** this file (`docs/sprints/SPRINT_TRACK_PAYROLL.md`)
