# PDF Renderer Alignment — Web ↔ Track

> **Goal:** align `ptpPdfRenderer.ts` + `toolboxPdfRenderer.ts` on Web so the distribute PDFs (email attachments the GC receives) match the Track local export **pixel-for-pixel** in layout, typography, and data rendering.
>
> **Source of truth:** Track's `src/features/safety/services/safety-export.ts` (commit `4ff2ac0`). That's what the foreman sees today when they tap **Export PDF** in the Safety detail screen — and it's what the pilot client (Jantile) signed off as "luce increíble."
>
> **Scope:** PTP, Toolbox Talk, and (future) Work Ticket PDFs. JHA keeps current structure.

---

## 🎯 Round 2 — Concrete gaps observed on PTP #31 (2026-04-21)

Comparison of the two PDFs for the same doc (`Tile PTP — 2026-04-21`, #31, Jantile, 7 tasks, 2 signatures):
- **Track export:** `PTP 31 TRACK.pdf` — client-approved baseline.
- **Takeoff distribute:** `PTP 31 TAKEOFF.pdf` — current Web output.

17 specific discrepancies found. Each one below is a **line-level change** the Takeoff renderer needs.

### A. Header

| # | Takeoff today | Target (Track) | Fix |
|---|---|---|---|
| 1 | Title: `PRE-TASK PLAN (PTP)` | `PRE-TASK PLAN` | Drop the `(PTP)` suffix from `labels.title`. The doc type is already implied by the table + content. Mirror in toolbox: `TOOLBOX TALK` not `TOOLBOX TALK (SAFETY)`. |
| 2 | Page-level repeating header on every page (logo + title + #number repeat on pages 2–3) | Header on page 1 only | Disable `doc.addPage()` header replay. Let pages 2+ flow as continuation with just the content. Saves ~60pt of vertical space per continuation page. |

### B. Metadata column (Info rows)

| # | Takeoff today | Target (Track) | Fix |
|---|---|---|---|
| 3 | Labels UPPERCASE: `DATE`, `SHIFT`, `TRADE`, `FOREMAN` | Title Case: `Date`, `Shift`, `Trade`, `Foreman` | Change label casing. Font weight stays 600 / muted color `#475569`. |
| 4 | Shift value `Day shift` (from `labels.shiftValues.day`) | `day` (raw enum value, lowercase) | Drop the shiftValues lookup for the info row rendering. Just `content.shift`. Keep shiftValues as a fallback dict only for toolbox which doesn't render this row. |

### C. Task table

| # | Takeoff today | Target (Track) | Fix |
|---|---|---|---|
| 5 | Section header: `TASK DESCRIPTION (7)` | `TASKS & HAZARD CONTROLS (7)` | Rename `labels.taskDescription` → `labels.tasksAndHazardControls` (or just hardcode the section header). The phrase "Task Description" should only appear as the column header, not the section. |
| 6 | Column headers: `TASK DESCRIPTION`, `HAZARDS IDENTIFIED`, `CONTROLS IN PLACE`, `PPE REQUIRED` | `TASK`, `HAZARDS`, `CONTROLS`, `PPE REQUIRED` | Shorter labels — match Track exactly. The column context is already clear from the section title; the verbose labels waste horizontal space and push content to wrap awkwardly. |
| 7 | TASK column shows only task name | Task name **bold** + category subtitle (e.g. "Cutting & Fitting") in small muted text below | Render `<strong>${task.task_name}</strong>` then `<div class="category-muted">${task.category}</div>` in the TASK cell. Currently the category is dropped — the foreman/GC can't tell what phase of the work a task belongs to. |
| 8 | HAZARDS cell: bullets + **appended italic line** `OSHA Reference: 29 CFR 1926.1153, 29 CFR 1926.300, ...` | Bullets only — no OSHA footnote line | **REMOVE the OSHA reference footnote entirely.** It wraps awkwardly, gets truncated mid-citation (`29 CFR 192` on page 1), and is redundant with the bulleted controls. If OSHA refs ever need to render, they belong inline on each hazard/control item, not as a comma-separated footer. |
| 9 | PPE column: bullet list `• Safety glasses AND face shield ...` | Pill-style tags — light gray background, rounded, each PPE item on its own chip | Replace the `<ul>` with rendered chips. HTML/CSS example: `<span style="display:inline-block; padding:2px 6px; margin:1px 2px; background:#F1F5F9; color:#334155; border-radius:3px; font-size:8pt;">${ppe}</span>` — one per item, they wrap naturally in the cell. |

### D. Signatures section

| # | Takeoff today | Target (Track) | Fix |
|---|---|---|---|
| 10 | Section header: `WORKER ACKNOWLEDGMENT (2)` | `SIGNATURES (2)` | Rename header. The signatures ARE the acknowledgment — redundant to say both. |
| 11 | Body paragraph: `"By signing below, workers acknowledge they have reviewed this Pre-Task Plan, understand the hazards identified, and agree to follow the controls and PPE requirements."` | No paragraph | **REMOVE** the acknowledgment paragraph. The signature implies consent; the paragraph is legal boilerplate the client doesn't want. |
| 12 | Signature cards wrapped in rounded `<div>` with border + padding — boxy look | Flat underline only + name + chip + timestamp below | Drop the card border and padding. Just: signature image sitting on a 1px bottom-border, then name (bold) + role chip + date on the lines below. Mirror Track exactly — cleaner at low density. |
| 13 | Timestamp shows `10:52 PM` (UTC) | `6:52 PM` (local) | Convert `sig.signed_at` to the organization's local timezone (EDT for Jantile). If no org timezone is stored, default to Eastern or the browser timezone at render time. Currently the renderer is displaying UTC directly and times are 4 hours off. |

### E. Footer

| # | Takeoff today | Target (Track) | Fix |
|---|---|---|---|
| 14 | Repeats on every page: `Generated by NotchField · Page 1`, `HASH 82dd3f9b9c339f85` | Footer appears **once** at the end of the document | Remove the per-page footer loop. Render the footer block only at the very end of the doc flow, not on each page. |
| 15 | Hash truncated to 16 chars `82dd3f9b9c339f85` | Full 64-char SHA-256 wrapping onto 2 lines | Don't truncate. Use `doc.splitTextToSize(hash, 320)` to wrap the full hash at 320pt width and render the line array. Integrity loses its purpose if verifiers can't see the whole hash. |
| 16 | Footer text: `Generated by NotchField` | `Generated by NotchField Track` + second line `Digitally created and signed on device` | Mirror Track's two-line footer left block. "Track" in the product name matters — PMs can tell at a glance whether the doc came from the mobile app or the Web surface. |

### F. Status pill

| # | Takeoff today | Target (Track) | Fix |
|---|---|---|---|
| 17 | Shows `DRAFT` | `ACTIVE` | This one is **data-level, not renderer**. Both PDFs read `safety_documents.status`. Track exported after the foreman tapped "Submit" (`status='active'`); Takeoff distribute fired before the status flip. Fix: `/distribute` endpoint should `setPtpStatus(docId, 'active')` BEFORE generating the PDF, not after — otherwise the PDF permanently shows DRAFT while the DB row flips to active a split second later. |

---

## 1. The visual target

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  [ JANTILE LOGO ]     PRE-TASK PLAN         #22         ║
║    88 x 44px          Marble PTP —        ┌────────┐    ║
║                       2026-04-21          │ ACTIVE │    ║
║                                            └────────┘    ║
║  ════════════════════════════════════════════════════   ║  ← 2px orange rule
║                                                          ║
║  ┌─────────────────┬──────────────────┬────────────────┐║
║  │ PROJECT         │ COMPANY          │ DATE           │║  ← meta bar
║  │ DEMO PROJECT    │ Jantile Inc      │ 04/21/2026     │║     (bg-slate-50)
║  └─────────────────┴──────────────────┴────────────────┘║
║                                                          ║
║  DATE     04/21/2026                                    ║
║  SHIFT    day                                           ║  ← info rows
║  TRADE    marble                                        ║
║  AREA     (omit if empty)                               ║
║  FOREMAN  Lalas Supervisor                              ║
║                                                          ║
║  ── TASKS & HAZARD CONTROLS (6) ───────────────────── ║
║  ┌───┬──────────┬────────┬────────┬───────────────┐    ║
║  │ # │ TASK     │ HAZARDS│ CONTROLS│ PPE REQUIRED │    ║
║  │ 1 │ Install  │ • ...  │ • ...  │ [Hard hat]   │    ║
║  │   │  stone   │        │        │ [Glasses]    │    ║
║  └───┴──────────┴────────┴────────┴───────────────┘    ║
║                                                          ║
║  ┌──────────────────────────────────────────────────┐  ║  ← callout (orange
║  │ EMERGENCY INFORMATION                            │  ║     left border)
║  │ Hospital: ...                                    │  ║
║  │ Assembly: ...                                    │  ║
║  └──────────────────────────────────────────────────┘  ║
║                                                          ║
║  ── SIGNATURES (2) ────────────────────────────────── ║
║  ┌────────────────────────┐ ┌──────────────────────┐   ║
║  │  [signature png]       │ │  [signature png]     │   ║
║  │  Lalas Supervisor 🟠FO │ │  carlos ruiz  ⚫CREW │   ║
║  │  4/21/2026, 5:23 PM    │ │  4/21/2026, 5:24 PM  │   ║
║  │  SST 123456789         │ │                      │   ║
║  └────────────────────────┘ └──────────────────────┘   ║
║                                                          ║
║  ─────────────────────────────────────────────────────  ║
║  Generated by NotchField Track    DOCUMENT INTEGRITY    ║  ← footer
║  Digitally created and signed     (SHA-256)             ║     (monospace
║  on device                        5d464bcf83c4bb14...   ║      REMOVED —
║                                                          ║      same font)
╚══════════════════════════════════════════════════════════╝
```

**Key principles:**

1. **Customer branding first.** The logo is the subcontractor's (Jantile), not ours. "NotchField Track" goes only in the footer watermark — never as the main header.
2. **Title center-aligned** at the top, not as an orange subtitle below the logo.
3. **One font.** Helvetica throughout on Web (jsPDF default) — no monospace for the hash, no serif anywhere.
4. **Counts are computed, never injected into labels.** Strip any trailing `(N)` from label strings, then append `(${selected_tasks.length})` / `(${signatures.length})` yourself (commit `274ef6b` pattern — keep it).
5. **No separate Crew/Attendance section.** Each signer shows up in Signatures with their role chip, SST, and signature image — a crew table above duplicates the same identity data. The Signatures block IS the attendance record. (Jantile pilot feedback, 2026-04-21.)
6. **All dates formatted MM/DD/YYYY** (US style) — not ISO `YYYY-MM-DD`, not long `April 21, 2026`. Single format everywhere, including the meta bar, info rows, and signature timestamps (`MM/DD/YYYY, H:MM AM/PM`).

---

## 2. Data reads (canonical)

Every PTP/Toolbox row on Web's renderer must read these fields. Many of today's bugs come from reading legacy field names that are always `null` in new-shape docs.

| Render slot            | Read from                                               | Notes                                         |
|------------------------|---------------------------------------------------------|-----------------------------------------------|
| Company logo           | `organizations.logo_url`                                | Fetch via `fetchImageAsDataUrl()`. If `null`, skip image and render `organizations.name` as bold text. |
| Company name           | `organizations.name`                                    | **Never** `organizations.id` — that's why the UUID leaked into older PDFs. |
| Project name           | `projects.name`                                         | Already correct.                              |
| Doc type title         | `labels.title` (PTP: "Pre-Task Plan" / Toolbox: "Toolbox Talk") | Track sends canonical `PtpPdfLabels`.  |
| Doc subtitle           | `safety_documents.title`                                | e.g. "Marble PTP — 2026-04-21".               |
| Doc number             | `safety_documents.number` (serial)                      | Prepend `#`.                                  |
| Status pill            | `safety_documents.status` ∈ {draft, active, completed}  | Color map below.                              |
| Date                   | `safety_documents.created_at` (formatted)               | "April 21, 2026".                             |
| **PTP tasks**          | `content.selected_tasks[]`                              | **Not** `content.tasks`. Each task has `task_name`, `category`, `hazards[]`, `controls[]`, `ppe_required[]`. |
| PTP foreman            | `content.foreman_name`                                  | String.                                       |
| PTP metadata           | `content.ptp_date`, `.shift`, `.trade`, `.area_label`   | Omit info rows where value is empty/null. Dates format MM/DD/YYYY. |
| PTP emergency          | `content.emergency.{hospital_name, assembly_point, ...}` | Whole block may be null — render callout only if any field is populated. |
| **Toolbox topic**      | `content.topic_snapshot.{title, why_it_matters, key_points[], discussion_questions[], category, source, osha_ref}` | **Not** `content.topic` + `content.discussion_points`. |
| Toolbox bilingual      | `content.delivered_language` ∈ {en, es, both}           | If `es` or `both`, prefer `*_es` variants when populated. |
| **Signer name**        | `sig.worker_name ?? sig.signer_name ?? 'Unknown'`       | **Canonical is `worker_name`.** `signer_name` is legacy from work-ticket signatures and is always `null` for PTP/Toolbox. Reading `signer_name` first is why today's PDFs show `undefined`. |
| Signer role chip       | `sig.is_foreman` → `Foreman`; `sig.is_walk_in` → `Walk-in`; else `Crew` | |
| Signer SST             | `sig.sst_card_number` (nullable)                        | Render "—" when null.                         |
| Signature image        | `sig.signature_data_url ?? sig.signature_data`          | data:image/png;base64,...                      |
| Signature timestamp    | `sig.signed_at`                                         | Format as `MM/DD/YYYY, H:MM AM/PM`. |
| Integrity hash         | SHA-256 computed server-side                            | Render in same font as body (no monospace).   |

---

## 3. Design tokens

```ts
const TOKENS = {
  font: 'Helvetica',  // jsPDF default — keep. NO monospace anywhere.

  color: {
    ink:       '#0F172A',  // primary text
    inkSoft:   '#475569',  // secondary text (labels, dates)
    inkMuted:  '#94A3B8',  // tertiary (meta labels, footer)
    rule:      '#E2E8F0',  // borders / dividers
    accent:    '#F97316',  // brand orange (header rule, callouts)
    bgAlt:     '#F8FAFC',  // zebra rows, meta bar background
  },

  status: {
    draft:     { bg: '#FEF3C7', fg: '#B45309' },
    active:    { bg: '#DCFCE7', fg: '#15803D' },
    completed: { bg: '#E0E7FF', fg: '#3730A3' },
    closed:    { bg: '#F1F5F9', fg: '#475569' },
  },

  role: {
    foreman:   { bg: '#FED7AA', fg: '#9A3412' },  // orange-100 / orange-900
    walkIn:    { bg: '#FDE68A', fg: '#92400E' },  // amber
    crew:      { bg: '#CBD5E1', fg: '#334155' },  // slate
  },

  fontSize: {
    docType:   18,   // "PRE-TASK PLAN" centered
    docNumber: 16,
    subtitle:  10,
    body:      10.5,
    table:      9.5,
    metaLabel:  7.5,  // uppercase, letterSpacing +1.2
    footer:     7.5,
    sectionHeader: 10,  // uppercase, letterSpacing +1.2, bottom border
  },

  spacing: {
    page:      { margin: 40 },       // letter, 40pt margin all sides
    header:    { paddingBottom: 14, marginBottom: 20 },
    metaBar:   { padding: 10, borderRadius: 6, marginBottom: 20 },
    section:   { marginTop: 18, marginBottom: 10 },
  },
} as const;
```

---

## 4. Three-column header (jsPDF)

```ts
// columns — compute once per page
const pageWidth = doc.internal.pageSize.getWidth();
const L = 40;                            // left margin
const R = pageWidth - 40;                // right margin
const col1End = L + (pageWidth - 80) * 0.28;   // logo column ends at 28%
const col3Start = R - (pageWidth - 80) * 0.28; // meta column starts 28% from right

// LEFT — logo or company text
if (orgLogoDataUrl) {
  // keep aspect; fit inside 140x56
  const { width, height } = fitInside(logoW, logoH, 140, 56);
  doc.addImage(orgLogoDataUrl, 'PNG', L, 55, width, height);
} else {
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(TOKENS.color.ink);
  doc.text(orgName, L, 70);
}

// CENTER — doc type + subtitle, centered on page midpoint
const centerX = pageWidth / 2;
doc.setFont('Helvetica', 'bold');
doc.setFontSize(18);
doc.setTextColor(TOKENS.color.ink);
doc.text(labels.title.toUpperCase(), centerX, 65, { align: 'center' });
doc.setFont('Helvetica', 'normal');
doc.setFontSize(10);
doc.setTextColor(TOKENS.color.inkSoft);
doc.text(doc.title, centerX, 80, { align: 'center' });

// RIGHT — doc number + status pill
doc.setFont('Helvetica', 'bold');
doc.setFontSize(16);
doc.setTextColor(TOKENS.color.ink);
doc.text(`#${doc.number}`, R, 65, { align: 'right' });
drawStatusPill(doc, { x: R, y: 80, status: doc.status, align: 'right' });

// Orange rule under the header block
doc.setDrawColor(TOKENS.color.accent);
doc.setLineWidth(2);
doc.line(L, 100, R, 100);
```

Reference implementation (HTML equivalent): [`safety-export.ts` `.letterhead`](src/features/safety/services/safety-export.ts).

---

## 5. Counts — strip + append pattern (keep from `274ef6b`)

```ts
function stripTrailingCount(label: string): string {
  return label.replace(/\s*\(\d+\)\s*$/, '');
}

// PTP tasks section header
const tasksCount = content.selected_tasks?.length ?? 0;
const tasksHeader = `${stripTrailingCount(labels.taskDescription)} (${tasksCount})`;

// Signatures section — this is also the attendance record, so no
// separate crew table above. Count is just signatures.length.
const sigsHeader = `${stripTrailingCount(labels.signaturesTitle)} (${signatures.length})`;
```

Track's label builder (`buildPtpLabels.ts`, commit `9511973`) already sends clean labels with no count — this guard is defense-in-depth against any future caller that injects one.

---

## 6. Signatures — canonical name resolution

```ts
function resolveSignerName(sig: any): string {
  const name = (sig?.worker_name ?? sig?.signer_name ?? '').toString().trim();
  return name || 'Unknown';
}
```

**Why in this order:** `worker_name` is what Sprint PTP + MANPOWER write. `signer_name` is what work-ticket signatures use (legacy). Today's `undefined` bug is from reading `signer_name` first → it's always null in PTP/Toolbox → falls through to undefined. Flip the order.

---

## 6b. Date formatting — MM/DD/YYYY everywhere

```ts
function fmtDate(value: string | null | undefined): string {
  if (!value) return '';
  // Plain YYYY-MM-DD: anchor at local midnight to avoid timezone slip.
  const iso = value.length === 10 ? value + 'T00:00:00' : value;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(value);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const date = fmtDate(value);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}
```

Applies to:
- Meta bar `DATE` (from `safety_documents.created_at`) → `fmtDate(...)`
- PTP info row `DATE` (from `content.ptp_date`) → `fmtDate(...)`
- Toolbox info rows `SCHEDULED` / `DELIVERED` (from `content.scheduled_date` / `.delivered_date`) → `fmtDate(...)`
- Signature timestamp (`sig.signed_at`) → `fmtDateTime(...)`

**Never** use `.toLocaleDateString()` with `month: 'long'` — pilot explicitly rejected "April 21, 2026" long-form. And **never** display raw ISO `2026-04-21`.

---

## 7. Footer — no monospace

Current Web footer renders the SHA-256 hash in `Courier` or equivalent. Client flagged this as "mixed fonts." Replace with the body Helvetica at 7.5pt:

```ts
doc.setFont('Helvetica', 'bold');
doc.setFontSize(7.5);
doc.setTextColor(TOKENS.color.inkMuted);
doc.text('DOCUMENT INTEGRITY (SHA-256)', R, footerY, { align: 'right' });

doc.setFont('Helvetica', 'normal');
doc.setTextColor(TOKENS.color.inkSoft);
// wrap the hash if it exceeds maxWidth
const lines = doc.splitTextToSize(hash, 320);
doc.text(lines, R, footerY + 10, { align: 'right' });
```

---

## 8. Acceptance checklist

When a Jantile foreman distributes a PTP via Track, the email PDF MUST match these criteria — tested against the current Track export as reference:

- [ ] Header LEFT shows Jantile's logo image (from `organizations.logo_url`). If logo_url is null, shows "Jantile Inc" text bold.
- [ ] Header CENTER shows "PRE-TASK PLAN" centered, bold, uppercase, 18pt. Subtitle (the doc `title` field) below in 10pt, muted.
- [ ] Header RIGHT shows `#22` bold 16pt, status pill below ("ACTIVE" in green).
- [ ] 2-point orange rule (`#F97316`) spans the full width below the header.
- [ ] Meta bar (Project / Company / Date) on a `#F8FAFC` background row.
- [ ] Company shows **"Jantile Inc"**, never the UUID.
- [ ] Info rows (Date, Shift, Trade, Area, Foreman) omitted when empty. No "—" placeholders for empty values (except SST column in tables).
- [ ] **NO separate Crew Members or Attendance table.** The Signatures block is the attendance record. Each signer shows with role chip + SST + signature.
- [ ] `TASKS & HAZARD CONTROLS (N)` count is derived from `content.selected_tasks.length` — not 0 when tasks exist.
- [ ] **All dates formatted MM/DD/YYYY.** Meta bar, info rows, signature timestamps. No ISO, no "April 21, 2026" long-form.
- [ ] Task table has 5 columns (`#`, Task, Hazards, Controls, PPE Required) with PPE rendered as pill tags.
- [ ] Emergency callout (orange left-border box) only renders when at least one emergency field is populated.
- [ ] Signature cards show `worker_name`, never "undefined".
- [ ] Signature cards have role chips: Foreman (orange), Walk-in (amber), Crew (slate).
- [ ] Single Helvetica family throughout. **No monospace font anywhere**, including the integrity hash.
- [ ] Footer shows "Generated by NotchField Track" (small muted text) on the left, hash on the right.
- [ ] If foreman uploads a new logo in Web Settings, the next distributed PDF picks it up via the `?t=<timestamp>` cache-bust query param on `logo_url`.

---

## 9. Reference files

Track source (what to mirror):
- HTML template: `src/features/safety/services/safety-export.ts`
- Logo component: `src/features/organizations/components/OrgLetterhead.tsx`
- Org fetch hook: `src/features/organizations/hooks/useOrganization.ts`

Web targets:
- `src/features/pm/services/ptpPdfRenderer.ts`
- `src/features/pm/services/toolboxPdfRenderer.ts`
- `src/features/pm/services/buildPtpPdfLabels.ts` (stays — already canonical)

Related Web commits to stay on top of during the redesign:
- `4a84abf` — dual-auth (done)
- `3c094a0` — jsPDF null guard (done)
- `3b0dfd0` — shiftValues coalescing (done)
- `274ef6b` — count strip + authoritative derivation (done — KEEP the pattern)

Related Track commits this spec reflects:
- `9511973` — canonical PtpPdfLabels contract
- `7b859b2` — add `category` + `source` toolbox label keys
- `4ff2ac0` — customer letterhead + new-shape bodies (the visual source of truth for this spec)

---

*Client sign-off: Jantile pilot, 2026-04-21 — "luce increíble" on Track local export. Web distribute PDF must match before pilot closure.*
