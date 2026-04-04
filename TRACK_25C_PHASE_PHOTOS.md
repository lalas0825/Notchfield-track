# TRACK SPRINT 25C — Photos Linked to Phases
# MODEL: /model claude-sonnet-4-6
# Repo: notchfield-track

---

## Context
field_photos table now has phase_id column (added in 25A schema update).
When foreman takes a photo from within a phase context, link it to the phase.

## What to build

### Camera icon on each phase row

In PhaseChecklist (built in 25B), add a 📷 icon button on the right side of each phase row.
Only show on phases that are in_progress or complete (not locked or not_started).

```
✅ 1. Sound proof      600/600 SF    📷
🟡 3. Waterproof       400/600 SF    📷 [▶]
🔒 4. Tile floor       0/600 SF          ← no camera (locked)
```

### Tap camera flow

1. Foreman taps 📷 on a phase row
2. Camera opens (expo-camera or expo-image-picker)
3. Photo taken → auto-tagged:
   - area_id: current area
   - phase_id: the phase they tapped 📷 on
   - context_type: 'progress'
   - GPS coordinates from expo-location
   - taken_by: current user
4. Photo enqueued via existing photo-queue (enqueuePhoto pattern)
5. Thumbnail shows inline on the phase row: 📷 2 (count badge)

### Photo count per phase

Query field_photos WHERE area_id = X AND phase_id = Y → show count badge.
"📷 3" means 3 photos taken for this phase.

Tap the count badge → opens photo gallery filtered to that phase.

### Also update area-level camera

The existing camera button at top of AreaDetail should continue to work 
but set phase_id = null (general area photo, not phase-specific).

### Files to modify

- PhaseRow.tsx (from 25B) — add camera icon + count badge
- photo-service.ts or photo-queue.ts — accept optional phase_id parameter
- AreaDetail.tsx — pass phase_id=null for area-level photos

### UX Rules
- Camera icon: 32dp, right-aligned on phase row
- Count badge: small orange circle with white number
- Haptic feedback on camera tap
- Toast: "Photo saved" after capture

## Verify
npx tsc --noEmit
