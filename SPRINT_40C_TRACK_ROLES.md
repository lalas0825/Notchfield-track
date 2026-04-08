# SPRINT 40C — Track Mobile Role Enforcement
# MODEL: /model claude-opus-4-6
# Repo: notchfield-track
# DEPENDS ON: Sprint 40A (project_assignments table in Supabase)

---

## Context

Read CLAUDE_TRACK.md before starting.

Takeoff Sprint 40A created project_assignments and permission_definitions tables.
Track needs to enforce roles: sync assignments, filter projects/areas by role,
show/hide features, block web-only roles from Track.

3 roles use Track: supervisor (all assigned projects), foreman (1 project), worker (1 project, assigned areas only).

---

## CHANGE 1: PowerSync Schema + Sync Rules

Add project_assignments to schema.ts:
- organization_id, project_id, user_id, role_in_project, assigned_by, assigned_at, is_active (integer), notes, created_at, updated_at

Add to sync-rules.yaml:
- SELECT * FROM project_assignments WHERE organization_id = bucket.organization_id

---

## CHANGE 2: Track Permission Service

Create src/shared/lib/permissions/trackPermissions.ts

10 features: check_in, ready_board, phase_progress, qc_photos, delivery_confirmation, assign_crews, work_tickets, safety_docs, daily_reports, plans_drawings

- Supervisor: ALL features, scope = all assigned projects
- Foreman: ALL features, scope = 1 project, delivery = assigned DTs only
- Worker: check_in + ready_board + phase_progress + qc_photos + plans (assigned areas only). NO delivery, crews, tickets, safety, reports.

Export: canUseFeature(role, feature), getProjectScope(role), isTrackRole(role)

---

## CHANGE 3: Login Gate

After auth, check role. If admin/pm/estimator/warehouse → show block screen:
"This app is for field teams. Your role uses the web app at notchfield.com."
Buttons: [Open Web App] [Logout]

---

## CHANGE 4: Project Selection

- Supervisor: show project picker (all assigned), can switch freely
- Foreman: auto-select single assigned project, no switcher
- Worker: auto-select single assigned project
- Zero assignments: "No projects assigned" screen with [Refresh] [Logout]

Query project_assignments filtered by user_id + is_active = 1.

---

## CHANGE 5: Area Filtering for Workers

Worker ready board: only areas where they are in the assigned crew.
If crew_assignments/crew_members tables don't exist in PowerSync yet, add them.
If they don't exist in Supabase at all, show all areas for workers with a TODO comment.

Supervisor/Foreman: see all areas in their project(s).

---

## CHANGE 6: Bottom Tab / More Menu Filtering

Filter More menu items by role using canUseFeature():
- Worker sees: Check In, Photos only
- Foreman sees: Check In, Deliveries, Work Tickets, Safety, Daily Reports, Assign Crews
- Supervisor sees: everything

---

## CHANGE 7: Delivery List — Project Filtering

- Supervisor: deliveries for all assigned projects
- Foreman: deliveries for their single project only
- Worker: no delivery access

---

## CHANGE 8: Track Permissions Context

Create TrackPermissionsContext provider:
- Gets role from profiles via PowerSync
- Gets project_assignments via PowerSync
- Validates isTrackRole (blocks web roles)
- Sets currentProject based on role logic
- Exposes: role, currentProject, assignedProjects, canUseFeature()

Wrap main navigator with this provider.

---

## Verify

1. project_assignments in PowerSync schema + sync rules
2. trackPermissions.ts with full matrix
3. Web-only roles blocked at login
4. Supervisor: project picker with all assigned
5. Foreman: auto-selects single project
6. Worker: auto-selects, sees only assigned areas
7. Zero assignments shows "No projects" screen
8. More menu filtered by role (worker limited)
9. Delivery list filtered by project assignment
10. TrackPermissionsContext wraps app
11. npx tsc --noEmit passes
