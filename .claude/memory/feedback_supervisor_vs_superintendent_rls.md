# RLS role check — accept both `supervisor` AND `superintendent`

Takeoff-inherited Supabase had 10 RLS policies that only accepted the
legacy role name `'superintendent'`. Track's role normalizer
(`ROLE_ALIASES` in `trackPermissions.ts`) treats `'supervisor'` and
`'superintendent'` as synonyms — both map to `TrackRole.supervisor`.
That mismatch silently rejected every write from a user whose DB
`profiles.role` was the modern `'supervisor'` string, e.g.:

```
[PowerSync] Upload rejected — PUT crew_assignments/...
  error:       new row violates row-level security policy for table "crew_assignments"
  auth.uid():  4c2cf51f-3e0a-4af5-aed0-cd239befee59
  row.by:      4c2cf51f-3e0a-4af5-aed0-cd239befee59   ✓ same
  row.org:     e40ea3ab-ecec-4822-b670-643addf863f0   ✓ correct org
```

org + assigned_by both passed, but `user_role() = 'supervisor'` was NOT
in the allowed array `['foreman','superintendent','pm','owner','admin']`.

## Fix applied

Migration `rls_accept_supervisor_role` (2026-04-19) extended every
field-leader policy to accept both strings. Tables touched:

| Table | Policies |
|---|---|
| area_time_entries | field_leaders_insert, field_leaders_update |
| crew_assignments | field_leaders_insert, field_leaders_update, field_leaders_delete |
| gps_checkins | leaders_see_org (SELECT) |
| gps_geofences | leaders_insert, leaders_update |
| daily_reports | foreman_updates |
| punch_items | members_update |

New allowed list:
```sql
ARRAY['foreman','supervisor','superintendent','pm','owner','admin']
```

Additive only — existing `'superintendent'` profiles keep working.

## Rule going forward

Any new RLS policy that gates on role MUST accept both strings until
the DB is migrated to one canonical value. The canonical direction is
`'supervisor'` (what Track writes and what Takeoff web's Manpower UI
shows); `'superintendent'` is legacy retained for back-compat.

If you're authoring Track-side code that reads `profiles.role`, always
go through `normalizeTrackRole()` so either string works.

## Diagnosing the next RLS failure

The supabase-connector (commit `4e53ed6`) now dumps the full payload
and auth context on every upload rejection. First thing to check when
RLS fails:

1. `auth.uid()` — matches expected user?
2. `row.org` vs `user_org_id()` — same org?
3. `row.by` / `row.created_by` / `row.reported_by` — matches auth.uid if the policy requires it?
4. `user_role()` — in the allowed list for that table's policy?

Grep the policy with:
```sql
SELECT qual, with_check FROM pg_policies
WHERE tablename = '<table>' AND cmd = '<op>';
```
