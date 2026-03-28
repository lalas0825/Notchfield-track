---
name: Build progress and architecture decisions
description: Track T1/T2 completion status, EAS build issues, key patterns chosen
type: project
---

## T1 — OPERATIONAL (39/43 tasks)
Completed 2026-03-28. All features compile, lint clean, 0 warnings.

## T2 — S1 + S2 + S3 DONE
- S1: Ready Board + Area Detail + Daily Report (3-click submit)
- S2: Gate validation + gate health metrics + auto field_message on block
- S3: Punch List (before/after photos) + Legal docs (NOD + SHA-256 + immutability trigger)
- S4: AI Agent + Picovoice voice — DEFERRED to post-launch

## EAS Build
- Build #1: CRASHED — missing `@journeyapps/react-native-quick-sqlite` (PowerSync peer dep)
- Build #2: IN PROGRESS — fix applied, awaiting result
- EAS Project: @lalas825/notchfield-track (281ade7b-a5d9-4f43-9710-d270ae4c49f4)

## Key Architecture Decisions
- Expo SDK 55 (canary), NativeWind v4, Zustand v5, Zod v4
- PowerSync for offline-first (not custom sync)
- SecureStore for auth session (not AsyncStorage)
- Platform-split files (.web.tsx) for native-only modules
- Photo outbox pattern: photo-queue enqueues, photo-worker uploads independently
- Declarative `<Redirect>` for auth routing (NOT `router.replace()` — crashes on native)
- PowerSync sync rules: org-scoped only, no JOINs/subqueries
- Legal immutability: Postgres trigger + SHA-256 hash (double protection)

**How to apply:** Always check EAS_BUILD_GUIDE.md before building. Always use `organization_id` not `org_id`. Never use JOINs in PowerSync sync rules.
