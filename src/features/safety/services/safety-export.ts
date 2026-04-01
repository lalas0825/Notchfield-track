/**
 * Safety Document PDF Export
 * ===========================
 * Generates professional PDF from safety doc data (JHA/PTP/Toolbox).
 * Uses expo-print (HTML → PDF) + expo-sharing (Share Sheet).
 *
 * 100% offline: reads from local data, no internet required.
 * Includes SHA-256 hash for document integrity verification.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import type { SafetyDocRow } from '../hooks/useSafetyDocs';
import type { SignatureEntry } from '../types/schemas';

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

/**
 * Export a safety document as PDF and open the share sheet.
 */
export async function exportSafetyDoc(
  doc: SafetyDocRow,
  projectName: string,
  orgName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const content = doc.content as Record<string, any>;
    const signatures = (doc.signatures ?? []) as SignatureEntry[];
    const docTypeTitle = DOC_TYPE_TITLES[doc.doc_type] ?? doc.doc_type;

    // Generate SHA-256 hash for integrity
    const hashInput = JSON.stringify({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      created_at: doc.created_at,
      signatures: signatures.map((s) => ({ name: s.signer_name, signed_at: s.signed_at })),
    });
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      hashInput,
    );

    // Build HTML
    const html = buildHtml({
      docTypeTitle,
      title: doc.title,
      number: doc.number,
      projectName,
      orgName,
      date: new Date(doc.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),
      content,
      docType: doc.doc_type,
      signatures,
      hash,
      status: doc.status,
    });

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html,
      width: 612, // Letter width in points
      height: 792, // Letter height
    });

    // Share
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
    console.error('[SafetyExport] Failed:', err?.message);
    return { success: false, error: err?.message ?? 'Failed to generate PDF' };
  }
}

// ─── HTML Template Builder ────────────────────────────────

function buildHtml(params: {
  docTypeTitle: string;
  title: string;
  number: number;
  projectName: string;
  orgName: string;
  date: string;
  content: Record<string, any>;
  docType: string;
  signatures: SignatureEntry[];
  hash: string;
  status: string;
}): string {
  const { docTypeTitle, title, number, projectName, orgName, date, content, docType, signatures, hash, status } = params;

  let bodyContent = '';
  if (docType === 'jha') {
    bodyContent = buildJhaBody(content);
  } else if (docType === 'ptp') {
    bodyContent = buildPtpBody(content);
  } else {
    bodyContent = buildToolboxBody(content);
  }

  const signatureHtml = signatures.map((sig) => `
    <div class="signature-block">
      <div class="sig-line">
        ${sig.signature_data && sig.signature_data.startsWith('data:')
          ? `<img src="${sig.signature_data}" class="sig-image" />`
          : '<div class="sig-placeholder">Signed digitally</div>'
        }
      </div>
      <div class="sig-name">${sig.signer_name}</div>
      <div class="sig-date">${new Date(sig.signed_at).toLocaleString()}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { margin: 48px; size: letter; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; color: #1E293B; line-height: 1.5; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #F97316; padding-bottom: 16px; margin-bottom: 24px; }
    .header-left { flex: 1; }
    .header-right { text-align: right; }
    .logo-text { font-size: 22pt; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; }
    .logo-accent { color: #F97316; }
    .logo-sub { font-size: 9pt; color: #94A3B8; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
    .doc-type { font-size: 14pt; font-weight: 700; color: #F97316; margin-top: 4px; }
    .doc-number { font-size: 9pt; color: #64748B; }
    .meta-label { font-size: 8pt; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; }
    .meta-value { font-size: 10pt; color: #0F172A; font-weight: 600; }

    /* Status badge */
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .status-active { background: #DCFCE7; color: #16A34A; }
    .status-draft { background: #FEF3C7; color: #D97706; }
    .status-closed { background: #F1F5F9; color: #64748B; }

    /* Content */
    .section-title { font-size: 11pt; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin: 20px 0 12px 0; }
    .info-row { display: flex; margin-bottom: 6px; }
    .info-label { width: 120px; font-size: 9pt; color: #64748B; font-weight: 600; }
    .info-value { flex: 1; font-size: 10pt; color: #0F172A; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 8px 0 16px 0; }
    th { background: #0F172A; color: white; text-align: left; padding: 8px 10px; font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px 10px; font-size: 10pt; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
    tr:nth-child(even) td { background: #F8FAFC; }

    /* Risk badges */
    .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; text-transform: uppercase; color: white; }

    /* PPE tags */
    .ppe-tag { display: inline-block; padding: 2px 6px; margin: 2px; border-radius: 3px; font-size: 8pt; background: #F1F5F9; color: #475569; }

    /* Bullet list */
    .bullet-list { padding-left: 20px; margin: 8px 0; }
    .bullet-list li { margin-bottom: 4px; font-size: 10pt; }

    /* Signatures */
    .signatures { margin-top: 32px; display: flex; gap: 40px; }
    .signature-block { flex: 1; }
    .sig-line { border-bottom: 1px solid #0F172A; height: 60px; margin-bottom: 4px; display: flex; align-items: flex-end; }
    .sig-image { max-height: 56px; max-width: 200px; object-fit: contain; }
    .sig-placeholder { font-size: 9pt; color: #94A3B8; font-style: italic; padding-bottom: 4px; }
    .sig-name { font-size: 10pt; font-weight: 700; color: #0F172A; }
    .sig-date { font-size: 8pt; color: #64748B; }

    /* Footer */
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-left { }
    .footer-right { text-align: right; }
    .hash-label { font-size: 7pt; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; }
    .hash-value { font-size: 7pt; color: #64748B; font-family: 'Courier New', monospace; word-break: break-all; max-width: 300px; }
    .watermark { font-size: 7pt; color: #CBD5E1; letter-spacing: 2px; text-transform: uppercase; }
    .generated { font-size: 7pt; color: #94A3B8; margin-top: 4px; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .header { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="logo-text">Notch<span class="logo-accent">Field</span></div>
      <div class="logo-sub">T R A C K</div>
      <div class="doc-type">${docTypeTitle}</div>
      <div class="doc-number">#${number}</div>
    </div>
    <div class="header-right">
      <div class="meta-label">Project</div>
      <div class="meta-value">${projectName}</div>
      <div style="margin-top: 8px;"><span class="meta-label">Company</span></div>
      <div class="meta-value">${orgName}</div>
      <div style="margin-top: 8px;"><span class="meta-label">Date</span></div>
      <div class="meta-value">${date}</div>
      <div style="margin-top: 8px;">
        <span class="status-badge status-${status}">${status}</span>
      </div>
    </div>
  </div>

  <!-- Title -->
  <h1 style="font-size: 16pt; color: #0F172A; margin-bottom: 16px;">${title}</h1>

  <!-- Body content (type-specific) -->
  ${bodyContent}

  <!-- Signatures -->
  ${signatures.length > 0 ? `
    <div class="section-title">Signatures</div>
    <div class="signatures">
      ${signatureHtml}
    </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <div class="watermark">GENERATED BY NOTCHFIELD TRACK</div>
      <div class="generated">This document was digitally created and signed using NotchField Track field operations software.</div>
    </div>
    <div class="footer-right">
      <div class="hash-label">Document Integrity Hash (SHA-256)</div>
      <div class="hash-value">${hash}</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── JHA Body ──────────────────────────────────

function buildJhaBody(content: Record<string, any>): string {
  const hazards = (content.hazards ?? []) as any[];

  return `
    <div class="info-row"><div class="info-label">Location</div><div class="info-value">${content.location ?? '—'}</div></div>
    <div class="info-row"><div class="info-label">Weather</div><div class="info-value">${content.weather ?? '—'}</div></div>

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
        ${hazards.map((h: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td>${h.description ?? ''}</td>
            <td><span class="risk-badge" style="background: ${RISK_COLORS[h.risk_level] ?? '#94A3B8'}">${(h.risk_level ?? '').toUpperCase()}</span></td>
            <td>${h.controls ?? ''}</td>
            <td>${(h.ppe ?? []).map((p: string) => `<span class="ppe-tag">${p}</span>`).join(' ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ─── PTP Body ──────────────────────────────────

function buildPtpBody(content: Record<string, any>): string {
  const tasks = (content.tasks ?? []) as any[];
  const crew = (content.crew_members ?? []) as string[];

  return `
    <div class="info-row"><div class="info-label">Location</div><div class="info-value">${content.location ?? '—'}</div></div>

    <div class="section-title">Crew Members (${crew.length})</div>
    <ul class="bullet-list">
      ${crew.map((m: string) => `<li>${m}</li>`).join('')}
    </ul>

    <div class="section-title">Tasks & Hazard Controls (${tasks.length})</div>
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
        ${tasks.map((t: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td>${t.task ?? ''}</td>
            <td>${t.hazards ?? ''}</td>
            <td>${t.controls ?? ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ─── Toolbox Talk Body ─────────────────────────

function buildToolboxBody(content: Record<string, any>): string {
  const points = (content.discussion_points ?? []) as string[];
  const attendance = (content.attendance ?? []) as string[];

  return `
    <div class="info-row"><div class="info-label">Topic</div><div class="info-value" style="font-weight: 700;">${content.topic ?? '—'}</div></div>

    <div class="section-title">Discussion Points</div>
    <ul class="bullet-list">
      ${points.map((p: string) => `<li>${p}</li>`).join('')}
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
        ${attendance.map((a: string, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td>${a}</td>
            <td style="color: #16A34A; font-weight: 700;">✓</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
