# SPRINT 34 — Track: 3 Missing Pilot Features
# MODEL: /model claude-sonnet-4-6
# Repo: notchfield-track

---

## Context
Track audit found 3 features blocking pilot deployment.
Read CLAUDE_TRACK.md for patterns (photo-queue, optimistic UI, dark mode, touch targets).

---

## FEATURE 1: TT2.4 — Progress Photo Per Surface

### What
When foreman marks a surface complete in AreaDetail, a camera icon appears 
next to that surface's checkbox. Tap → take photo → auto-tagged to that surface.

### Implementation

In AreaDetail.tsx, for each surface checkbox row, add a camera icon button 
that appears when the surface status is 'in_progress' or 'complete':

```
┌─────────────────────────────────────────────┐
│ ☑ Floor    CT-04    600 SF    ✅    📷 2    │
│ ☑ Wall     CT-05   1,280 SF   ✅    📷 1    │
│ ☐ Base     CT-05     56 SF    ⬜           │
│ ☑ Saddle   —          6 PCS   🔴    📷     │
└─────────────────────────────────────────────┘
```

- 📷 icon: 32dp, right side of surface row
- Only shows on surfaces that are in_progress, complete, or blocked
- Tap → opens camera (expo-camera or expo-image-picker)
- Photo auto-tagged with:
  - area_id: current area
  - object_id: the surface's production_area_object id
  - phase_id: null (surface-level, not phase-level)
  - context_type: 'progress'
  - GPS coordinates from expo-location getCurrentPositionAsync()
  - taken_by: current user
- Uses existing enqueuePhoto() from photo-queue
- After capture: show count badge "📷 2" next to icon
- Query field_photos WHERE area_id AND object_id to get count

### Files
- Modify: AreaDetail.tsx — add camera icon per surface row
- Reuse: existing photo-queue enqueuePhoto() and photo-worker

---

## FEATURE 2: TT2.6 — Photo Gallery Per Area

### What
Swipeable photo timeline in AreaDetail showing all photos for that area.
Foreman and PM can scroll through progress, QC, blocked, delivery photos.

### Implementation

Add a "Photos" section at the bottom of AreaDetail (or as a tab within AreaDetail):

```
┌─────────────────────────────────────────────┐
│ PHOTOS (12)                          [📷 +] │
│                                             │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│ │    │ │    │ │    │ │    │ │    │  →scroll │
│ │ 📷 │ │ 📷 │ │ 📷 │ │ 📷 │ │ 📷 │        │
│ │    │ │    │ │    │ │    │ │    │        │
│ └────┘ └────┘ └────┘ └────┘ └────┘        │
│ Mar 25  Mar 25 Mar 26 Mar 26 Mar 27        │
│ progress blocked progress qc     progress  │
└─────────────────────────────────────────────┘
```

- Horizontal scrollable thumbnail strip (FlatList horizontal)
- Each thumbnail: 80x80dp, rounded corners 8dp
- Below thumbnail: date (14sp) + context_type badge (12sp, colored)
- Tap thumbnail → full-screen photo viewer:
  - Pinch to zoom
  - Swipe left/right to navigate
  - Shows: caption, taken_by, taken_at, GPS, context_type, surface name (if object_id), phase name (if phase_id)
  - Close button top-left
- [📷 +] button top-right: take general area photo (context_type='general', no object_id, no phase_id)
- Filter chips above gallery: All | Progress | QC | Blocked | Delivery
- Sort: newest first

### Data source
Query field_photos WHERE area_id = current area, ordered by taken_at DESC.
For offline: show photos from local filesystem (local_uri) if remote_url not yet uploaded.

### Files
- Create: src/features/production/components/PhotoGallery.tsx
- Create: src/features/production/components/PhotoViewer.tsx (full-screen modal)
- Modify: AreaDetail.tsx — add PhotoGallery section at bottom

### UX Rules
- Thumbnails load from local_uri first (offline), remote_url as fallback
- Skeleton loading while photos load
- Empty state: "No photos yet. Take a photo using the 📷 buttons above."
- Badge colors: progress=green, qc=blue, blocked=red, delivery=amber, safety=purple, general=gray

---

## FEATURE 3: TT2.10 — Auto-Progress Calculation (sqft-weighted)

### What
Room progress percentage auto-calculated from surface sqft, not just checkbox count.
A 1,280 SF wall counts more than a 6 SF saddle.

### Implementation

Update the progress calculation to use sqft-weighted formula.

Currently: progress might be checkbox-based (completed surfaces / total surfaces).
New: progress = sum(completed_sf) / sum(total_sf)

```typescript
// src/features/production/utils/progressCalculation.ts
// This file was created in Sprint 25B for phase-level progress.
// Add surface-level progress calculation:

export function calculateSurfaceProgress(surfaces: ProductionAreaObject[]): number {
  let totalSf = 0;
  let completedSf = 0;
  
  for (const surface of surfaces) {
    const sf = surface.quantity_sf || surface.total_quantity_sf || 0;
    if (sf <= 0) continue; // skip surfaces without sqft (e.g., PCS items)
    
    totalSf += sf;
    if (surface.status === 'complete') {
      completedSf += sf;
    }
  }
  
  // For PCS/EA items without SF, use count-based
  const pcsItems = surfaces.filter(s => !s.quantity_sf && !s.total_quantity_sf);
  if (pcsItems.length > 0) {
    const pcsWeight = 20; // fixed weight per PCS item
    totalSf += pcsItems.length * pcsWeight;
    completedSf += pcsItems.filter(s => s.status === 'complete').length * pcsWeight;
  }
  
  return totalSf > 0 ? Math.round((completedSf / totalSf) * 100) : 0;
}

// Combined progress: phases + surfaces
export function calculateAreaProgress(
  phases: PhaseProgress[], 
  surfaces: ProductionAreaObject[]
): number {
  // If phases exist, use phase-level progress (from Sprint 25B)
  if (phases.length > 0) {
    return calculatePhaseProgress(phases); // existing function
  }
  // Fallback: use surface-level progress
  return calculateSurfaceProgress(surfaces);
}
```

### Where to use
- ReadyBoard: each area card shows progress % from calculateAreaProgress()
- AreaDetail: progress bar at top uses calculateAreaProgress()
- FloorHeader: floor progress = average of area progresses, weighted by total SF
- Home dashboard: project progress = weighted average of all areas

### Update ReadyBoard
In ReadyBoard.tsx, when computing progress per area:
- Query production_area_objects for each area
- Pass to calculateSurfaceProgress() or calculateAreaProgress()
- Display the percentage on the area card

### Update AreaDetail header
The progress bar at top of AreaDetail should use the sqft-weighted calc:
```
Washroom 03-001          🟡 In Progress
▓▓▓▓▓▓▓░░░ 68%          (1,768 / 2,592 SF)
```
Show both percentage and SF fraction.

### Files
- Modify: src/features/production/utils/progressCalculation.ts — add calculateSurfaceProgress, calculateAreaProgress
- Modify: ReadyBoard.tsx — use sqft-weighted progress
- Modify: AreaDetail.tsx — use sqft-weighted progress in header
- Modify: any floor-level progress bars

---

## Verify

1. Surface checkboxes have 📷 camera icon (in_progress/complete/blocked surfaces)
2. Tap camera → takes photo → count badge updates
3. PhotoGallery shows horizontal thumbnail strip at bottom of AreaDetail
4. Tap thumbnail → full-screen viewer with swipe + zoom
5. Filter chips work (All/Progress/QC/Blocked/Delivery)
6. Progress % uses sqft-weighted formula
7. 1,280 SF wall counts more than 6 SF saddle in progress calc
8. ReadyBoard cards show sqft-weighted progress
9. AreaDetail header shows "68% (1,768 / 2,592 SF)"
10. PCS items get fixed 20 SF weight
11. npx tsc --noEmit passes
