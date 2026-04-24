# Changelog

All notable changes to **NotchField Track** go here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(`MAJOR.MINOR.PATCH`).

Every released version has two sections:

- **Release Notes** — user-facing copy. Paste this into App Store
  Connect's *"What's New in This Version"* and Google Play Console's
  *"Release notes"* field at submission time. Keep it readable for
  foremen and PMs, not devs. Hard limits: Apple 4 000 chars, Play 500
  chars per locale.
- **Changes** — developer-facing detail, grouped under the Keep a
  Changelog verbs (`Added` / `Changed` / `Fixed` / `Security`).
  Anything a future engineer might need to understand a commit later.

Commits before `1.0.0` (while the app was in Jantile pilot) aren't
exhaustively logged here — git history is the record of truth. The
`1.0.0` entry below summarizes the pilot scope for store submission.

---

## [Unreleased]

### Release Notes
<!-- Add user-facing line items here as commits land. Keep them short
     and concrete. e.g.: "Toolbox talks now show the Why-It-Matters
     section in Spanish when the foreman switches to ES." -->

### Changes

#### Added
-

#### Changed
-

#### Fixed
-

#### Security
-

---

## [1.0.0] — 2026-04-24 — Pilot launch

First public release. Covers the Jantile pilot scope across safety,
production, crew, deliveries, work tickets, and plans.

### Release Notes

```
NotchField Track 1.0.0 — Pilot launch

• Pre-Task Plan wizard — pick JHA-backed tasks, crew signs on the
  device, PDF goes to GC before the first cut.
• Weekly Toolbox Talk — scheduler picks the right safety topic for
  your trade, bilingual EN/ES, photos optional.
• Ready Board — every area, floor by floor, with real surface-level
  progress. Block with a reason + photo when another trade is in
  the way.
• Work Tickets — T&M tickets with GC signature captured on the
  phone, SHA-256 integrity hash on every PDF.
• GC Punchlist — resolve Procore punch items in the field; photos
  + hours push back automatically.
• Plans viewer — multi-sheet PDF with pin drops and hyperlink
  navigation between sheets.
• Offline-first — everything syncs when you're back online.
• Crash reporting, in-app account deletion, US-format dates.
```

### Changes

#### Added
- **Foundation (T1):** Expo SDK 55 + PowerSync + Supabase Auth + 6-locale
  i18n. 5-tab bottom navigation (Home / Board / Plans / Safety / More
  + hidden Tickets + Delivery surfaced per role). Role model = scope:
  foreman sees 1 project, supervisor sees all assigned.
- **GPS + Check-in:** foreground + background location, Haversine
  geofence, manual check-in/out button, GPS stamps on photos.
- **Safety documents:** JHA (hazards + risk levels + controls + PPE),
  PTP 4-step wizard (tasks → review → signatures → distribute, backed
  by `jha_library` with 149 seeded tasks), Toolbox Talk 3-step wizard
  (Present → Sign → Send, scheduler-driven topic selection, EN/ES
  bilingual, optional huddle photos). Digital signatures via
  `react-native-signature-canvas`, SST cert snapshot at tap-sign time.
- **Work Tickets:** T&M ticket builder with labor (Mechanic / Helper /
  Apprentice / Foreman) + materials (pcs/box/bag/sqft/lf/gal/lbs).
  In-app signing flow (foreman hands phone to GC) + remote signing
  link. SHA-256 integrity hash on every signed ticket.
- **Crew management + time tracking:** `crew_assignments` (live state) +
  `area_time_entries` (historical log). 2-tap flow to assign workers
  to areas; moving workers auto-closes previous entries. Daily hours
  summary; cert expiry alerts for SST / OSHA-10 / OSHA-30 / SWAC.
- **Production reporting (T2):** Ready Board grouped by floor with
  status colors + progress bars; surface checklist with 3-state
  (not_started → in_progress → completed); block reporting with 7
  predefined reasons + required notes + photo; phase tracking with
  gate locks; auto-propagation of surface status to parent area card.
- **Plans tab:** sheet list grouped by discipline (reads
  `drawing_register` from Takeoff PM), PDF viewer with pinch-zoom, fit-
  to-width rendering, offline PDF caching in filesystem, hyperlinks +
  pin annotations (add / resolve / reopen) synced via PowerSync.
- **GC Punchlist:** read-only punch items pulled from Procore via
  server-side cron, resolution workflow (Start Work → log hours + notes
  + resolution photos → Ready for Review) pushes back to Procore.
- **Delivery (T3):** delivery confirmation (received / short / damaged /
  rejected per item), pending_review → approved flow, Home alerts.
- **Feedback reports:** Report Issue flow (bug / feature / feedback),
  auto-captured context (route, device, screen size, role, project),
  up to 3 screenshots per report, private bucket upload.
- **Store readiness (Sprint `STORE`):** Sentry crash reporting with PII
  redaction (`user.id` only, role + organization_id as tags), in-app
  account deletion (`delete-my-account` Edge Function + Settings →
  Danger Zone), centralized URL config (`src/shared/config/urls.ts`),
  `autoIncrement` on iOS buildNumber and Android versionCode in
  `eas.json`, demo reviewer accounts for Apple + Google submission.

#### Changed
- **PDF export (Sprint 52):** `safety-export.ts` rewritten to match the
  client-approved letterhead — 3-column header (logo / doc type / doc
  number), MM/DD/YYYY dates everywhere, single sans-serif font,
  customer logo pulled from `organizations.logo_url` with company
  name text fallback. Signatures block is the attendance record — no
  separate crew/attendance table above.
- **PTP labels contract:** aligned with Takeoff Web's canonical
  `PtpPdfLabels` shape (43 fields, camelCase, `shiftValues` as object
  map). Fixes the "undefined[day]" crash that killed older distribute
  PDFs.
- **Trade picker filter:** PTP "new" flow now reads
  `organizations.primary_trades` to scope the trade chips. Jantile only
  does tile + marble, so the picker shows those two instead of the
  10-trade full library seed.
- **Plans data source:** migrated from the estimator-side `drawings` +
  `drawing_sets` tables to the PM-side `drawing_register` (where the
  Takeoff PM module actually uploads). Public URLs from the `documents`
  bucket; storage path branch kept for legacy projects.

#### Fixed
- **`safety_documents` SERIAL burn:** every draft create was burning one
  sequence value because `createDraftPtp` fired a manual `forceSync()`
  in parallel with PowerSync's own auto-upload. Removed the manual
  flush from the create path; kept it in `distributePtp` preflight only.
- **Signature pad only drawing dots:** wrapper View was stealing
  `touchmove` events from the WebView canvas. Removed the responder
  handlers and moved `scrollEnabled` toggle to the parent ScrollView.
- **`jha_library` dropped 2 marble tasks silently:** `JhaHazardItem.osha_ref`
  was `.optional()` which accepts `undefined` but rejects `null`. Two
  rows had `null` OSHA refs on cross-task hazards; schema relaxed to
  `.nullable().optional()`.
- **Auth trigger broke user creation:** `auto_seed_permissions()` was
  missing `SECURITY DEFINER SET search_path = public`, so under the
  auth admin's search_path the inner `PERFORM
  seed_default_permissions()` resolved to "function not found". Fix
  applied via MCP + documented in `scripts/fix-auth-trigger-search-path.sql`.
- **PTP Task Picker chips row ate half the screen:** RN `ScrollView`
  defaults to `flex: 1` even in horizontal mode. Added `flexGrow: 0 +
  maxHeight: 52`.
- **`distributeService` retry queue never drained:** pre-guard zombies
  (4xx errors) were being re-queued forever. Now only `wasNetworkError`
  failures re-queue, with a `MAX_ATTEMPTS = 20` cap.

#### Security
- All PII stripped from Sentry events via `beforeSend` hook. Only
  `user.id` is captured; email, ip_address, username, full_name are
  deleted before the event leaves the device.
- Signatures uploaded to private `signatures/{org_id}/{token}.png`
  bucket. SHA-256 content hash computed client-side via `expo-crypto`
  and stored on the `document_signatures` row for integrity
  verification.
- Account deletion tombstones the auth row (rotates email + password)
  instead of calling `admin.deleteUser()` — preserves the 7-year legal
  retention on signed safety docs that FK to the profiles row.

---

## How to cut a release

1. Move **`Unreleased`** items into a new `## [X.Y.Z] — YYYY-MM-DD —
   <short title>` header. Draft the **Release Notes** prose first since
   that's what the user reads in the store.
2. Bump `app.json.expo.version` to `X.Y.Z`. `eas.json` auto-increments
   `ios.buildNumber` and `android.versionCode` on each production build,
   so no manual bump there.
3. Commit as `chore(release): vX.Y.Z` + tag `vX.Y.Z` on `main`:
   ```
   git tag -a v1.0.1 -m "Release 1.0.1"
   git push origin v1.0.1
   ```
4. `eas build --profile production --platform all`
5. `eas submit --profile production --platform ios` (waits for
   TestFlight processing), then `eas submit --profile production
   --platform android` (uploads to the closed testing track first; only
   promotable to Production after the 14-day / 12-tester rule is met).
6. Paste the **Release Notes** block into App Store Connect *"What's New
   in This Version"* and Play Console *"Release notes"* (EN + ES).
7. Watch Sentry for the first 48 h. If crash-free-users dips below 98 %,
   use the hotfix path in `SPRINT_TRACK_STORE_RELEASE.md §7.4`.

[Unreleased]: https://github.com/lalas0825/Notchfield-track/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lalas0825/Notchfield-track/releases/tag/v1.0.0
