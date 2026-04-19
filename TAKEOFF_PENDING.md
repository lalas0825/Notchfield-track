# Takeoff — Pending Work to Unblock Track

> Four follow-ups on Takeoff side. Track is live on the latest sprints
> (PTP, MANPOWER, TOOLBOX) and ready to use all of these once deployed.
> Some DB-level fixes were already applied via Track's Supabase MCP;
> those need to be codified as Takeoff migrations so a fresh checkout
> doesn't revert them.

---

## 1. 🔴 BLOCKER — Distribute endpoint auth + email provider

### Symptom
Track's PTP/Toolbox distribute flow calls
`POST https://notchfield.com/api/pm/safety-documents/[id]/distribute`
with `Authorization: Bearer <supabase_jwt>`. Current response: **401 Unauthorized**.

Track log (with diagnostics added in commit `d637eb4`):
```
[distribute] endpoint rejected — POST https://notchfield.com/api/pm/safety-documents/.../distribute
  status: 401
  body:   {"error":"Unauthorized"}  (or similar)
```

### Root cause (suspected)
Endpoint likely uses NextAuth cookies or Supabase SSR helpers — rejects a
naked Bearer JWT sent from a React Native client.

### What Takeoff needs to do
1. **Accept Bearer Supabase JWT in the distribute route.**
   Pattern that works:
   ```ts
   // /api/pm/safety-documents/[id]/distribute/route.ts
   import { createClient } from '@supabase/supabase-js'

   const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
   if (!bearer) return Response.json({ error: 'no token' }, { status: 401 })

   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
     { global: { headers: { Authorization: `Bearer ${bearer}` } } }
   )

   const { data: { user }, error } = await supabase.auth.getUser()
   if (error || !user) return Response.json({ error: 'invalid token' }, { status: 401 })

   // ... proceed with distribute logic ...
   ```

2. **Confirm Resend (or equivalent) is configured**
   User mentioned: *"el email provider que tengo setiado talvez no este
   funcionando bien"*. Verify:
   - `RESEND_API_KEY` env var is set in Takeoff prod (Vercel or wherever)
   - Sender domain verified in Resend dashboard
   - Test: `curl https://api.resend.com/emails -H "Authorization: Bearer $KEY" -d '{"from":...}'`

3. **Request body contract (what Track sends):**
   ```json
   {
     "labels": {
       "title": "string",
       "project_name": "string",
       "foreman_label": "string",
       "date_label": "string",
       ...
     },
     "recipients": ["safety@gc.com", "super@gc.com"]
   }
   ```

4. **Response contract Track expects on success:**
   ```json
   {
     "integrity_hash": "sha256:abc123...",
     "emails_sent": 2,
     "emails_failed": 0
   }
   ```
   (Field `integrity_hash` gets stamped into `safety_documents.content.distribution.pdf_sha256`.)

### Dev/test recipe
1. Start Track with `npx expo start --dev-client`
2. Deliver a Toolbox Talk end-to-end. Watch Track metro console for the
   `[distribute]` log lines — they'll show exactly what HTTP status/body
   Takeoff returned.
3. Once fixed: the wizard's final "Submit & Send" shows a success toast
   (not the "Queued" fallback).

---

## 2. 🟡 Sprint 50D — Toolbox PDF renderer + labels + endpoint branch

Spec already in Track's repo at `SPRINT_TRACK_TOOLBOX.md` §11.

### What Takeoff needs to do
- [ ] `toolboxPdfRenderer.ts` — port from `ptpPdfRenderer` with the
  topic-snapshot layout (Why It Matters / Key Points / Discussion
  Questions / Signatures). Use `content.delivered_language` to pick
  EN/ES/both content from the snapshot.
- [ ] `buildToolboxPdfLabels()` helper — mirrors `buildPtpPdfLabels`.
  Track already sends the labels (see `buildToolboxLabels.ts`).
- [ ] Branch the distribute endpoint by doc_type:
  ```ts
  const pdf = doc.doc_type === 'toolbox'
    ? renderToolboxPdf(doc, labels)
    : renderPtpPdf(doc, labels)
  ```
- [ ] i18n: Toolbox PDF section headers in 6 locales (EN, ES, FR, PT,
  IT, DE). Track uses English placeholders right now.

### Gating
Until 50D ships, Track's Toolbox submits hit the distribute endpoint
and get either a 400 (if server rejects doc_type=toolbox) or the PTP
renderer produces garbage for toolbox content. Either way the email
goes out wrong. Block toolbox-to-prod until 50D is live.

---

## 3. 🟡 Codify DB migrations from Track MCP

Track applied two migrations directly to Supabase during Sprint
MANPOWER debugging. They work in prod right now, but Takeoff's repo
doesn't know about them — a fresh DB reset from Takeoff migrations
would revert them.

### Migration A: `rls_accept_supervisor_role` (2026-04-19)

Extended 10 RLS policies to accept both `'supervisor'` and `'superintendent'`.
Tables: area_time_entries, crew_assignments, daily_reports, gps_checkins,
gps_geofences, punch_items.

Full SQL in Supabase migrations log. Takeoff should copy this into their
`supabase/migrations/` folder so the roles list is:
```
ARRAY['foreman','supervisor','superintendent','pm','owner','admin']
```

Track's `ROLE_ALIASES` already treats them as synonyms — keep this behaviour.

### Migration B: `crew_assignments_fk_to_workers` (2026-04-19)

Repointed foreign keys:
- `crew_assignments.worker_id` → `workers(id)` (was `profiles(id)`)
- `area_time_entries.worker_id` → `workers(id)` (was `profiles(id)`)
- `ON DELETE CASCADE` on both

Both tables were TRUNCATEd during the migration (1 orphan row each, no
real data). Walk-in workers (profile_id NULL) are now assignable.

---

## 4. 🟢 Toolbox library seed — IN PROGRESS

**Status (2026-04-19):** Takeoff team actively curating topics. Scope
revised from ~110 → ~30 high-quality global topics after the initial
bulk pass produced low-quality content. Quality-over-quantity direction.

Track's empty-library fallback handles the 0-row state gracefully. The
scheduler engine works the same whether there are 30 or 110 topics —
rotation is 8 weeks, so 30 topics cover ~7 months of weekly rotation
without repeats. Plenty for pilot.

Nothing to do on Track side until seed lands. When it does, the
WeeklyToolboxCard and wizard auto-populate on next PowerSync pull.

---

## Summary for handoff

| # | Priority | Owner | Status | Blocker for |
|---|---|---|---|---|
| 1 | 🔴 P0 | Takeoff backend | ⬜ Pending | All PTP + Toolbox sends |
| 2 | 🟡 P1 | Takeoff backend | ⬜ Pending | Toolbox-to-prod correctness |
| 3 | 🟡 P1 | Takeoff DevOps | ⬜ Pending | Future migration drift |
| 4 | 🟢 P2 | PM / content team | 🔄 In progress (~30 curated) | Toolbox scheduler usefulness |

Once #1 ships, Jantile's pilot can run the full PTP flow on
production. #2 is required before Toolbox PDFs look right. #3 is
hygiene. #4 is actively being curated.

---

*Track-side work is caught up. Repo: https://github.com/lalas0825/Notchfield-track (latest commit `d637eb4`).*
