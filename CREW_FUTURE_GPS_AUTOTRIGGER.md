# Crew Management — Future P4: GPS Auto-Trigger

> **Status:** Deferred (2026-04-28). Pilot Jantile is live with P1+P2+P3 manual flow.
> **Estimate when pursued:** ~3-4h Track-side + Web cron updates.
> **Trigger to revisit:** Foreman feedback that the manual 2-tap assign workflow
> doesn't match how the crew actually moves on site, OR pilot adds enough crew
> (>10 workers) that manual reassignment becomes friction.

## What it is

Replace the foreman's manual "select workers → pick area → assign" flow with
automatic time tracking driven by GPS check-ins. Worker walks into the
geofence of a specific area (or scans an area QR code), system auto-creates
the `area_time_entries.started_at`. Worker leaves geofence or scans out,
system auto-closes with `ended_at`.

The foreman keeps the manual override — they can still drag a worker to
an area when GPS doesn't fire (basement, signal dead zones, indoor only).
But the default is hands-off.

## Why we deferred

Three reasons:

1. **GPS reliability on construction sites is low.** Indoor jobs, dense
   reinforcement, basement floors, and inter-building shadowing all break
   geofence triggers. False negatives mean missing hours; false positives
   mean wrong-area attribution. Either is worse than the foreman's manual
   tap, which is 100% accurate.
2. **Per-area geofences require area-level lat/lng polygons.** Today
   `production_areas` has `floor` and `name` but no spatial geometry. A
   project-level `gps_geofences` row exists but it's the whole job site
   boundary, not per-room. Adding per-area polygons means PM workflow on
   Web to draw them, plus storage shape changes.
3. **The 2-tap manual flow already works for Jantile.** Foreman taps
   workers (multi-select), taps area, done. Adding GPS magic that fails
   sometimes will frustrate more than the saved tap saves time.

## What would need to be built

### Track-side

#### Geofence proximity check (foreground + background)

Already partially exists via `expo-location` and `gps_geofences` table.
Extend to:

- Subscribe to position updates in foreground (already does) AND background
  with `Location.startLocationUpdatesAsync` registered in `app.json`.
- On each update, find any matching area geofence (point-in-polygon) for
  the worker's project.
- If new match → enqueue `area_time_entries` insert with `started_at = now`,
  `worker_id = current user's worker.id` (resolved via `useMyWorker`).
- If leaving previous match → enqueue `ended_at = now` for the open entry.

#### Conflict resolution with foreman manual override

The foreman's manual `assignWorker` and the GPS auto-trigger can race —
e.g. foreman moves Carlos to L3-E2 while Carlos's phone GPS thinks he's
still in L3-E4 from the morning. Tiebreaker:

- **Foreman manual ALWAYS wins.** Crew-store `assignWorker` writes its
  entry with a flag `source: 'foreman_manual'` (new column on
  `area_time_entries`). GPS-driven inserts use `source: 'gps_auto'`.
- When the GPS handler detects a worker entering a new area, it first
  checks if the worker has an open `source: 'foreman_manual'` entry for
  a DIFFERENT area within the last 60 minutes — if so, GPS does NOT
  auto-create. Foreman knows where they are; ignore GPS.
- Foreman can manually close any GPS entry (long-press → "Close").

#### Settings toggle per project

Some PMs won't trust GPS at all. Add `projects.crew_gps_autotrigger_enabled`
boolean (default false). Track reads it on Crew screen mount; if false,
hide GPS UI entirely and rely on manual flow.

#### Indicators in UI

- AreaCrewTile rows: small icon next to each worker indicating source
  (📌 manual / 📍 GPS). Trust signal for the foreman walking the floor.
- Crew screen: "GPS coverage today" chip showing N entries auto-tracked
  vs N manual.

### Web-side

#### Per-area geofence polygons

Schema:

```sql
ALTER TABLE production_areas
  ADD COLUMN geofence_polygon geometry(Polygon, 4326);  -- WKT polygon
-- or simpler: bounding box
ALTER TABLE production_areas
  ADD COLUMN geofence_lat NUMERIC,
  ADD COLUMN geofence_lng NUMERIC,
  ADD COLUMN geofence_radius_m NUMERIC;  -- circular buffer
```

For Jantile-scale projects (one floor at a time), a circular buffer
with 5-15m radius is plenty. Multi-floor jobs need elevation-aware
geofences eventually, but circular gets us 80% of the way for v1.

PM workflow on Web:

1. PM opens area in Takeoff
2. Clicks "Set geofence" → map view centered on project's `gps_geofences`
   coordinate
3. Drops pin or draws polygon → saved to area row
4. Track receives the column updates via PowerSync sync of
   `production_areas` (already in sync rules, just adds columns)

#### `area_time_entries.source` column

```sql
ALTER TABLE area_time_entries
  ADD COLUMN source TEXT CHECK (source IN ('foreman_manual', 'gps_auto', 'gps_corrected'))
    DEFAULT 'foreman_manual';
```

Default `'foreman_manual'` so existing data migrates safely. Track
populates the field on every new insert.

#### End-of-day cron (related to P3)

Already noted as a P3 follow-up. With GPS auto-trigger, the cron also
needs to handle "phone died with worker still in geofence" — close any
`source: 'gps_auto'` entry that has been open >12h with `ended_at` =
last known position timestamp (or fallback to the project's "end of
day" preset).

## Edge cases to handle

| Case | Behavior |
|------|----------|
| Worker leaves geofence for 2 min (lunch in corridor) then returns | Don't close + reopen. Threshold: only close after 5 min outside. |
| Two adjacent areas with overlapping geofences | Pick the area with closer centroid OR the more-recently-entered area. |
| Worker on phone in elevator (GPS lost completely) | Don't auto-close. Hold open. Foreman can close manually if 30 min idle. |
| Worker forgot phone at home | Manual flow falls through. No GPS = no auto-create = foreman taps. |
| Phone GPS gives wrong coords by 50m | Per-area `geofence_radius_m` ≥ 15m absorbs noise. Don't use raw lat/lng equality. |
| Worker walks lobby (no specific area) | No geofence matches → no entry created. Lobby is not a billable area anyway. |
| Foreman ends day at 5pm but workers' phones still in geofence | End-of-day cron closes all open at project preset (e.g. 8pm cap). |

## Validation criteria before pursuing

Before spending the 3-4h, confirm one of:

1. Pilot has reported "manual assignment is friction" (qualitative — too many taps).
2. Pilot has >10 active workers per project (quantitative — manual scales worse).
3. PM has explicitly asked for "auto-tracked hours" for a labor-cost report
   (Web's existing manhour calculations come from `area_time_entries.hours`,
    so GPS attribution = better cost data).

If none of those land, keep the manual flow. It's accurate, fast, and
ships.

## Files that would change (rough map)

```
TRACK
├── src/features/crew/services/gpsAutoTrigger.ts        (NEW)
├── src/features/crew/hooks/useGpsAutoTrigger.ts        (NEW)
├── src/features/crew/store/crew-store.ts               (add source field)
├── src/features/crew/components/AreaCrewTile.tsx       (source icon)
├── src/features/crew/components/CrewHistoryView.tsx    (source breakdown)
├── src/shared/lib/powersync/schema.ts                  (add source col)
├── powersync/sync-rules.yaml                           (no change — col auto-syncs)
└── app.json                                            (background location plugin)

WEB (server)
├── migrations/add_geofence_to_areas.sql                (NEW)
├── migrations/add_source_to_area_time_entries.sql      (NEW)
├── /api/cron/close-stale-entries                       (NEW or extend existing)
└── /pm/projects/[id]/areas/[id]/geofence               (NEW PM UI)
```

## Cross-references

- [PRODUCTION_TRACKING.md] — base time tracking model
- `src/features/crew/hooks/useStaleEntries.ts` — current Track-side guard
  against orphan entries (the proper cron fix lives Web-side; this is the
  manual-cleanup escape hatch).
- CLAUDE.md "Track collects, Web processes" — same principle applies:
  GPS data collected by Track, Web does the cron + reporting + cost.
