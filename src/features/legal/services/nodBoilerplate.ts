/**
 * Sprint 53C — NOD boilerplate (hardcoded v1).
 *
 * Assumes NY DOB / NYC Local Law references (the pilot's jurisdiction —
 * Jantile is NYC). Web team will abstract this to a legal_templates table
 * per-jurisdiction post-Sprint 53.
 */

import { formatCentsUsd, type DelayCost } from './costEngine';

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

/** US-format date (MM/DD/YYYY) per Jantile pilot preference. */
export function formatUSDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Full datetime in local TZ — MM/DD/YYYY HH:MM. */
export function formatUSDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()} ${hh}:${min}`;
}

/**
 * Build the body text for a NOD. Single string, paragraph-separated.
 * Used by the HTML renderer; callers render as <p> per line.
 */
export function buildNodBody(params: {
  areaLabel: string;
  blockedAt: string;
  blockedReason: string;
  hoursBlocked: number;
  cost: DelayCost;
  organizationName: string;
  gcName: string;
  projectName: string;
  additionalNotes?: string;
}): string {
  const blockedReadable = formatUSDateTime(params.blockedAt);
  const hours = Math.round(params.hoursBlocked);
  const dayLabel = params.cost.days_lost === 1 ? 'workday' : 'workdays';

  const lines = [
    `NOTICE OF DELAY`,
    ``,
    `Project: ${params.projectName}`,
    `Area Affected: ${params.areaLabel}`,
    `Blocked Since: ${blockedReadable}`,
    `Duration: ${hours} hours (${params.cost.days_lost} ${dayLabel})`,
    ``,
    `REASON FOR DELAY`,
    params.blockedReason,
    ``,
    `CREW IMPACT`,
    `- Crew size impacted: ${params.cost.crew_size} worker${params.cost.crew_size === 1 ? '' : 's'}`,
    `- Average daily labor rate: ${formatCentsUsd(params.cost.daily_rate_cents)}`,
    `- Days lost to date: ${params.cost.days_lost}`,
    `- Total documented impact: ${formatCentsUsd(params.cost.total_cost_cents)}`,
    ``,
    `LEGAL BASIS`,
    `This Notice is issued pursuant to the General Conditions of the contract between ${params.organizationName} (Subcontractor) and ${params.gcName} (General Contractor), and applicable provisions of New York City Local Law and NY DOB Industrial Code Section 23 governing impacted construction work.`,
    ``,
    `ACKNOWLEDGMENT REQUIRED`,
    `Please acknowledge receipt of this Notice within forty-eight (48) hours. Failure to respond will be documented as non-response and may be incorporated into a future Request for Equitable Adjustment (REA).`,
    ``,
    `This document is digitally signed and tamper-evident via SHA-256 hash. Modification after signature is prevented at the database level.`,
  ];

  if (params.additionalNotes?.trim()) {
    lines.push('', 'ADDITIONAL NOTES', params.additionalNotes.trim());
  }

  return lines.join('\n');
}

/**
 * Render NOD body as HTML paragraphs. Sections with ALL-CAPS headers get
 * styled headings; body lines wrap. Escapes input.
 */
export function buildNodHtml(body: string): string {
  const paragraphs = body.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    // Heading heuristic — line is a short ALL-CAPS label
    if (/^[A-Z][A-Z0-9 ]{2,}$/.test(trimmed) && trimmed.length < 60) {
      return `<h3 style="margin:18px 0 6px;font-size:13px;letter-spacing:0.6px;color:#0F172A;">${escapeHtml(trimmed)}</h3>`;
    }
    // Bullet line
    if (trimmed.startsWith('-')) {
      return `<p style="margin:2px 0 2px 16px;font-size:13px;color:#1E293B;line-height:20px;">${escapeHtml(trimmed.slice(1).trim())}</p>`;
    }
    return `<p style="margin:6px 0;font-size:13px;color:#1E293B;line-height:20px;">${escapeHtml(trimmed)}</p>`;
  });
  return paragraphs.filter(Boolean).join('\n');
}
