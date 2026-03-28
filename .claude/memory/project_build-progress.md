---
name: Build progress and architecture decisions
description: Track T1/T2 completion status, key patterns chosen, and what to build next
type: project
---

## T1 — OPERATIONAL (39/43 tasks)
Completed 2026-03-28. 6 commits. All features compile, lint clean, 0 warnings.

Key decisions:
- Expo SDK 55 (canary), NativeWind v4, Zustand v5, Zod v4
- PowerSync for offline-first (not custom sync)
- SecureStore for auth session (not AsyncStorage)
- Platform-split files (.web.tsx) for native-only modules (react-native-pdf, PowerSync, maps)
- Photo outbox pattern: photo-queue enqueues, photo-worker uploads independently
- i18n: 150+ keys, 6 locales, construction-specific terminology per country

Remaining T1: cert tracking (TT1.23), plans overlay/split (T2 dep)

## T2 — IN PROGRESS (S1 + S2 done)
- S1: Ready Board + Area Detail + Daily Report (3-click submit)
- S2: Gate validation + gate health metrics + auto field_message on block
- S3 next: Legal docs (NOD), Punch List, Area notes, Photo gallery
- S4 last: AI Agent + Picovoice voice (post-pilot)

Key decisions:
- production_areas.status is denormalized — Ready Board is 1 query, not N+1
- recalcFloor() only recalcs the changed floor, not all areas
- canCompleteArea() enforces gate validation before area completion
- blockPhase() auto-creates field_message (blocker type)
- daily_reports uses UNIQUE(project_id, foreman_id, report_date) — one per day

**How to apply:** When building T2-S3, the punch_items table already exists (migration applied). Legal docs use existing legal_documents table from Takeoff. Focus on UI, not schema.
