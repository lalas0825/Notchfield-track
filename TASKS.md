# NotchField Track — TASKS_TRACK.md
> Track native app task tracker | 105 tasks | Updated: 2026-03-31
> 4 phases: T1 (start now) → T2 (after Takeoff 7B) → T3 (after Takeoff 9) → T4 (after Takeoff 10)
> Same Supabase as Takeoff. Expo + PowerSync. Offline-first.
> **Supabase project:** msmpsxalfalzinuorwlg (Notchfield Takeoff — shared)
> **PowerSync:** 69c72137a112d86b20541618.powersync.journeyapps.com
> **EAS Project:** 281ade7b-a5d9-4f43-9710-d270ae4c49f4 (@lalas825/notchfield-track)
> **Repo:** https://github.com/lalas0825/Notchfield-track (25 commits)
> **APK:** Installed on device. Login + Home + Docs + Plans + More working. Board + GPS + Signature need debug.

---

## 📊 Summary

| Phase | What | Tasks | Depends On | Status |
|-------|------|-------|-----------|--------|
| **T1 — Foundation + Safety + GPS + Time Tracking + Plans** | Auth, navigation, GPS, safety, work tickets, crew, time entries, drawing viewer | **43** | Nothing (tables exist) | ✅ OPERATIONAL (40/43) |
| **T2 — Production + Ready Board + Legal + Punch List + AI Agent** | Daily report, checkboxes, Ready Board, gates, NOD/REA, punch list, AI agent + voice | **38** | Takeoff Fase 7B | ✅ S1-S3 DONE (AI Agent deferred post-launch) |
| **T3 — Delivery + Material Flow** | Delivery confirmation, supervisor tracker, material consumption | **10** | Takeoff Fase 9 | ✅ 7/10 DONE (3 UI screens pending) |
| **T4 — Polish + App Store** | Role enforcement, push, performance, store submission | **10** | Takeoff Fase 10 | ⬜ After Fase 10 |
| **Audit** | 65-check audit (AUDIT_TRACK.md) | 65 | — | ✅ B- grade, 11 FAILs fixed |
| **EAS Build** | APK on device testing | — | — | 🟡 ~7 builds. Awaiting dev-client build |
| **Seed Data** | Real production data in Supabase | — | — | ✅ 6 areas, 5 workers, template, geofence |
| **TOTAL** | | **105** | | |

### 🐛 Known Device Bugs (need dev-client build to debug)

| Bug | Severity | Root Cause | Fix Status |
|-----|----------|-----------|------------|
| GPS screen crash | P0 | Google Maps API key missing → fallback to text | ✅ Fixed in code, needs build |
| Signature pad dots only | P1 | ScrollView steals touch from WebView canvas | ✅ Fixed in code, needs build |
| Tickets don't sync to Supabase | P1 | Serial `number` column + JSONB serialization | ✅ Fixed in connector, needs build |
| Status values mismatch | P0 | `'complete'` vs `'completed'` in Postgres CHECK | ✅ Fixed in code |
| Blocked reasons mismatch | P1 | `'material'` vs `'material_not_delivered'` | ✅ Fixed in code |

All 5 bugs are fixed in code (commit 79b592a). Need EAS dev-client build to verify on device.

---

## 📱 PHASE T1 — Foundation + Safety + GPS — ✅ OPERATIONAL
> 39 of 43 tasks complete. 4 deferred to T2 (require data from Takeoff 7B).
> 5 Supabase migrations applied. PowerSync sync rules deployed. 6 locales.

### Foundation
- [x] TT1.1 Expo project init — SDK 55, TypeScript, NativeWind v4, Zustand v5, Zod v4
- [x] TT1.2 PowerSync setup — connection to shared Supabase (msmpsxalfalzinuorwlg), sync rules deployed
- [x] TT1.3 Supabase Auth integration — SecureStore session persistence, shared auth with Takeoff
- [x] TT1.4 i18n setup — 6 locales (EN, ES, FR, PT, IT, DE), 150+ keys, construction terminology
- [x] TT1.5 Navigation — 5 bottom tabs (Home, Board, Plans, Docs, More)
- [x] TT1.6 Role-based scope — foreman auto-selects 1 project, supervisor gets ProjectSwitcher modal
- [x] TT1.7 Home screen — dashboard with modular DashboardCards, quick actions, alerts, crew/safety/ticket stats
- [x] TT1.8 Offline indicator — SyncStatusBar (amber syncing, muted offline, hidden when connected)
- [x] TT1.9 Photo service — expo-camera + expo-image-picker, photo-queue outbox pattern, photo-worker background upload
- [x] TT1.10 Branding — brand colors (colors.ts), dark mode default, touch targets, font sizes, app.json configured

### GPS + Check-in
- [x] TT1.11 expo-location setup — foreground permissions, high accuracy + last known fallback
- [x] TT1.12 Geofence — Haversine distance check against gps_geofences, isInsideGeofence()
- [x] TT1.13 Manual check-in/out — 120dp circle button, manual override for GPS failure
- [x] TT1.14 `gps_checkins` table — created via migration, RLS: org_id + user_id
- [x] TT1.15 `gps_geofences` table — created via migration, RLS: org_id + field leaders only
- [x] TT1.16 GPS stamps on photos — gps_lat/gps_lng in field_photos table

### Safety Documents
- [x] TT1.17 JHA — dynamic form: hazards[], risk levels, controls, PPE chips. Zod validated
- [x] TT1.18 PTP — tasks[], crew members, location. Zod validated
- [x] TT1.19 Toolbox Talk — topic, discussion points, attendance. Zod validated
- [x] TT1.20 Safety doc list — grouped by type, status badges, FAB create button
- [x] TT1.21 Signature collection — SignaturePad (react-native-signature-canvas), base64 capture
- [x] TT1.22 QR signature — document_signoffs table exists with token field (web route pending)
- [x] TT1.23 Cert tracking — worker_certifications table, useCertAlerts hook, cert dots on WorkerCard, assignment validation Alert

### Work Tickets
- [x] TT1.24 Create work ticket — TicketForm with camera, crew auto-fill from crew-store
- [x] TT1.25 Work ticket list — unified Docs tab with Tickets + Safety tabs, status filters
- [x] TT1.26 Work ticket detail — header card, location, description, photo gallery
- [x] TT1.27 Status workflow — draft/submitted/reviewed/closed chips, completed requires photo

### Crew Management + Time Tracking by Area
- [x] TT1.28 `crew_assignments` table — UNIQUE(worker_id), RLS org_id, field leaders only
- [x] TT1.29 `area_time_entries` table — hours GENERATED ALWAYS, RLS org_id
- [x] TT1.30 Assign workers to area — 2-tap flow: select workers → pick area
- [x] TT1.31 Move workers to new area — auto-closes previous time entries, creates new
- [x] TT1.32 End of day — "End Day" button closes all open entries + clears assignments
- [x] TT1.33 Today's crew view — WorkerCard with current area, assignment status
- [x] TT1.34 Daily hours summary — todayHours computed live from time entries

### Plans / Drawing Viewer
- [x] TT1.35 Plans tab + sheet list — grouped by discipline (A=Arch, S=Struct, M=Mech), search, collapse
- [x] TT1.36 PDF plan viewer — react-native-pdf, pinch-to-zoom, horizontal paging, platform-split (.web.tsx)
- [x] TT1.37 PDF offline caching — expo-file-system legacy API, signed URL download, progress bar, cache-first
- [ ] TT1.38 Takeoff overlay — ⬜ T2 (needs takeoff_objects data from Estimator)
- [ ] TT1.39 Hyperlinked sheets — ⬜ T2 (needs cross-references in drawing_register)
- [x] TT1.40 Revision indicator — amber badge for sheets with multiple revisions, cloud status icon
- [ ] TT1.41 Tap area → jump to detail — ⬜ T2 (needs production_areas data + area detail screen)
- [ ] TT1.42 Tablet split view — ⬜ T2 (needs TT1.41 + tablet testing)
- [ ] TT1.43 Field markups — ⬜ T2 (needs field_markups migration)

---

## 🏭 PHASE T2 — Production Reporting — 🟡 IN PROGRESS
> Takeoff 7B tables confirmed: production_areas, production_area_objects, production_templates,
> production_template_phases, production_phase_progress all exist.
> 3 new migrations applied: daily_reports, field_messages, punch_items.

### Daily Report (3-click workflow) — Sprint T2-S1 ✅
- [x] TT2.1 Area list — ReadyBoard component: grouped by floor, progress bars, status dots, search, filter chips
- [x] TT2.2 Area detail — AreaDetail component: phase list with gates/locks, status header, time entries
- [x] TT2.3 Mark surface complete — markAreaStatus() with optimistic UI + gate validation
- [x] TT2.5 Area progress photo — camera button on AreaDetail → enqueuePhoto() via photo-queue
- [x] TT2.7 Mark surface blocked — 7 predefined reasons (other_trade, material, etc.), block reporting flow
- [x] TT2.8 Unblock surface — "Unblock — Resume Work" button, clears blocked_reason
- [x] TT2.9 Phase tracking — ordered phase list from template, completePhase() with userId audit
- [x] TT2.11 Submit daily report — report-service.ts: draft/submit lifecycle, upsert on UNIQUE, area checkboxes, auto man-hours
- [ ] TT2.4 Progress photo per surface — ⬜ needs production_area_objects surface checkboxes (T2-S3)
- [ ] TT2.6 Photo gallery per area — ⬜ swipeable timeline (T2-S3)
- [ ] TT2.10 Auto-progress calculation — ⬜ needs surface sqft data (T2-S3)

### Production Dashboard (in-app) — Sprint T2-S1 ✅
- [x] TT2.9 Foreman dashboard — Ready Board is the dashboard: floors, areas, progress, blocked
- [x] TT2.11 Floor progress view — collapsible floor sections with progress bars
- [x] TT2.12 Blocked areas highlight — red status dots + blocked reason text + badge in floor header
- [ ] TT2.10 Supervisor dashboard — ⬜ cross-project comparison (T2-S3)

### Ready Board Mobile — Sprint T2-S1 ✅
- [x] TT2.13 Ready Board list view — vertical list, floor groups, status chips filter, search, tap→detail
- [x] TT2.14 Ready Board supervisor aggregate — gate health per floor (shield icon), blocked count badge, progress bars

### Gate Tasks — Sprint T2-S2 ✅
- [x] TT2.15 Gate phase UI — phases with requires_inspection show "Gate" badge, locked phases greyed + lock icon, canCompleteArea() validates gates
- [x] TT2.16 Supervisor gate verification — completePhase() works for any role with access, recalcFloor() updates instantly
- [x] Gate health metrics — computeGateHealth() per floor: totalGates, completedGates, gateHealthPct
- [x] Auto field_message on gate block — blockPhase() auto-inserts blocker message

### Legal Documentation (supervisor only)
- [ ] TT2.17 NOD draft notification — ⬜ T2-S3
- [ ] TT2.18 NOD review + sign — ⬜ T2-S3
- [ ] TT2.19 Legal docs list — ⬜ T2-S3

### Crew Assignment (extended)
- [x] TT2.15 Link time entries to production areas — AreaDetail shows "X man-hours today" from crew time entries
- [ ] TT2.16 Supervisor: assign foreman to project — ⬜ T2-S3
- [ ] TT2.17 Labor cost per area — ⬜ T2-S3

### Communication
- [x] TT2.17 `field_messages` table — created via migration, auto-populated by blockPhase()
- [x] TT2.18 `daily_reports` table — created via migration, used by report-service.ts
- [ ] TT2.15 Area notes UI — ⬜ T2-S3
- [ ] TT2.16 Photo annotations — ⬜ T2-S3

### Punch List (internal — supervisor → foreman)
- [x] TT2.26 `punch_items` table — created via migration with RLS
- [ ] TT2.27 Create punch item — ⬜ T2-S3
- [ ] TT2.28 Punch list view — ⬜ T2-S3
- [ ] TT2.29 Foreman resolves punch — ⬜ T2-S3
- [ ] TT2.30 Supervisor verifies — ⬜ T2-S3
- [ ] TT2.31 Punch item on plan — ⬜ T2-S3
- [ ] TT2.32 Punch summary KPIs — ⬜ T2-S3

### AI Agent + Voice Commands (Future — Post-Pilot)
- [ ] TT2.20 AI Agent chat UI — ⬜ T2-S4
- [ ] TT2.21 Picovoice wake word — ⬜ T2-S4
- [ ] TT2.22 Picovoice speech-to-intent — ⬜ T2-S4
- [ ] TT2.23 Voice context file — ⬜ T2-S4
- [ ] TT2.24 AI Agent online mode — ⬜ T2-S4
- [ ] TT2.25 Hybrid voice routing — ⬜ T2-S4

---

## 📦 PHASE T3 — Delivery + Material Flow — ✅ COMPLETE
> Tables exist: delivery_tickets, delivery_ticket_items, material_consumption.
> PowerSync schema + sync rules updated. Delivery service + UI built.

### Delivery Confirmation
- [ ] TT3.1 Delivery notification — ⬜ push notification (T4 — needs expo-notifications)
- [x] TT3.2 Delivery checklist — per item: received / short / damaged / rejected buttons in expandable panel
- [x] TT3.3 Quantity received input — numeric input with over-delivery warning Alert
- [ ] TT3.4 Photo evidence — ⬜ camera integration on item confirm (quick add)
- [x] TT3.5 One-tap "Confirm All" — green button confirms all pending items as received
- [x] TT3.6 Update delivery_ticket_items — receipt_status, quantity_received, receipt_notes via PowerSync local-first

### Supervisor Delivery Tracker
- [x] TT3.7 Delivery history view — chronological list with supplier, PO, status badges, KPI bar
- [ ] TT3.8 Material by area view — ⬜ needs UI screen (data in material_consumption table)
- [ ] TT3.9 Material alerts view — ⬜ needs UI screen

### Material Consumption
- [x] TT3.10 Auto-update material_consumption — updateDeliveredQty() on item confirm, updateInstalledQty() on surface complete. Creates consumption row if not exists.

---

## ✨ PHASE T4 — Polish + App Store — ⬜ AFTER TAKEOFF FASE 10
> Depends on: role system from Takeoff Fase 10 for proper enforcement

### Role Enforcement
- [ ] TT4.1 Worker mode — limited UI: check-in/out, view schedule, sign docs only
- [ ] TT4.2 Scope enforcement — foreman: filter all queries by assigned project_id. Supervisor: show project switcher.
- [ ] TT4.3 PowerSync sync rules by role — worker syncs minimal data, foreman syncs 1 project, supervisor syncs all

### Push Notifications
- [ ] TT4.4 Delivery arriving notification
- [ ] TT4.5 New area assignment notification
- [ ] TT4.6 Cert expiring notification (30 days before)
- [ ] TT4.7 PM message/request notification

### Performance + Testing
- [ ] TT4.8 Large project stress test — 600+ areas, 1000+ objects, offline sync
- [ ] TT4.9 Offline resilience test — full workflow without internet, then sync

### App Store Submission
- [ ] TT4.10 App Store + Google Play — assets, screenshots, description, privacy policy URL, age rating, data safety

---

## 📋 Priority Execution Order

### NOW — Phase T1 (parallel with Takeoff Fase 7B + 8)
1. TT1.1–TT1.10 Foundation (Expo, PowerSync, Auth, i18n, navigation)
2. TT1.11–TT1.16 GPS + check-in
3. TT1.17–TT1.23 Safety documents
4. TT1.24–TT1.27 Work tickets
5. TT1.28–TT1.34 Crew management + time tracking
6. TT1.35–TT1.43 Plans / Drawing Viewer (PlanGrid-style, tablet split view)

### After Takeoff 7B completes — Phase T2
1. TT2.1–TT2.11 Daily report (checkboxes, blocked, phases, submit)
2. TT2.12–TT2.14 Production dashboard + Ready Board mobile
3. TT2.15–TT2.19 Gate tasks + Legal (NOD/REA)
4. TT2.15–TT2.18 Communication
5. TT2.20–TT2.25 AI Agent + Picovoice voice commands (post-pilot)

### After Takeoff Fase 9 completes — Phase T3
1. TT3.1–TT3.6 Delivery confirmation
2. TT3.7–TT3.9 Supervisor delivery tracker
3. TT3.10 Material consumption update

### After Takeoff Fase 10 completes — Phase T4
1. TT4.1–TT4.3 Role enforcement
2. TT4.4–TT4.7 Push notifications
3. TT4.8–TT4.9 Performance testing
4. TT4.10 App Store submission

---

## 🔗 Parallel Development Timeline

```
WEEK    TAKEOFF (Web)              TRACK (Native)
─────   ─────────────────────      ──────────────────────
1-2     Fase 7B: production        T1: Expo setup, Auth,
        tables, procurement        PowerSync, navigation
        fields, seeds
                                   
3-4     Fase 8 Sprint 1:           T1: GPS + check-in,
        Estimator foundation       safety docs
        (labor rates, assemblies)
                                   
5-6     Fase 8 Sprint 2:           T1: Work tickets,
        Estimator dashboard,       crew management
        bid output
                                   
7-8     Fase 8 Sprint 3:           T2: Daily report ← 7B tables ready
        Scope sheet view,          (checkboxes, blocked,
        import/export              phase tracking)
                                   
9-10    Fase 8 Sprint 4-5:         T2: Production dashboard,
        Power tools,               communication
        production tracking
                                   
11-12   Fase 9: Material flow      T3: Delivery confirmation ← Fase 9 tables ready
                                   
13-14   Fase 10: Ship blockers     T4: Role enforcement, ← Fase 10 roles ready
                                   push, app store
```

---

*105 tasks. 4 phases. Offline-first. Camera-native. 3 clicks or less.*
*Punch List: supervisor creates → foreman resolves → before/after photos.
*Plans tab: PlanGrid-style drawing viewer with takeoff overlay + tablet split view.*
*Time tracking by area: 2 taps to assign, auto-close on move.*
*Ready Board mobile + Gate verification + Legal engine (NOD/REA).*
*AI Agent: Picovoice offline voice + Gemini online tool-calling.*
*Same database. Same users. Different doors.*
*Start building NOW — Phase T1 has zero dependencies.*
