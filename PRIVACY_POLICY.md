# Privacy Policy — NotchField Track

**Effective date:** 2026-04-24
**Last updated:** 2026-04-24
**Publisher:** NotchField
**Contact:** [privacy@notchfield.com](mailto:privacy@notchfield.com)

> **Hosting note for the Takeoff team:** this document is the source
> for the policy URL required by Apple App Store and Google Play
> submissions. Publish at **`https://notchfield.com/privacy`** (the URL
> is already referenced by Track app's store listings, legal notices,
> and the reviewer notes). The content below is MDX/markdown-friendly
> and uses only plain headings and bullets so it renders in whatever
> CMS the marketing site runs. Don't rename the file without also
> updating `SPRINT_TRACK_STORE_RELEASE.md §2.1`, the Apple App Privacy
> Nutrition Labels, and the Play Data Safety form.

---

## 1. Overview

NotchField Track ("Track", "the app", "we") is a mobile application
used by construction field workers — foremen, supervisors, and
laborers — to record safety documentation, track production, capture
crew assignments, manage material deliveries, and coordinate work on a
jobsite. Track pairs with **NotchField Takeoff**, the web application
used by project managers and estimators in the same organization.
This policy describes what personal information Track collects, how
we use it, how we store it, and what rights you have over it.

Track is a **business-to-business (B2B) tool**. Individual field
workers use the app only on behalf of the contractor who employs them.
Your employer — identified in the app as your *organization* — is the
data controller for employment-derived records (your name, job
assignments, time entries, safety signatures). NotchField is the data
processor.

## 2. Information we collect

### 2.1 Information you give us

| Category | What | When | Why |
|---|---|---|---|
| Identity | Full name, email address, phone (optional), avatar photo (optional) | You enter these at sign-up; your employer adds you to their organization | Log in, attribute your work to you in safety and time records, send delivery notifications |
| Credentials | Password (one-way salted hash, we never see the plaintext); SST card number, OSHA-10/30 / SWAC certificate numbers and expiry dates | Entered by you or by your employer's HR | Comply with NYC DOB / OSHA jobsite requirements; alert when a card is about to expire |
| Emergency contact | Name, phone, relationship | Entered at onboarding, optional | Contact someone on your behalf in case of a jobsite injury |
| Signatures | Digital signature image (PNG, base64) | When you sign a safety doc, work ticket, or sign-off | Legal record that you acknowledged the document |
| Work records | Task/area/surface you are assigned to; phase progress checkboxes; blocked reasons; photos of progress, quality, or blockers | While you do your job in the app | Production tracking, delay documentation, GC verification |
| Bug reports | Free-form text, up to 3 screenshots, auto-captured app version and device model | Only when you tap **Report Issue** | Improve the app |

### 2.2 Information collected automatically

| Category | What | Purpose |
|---|---|---|
| GPS location | **Precise location**, foreground and background. Coordinates are stamped onto check-in records, photos, and signatures so they can be verified after the fact. Background location is used to auto-check-you-in when you enter a job-site geofence defined by your supervisor. | Time tracking, geofence auto-check-in, photo / signature verification |
| Camera + photo library | Photos you capture or select for progress reports, quality control, blocked areas, deliveries, or safety documentation | Visual evidence attached to the corresponding work record |
| Device identifiers | A stable internal user ID (UUID, not your email or device hardware ID); app version; operating system version; screen size | Crash diagnostics and feature scoping |
| Crash diagnostics | Stack trace, app version, non-identifying device info, and the page you were on when the crash happened | Find and fix crashes in production |

We do **not** collect: your contacts, your calendar, your messages,
your browsing history outside the app, your advertising ID, your
microphone audio (the microphone permission appears on Android because
a future release will include voice commands, but the current version
does not record audio).

## 3. How we use the information

- **Provide the core features.** Log you in, show you your assignments,
  sync your offline edits back to your employer's project manager,
  generate PDFs of safety documents you sign, record your hours.
- **Meet legal and regulatory obligations.** Safety documents (JHA,
  PTP, Toolbox Talks, sign-offs) and time records are retained for
  the periods required by OSHA, New York State Labor Law, and similar
  rules in the jurisdictions Track operates in. See *Retention* below.
- **Improve the app.** We use aggregated, non-identifying error and
  performance data to find crashes and performance regressions. We
  never use your work content (photos, signatures, task notes) for
  product analytics.
- **Communicate with you and your employer.** Emails when a safety
  document is distributed to a General Contractor; push notifications
  when a delivery is arriving or when your certification is expiring
  (push notifications are planned — not present in 1.0.0 but declared
  here so future releases are covered by the same policy).

We do **not** use your information for advertising, profiling, or any
third-party marketing. We do not sell your personal information.

## 4. Who we share it with

NotchField Track runs on a small set of service providers. Each one
has a data-processing agreement with NotchField that limits them to
processing your data on our instructions only.

| Processor | What they do | Data residency |
|---|---|---|
| **Supabase** ([supabase.com](https://supabase.com)) | Primary database + authentication + encrypted file storage (photos, signatures, PDFs, drawings) | United States (`us-east-1`) |
| **PowerSync** ([powersync.com](https://www.powersync.com)) | Offline sync between your device and Supabase — mirrors rows you're authorized to see into a local SQLite database on your phone | United States |
| **Zoho Mail (Zoho SMTP)** ([zoho.com/mail](https://www.zoho.com/mail)) | Sends distribution emails for safety documents and work tickets | United States |
| **Expo Application Services** ([expo.dev](https://expo.dev)) | Builds and distributes the app; in a future release, delivers push notifications | United States |
| **Sentry** ([sentry.io](https://sentry.io)) | Crash and performance monitoring; receives stack traces and non-identifying device info. We strip email, IP address, and name from every event before it leaves your device. | United States |
| **Procore** (optional) | If your employer uses Procore for punch lists, Track reads and writes punch items on that account under your employer's credentials | Depends on your employer's Procore tenancy |

Your employer's **General Contractor** receives the PDFs of safety
documents you sign and work tickets they've signed — because that's
the point of those documents. Your name, the date, and your signature
image are included in those PDFs, along with an SHA-256 hash so the
document's authenticity can be verified later.

We share information with law enforcement or in legal proceedings only
when required by a valid subpoena, court order, or similar process, and
we'll notify your employer unless the order prohibits it.

## 5. Data retention

| Record type | How long we keep it | Why |
|---|---|---|
| Signed safety documents (JHA, PTP, Toolbox Talks, sign-offs) | **7 years** after the date of signing | New York State Labor Law §240; OSHA 29 CFR 1904.33 retention requirements |
| Time entries + GPS check-ins | **7 years** | Prevailing-wage and Fair Labor Standards Act record-keeping |
| Work tickets and signed PDFs | **7 years** | Statute-of-limitations for construction contract disputes in most US jurisdictions |
| Photos attached to work records | Same as the parent record | Preserve evidentiary context |
| Crash reports | **90 days** rolling | Debug the current and previous two releases |
| Bug reports you submit | Until we close the issue or 2 years, whichever is longer | Follow-up and reproduction |
| Your profile identity (name, email) after you delete your account | Anonymized *immediately* — see *Account deletion* | Preserve employment records in the org while stripping personal identifiers |

## 6. Your rights

Regardless of where you live, you can:

- **Access** the personal information Track holds about you. Ask at
  [privacy@notchfield.com](mailto:privacy@notchfield.com) and we'll
  export a copy within 30 days.
- **Correct** anything wrong. Most of your personal information
  (name, phone, emergency contact, avatar) is editable directly in
  the app under **More → Settings**. Certification numbers are
  maintained by your employer's HR — ask them.
- **Delete** your account. Use the in-app flow described next.
- **Object** to processing, or **restrict** processing in specific
  cases. Contact us and we'll explain what we can and can't restrict
  without also breaking your employment records — the 7-year retention
  on signed safety documents is a legal obligation and isn't
  subject to erasure requests under GDPR Art. 17(3)(b).

### 6.1 Account deletion (in-app)

Track includes a self-service account-deletion flow required by Apple
and Google store policies.

1. Open the app → **More** tab → **Settings**.
2. Scroll to the **Danger Zone** section at the bottom.
3. Tap **Delete my account**.
4. Type `DELETE` in the confirmation field to enable the destructive
   action. Tap **Delete**.
5. The app calls our `delete-my-account` server function which, in a
   single transaction:
   - Anonymizes your profile row (name becomes "Deleted User", avatar
     is removed).
   - Tombstones your authentication credentials — email is rotated to
     an internal placeholder, password is replaced with a random
     unguessable value. You will never be able to sign in again.
6. You are signed out and returned to the login screen.

What stays — per the legal-retention reasons under *Data retention*:
- The safety documents you signed (attributed to "Deleted User").
- Work tickets you created or signed (same).
- Daily reports, time entries, GPS check-ins (same).

If you also want your employer's organization to erase your employment
records after the statutory retention windows elapse, contact your
employer directly. NotchField can only act on your personal account.

### 6.2 California (CCPA) and Virginia / Colorado / Connecticut / Utah

If you live in one of these states, you have additional statutory
rights including the right to know the categories of personal
information collected (listed in §2 above), the right to opt out of
sales (NotchField does not sell personal information, so there is
nothing to opt out of), and the right to non-discrimination for
exercising your rights. Exercise any of these by emailing
[privacy@notchfield.com](mailto:privacy@notchfield.com).

### 6.3 European Economic Area, United Kingdom, and Switzerland (GDPR)

If you live in the EEA, UK, or Switzerland, you have the same rights
listed in §6 plus the right to data portability and the right to
lodge a complaint with your local data protection authority
(e.g. Ireland's DPC, the UK's ICO, Switzerland's FDPIC).

Track transfers personal information to the United States for
processing under the EU Commission's **Standard Contractual Clauses
(2021 modules)**, which are in place between NotchField and each of
the processors listed in §4. If you'd like a copy, ask.

## 7. Security

- All network traffic between your device and our servers uses TLS
  1.2 or higher.
- All data at rest in Supabase is encrypted using AES-256.
- Authentication uses salted bcrypt hashes; we never see your
  password in plaintext.
- Digital signatures include an SHA-256 integrity hash that allows
  anyone holding the PDF to verify it wasn't modified since signing.
- Row-level security enforces that you only see data that belongs to
  your organization and the projects you're assigned to.

No system is perfectly secure. If you believe your account has been
compromised, contact us immediately at
[security@notchfield.com](mailto:security@notchfield.com).

## 8. Children

NotchField Track is a workforce app. **We do not direct it to children
under 16 and we do not knowingly collect personal information from
anyone under 18.** Construction work in the United States generally
requires you to be 18 or older anyway. If you believe a minor has
registered, tell us and we'll delete the account.

## 9. Third-party tracking and analytics

Track does **not** use third-party advertising SDKs, behavioral
analytics, attribution trackers, or social-media pixels. The crash
and performance monitoring described in §4 (Sentry) is the only
telemetry, and it is PII-stripped before transmission.

## 10. Changes to this policy

We may update this policy when features change or when the law
requires it. The **Last updated** date at the top of this page
reflects the most recent change. We'll notify you of material changes
via in-app banner and email to the address on your profile, at least
14 days before the change takes effect.

## 11. Contact

- **Privacy questions, access requests, erasure requests:**
  [privacy@notchfield.com](mailto:privacy@notchfield.com)
- **Security incidents:**
  [security@notchfield.com](mailto:security@notchfield.com)
- **General support:**
  [support@notchfield.com](mailto:support@notchfield.com)
- **Postal mail:** NotchField, *(physical address — pending)*

Response time: within **30 days** for personal-data requests, sooner
for security matters.
