# FULL AUDIT — NotchField Track
# MODEL: /model claude-sonnet-4-6
# Run in TRACK repo

---

## TRACK AUDIT

Lee CLAUDE_TRACK.md y TASKS_TRACK.md completamente. Then audit everything:

### 1. TypeScript Health
```
npx tsc --noEmit 2>&1 | head -50
```

### 2. PowerSync Schema vs Supabase
Verify ALL tables in PowerSync schema (schema.ts) match actual Supabase columns.
Check these specifically (added in Sprint 25A):
- room_types
- room_type_surfaces  
- phase_progress
- production_areas (new columns: room_type_id, acceptance_status, start_date, target_end_date)
- production_template_phases (new columns: applies_to_surface_types, is_binary, binary_weight)
- field_photos (new column: phase_id)

### 3. Sync Rules
Read powersync/sync-rules.yaml and verify:
- All tables in schema.ts have a corresponding sync rule
- room_types, room_type_surfaces, phase_progress included
- All rules filter by organization_id = bucket.organization_id
- No JOINs or subqueries in data section

### 4. Navigation
Verify 5 bottom tabs exist and render:
- Home
- Board (Production/Ready Board)
- Plans
- Docs
- More

### 5. Production Features (Phase T2)
Verify these components exist and are wired:
- ReadyBoard component (area list, floor groups, status colors)
- AreaDetail component (phase list, surface checkboxes)
- PhaseChecklist component (Sprint 25B — new)
- PhaseRow component (Sprint 25B — new)
- PhaseUpdateSheet component (Sprint 25B — bottom sheet for phase update)
- progressCalculation.ts (Sprint 25B — sqft-weighted progress)
- markAreaStatus() function
- completePhase() function
- blockPhase() function

### 6. Photo Service
Verify:
- enqueuePhoto() accepts optional phase_id parameter
- Camera icon on PhaseRow components (Sprint 25C)
- Photo count badge per phase
- field_photos.phase_id populated when taking photo from phase context

### 7. Delivery Features (Phase T3)
Verify:
- Delivery checklist component
- Quantity received input
- Confirm All button
- receipt_status update uses "quantity_ordered" (NOT "quantity")
- material_consumption auto-update on confirm

### 8. Offline Capability
Verify:
- All writes go to PowerSync local DB first
- SyncStatusBar component shows online/offline/syncing
- Photo queue works offline (enqueuePhoto → photo-worker upload when online)

### 9. Known Device Bugs
Check if these fixes are still in code:
- GPS screen crash fix (Maps fallback)
- Signature pad fix (ScrollView touch)
- Ticket sync fix (serial column + JSONB)
- Status values fix ('completed' not 'complete')
- Blocked reasons fix ('material_not_delivered' not 'material')

### 10. Missing Features
List tasks from TASKS_TRACK.md marked as ⬜ that block the pilot:
- TT2.4 Progress photo per surface
- TT2.6 Photo gallery per area
- TT2.10 Auto-progress calculation (sqft-weighted — should be done in 25B)
- TT2.27-32 Punch List items (create, view, resolve, verify)
- TT1.38-43 Plan overlay, hyperlinks, tablet split

### 11. EAS Build Readiness
Verify:
- app.json configured correctly
- eas.json has env block
- No Node 25 dependencies that break metro
- PowerSync @journeyapps/react-native-quick-sqlite as explicit dep

### 12. Data Alignment with Takeoff
Verify Track can read data created by Takeoff Sprint 23+:
- Rooms created via Apply to Rooms (production_areas with room_type_id)
- Surfaces copied to production_area_objects (with material_code, quantity_sf)
- phase_progress rows (if created)
- scope_materials (does Track need this? probably not)
- scope_groups (does Track need this? probably not)

---

## OUTPUT FORMAT

```
TRACK AUDIT REPORT — 2026-04-04

TYPESCRIPT: PASS/FAIL
POWERSYNC SCHEMA: N tables, N aligned, N mismatched
SYNC RULES: N rules, all correct? Y/N
NAVIGATION: 5/5 tabs working
PRODUCTION: N/9 components exist
PHOTOS: N/4 checks pass
DELIVERY: N/5 checks pass
OFFLINE: N/3 checks pass
DEVICE BUGS: N/5 fixes present in code
MISSING FEATURES: list with priority
EAS BUILD: ready? Y/N (list blockers)
DATA ALIGNMENT: N/4 checks pass

PRIORITY FIXES (ordered by severity):
1. ...
2. ...
3. ...

READY FOR APK BUILD: YES/NO
```
