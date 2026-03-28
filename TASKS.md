# NotchField Track — TASKS_TRACK.md
> Track native app task tracker | 105 tasks | Updated: 2026-03-28
> 4 phases: T1 (start now) → T2 (after Takeoff 7B) → T3 (after Takeoff 9) → T4 (after Takeoff 10)
> Same Supabase as Takeoff. Expo + PowerSync. Offline-first.
> **Supabase project:** msmpsxalfalzinuorwlg (Notchfield Takeoff — shared)
> **PowerSync:** 69c72137a112d86b20541618.powersync.journeyapps.com

---

## 📊 Summary

| Phase | What | Tasks | Depends On | Status |
|-------|------|-------|-----------|--------|
| **T1 — Foundation + Safety + GPS + Time Tracking + Plans** | Auth, navigation, GPS, safety, work tickets, crew, time entries, drawing viewer | **43** | Nothing (tables exist) | ✅ OPERATIONAL (39/43) |
| **T2 — Production + Ready Board + Legal + Punch List + AI Agent** | Daily report, checkboxes, Ready Board, gates, NOD/REA, punch list, AI agent + voice | **38** | Takeoff Fase 7B | ⬜ After 7B |
| **T3 — Delivery + Material Flow** | Delivery confirmation, supervisor tracker, material consumption | **10** | Takeoff Fase 9 | ⬜ After Fase 9 |
| **T4 — Polish + App Store** | Role enforcement, push, performance, store submission | **10** | Takeoff Fase 10 | ⬜ After Fase 10 |
| **TOTAL** | | **105** | | |

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
- [ ] TT1.23 Cert tracking — ⬜ deferred (nice-to-have, not blocking)

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

## 🏭 PHASE T2 — Production Reporting — ⬜ AFTER TAKEOFF 7B
> Depends on: production_areas, production_area_objects, production_templates,
> production_template_phases, production_phase_progress (created in Takeoff Fase 7B)

### Daily Report (3-click workflow)
- [ ] TT2.1 Area list — grouped by floor, show progress bar per area, status badges
- [ ] TT2.2 Area detail — surface checklist from production_area_objects, checkbox per surface
- [ ] TT2.3 Mark surface complete — tap checkbox → sets completed_at, completed_by on production_area_objects
- [ ] TT2.4 Progress photo per surface — after marking complete, camera icon appears. Tap → snap photo → auto-linked to area_id + object_id + context_type='progress'. Thumbnail shows next to checkbox. Multiple photos per surface.
- [ ] TT2.5 Area progress photo — camera button at top of area detail. General room photo, tagged context_type='progress' with area_id only (no specific surface).
- [ ] TT2.6 Photo gallery per area — swipeable photo timeline on area detail: all photos (progress, blocked, QC) with timestamp, who took it, which surface. Tap to view full-res.
- [ ] TT2.7 Mark surface blocked — select reason (other_trade, material, inspection, access, rework, design, other) → optional note → optional photo (context_type='blocked') → sets blocked_reason, blocked_at
- [ ] TT2.8 Unblock surface — when issue resolved, mark complete → system records gap duration
- [ ] TT2.9 Phase tracking — view phases per area (from template), mark phase complete/started/skipped
- [ ] TT2.10 Auto-progress calculation — room progress_pct updates from completed surface sqft (via productionEngine logic)
- [ ] TT2.11 Submit daily report — one button compiles all changes + photos into `daily_reports` summary → notifies PM

### Production Dashboard (in-app)
- [ ] TT2.9 Foreman dashboard — progress of his assigned floors/areas, status counts
- [ ] TT2.10 Supervisor dashboard — progress across ALL assigned projects, project comparison
- [ ] TT2.11 Floor progress view — expand floor → see all rooms with progress bars
- [ ] TT2.12 Blocked areas highlight — red indicators, tap to see reason + photos

### Ready Board Mobile (first screen in Production tab)
- [ ] TT2.13 Ready Board list view — vertical list grouped by floor. Per area: status dot, label, type, progress %, current phase, gate icon, blocked reason. Filter chips: All/Blocked/In Progress/Complete. Floor headers with progress bars. Tap area → Detail. Swipe right → complete, swipe left → block.
- [ ] TT2.14 Ready Board supervisor aggregate — "All Projects" view: areas grouped by project → floor. Project switcher at top.

### Gate Tasks (phase verification)
- [ ] TT2.15 Gate phase UI — when foreman completes a gated phase, show "⛔ AWAITING VERIFICATION" with timer. Lock subsequent phases (greyed out + lock icon). Push notification to PM.
- [ ] TT2.16 Supervisor gate verification — supervisor can verify gates in Track (not just PM in web). Tap "Verify" → confirm → next phase unlocks.

### Legal Documentation (supervisor only)
- [ ] TT2.17 NOD draft notification — badge on Docs tab when NOD auto-drafted from block. "NOD Draft Available" with area, days blocked, crew cost impact.
- [ ] TT2.18 NOD review + sign — supervisor reviews PDF preview, finger-signs (react-native-signature-canvas), system adds SHA-256 + sends to GC. Status: draft → sent.
- [ ] TT2.19 Legal docs list — all NODs/REAs for current project with status badges (draft/sent/opened/no_response). Supervisor and sub_pm only — foreman never sees.

### Crew Assignment (extended)
- [ ] TT2.15 Link time entries to production areas — area hours summary visible on area detail screen: "18 man-hours today, 45 total this week"
- [ ] TT2.16 Supervisor: assign foreman to project — "Mario runs 200 Hamilton this week"
- [ ] TT2.17 Labor cost per area — man-hours × rate = actual cost. Compare to bid estimate. "Bid: $5,250 labor. Actual so far: $3,800 (72%)."

### Communication
- [ ] TT2.15 Area notes — foreman/supervisor can leave notes on specific areas (visible to both + PM in web)
- [ ] TT2.16 Photo annotations — take photo, draw/annotate on it, attach to area
- [ ] TT2.17 `field_messages` table — area_id, sender_id, message, photos[], created_at
- [ ] TT2.18 `daily_reports` table — project_id, date, areas_worked[], progress_summary, compiled_by

### Punch List (internal — supervisor → foreman)
- [ ] TT2.26 `punch_items` table — project_id, area_id, object_id (surface, optional), title, description, priority (low/medium/high/critical), status (open/in_progress/resolved/verified/rejected), photos[], assigned_to (foreman), created_by (supervisor), resolved_at, verified_at, rejected_reason
- [ ] TT2.27 Create punch item — supervisor taps area → "Add Punch Item" → photo (required) + title + description + priority + assign to foreman. Can also create from plan view (tap location on drawing).
- [ ] TT2.28 Punch list view — list of all punch items for project. Filter by: status, priority, area, assigned to. Badge count on Docs tab: "5 open punch items."
- [ ] TT2.29 Foreman resolves punch — foreman sees assigned items → taps item → takes "after" photo → marks resolved. Before/after photos side by side.
- [ ] TT2.30 Supervisor verifies — supervisor reviews resolved items → approves (verified) or rejects (rejected + reason). Rejected items re-open for foreman.
- [ ] TT2.31 Punch item on plan — punch items pinned to location on the drawing (coordinates). Supervisor can see red pins on the plan where items exist. Tap pin → item detail.
- [ ] TT2.32 Punch summary KPIs — total open, resolved today, avg resolution time, items by priority. Shown on Home screen if >0 open items.

### AI Agent + Voice Commands (Future — Post-Pilot)
- [ ] TT2.20 AI Agent chat UI — floating 🤖 button on every screen → half-screen slide-up chat panel. Type input + voice input toggle. Inline confirmation cards for write actions. Role-scoped (foreman sees hours not $).
- [ ] TT2.21 Picovoice wake word — "Hey NotchField" detection via @picovoice/porcupine-react-native. Battery-efficient, runs on-device. Activates voice listening mode.
- [ ] TT2.22 Picovoice speech-to-intent — 4 offline voice commands via @picovoice/rhino-react-native: "Wall A done" (markComplete), "Blocked other trade" (reportBlocked), "Check in" (checkIn), "What's left" (queryStatus). English + Spanish.
- [ ] TT2.23 Voice context file — Picovoice Rhino context trained on construction vocabulary: surface names (wall/floor/saddle/vanity), block reasons (other trade/no material/inspection), bilingual EN+ES. Trained at console.picovoice.ai.
- [ ] TT2.24 AI Agent online mode — complex questions route to Gemini 2.5 Flash API with 29 tool declarations. Context injection: user role, project, current area. Response with real project data.
- [ ] TT2.25 Hybrid voice routing — Picovoice handles 4 simple intents offline → if not matched → routes to Gemini API when online → if offline → queues "I'll process that when connected."

---

## 📦 PHASE T3 — Delivery + Material Flow — ⬜ AFTER TAKEOFF FASE 9
> Depends on: delivery_ticket_items, material_consumption (created in Takeoff Fase 9)

### Delivery Confirmation
- [ ] TT3.1 Delivery notification — push notification when warehouse marks "shipped"
- [ ] TT3.2 Delivery checklist — per item: received / short / damaged buttons
- [ ] TT3.3 Quantity received input — if short, enter actual quantity received
- [ ] TT3.4 Photo evidence — capture photo of damaged/short items
- [ ] TT3.5 One-tap "Confirm All" — for deliveries received complete
- [ ] TT3.6 Update delivery_ticket_items — receipt_status, quantity_received, receipt_photos, received_by, received_at

### Supervisor Delivery Tracker
- [ ] TT3.7 Delivery history view — chronological list of all deliveries with items, status, photos
- [ ] TT3.8 Material by area view — floor/area breakdown: target vs delivered vs installed
- [ ] TT3.9 Material alerts view — no delivery scheduled, running low, surplus

### Material Consumption
- [ ] TT3.10 Auto-update material_consumption.installed_qty — when foreman marks surfaces complete, installed sqft flows to consumption table

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
