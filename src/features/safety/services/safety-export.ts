/**
 * Safety Document PDF Export — Track local mockup preview
 * ========================================================
 * Generates a professional PDF from safety doc data (JHA/PTP/Toolbox)
 * using expo-print (HTML → PDF). Works offline, no network required.
 *
 * This is the "mockup" / preview — the authoritative PDF emailed to
 * recipients is generated server-side by Takeoff Web when the foreman
 * taps Distribute. They share the same visual language (logo, centered
 * title, single font) so what the foreman exports locally matches what
 * the GC receives.
 *
 * Sprint 52 pilot updates:
 *   - Logo: reads organizations.logo_url when available, falls back to
 *     org name text. Cache-busts automatically via the ?t=... query
 *     param Web appends on upload.
 *   - Header: 3-column (logo LEFT, doc type CENTER, doc# + status RIGHT).
 *     Title is centered at top next to the logo, NOT an orange subtitle
 *     below.
 *   - Font: single sans-serif family throughout — removed the
 *     monospace Courier block from the hash line (client feedback: no
 *     mixed fonts).
 *   - Signatures: reads worker_name FIRST (canonical PTP/Toolbox field),
 *     falls back to signer_name (legacy work-ticket field). No more
 *     'undefined' slots on signature cards.
 *   - New-shape PTP: renders content.selected_tasks + derived crew from
 *     signatures[] where is_foreman=false. Legacy shape still supported
 *     for historical rows.
 *   - New-shape Toolbox: renders content.topic_snapshot.* (title, why,
 *     key_points, discussion_questions, category, osha_ref). Legacy
 *     shape still supported.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import type { SafetyDocRow } from '../hooks/useSafetyDocs';

const DOC_TYPE_TITLES: Record<string, string> = {
  jha: 'Job Hazard Analysis',
  ptp: 'Pre-Task Plan',
  toolbox_talk: 'Toolbox Talk',
  toolbox: 'Toolbox Talk',
};

const RISK_COLORS: Record<string, string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

// ─── Signature normalization ──────────────────────────────
// Canonical field for PTP/Toolbox is worker_name; signer_name is legacy
// from work-ticket signatures (always null in the new wizards).

type NormalizedSig = {
  name: string;
  signature_data: string | null;
  signed_at: string;
  sst_card_number: string | null;
  is_foreman: boolean;
  is_walk_in: boolean;
};

function normalizeSignatures(raw: unknown): NormalizedSig[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any) => ({
    name: (s?.worker_name ?? s?.signer_name ?? '').toString().trim() || 'Unknown',
    signature_data: s?.signature_data_url ?? s?.signature_data ?? null,
    signed_at: s?.signed_at ?? '',
    sst_card_number: s?.sst_card_number ?? null,
    is_foreman: !!s?.is_foreman,
    is_walk_in: !!s?.is_walk_in,
  }));
}

function htmlEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Public entry point ───────────────────────────────────

type ExportOrg = {
  name: string;
  logo_url?: string | null;
};

/**
 * Export a safety document as PDF and open the share sheet.
 */
export async function exportSafetyDoc(
  doc: SafetyDocRow,
  projectName: string,
  org: ExportOrg | string,
): Promise<{ success: boolean; error?: string }> {
  // Back-compat: earlier callers passed an orgName string. Accept either.
  const orgInfo: ExportOrg =
    typeof org === 'string' ? { name: org, logo_url: null } : org;

  try {
    const content = (doc.content ?? {}) as Record<string, any>;
    const signatures = normalizeSignatures(doc.signatures);
    const docTypeTitle = DOC_TYPE_TITLES[doc.doc_type] ?? doc.doc_type;

    // SHA-256 integrity hash — signed_at + name only; skip signature image
    // blobs so the hash doesn't churn when the PNG encoder tweaks pixels.
    const hashInput = JSON.stringify({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      created_at: doc.created_at,
      signatures: signatures.map((s) => ({ name: s.name, signed_at: s.signed_at })),
    });
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      hashInput,
    );

    const html = buildHtml({
      docTypeTitle,
      title: doc.title,
      number: doc.number,
      projectName,
      org: orgInfo,
      date: new Date(doc.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      content,
      docType: doc.doc_type,
      signatures,
      hash,
      status: doc.status,
    });

    const { uri } = await Print.printToFileAsync({
      html,
      width: 612, // Letter width in points
      height: 792, // Letter height
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return { success: false, error: 'Sharing is not available on this device' };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${docTypeTitle} — ${doc.title}`,
      UTI: 'com.adobe.pdf',
    });

    return { success: true };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[SafetyExport] Failed:', err?.message);
    return { success: false, error: err?.message ?? 'Failed to generate PDF' };
  }
}

// ─── HTML template ────────────────────────────────────────

function buildHtml(params: {
  docTypeTitle: string;
  title: string;
  number: number | null | undefined;
  projectName: string;
  org: ExportOrg;
  date: string;
  content: Record<string, any>;
  docType: string;
  signatures: NormalizedSig[];
  hash: string;
  status: string;
}): string {
  const {
    docTypeTitle,
    title,
    number,
    projectName,
    org,
    date,
    content,
    docType,
    signatures,
    hash,
    status,
  } = params;

  const bodyContent =
    docType === 'jha'
      ? buildJhaBody(content)
      : docType === 'ptp'
        ? buildPtpBody(content, signatures)
        : buildToolboxBody(content, signatures);

  const signatureHtml = signatures
    .map((sig) => {
      const hasImg =
        typeof sig.signature_data === 'string' && sig.signature_data.startsWith('data:');
      const roleChip = sig.is_foreman
        ? '<span class="role-chip role-foreman">Foreman</span>'
        : sig.is_walk_in
          ? '<span class="role-chip role-walkin">Walk-in</span>'
          : '<span class="role-chip role-crew">Crew</span>';
      const sst = sig.sst_card_number
        ? `<div class="sig-meta">SST ${htmlEscape(sig.sst_card_number)}</div>`
        : '';
      return `
    <div class="signature-block">
      <div class="sig-line">
        ${
          hasImg
            ? `<img src="${htmlEscape(sig.signature_data)}" class="sig-image" />`
            : '<div class="sig-placeholder">Signed digitally</div>'
        }
      </div>
      <div class="sig-name">${htmlEscape(sig.name)} ${roleChip}</div>
      <div class="sig-date">${sig.signed_at ? htmlEscape(new Date(sig.signed_at).toLocaleString()) : ''}</div>
      ${sst}
    </div>`;
    })
    .join('');

  // Header LEFT: logo image if present, otherwise company name text.
  const hasLogo = !!org.logo_url;
  const headerLeft = hasLogo
    ? `<img src="${htmlEscape(org.logo_url)}" class="logo-img" alt="${htmlEscape(org.name)}" />`
    : `<div class="company-text">${htmlEscape(org.name)}</div>`;

  const statusClass = `status-${status || 'draft'}`;
  const numberLine = number != null ? `#${number}` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* ═══ Single font family throughout — no serif, no monospace ═══ */
    :root {
      --font: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --ink: #0F172A;
      --ink-soft: #475569;
      --ink-muted: #94A3B8;
      --rule: #E2E8F0;
      --accent: #F97316;
      --bg-alt: #F8FAFC;
    }
    @page { margin: 40px; size: letter; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: var(--font);
      font-size: 10.5pt;
      color: var(--ink);
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ═══ Letterhead (3-column: logo LEFT | title CENTER | meta RIGHT) ═══ */
    .letterhead {
      display: table;
      width: 100%;
      table-layout: fixed;
      border-bottom: 2px solid var(--accent);
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .lh-left, .lh-center, .lh-right {
      display: table-cell;
      vertical-align: middle;
    }
    .lh-left { width: 28%; }
    .lh-center { width: 44%; text-align: center; }
    .lh-right { width: 28%; text-align: right; }

    .logo-img {
      max-width: 140px;
      max-height: 56px;
      object-fit: contain;
      display: block;
    }
    .company-text {
      font-size: 14pt;
      font-weight: 700;
      color: var(--ink);
      letter-spacing: -0.2px;
    }

    .doc-type {
      font-size: 18pt;
      font-weight: 700;
      color: var(--ink);
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .doc-subtitle {
      font-size: 10pt;
      font-weight: 500;
      color: var(--ink-soft);
      margin-top: 2px;
    }

    .doc-number {
      font-size: 16pt;
      font-weight: 700;
      color: var(--ink);
    }
    .status-pill {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .status-draft     { background: #FEF3C7; color: #B45309; }
    .status-active    { background: #DCFCE7; color: #15803D; }
    .status-completed { background: #E0E7FF; color: #3730A3; }
    .status-closed    { background: #F1F5F9; color: #475569; }

    /* ═══ Meta bar (Project / Company / Date) ═══ */
    .meta-bar {
      display: table;
      width: 100%;
      table-layout: fixed;
      border-radius: 6px;
      background: var(--bg-alt);
      padding: 10px 12px;
      margin-bottom: 20px;
    }
    .meta-cell { display: table-cell; padding-right: 12px; }
    .meta-cell:last-child { padding-right: 0; }
    .meta-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: var(--ink-muted);
      text-transform: uppercase;
      letter-spacing: 1.2px;
    }
    .meta-value {
      font-size: 10.5pt;
      font-weight: 600;
      color: var(--ink);
      margin-top: 1px;
    }

    /* ═══ Sections / tables ═══ */
    .section-title {
      font-size: 10pt;
      font-weight: 700;
      color: var(--ink);
      text-transform: uppercase;
      letter-spacing: 1.2px;
      border-bottom: 1px solid var(--rule);
      padding-bottom: 5px;
      margin: 18px 0 10px 0;
    }
    .info-row { display: table; width: 100%; margin-bottom: 5px; }
    .info-label {
      display: table-cell;
      width: 120px;
      font-size: 9pt;
      font-weight: 600;
      color: var(--ink-soft);
    }
    .info-value {
      display: table-cell;
      font-size: 10pt;
      color: var(--ink);
    }

    table { width: 100%; border-collapse: collapse; margin: 6px 0 14px 0; }
    th {
      background: var(--ink);
      color: white;
      text-align: left;
      padding: 7px 10px;
      font-size: 8.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 7px 10px;
      font-size: 9.5pt;
      border-bottom: 1px solid var(--rule);
      vertical-align: top;
    }
    tr:nth-child(even) td { background: var(--bg-alt); }

    .risk-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      color: white;
    }
    .ppe-tag {
      display: inline-block;
      padding: 2px 6px;
      margin: 1px 2px 1px 0;
      border-radius: 3px;
      font-size: 8pt;
      background: #F1F5F9;
      color: #334155;
    }

    .bullet-list { padding-left: 18px; margin: 6px 0; }
    .bullet-list li { margin-bottom: 3px; font-size: 9.5pt; }

    .callout {
      border-left: 3px solid var(--accent);
      background: #FFF7ED;
      padding: 10px 12px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .callout-label {
      font-size: 8pt;
      font-weight: 700;
      color: #9A3412;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      margin-bottom: 4px;
    }

    /* ═══ Signatures ═══ */
    .signatures {
      margin-top: 24px;
      display: table;
      width: 100%;
      table-layout: fixed;
    }
    .signature-block {
      display: table-cell;
      padding-right: 24px;
      vertical-align: top;
    }
    .signature-block:last-child { padding-right: 0; }
    .sig-line {
      border-bottom: 1px solid var(--ink);
      height: 54px;
      margin-bottom: 4px;
      display: flex;
      align-items: flex-end;
    }
    .sig-image {
      max-height: 50px;
      max-width: 180px;
      object-fit: contain;
    }
    .sig-placeholder {
      font-size: 9pt;
      color: var(--ink-muted);
      font-style: italic;
      padding-bottom: 3px;
    }
    .sig-name {
      font-size: 10pt;
      font-weight: 700;
      color: var(--ink);
    }
    .sig-date { font-size: 8pt; color: var(--ink-soft); margin-top: 1px; }
    .sig-meta { font-size: 8pt; color: var(--ink-soft); margin-top: 1px; }

    .role-chip {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-left: 6px;
      vertical-align: middle;
    }
    .role-foreman { background: rgba(249, 115, 22, 0.15); color: #9A3412; }
    .role-walkin  { background: rgba(245, 158, 11, 0.18); color: #92400E; }
    .role-crew    { background: rgba(100, 116, 139, 0.15); color: #334155; }

    /* ═══ Footer ═══ */
    .footer {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid var(--rule);
      display: table;
      width: 100%;
      table-layout: fixed;
    }
    .footer-left, .footer-right {
      display: table-cell;
      vertical-align: top;
      font-size: 7.5pt;
      color: var(--ink-muted);
    }
    .footer-right { text-align: right; }
    .hash-label {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
    }
    .hash-value {
      color: var(--ink-soft);
      word-break: break-all;
      max-width: 320px;
      display: inline-block;
      margin-top: 2px;
    }

    @media print {
      .letterhead { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <div class="lh-left">${headerLeft}</div>
    <div class="lh-center">
      <div class="doc-type">${htmlEscape(docTypeTitle)}</div>
      <div class="doc-subtitle">${htmlEscape(title)}</div>
    </div>
    <div class="lh-right">
      <div class="doc-number">${htmlEscape(numberLine)}</div>
      <div class="status-pill ${statusClass}">${htmlEscape(status)}</div>
    </div>
  </div>

  <div class="meta-bar">
    <div class="meta-cell">
      <div class="meta-label">Project</div>
      <div class="meta-value">${htmlEscape(projectName)}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Company</div>
      <div class="meta-value">${htmlEscape(org.name)}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Date</div>
      <div class="meta-value">${htmlEscape(date)}</div>
    </div>
  </div>

  ${bodyContent}

  ${
    signatures.length > 0
      ? `<div class="section-title">Signatures (${signatures.length})</div>
         <div class="signatures">${signatureHtml}</div>`
      : ''
  }

  <div class="footer">
    <div class="footer-left">
      <div>Generated by NotchField Track</div>
      <div style="margin-top: 2px;">Digitally created and signed on device</div>
    </div>
    <div class="footer-right">
      <div class="hash-label">Document Integrity (SHA-256)</div>
      <div class="hash-value">${htmlEscape(hash)}</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── JHA Body ──────────────────────────────────────────────

function buildJhaBody(content: Record<string, any>): string {
  const hazards = (content.hazards ?? []) as any[];

  return `
    <div class="info-row"><div class="info-label">Location</div><div class="info-value">${htmlEscape(content.location ?? '—')}</div></div>
    <div class="info-row"><div class="info-label">Weather</div><div class="info-value">${htmlEscape(content.weather ?? '—')}</div></div>

    <div class="section-title">Hazard Analysis (${hazards.length} identified)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 5%">#</th>
          <th style="width: 25%">Hazard</th>
          <th style="width: 10%">Risk</th>
          <th style="width: 30%">Controls</th>
          <th style="width: 30%">PPE Required</th>
        </tr>
      </thead>
      <tbody>
        ${hazards
          .map(
            (h: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td>${htmlEscape(h.description ?? '')}</td>
            <td><span class="risk-badge" style="background: ${RISK_COLORS[h.risk_level] ?? '#94A3B8'}">${htmlEscape((h.risk_level ?? '').toUpperCase())}</span></td>
            <td>${htmlEscape(h.controls ?? '')}</td>
            <td>${(h.ppe ?? []).map((p: string) => `<span class="ppe-tag">${htmlEscape(p)}</span>`).join(' ')}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

// ─── PTP Body ──────────────────────────────────────────────
// Supports both the new wizard shape (selected_tasks with JHA snapshots)
// and the legacy form (tasks[] + crew_members[]).

function buildPtpBody(content: Record<string, any>, signatures: NormalizedSig[]): string {
  const isNewShape = Array.isArray(content.selected_tasks);

  if (!isNewShape) {
    const tasks = (content.tasks ?? []) as any[];
    const crew = (content.crew_members ?? []) as string[];
    return `
      <div class="info-row"><div class="info-label">Location</div><div class="info-value">${htmlEscape(content.location ?? '—')}</div></div>

      <div class="section-title">Crew Members (${crew.length})</div>
      <ul class="bullet-list">
        ${crew.map((m: string) => `<li>${htmlEscape(m)}</li>`).join('')}
      </ul>

      <div class="section-title">Tasks &amp; Hazard Controls (${tasks.length})</div>
      <table>
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 30%">Task</th>
            <th style="width: 35%">Hazards</th>
            <th style="width: 30%">Controls</th>
          </tr>
        </thead>
        <tbody>
          ${tasks
            .map(
              (t: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td>${htmlEscape(t.task ?? '')}</td>
              <td>${htmlEscape(t.hazards ?? '')}</td>
              <td>${htmlEscape(t.controls ?? '')}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  const tasks = (content.selected_tasks ?? []) as Array<{
    task_name: string;
    category?: string | null;
    hazards?: { name: string; osha_ref?: string }[];
    controls?: { name: string; category?: string }[];
    ppe_required?: string[];
  }>;
  const crew = signatures.filter((s) => !s.is_foreman);
  const emergency = content.emergency as
    | {
        hospital_name?: string | null;
        hospital_address?: string | null;
        assembly_point?: string | null;
        first_aid_location?: string | null;
        contact_name?: string | null;
        contact_phone?: string | null;
      }
    | null
    | undefined;

  const infoRows = [
    ['Date', content.ptp_date],
    ['Shift', content.shift],
    ['Trade', content.trade],
    ['Area', content.area_label],
    ['Foreman', content.foreman_name],
  ]
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(
      ([label, value]) =>
        `<div class="info-row"><div class="info-label">${label}</div><div class="info-value">${htmlEscape(value)}</div></div>`,
    )
    .join('');

  const crewRows = crew
    .map(
      (c, i) =>
        `<tr>
          <td>${i + 1}</td>
          <td>${htmlEscape(c.name)}</td>
          <td>${c.is_walk_in ? '<span class="ppe-tag">Walk-in</span>' : ''}</td>
          <td>${htmlEscape(c.sst_card_number ?? '—')}</td>
        </tr>`,
    )
    .join('');

  const taskRows = tasks
    .map(
      (t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>
          <strong>${htmlEscape(t.task_name)}</strong>
          ${t.category ? `<div style="font-size:8pt;color:#64748B;margin-top:2px;">${htmlEscape(t.category)}</div>` : ''}
        </td>
        <td>${(t.hazards ?? []).map((h) => `• ${htmlEscape(h.name)}`).join('<br>')}</td>
        <td>${(t.controls ?? []).map((c) => `• ${htmlEscape(c.name)}`).join('<br>')}</td>
        <td>${(t.ppe_required ?? []).map((p) => `<span class="ppe-tag">${htmlEscape(p)}</span>`).join(' ')}</td>
      </tr>`,
    )
    .join('');

  const emergencyHtml =
    emergency &&
    (emergency.hospital_name ||
      emergency.assembly_point ||
      emergency.first_aid_location ||
      emergency.contact_name)
      ? `
      <div class="callout">
        <div class="callout-label">Emergency Information</div>
        ${emergency.hospital_name ? `<div><strong>Hospital:</strong> ${htmlEscape(emergency.hospital_name)}${emergency.hospital_address ? ` — ${htmlEscape(emergency.hospital_address)}` : ''}</div>` : ''}
        ${emergency.assembly_point ? `<div style="margin-top:3px;"><strong>Assembly Point:</strong> ${htmlEscape(emergency.assembly_point)}</div>` : ''}
        ${emergency.first_aid_location ? `<div style="margin-top:3px;"><strong>First Aid:</strong> ${htmlEscape(emergency.first_aid_location)}</div>` : ''}
        ${emergency.contact_name ? `<div style="margin-top:3px;"><strong>Contact:</strong> ${htmlEscape(emergency.contact_name)}${emergency.contact_phone ? ` — ${htmlEscape(emergency.contact_phone)}` : ''}</div>` : ''}
      </div>`
      : '';

  return `
    ${infoRows}

    ${
      crew.length > 0
        ? `<div class="section-title">Crew Members (${crew.length})</div>
           <table>
             <thead>
               <tr>
                 <th style="width: 5%">#</th>
                 <th style="width: 45%">Name</th>
                 <th style="width: 20%">Role</th>
                 <th style="width: 30%">SST Card</th>
               </tr>
             </thead>
             <tbody>${crewRows}</tbody>
           </table>`
        : ''
    }

    <div class="section-title">Tasks &amp; Hazard Controls (${tasks.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width: 5%">#</th>
          <th style="width: 23%">Task</th>
          <th style="width: 27%">Hazards</th>
          <th style="width: 25%">Controls</th>
          <th style="width: 20%">PPE Required</th>
        </tr>
      </thead>
      <tbody>${taskRows}</tbody>
    </table>

    ${emergencyHtml}

    ${
      content.additional_notes
        ? `<div class="section-title">Additional Notes</div>
           <div>${htmlEscape(content.additional_notes)}</div>`
        : ''
    }
  `;
}

// ─── Toolbox Talk Body ─────────────────────────────────────
// New wizard stores data in content.topic_snapshot; legacy form stored
// content.topic + content.discussion_points + content.attendance.

function buildToolboxBody(
  content: Record<string, any>,
  signatures: NormalizedSig[],
): string {
  const snap = content.topic_snapshot as
    | {
        title?: string;
        title_es?: string | null;
        why_it_matters?: string;
        why_it_matters_es?: string | null;
        key_points?: string[];
        key_points_es?: string[] | null;
        discussion_questions?: string[];
        discussion_questions_es?: string[] | null;
        osha_ref?: string | null;
        category?: string | null;
        source?: string | null;
      }
    | undefined;

  if (!snap) {
    // Legacy shape
    const points = (content.discussion_points ?? []) as string[];
    const attendance = (content.attendance ?? []) as string[];
    return `
      <div class="info-row"><div class="info-label">Topic</div><div class="info-value" style="font-weight: 700;">${htmlEscape(content.topic ?? '—')}</div></div>

      <div class="section-title">Discussion Points</div>
      <ul class="bullet-list">
        ${points.map((p: string) => `<li>${htmlEscape(p)}</li>`).join('')}
      </ul>

      <div class="section-title">Attendance (${attendance.length})</div>
      <table>
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 60%">Name</th>
            <th style="width: 35%">Present</th>
          </tr>
        </thead>
        <tbody>
          ${attendance
            .map(
              (a: string, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td>${htmlEscape(a)}</td>
              <td style="color: #15803D; font-weight: 700;">Yes</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  const lang = (content.delivered_language as string | undefined) ?? 'en';
  const showEs = lang === 'es' || lang === 'both';
  const title = showEs && snap.title_es ? snap.title_es : snap.title ?? '';
  const why =
    showEs && snap.why_it_matters_es ? snap.why_it_matters_es : snap.why_it_matters ?? '';
  const keyPoints =
    showEs && snap.key_points_es?.length ? snap.key_points_es : snap.key_points ?? [];
  const questions =
    showEs && snap.discussion_questions_es?.length
      ? snap.discussion_questions_es
      : snap.discussion_questions ?? [];

  const attendance = signatures.filter((s) => !s.is_foreman);

  const metaRows = [
    ['Category', snap.category],
    ['Source', snap.source],
    ['OSHA Reference', snap.osha_ref],
    ['Language', lang === 'both' ? 'EN + ES' : lang === 'es' ? 'Español' : 'English'],
    ['Scheduled', content.scheduled_date],
    ['Delivered', content.delivered_date],
    ['Foreman', content.foreman_name],
  ]
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(
      ([label, value]) =>
        `<div class="info-row"><div class="info-label">${label}</div><div class="info-value">${htmlEscape(value)}</div></div>`,
    )
    .join('');

  const attendanceRows = attendance
    .map(
      (a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${htmlEscape(a.name)} ${a.is_walk_in ? '<span class="ppe-tag">Walk-in</span>' : ''}</td>
        <td>${htmlEscape(a.sst_card_number ?? '—')}</td>
        <td style="color: #15803D; font-weight: 700;">Yes</td>
      </tr>`,
    )
    .join('');

  return `
    ${metaRows}

    <div class="section-title">${htmlEscape(title)}</div>

    ${
      why
        ? `<div class="callout">
             <div class="callout-label">Why it matters</div>
             <div>${htmlEscape(why)}</div>
           </div>`
        : ''
    }

    ${
      keyPoints.length > 0
        ? `<div class="section-title">Key Points (${keyPoints.length})</div>
           <ul class="bullet-list">
             ${keyPoints.map((p) => `<li>${htmlEscape(p)}</li>`).join('')}
           </ul>`
        : ''
    }

    ${
      questions.length > 0
        ? `<div class="section-title">Discussion Questions (${questions.length})</div>
           <ul class="bullet-list">
             ${questions.map((q) => `<li>${htmlEscape(q)}</li>`).join('')}
           </ul>`
        : ''
    }

    ${
      attendance.length > 0
        ? `<div class="section-title">Attendance (${attendance.length})</div>
           <table>
             <thead>
               <tr>
                 <th style="width: 5%">#</th>
                 <th style="width: 45%">Name</th>
                 <th style="width: 30%">SST Card</th>
                 <th style="width: 20%">Present</th>
               </tr>
             </thead>
             <tbody>${attendanceRows}</tbody>
           </table>`
        : ''
    }

    ${
      content.discussion_notes
        ? `<div class="section-title">Field Notes</div>
           <div>${htmlEscape(content.discussion_notes)}</div>`
        : ''
    }
  `;
}
