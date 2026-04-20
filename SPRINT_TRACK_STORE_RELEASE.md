# Sprint Track — App Store + Google Play Release

> **Goal:** Publish NotchField Track to Apple App Store and Google Play.
> Covers developer accounts, legal, technical prerequisites, assets,
> submission flow, and ongoing release cadence.
>
> **Est:** 5-7 days focused work for first submission (excluding store
> review time). Reviews: Apple 2-5 days first pass, Google 2-7 days.
>
> **Prereq:** EAS build pipeline working (commit `f5614ad` confirms APK
> installs on device). Takeoff Sprint 50 (toolbox renderer + distribute
> endpoint) should be live before Safety flows ship to public prod.

---

## 1. Phase overview

Three parallel tracks:

```
LEGAL / CONTENT          TECHNICAL                STORE OPS
━━━━━━━━━━━━━            ━━━━━━━━━                ━━━━━━━━━
Privacy Policy           Account deletion         Apple Developer account
Terms of Service         Crash reporting          Google Play account
Descriptions (EN+ES)     Version bump logic       Screenshots + marketing
Data Safety form         Error boundaries         App listing
                         Remove dev logs          TestFlight / Internal
                         Target SDK + tablet      Closed testing rollout
                         ──────────               Production rollout
```

---

## 2. Legal + content

### 2.1 Privacy Policy (blocks submission)
Required URL (e.g., `notchfield.com/privacy`) covering:

- [ ] What data we collect:
  - GPS coordinates (foreground + background for geofence)
  - Camera photos (progress, QC, safety, delivery evidence)
  - Digital signatures (base64 PNG)
  - Personal info (name, email, phone from profiles)
  - SST/OSHA/SWAC certificate numbers (workers HR)
  - Activity data (assignments, time entries, phase progress)
- [ ] Purpose of each (time tracking, safety compliance, legal
  documentation, crew management)
- [ ] Processors:
  - Supabase (US-east, encrypted at rest)
  - PowerSync (sync layer, same data residency)
  - Resend (email delivery for safety docs — once P0 ships)
  - Expo push service (when T4.4-7 ship)
- [ ] Retention: 7 years for legal docs (NY Labor Law), 2 years
  otherwise, purge on account deletion
- [ ] Account deletion instructions + contact email
- [ ] Third-party tracking: none
- [ ] COPPA: workforce app, no users under 18 (declare in listing)
- [ ] California CCPA + EU GDPR sections

### 2.2 Terms of Service (recommended)
- [ ] Acceptable use
- [ ] IP ownership (Notchfield owns the app, user owns their data)
- [ ] Liability disclaimers (especially re: safety docs — we're a
  record-keeping tool, not the source of truth for compliance)
- [ ] Dispute resolution + jurisdiction

### 2.3 Account deletion in-app (blocks both stores)
Apple policy since 2022, Google since 2023:

- [ ] Add "Delete My Account" button in Settings → Profile
- [ ] Confirmation modal: "This permanently deletes your account and
  all personal data. Work records stay with your organization."
- [ ] Call Supabase Admin API (via Edge Function) to:
  - Anonymize profile (set full_name="Deleted User", email=null)
  - Keep FK rows for audit (signatures, daily_reports stay) — just
    detached from identity
  - Revoke all sessions
- [ ] Show success screen → sign out → navigate to login

Scope: ~1 day dev, 2 hours Supabase Edge Function.

### 2.4 App descriptions

#### Short (80 chars for Play Store subtitle / Apple subtitle 30):
```
Field operations for finishing-trade foremen — safety, crew, and production.
```

#### Full description (draft — tune for Jantile):
```
NotchField Track is the field companion to NotchField Takeoff — built
for foremen and supervisors in finishing trades (tile, marble, flooring,
drywall, paint). Track turns a smartphone into the jobsite's
single source of truth:

• MORNING PTP (Pre-Task Plan) — Pick today's tasks from a library of
  OSHA-cited hazards + controls. Crew signs on the device. GC gets a
  signed PDF in their inbox before the first cut.

• WEEKLY TOOLBOX TALK — Scheduler suggests the right safety topic
  based on your trade and last week's hazards. Present bilingual
  content (EN/ES), capture signatures, distribute PDF.

• READY BOARD — See every area, floor-by-floor, with surface-level
  progress. Mark surfaces complete by tapping a checkbox. Block with a
  reason + photo when another trade's in the way.

• CREW MANAGEMENT — Two taps to assign workers to areas. Move them
  mid-day; Track auto-closes time entries. Man-hours per area calculated
  automatically.

• DRAWING VIEWER — Pinch-to-zoom PDF plans with estimator's takeoff
  overlay. Drop pins for defects. Navigate between sheets via
  hyperlinks.

• GC PUNCHLIST — Resolve Procore punch items in the field: status,
  hours, resolution photos. Changes push back to the GC platform
  automatically.

• WORK TICKETS — Create T&M tickets, capture GC signature on the
  phone, email a PDF with SHA-256 integrity hash.

OFFLINE-FIRST — Track uses PowerSync to keep working when the
jobsite has no signal. Everything syncs when you're back online.

FIELD-TESTED — Large touch targets, haptic feedback, dark mode by
default, works with gloves, 3 taps or less for every core action.

Requires an active NotchField subscription via Notchfield Takeoff
(notchfield.com).
```

Spanish version: direct translation, keep product names in English.

#### Keywords (100 chars, App Store):
```
construction,tile,marble,foreman,crew,safety,PTP,toolbox,JHA,field,manpower,jobsite,OSHA,punch
```

---

## 3. Technical prerequisites

### 3.1 Crash reporting (Sentry)
Without this, stores may reject on crash rate > 2%.

- [ ] Create Sentry project (React Native platform)
- [ ] `npx expo install @sentry/react-native`
- [ ] Wrap root in `<Sentry.ErrorBoundary>`
- [ ] Upload source maps in EAS build hook
- [ ] Configure release name = app version for per-release dashboards
- [ ] Redact PII (user.id is OK, email/full_name redact)

### 3.2 Remove dev logs
Grep and delete/guard behind `__DEV__`:
- [ ] `console.warn('[PTP]...')` — diagnostic from commit 77e8df5/29db643
- [ ] `console.warn('[appendSignature]...')` + `[getPtpById]` — commit d637eb4
- [ ] `console.warn('[distribute]...')` — keep in prod? (user-useful)
- [ ] `console.warn('[More]...')` — already removed
- [ ] Any other `console.log` / `console.warn` that was added for
  debugging across Sprint PTP + TOOLBOX + MANPOWER

Script: `grep -rn "console.warn\|console.log" src/ | grep -v __DEV__`

### 3.3 Version bump automation
`app.json` + `eas.json` should auto-increment on each build:

- [ ] Set `eas.json` `production.ios.autoIncrement: true` (already set ✓)
- [ ] Same for Android: `production.android.autoIncrement: "versionCode"`
- [ ] Document release notes per version in `CHANGELOG.md` or similar

### 3.4 Asset audit
- [ ] Icon 1024×1024 — verify no alpha channel (Apple rejects), RGB
  only. Current: `src/assets/images/icon.png`.
- [ ] Adaptive icon Android — 1024×1024 foreground, background color
  `#0F172A`. Current setup in `app.json` ✓.
- [ ] Splash screen — 1284×2778 recommended. Current: logo.png ✓.
- [ ] Notification icon (future) — 96×96 white on transparent.

### 3.5 Target SDK + compatibility
- [ ] Android: Target SDK 35 (Android 15) — Expo SDK 55 handles this
- [ ] iOS: min 15.1 (Expo SDK 55 default)
- [ ] Tablet layouts: verify Plans + Board in landscape on iPad

### 3.6 Hardcoded URLs
Search and replace with env vars:
- [ ] `https://notchfield.com` in `SIGN_BASE_URL`, `distributeService`, etc.
- [ ] Use `EXPO_PUBLIC_WEB_API_URL` + `EXPO_PUBLIC_SIGN_BASE_URL`
- [ ] Confirm `eas.json` sets prod URLs

---

## 4. Apple App Store

### 4.1 Developer account
- [ ] Enroll in Apple Developer Program ($99/year) — up to 2 days
  approval for individual, 1-2 weeks for org with D-U-N-S
- [ ] Set up Agreements, Tax, Banking in App Store Connect

### 4.2 App Store Connect setup
- [ ] Create app: bundle ID `com.notchfield.track`
- [ ] Primary category: Business
- [ ] Secondary category: Productivity
- [ ] Age rating: 4+ (no objectionable content)
- [ ] Content rights: check "Does contain third-party content" — NO
- [ ] Pricing: Free
- [ ] Territories: US + your pilot markets

### 4.3 Screenshots (required sizes)
- [ ] 6.7" iPhone 15 Pro Max: 1290×2796 — **3-10 screenshots**
- [ ] 5.5" iPhone 8 Plus: 1242×2208 — **3-10 screenshots** (legacy)
- [ ] iPad Pro 12.9": 2048×2732 — required if tablet-supported (we are)

Recommended shots:
1. Home with Morning PTP card + crew summary
2. Ready Board with blocked/in-progress areas
3. PTP wizard — task picker with JHA library
4. Signature capture
5. Plans tab with drawing overlay
6. Crew Management — assign workers to area
7. Home card "PTP distributed" green state

Tool: `hotpot.ai` or Figma template at
[figma.com/community/file/1018028061927747519](https://www.figma.com/community/file/1018028061927747519)

### 4.4 App Review preparation
- [ ] **Demo account credentials** for reviewers (create
  `apple-reviewer@notchfield.com` in Supabase with supervisor role,
  assigned to DEMO PROJECT with sample data)
- [ ] **Review notes** — copy-paste:
  ```
  NotchField Track is a B2B construction app. Requires demo account.
  Login: apple-reviewer@notchfield.com / [password]
  The app uses:
  - Background location: GPS geofence auto-check-in at job sites.
    Reviewer can disable in Settings > Privacy to confirm app works
    without it.
  - Camera: progress photos tagged to construction areas.
  - Photo library: selecting existing photos as evidence.
  - Microphone: not used (future voice commands).
  All data syncs through Supabase (offline-first via PowerSync).
  Subscriptions managed outside the app (B2B) — no IAP.
  ```

### 4.5 Submission
```bash
eas build --profile production --platform ios
eas submit --platform ios --latest
```
Wait for TestFlight processing (~30 min), then tap "Submit for Review".

---

## 5. Google Play Store

### 5.1 Developer account
- [ ] Google Play Console ($25 one-time)
- [ ] Identity verification (passport + address)
- [ ] Tax form

### 5.2 Store listing
- [ ] App name: NotchField Track
- [ ] Short description (80 char)
- [ ] Full description (4000 char)
- [ ] Icon 512×512 PNG
- [ ] Feature graphic 1024×500 PNG
- [ ] Screenshots phone: 3-8, 16:9 or 9:16
- [ ] Screenshots 7" tablet: optional but recommended
- [ ] Screenshots 10" tablet: optional

### 5.3 Content rating (IARC questionnaire)
- [ ] Complete questionnaire — Track should result in "Everyone" or
  "Everyone 10+"
- [ ] No violence, no nudity, no simulated gambling

### 5.4 Data Safety form
This is the killer form — takes ~1 hour to fill properly.

- [ ] Data types collected:
  - Location (precise): collected, shared, required
  - Personal info (name, email): collected, shared, required
  - Photos: collected, shared, optional
  - Audio: not collected
  - App activity, app info: collected, not shared, optional
  - Device ID: not collected
- [ ] Purposes:
  - App functionality, account management, analytics
- [ ] Data encrypted in transit: YES
- [ ] Data encrypted at rest: YES (Supabase)
- [ ] User can request data deletion: YES (account deletion flow)
- [ ] Committed to Google's Play Families Policy: NO (adult app)

### 5.5 Background location declaration form
Required since 2020. Fill in Play Console:
- [ ] Core functionality justifying background location
- [ ] Video demo (30 sec) showing auto-check-in at job site geofence
- [ ] Description why foreground-only wouldn't work

### 5.6 Closed testing requirement (2024+)
- [ ] Create closed testing track
- [ ] Invite 12+ testers (can be your team)
- [ ] Testers must open the app on 14 **distinct days** within 14 days
- [ ] Only after that can you promote to Production

### 5.7 Submission
```bash
eas build --profile production --platform android
eas submit --platform android --latest
```

---

## 6. EAS configuration (both platforms)

Extend `eas.json` with submit credentials:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "apple-dev@notchfield.com",
        "ascAppId": "<NUMERIC_APP_STORE_CONNECT_ID>",
        "appleTeamId": "<TEAM_ID>"
      },
      "android": {
        "serviceAccountKeyPath": "./secrets/play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

`secrets/play-service-account.json` — **NEVER COMMIT**. Add to `.gitignore`
and EAS secrets (`eas secret:create`).

---

## 7. Release cadence (post-launch)

### 7.1 Release branches
- `main` → develop
- Tag releases `vX.Y.Z` on `main`
- `eas build --profile production` on tag CI

### 7.2 Version strategy
- `app.json.expo.version` = semver `X.Y.Z`
- `android.versionCode` = `1000*X + 100*Y + Z` (monotonic)
- `ios.buildNumber` = matches `versionCode` for consistency

### 7.3 Staged rollout
- Android: start at 20%, watch crash-free rate for 48h, expand to 100%
- iOS: Phased Release (7-day auto-rollout) unless critical fix

### 7.4 Hotfix path
- iOS: Expedited review request if ANR/crash > 5%
- Android: internal → closed → production, all same-day

---

## 8. Task breakdown

| # | Task | Est | Owner | Depends on |
|---|------|-----|-------|-----------|
| 1 | Privacy Policy + ToS drafting | 4h | Legal/content | — |
| 2 | Publish privacy/terms to notchfield.com | 2h | Takeoff web | 1 |
| 3 | Account deletion screen + Edge Function | 1d | Track | — |
| 4 | Sentry integration + source map uploads | 4h | Track | — |
| 5 | Remove dev console.warn across safety/ | 2h | Track | — |
| 6 | Version bump automation in eas.json | 1h | Track | — |
| 7 | Asset audit (icons no alpha, splash, etc.) | 2h | Track | — |
| 8 | Apple Developer enrollment | 1-7 days | Admin | — |
| 9 | Google Play Console enrollment | 1 day | Admin | — |
| 10 | Screenshots x 7 views x 3 sizes | 1d | Design | 4 working sim |
| 11 | App listing descriptions EN + ES | 4h | Content | — |
| 12 | Data Safety form + IARC questionnaire | 2h | Admin | 1 |
| 13 | Background location declaration + video | 4h | Track + admin | — |
| 14 | Demo account + review notes | 1h | Track | — |
| 15 | Closed testing cohort (Android) | 14 days wall-clock | Admin | 9 |
| 16 | First iOS build + submit | 1h | Track | 8, 14 |
| 17 | First Android build + submit | 1h | Track | 9, 15 |
| 18 | Respond to review rejections | varies | Track | — |

**Critical path:** 1 → 2 → 3 → 8 → 14 → 16 = ~5-7 days work + 2-5 days
Apple review.

---

## 9. Pre-submit checklist

The day of first submission:

- [ ] `npx tsc --noEmit` clean
- [ ] No open `TODO` / `FIXME` in critical paths
- [ ] Crash reporting live (test crash in dev build, see event in Sentry)
- [ ] Privacy URL returns 200
- [ ] Account deletion tested end-to-end
- [ ] Version + buildNumber incremented
- [ ] Demo account credentials saved somewhere accessible
- [ ] Screenshots uploaded
- [ ] `TAKEOFF_PENDING.md` items 1 + 4 resolved (distribute endpoint
  works, toolbox library seeded)
- [ ] Offline-first test: airplane mode → create PTP → sign → airplane
  off → sync succeeds
- [ ] Fresh install on device, first-run experience works
- [ ] No hardcoded staging URLs
- [ ] App icon has no alpha
- [ ] Tested on iPhone SE 3 (smallest supported screen) + 15 Pro Max

---

## 10. Cost summary

| Item | One-time | Annual |
|---|---|---|
| Apple Developer Program | — | $99 |
| Google Play Console | $25 | — |
| Sentry (Developer plan) | — | $0 — $312/yr |
| EAS Build (past free tier) | — | $228/yr ($19/mo) or $1188/yr ($99/mo) |
| D-U-N-S number (if org) | — | free |
| **Total year 1** | **$25** | **$99 + up to $1500** |

Realistic small-business year 1: **~$350-$600 USD total**.

---

## 11. Done when

- [ ] Track live on Apple App Store, searchable as "NotchField Track"
- [ ] Track live on Google Play, searchable same
- [ ] Auto-deploy pipeline: tag `v1.0.1` → build + submit for review
  runs on CI
- [ ] Release notes template in repo
- [ ] Crash-free users > 98% in first week post-launch
- [ ] Jantile foreman installs from the public store (not EAS link)
  and runs a full safety flow end-to-end

---

*From Jantile pilot to public App Store. 5-7 days of focused work +
2-5 days of Apple/Google review. Cost: less than one month's Supabase
Pro plan.*
