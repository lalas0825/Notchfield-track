# TRACK AUDIT REPORT — 2026-04-04
> Model: Claude Sonnet 4.6 | Repo: Notchfield-track (30 commits)

---

## SUMMARY SCORES

| Check | Result |
|-------|--------|
| **TYPESCRIPT** | ✅ PASS — 0 errors |
| **POWERSYNC SCHEMA** | 🟡 33 tables in schema.ts — 2 in sync-rules NOT in schema |
| **SYNC RULES** | 🟡 All filters correct — 2 consistency gaps |
| **NAVIGATION** | ✅ 5/5 tabs confirmed |
| **PRODUCTION COMPONENTS** | ✅ 9/9 exist and wired |
| **PHOTOS** | ✅ 4/4 checks pass |
| **DELIVERY** | ✅ 5/5 checks pass |
| **OFFLINE** | ✅ 3/3 checks pass |
| **DEVICE BUGS** | ✅ 5/5 fixes present in code |
| **MISSING FEATURES** | 🔴 5 pilot-blocking + 5+ post-pilot pending |
| **EAS BUILD** | 🟡 READY — 1 note |
| **DATA ALIGNMENT** | ✅ 4/4 checks pass |

---

## 1. TYPESCRIPT — ✅ PASS

```
npx tsc --noEmit → 0 errors
```

Clean build. All types resolved. No issues.

---

## 2. POWERSYNC SCHEMA vs SUPABASE

### Sprint 25A new columns — ALL VERIFIED ✅

| Table | Columns Added |
|-------|--------------|
| `production_areas` | ✅ `room_type_id`, `acceptance_status`, `start_date`, `target_end_date` |
| `production_template_phases` | ✅ `applies_to_surface_types`, `is_binary`, `binary_weight` |
| `field_photos` | ✅ `phase_id` |
| `room_types` | ✅ NEW TABLE — fully defined |
| `room_type_surfaces` | ✅ NEW TABLE — fully defined |
| `phase_progress` | ✅ NEW TABLE — fully defined |

### ⚠️ Schema Gaps Found

1. **`master_production_targets`** — in `sync-rules.yaml` line 47 but **NOT in `schema.ts`**.
   PowerSync syncs these rows but the app cannot query them locally. Low risk (Track doesn't need the data), but inconsistent.

2. **`legal_documents`** — in `sync-rules.yaml` line 45 but **NOT in `schema.ts`**.
   Legal feature is not yet built. Rows are being synced with no local consumer.

**Fix:** Remove both from `sync-rules.yaml` until added to `schema.ts` (5-min edit).

---

## 3. SYNC RULES

✅ Sprint 25A tables included: `room_types` (line 53), `room_type_surfaces` (line 54), `phase_progress` (line 55)
✅ All rules filter by `organization_id = bucket.organization_id`
✅ No JOINs or subqueries in data sections
✅ `by_user` bucket for per-user profile scoping

⚠️ `master_production_targets` and `legal_documents` in sync-rules but NOT in schema.ts

---

## 4. NAVIGATION — ✅ 5/5 TABS

```
src/app/(tabs)/
├── _layout.tsx   ← defines 5 bottom tabs
├── home/         ← Tab 1: Home           ✅
├── board/        ← Tab 2: Board          ✅
├── plans/        ← Tab 3: Plans          ✅
├── docs/         ← Tab 4: Docs           ✅
└── more/         ← Tab 5: More           ✅
```

---

## 5. PRODUCTION FEATURES — ✅ 9/9

| Component | File | Status |
|-----------|------|--------|
| ReadyBoard | `production/components/ReadyBoard.tsx` | ✅ EXISTS |
| AreaDetail | `production/components/AreaDetail.tsx` | ✅ EXISTS |
| PhaseChecklist | `production/components/PhaseChecklist.tsx` | ✅ Sprint 25B |
| PhaseRow | `production/components/PhaseRow.tsx` | ✅ Sprint 25B |
| PhaseUpdateSheet | `production/components/PhaseUpdateSheet.tsx` | ✅ Sprint 25B |
| progressCalculation.ts | `production/utils/progressCalculation.ts` | ✅ Sprint 25B |
| `markAreaStatus()` | `production-store.ts:176` | ✅ WIRED |
| `completePhase()` | `production-store.ts:242` | ✅ WIRED |
| `blockPhase()` | `production-store.ts:279` | ✅ WIRED |

---

## 6. PHOTO SERVICE — ✅ 4/4

| Check | Result |
|-------|--------|
| `enqueuePhoto()` accepts optional `phase_id` | ✅ `params.phaseId?: string \| null` at line 39 |
| Camera icon on PhaseRow (Sprint 25C) | ✅ `showCamera` guard + `camera-outline` icon at line 152 |
| Photo count badge per phase | ✅ Badge renders when `photoCount > 0` (lines 110–136) |
| `field_photos.phase_id` populated from phase context | ✅ `phase_id: params.phaseId ?? null` at line 71 |

---

## 7. DELIVERY FEATURES — ✅ 5/5

| Check | Result |
|-------|--------|
| Delivery checklist component | ✅ `delivery/components/` (TT3.2 done) |
| Quantity received input | ✅ `quantity_received` field in `DeliveryItem` type |
| Confirm All button | ✅ `confirmAllItems()` at `delivery-service.ts:123` |
| Uses `quantity_ordered` (not `quantity`) | ✅ `quantity_received: item.quantity_ordered` at line 130 |
| `material_consumption` auto-update on confirm | ✅ `updateDeliveredQty()` at line 190 |

---

## 8. OFFLINE CAPABILITY — ✅ 3/3

| Check | Result |
|-------|--------|
| All writes go to PowerSync local DB first | ✅ All use `localUpdate()` / `localInsert()` from `write.ts` |
| SyncStatusBar shows online/offline/syncing | ✅ `SyncStatusBar.tsx` mounted in `_layout.tsx:74` |
| Photo queue works offline | ✅ `photo-queue.ts` saves to local FS → `photo-worker.ts` uploads when online |

---

## 9. DEVICE BUGS — ✅ 5/5 FIXES PRESENT IN CODE

| Bug | Severity | Fix Location |
|-----|----------|-------------|
| GPS screen crash — Maps fallback | P0 | ✅ `GeofenceMap.tsx:29-30` |
| Signature pad — ScrollView steals touch | P1 | ✅ Confirmed in code (TT1.21) |
| Ticket sync — serial column + JSONB | P1 | ✅ Fixed in `supabase-connector.ts` |
| Status value `'complete'` (not `'completed'`) | P0 | ✅ `progressCalculation.ts:41`, `PhaseRow.tsx:37` |
| Blocked reason `'material_not_delivered'` | P1 | ✅ `PhaseUpdateSheet.tsx:11`, `AreaDetail.tsx:8` |

> ⚠️ All 5 fixes are in code (commit `79b592a`). Still need **EAS dev-client build** to validate on device.

---

## 10. MISSING FEATURES

### 🔴 Pilot-Blocking (needed before first field use)

| Task | Description | Priority |
|------|-------------|----------|
| TT2.4 | Progress photo per surface (camera icon on checkboxes) | HIGH |
| TT2.6 | Photo gallery per area (swipeable timeline) | HIGH |
| TT2.10 | Auto-progress calc — sqft-weighted % from surfaces | HIGH |
| TT3.4 | Photo evidence on delivery item confirm | MEDIUM |
| TT3.8 | Material by area view (supervisor screen) | MEDIUM |

### ⬜ Non-blocking / Post-Pilot

| Tasks | Description |
|-------|-------------|
| TT2.17–19 | Legal: NOD draft, review, sign |
| TT2.27–32 | Punch List full UI (create/view/resolve/verify) |
| TT1.38–43 | Plan overlay, hyperlinks, tablet split view |
| TT2.20–25 | AI Agent + Picovoice voice commands |
| TT4.1–10 | Phase T4: role enforcement, push notifications, App Store |

---

## 11. EAS BUILD READINESS — 🟡 READY

| Check | Result |
|-------|--------|
| `app.json` configured | ✅ Bundle IDs, permissions, all plugins set |
| `eas.json` has env block | ✅ All 3 profiles (dev / preview / prod) have env vars |
| `@journeyapps/react-native-quick-sqlite` explicit dep | ✅ `package.json:17` + `app.json` plugins list |
| No Node 25+ breaking deps | ✅ Expo SDK 55 canary pinned to `20260327` snapshot |

> ⚠️ NOTE: All packages pinned to `55.0.x-canary-20260327-0789fbc`. dev-client APK is on device.
> Next build needed: **preview APK** (`eas build --platform android --profile preview`) to test bug fixes.

---

## 12. DATA ALIGNMENT WITH TAKEOFF SPRINT 23+ — ✅ 4/4

| Takeoff Data | Track Schema | Sync Rule |
|-------------|-------------|-----------|
| `production_areas.room_type_id` (Apply to Rooms) | ✅ `schema.ts:71` | ✅ `sync-rules:32` |
| `production_area_objects` with `material_code`, `quantity_sf` | ✅ `schema.ts:91-92` | ✅ `sync-rules:29` |
| `phase_progress` rows | ✅ `schema.ts:476-492` | ✅ `sync-rules:55` |
| `scope_materials` / `scope_groups` | ❌ NOT in schema — ✅ correct, Track doesn't need them | — |

---

## PRIORITY FIXES (ordered by severity)

```
1. [HIGH] SCHEMA CONSISTENCY
   Remove `master_production_targets` and `legal_documents` from sync-rules.yaml
   -OR- add them to schema.ts. Currently syncing rows with no local consumer.
   File: powersync/sync-rules.yaml (lines 45 and 47)
   Time: 5 minutes.

2. [HIGH] EAS DEV-CLIENT BUILD
   Trigger eas build --platform android --profile preview to validate
   the 5 P0/P1 bug fixes from commit 79b592a on real device.

3. [MEDIUM] TT2.4 — Progress photo per surface
   Camera icon on surface checkboxes in AreaDetail.
   Blocker for the core production reporting UX.

4. [MEDIUM] TT2.10 — sqft-weighted progress calculation
   Auto-compute % from production_area_objects.quantity_sf.
   Required for Ready Board accuracy.

5. [MEDIUM] TT2.6 — Photo gallery per area
   Swipeable photo timeline in AreaDetail.
   Needed before handing device to foreman.

6. [LOW] TT3.8 / TT3.9 — Material by area + alerts screens
   Data is already in material_consumption table. Just needs UI.
   Non-blocking for the foreman workflow.
```

---

## READY FOR APK BUILD: **YES**

> TypeScript clean. Sprint 25A/B/C fully shipped. 9/9 production components wired.
> All 5 device bug fixes committed. EAS config complete.
>
> **Next command:** `eas build --platform android --profile preview`
> **Before that:** Fix sync-rules consistency (Priority 1 — 5-min edit).

---

*Audit executed: 2026-04-04 | Model: Claude Sonnet 4.6 | Repo: Notchfield-track*
