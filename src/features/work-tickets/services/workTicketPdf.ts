/**
 * Work Ticket PDF — Sprint 45B
 * ================================
 * Uses expo-print + HTML template (NOT jsPDF). Matches Takeoff Web's layout
 * (`src/features/pm/services/workTicketPdfRenderer.ts`).
 *
 * Signature is embedded via `<img src="{public_url}" crossorigin="anonymous" />`.
 * DO NOT fetch + base64 + canvas dance — the signatures bucket is public and
 * returns Access-Control-Allow-Origin: *, so the <img> tag works directly
 * inside the print renderer.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { WorkTicket, DocumentSignature } from '../types';
import { ensureLabor, ensureMaterials } from './work-tickets-service';
import { totalHours } from '../types';

export interface PdfCompanyInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}

export async function generateWorkTicketPdf(
  ticket: WorkTicket,
  signature: DocumentSignature | null,
  projectName: string,
  company: PdfCompanyInfo,
): Promise<string> {
  const html = buildHtml(ticket, signature, projectName, company);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function shareWorkTicketPdf(pdfUri: string, dialogTitle?: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing not available on this device');
  }
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    dialogTitle: dialogTitle ?? 'Share Work Ticket PDF',
    UTI: 'com.adobe.pdf',
  });
}

// ─── HTML template ─────────────────────────────────────────────

function buildHtml(
  ticket: WorkTicket,
  signature: DocumentSignature | null,
  projectName: string,
  company: PdfCompanyInfo,
): string {
  const labor = ensureLabor(ticket.labor);
  const materials = ensureMaterials(ticket.materials);
  const hours = totalHours(labor);

  const laborRows = labor
    .map(
      (l) => `
    <tr>
      <td>${escapeHtml(l.name)}</td>
      <td>${escapeHtml(l.classification)}</td>
      <td>${Number(l.regular_hours).toFixed(1)}</td>
      <td>${Number(l.overtime_hours).toFixed(1)}</td>
      <td>${(Number(l.regular_hours) + Number(l.overtime_hours)).toFixed(1)} hrs</td>
    </tr>
  `,
    )
    .join('');

  const materialRows = materials
    .map(
      (m) => `
    <tr>
      <td>${escapeHtml(m.description)}</td>
      <td>${m.quantity}</td>
      <td>${escapeHtml(m.unit)}</td>
    </tr>
  `,
    )
    .join('');

  const isSigned = signature?.status === 'signed' && !!signature.signature_url;

  const signatureSection = isSigned
    ? `
      <div class="signature">
        <div class="sig-label">AUTHORIZATION SIGNATURE</div>
        <img src="${escapeAttr(signature!.signature_url!)}" crossorigin="anonymous"
             style="height:60px;object-fit:contain;" />
        <div class="signed-by">
          Signed by: ${escapeHtml(signature!.signer_name ?? '—')} (${escapeHtml((signature!.signer_role ?? 'gc').toUpperCase())})
        </div>
        <div class="signed-date">
          Date: ${formatDate(signature!.signed_at)}
        </div>
        ${
          signature!.content_hash
            ? `
          <div class="hash">
            <div class="hash-label">SHA-256 Integrity Hash:</div>
            <div class="hash-value">${escapeHtml(signature!.content_hash)}</div>
          </div>
        `
            : ''
        }
      </div>
    `
    : `
      <div class="signature">
        <div class="sig-label">AUTHORIZATION SIGNATURE</div>
        <div class="blank-lines">
          Authorized by: _______________________________<br/><br/>
          Title: ____________________<br/><br/>
          Date: ____________________ · Signature: ____________________
        </div>
      </div>
    `;

  const locationText = [ticket.floor, ticket.area_description].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 50px; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1d23; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; }
    .company { font-size: 10px; color: #787878; }
    .title { font-size: 22px; font-weight: bold; text-align: right; }
    .title-underline { border-bottom: 3px solid #ff8c00; width: 160px; margin: 6px 0 8px auto; }
    .ticket-number { font-size: 11px; color: #787878; text-align: right; }
    .divider { border-top: 0.5px solid #dcdcdc; margin: 16px 0; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 10px; }
    .meta-label { color: #787878; font-size: 8px; text-transform: uppercase; }
    .meta-value { color: #1a1d23; font-size: 10px; margin-top: 2px; }
    .section-label { font-size: 9px; color: #787878; text-transform: uppercase; margin-bottom: 8px; }
    .description { font-size: 10px; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th { background: #f5f5f5; color: #787878; font-size: 8px; text-align: left; padding: 6px; font-weight: normal; text-transform: uppercase; }
    td { padding: 6px; border-bottom: 0.3px solid #e6e6e6; }
    .total-hours { font-size: 9px; color: #787878; text-align: right; }
    .signature { margin-top: 24px; padding-top: 16px; border-top: 0.5px solid #dcdcdc; }
    .sig-label { font-size: 9px; color: #787878; text-transform: uppercase; margin-bottom: 14px; }
    .signed-by { font-size: 9px; color: #1a1d23; margin-top: 4px; }
    .signed-date { font-size: 9px; color: #1a1d23; margin-top: 2px; }
    .hash { margin-top: 10px; }
    .hash-label { font-size: 7px; color: #787878; }
    .hash-value { font-family: Courier, monospace; font-size: 7px; word-break: break-all; }
    .blank-lines { font-size: 9px; color: #1a1d23; line-height: 1.8; }
    .footer { position: fixed; bottom: 20px; left: 50px; right: 50px; display: flex; justify-content: space-between; font-size: 8px; color: #787878; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${
        company.logoUrl
          ? `<img src="${escapeAttr(company.logoUrl)}" crossorigin="anonymous" style="max-height:50px;max-width:140px;" />`
          : `<div style="font-size:16px;font-weight:bold;">${escapeHtml(company.name)}</div>
             <div class="title-underline" style="margin:6px 0;"></div>`
      }
      ${company.address ? `<div class="company">${escapeHtml(company.address)}</div>` : ''}
      ${company.phone ? `<div class="company">${escapeHtml(company.phone)}</div>` : ''}
    </div>
    <div>
      <div class="title">ORDER FOR ADDITIONAL WORK</div>
      <div class="title-underline"></div>
      ${ticket.number != null ? `<div class="ticket-number">T&amp;M Work Ticket #${ticket.number}</div>` : ''}
    </div>
  </div>

  <div class="divider"></div>

  <div class="meta-grid">
    <div>
      <div class="meta-label">Project</div>
      <div class="meta-value">${escapeHtml(projectName)}</div>
    </div>
    <div>
      <div class="meta-label">Service Date</div>
      <div class="meta-value">${formatDate(ticket.service_date)}</div>
    </div>
    <div>
      <div class="meta-label">Trade</div>
      <div class="meta-value">${escapeHtml(ticket.trade)}</div>
    </div>
    <div>
      <div class="meta-label">Priority</div>
      <div class="meta-value">${ticket.priority === 'urgent' ? '⚠ URGENT' : 'Normal'}</div>
    </div>
    ${
      locationText
        ? `
      <div style="grid-column: 1 / -1;">
        <div class="meta-label">Location</div>
        <div class="meta-value">${escapeHtml(locationText)}</div>
      </div>
    `
        : ''
    }
    ${
      ticket.foreman_name
        ? `
      <div>
        <div class="meta-label">Foreman</div>
        <div class="meta-value">${escapeHtml(ticket.foreman_name)}</div>
      </div>
    `
        : ''
    }
  </div>

  <div class="divider"></div>

  <div class="section-label">Work Description</div>
  <div class="description">${escapeHtml(ticket.work_description)}</div>

  ${
    labor.length > 0
      ? `
    <div style="margin-top:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="section-label">Labor</div>
        <div class="total-hours">Total: ${hours.toFixed(1)} hrs</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Classification</th><th>Reg Hrs</th><th>OT Hrs</th><th>Total</th>
          </tr>
        </thead>
        <tbody>${laborRows}</tbody>
      </table>
    </div>
  `
      : ''
  }

  ${
    materials.length > 0
      ? `
    <div style="margin-top:24px;">
      <div class="section-label">Materials</div>
      <table>
        <thead>
          <tr><th>Description</th><th>Qty</th><th>Unit</th></tr>
        </thead>
        <tbody>${materialRows}</tbody>
      </table>
    </div>
  `
      : ''
  }

  ${
    ticket.gc_notes
      ? `
    <div style="margin-top:24px;">
      <div class="section-label">GC Notes</div>
      <div class="description">${escapeHtml(ticket.gc_notes)}</div>
    </div>
  `
      : ''
  }

  ${signatureSection}

  <div class="footer">
    <div>Powered by NotchField</div>
    <div>Page 1</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return String(s).replace(/"/g, '&quot;');
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}
