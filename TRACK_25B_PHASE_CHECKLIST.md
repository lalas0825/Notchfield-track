# TRACK SPRINT 25B — Phase Checklist UI
# MODEL: /model claude-sonnet-4-6
# Repo: notchfield-track

---

## Context
Track's AreaDetail screen currently shows surface checkboxes and phase list from production_phase_progress (old table). 
Sprint 23 created phase_progress (new table with target_sf + completed_sf).
Update AreaDetail to use phase_progress for sqft-weighted progress.

## What to build

### Phase Checklist Section in AreaDetail

Add a PHASES section at the top of AreaDetail, above the existing surfaces:

```
┌─────────────────────────────────────────┐
│ Washroom 03-001          🟡 In Progress │
│ ▓▓▓▓▓▓░░░░ 42%                         │
├─────────────────────────────────────────┤
│ PHASES (9)              Bathroom Constr │
│                                         │
│ ✅ 1. Sound proof      600/600 SF       │
│ ✅ 2. Pre-float        600/600 SF       │
│ 🟡 3. Waterproof       400/600 SF  [▶]  │
│ 🔒 4. Tile floor       0/600 SF         │
│ 🔒 5. Tile base        0/56 SF          │
│ 🔒 6. Tile wall        0/1280 SF        │
│ 🔒 7. Grout            0/1936 SF        │
│ ⬜ 8. Caulk            — (binary)       │
│ 🔒 9. Sealer           0/600 SF         │
├─────────────────────────────────────────┤
│ SURFACES (6)                            │
│ ...existing surface checkboxes...       │
└─────────────────────────────────────────┘
```

### Phase row behavior

Each phase row shows:
- Status icon: ✅ complete, 🟡 in_progress, 🔴 blocked, ⬜ not_started, 🔒 locked
- Phase name (from production_template_phases.name)
- completed_sf / target_sf (from phase_progress)
- Binary phases (is_binary=true): show "—" instead of SF, just done/not done

### Tap interaction

Tap a phase that is not_started or in_progress → opens a bottom sheet:
- Slider or numeric input for completed_sf (0 to target_sf)
- "Mark Complete" button (sets completed_sf = target_sf, status = 'complete')
- "Report Blocked" button → blocked reason picker (7 reasons)
- Auto-save on slider change (optimistic UI)

Locked phases (🔒) are not tappable. They unlock when the previous phase is complete.
If previous phase has is_gate=true, locked until verified_at is set.

### Progress calculation

Progress bar at top = sum(completed_sf) / sum(target_sf) across all phases.
Binary phases contribute binary_weight (default 20) to both numerator (if complete) and denominator.

```typescript
function calculateProgress(phases: PhaseProgress[]): number {
  let totalTarget = 0;
  let totalCompleted = 0;
  for (const p of phases) {
    if (p.is_binary) {
      totalTarget += p.binary_weight || 20;
      totalCompleted += p.status === 'complete' ? (p.binary_weight || 20) : 0;
    } else {
      totalTarget += p.target_sf || 0;
      totalCompleted += p.completed_sf || 0;
    }
  }
  return totalTarget > 0 ? totalCompleted / totalTarget : 0;
}
```

### Data source

Query phase_progress WHERE area_id = current area, JOIN with production_template_phases for name + sort_order + is_binary + is_gate.

If phase_progress rows don't exist for this area yet (room was just created), show "No phases assigned. PM needs to assign a template in Takeoff."

### Write operations

When foreman updates a phase:
- UPDATE phase_progress SET completed_sf = X, status = 'in_progress' (or 'complete' if X >= target_sf)
- If marking complete: SET completed_at = now(), completed_by = userId
- If reporting blocked: SET status = 'blocked', blocked_reason = reason
- All writes go to PowerSync local DB first (offline-first)

### Files to modify

- AreaDetail.tsx (or wherever the area detail screen is) — add PhaseChecklist component above surfaces
- Create: src/features/production/components/PhaseChecklist.tsx
- Create: src/features/production/components/PhaseRow.tsx  
- Create: src/features/production/components/PhaseUpdateSheet.tsx (bottom sheet)
- Create: src/features/production/utils/progressCalculation.ts
- Update: any existing progress display to use new calculation

### UX Rules (from CLAUDE_TRACK.md)
- Touch targets 48dp minimum, phase rows 56dp height
- Haptic feedback on status change
- Optimistic UI — update immediately, sync in background
- Status colors: ✅ #22C55E, 🟡 #F59E0B, 🔴 #EF4444, ⬜ #9CA3AF, 🔒 #6B7280
- Font: phase name 16sp, SF numbers 14sp
- Dark mode default

## Verify
npx tsc --noEmit
