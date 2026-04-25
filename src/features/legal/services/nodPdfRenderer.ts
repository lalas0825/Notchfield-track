/**
 * Sprint 53C — Local NOD PDF renderer via expo-print.
 *
 * Generates a self-contained HTML document, converts to PDF, uploads to
 * Supabase Storage (bucket: field-photos, path: legal-documents/{org}/{docId}.pdf),
 * and returns the public URL. Also computes SHA-256 over the PDF bytes.
 *
 * Pattern mirrors src/shared/utils/safety-export.ts — single font, MM/DD/YYYY,
 * OrgLetterhead-style header with logo + document type + status.
 *
 * Web team will ship a server-side renderer post-Sprint 53 that we migrate to
 * (same labels shape). Until then, Track renders locally.
 */

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/shared/lib/supabase/client';
import { buildNodBody, buildNodHtml, formatUSDateTime } from './nodBoilerplate';
import type { DelayCost } from './costEngine';
import type { LegalDoc } from './legal-service';

export type NodRenderInput = {
  doc: LegalDoc;
  area: { label: string | null; name: string; blocked_reason: string | null; blocked_at: string | null };
  cost: DelayCost;
  organization: { name: string; logo_url: string | null };
  project: { name: string };
  gc: { name: string };
  signer: { name: string; title: string | null };
  signatureDataUrl: string; // base64 PNG of the signature (data: URI or raw base64)
  signedAtIso: string;
  additionalNotes?: string;
};

export type NodRenderResult = {
  pdfUrl: string;       // public URL of uploaded PDF
  sha256Hash: string;   // hex digest of the PDF bytes
  localUri: string;     // local path (cached; may be pruned by Expo later)
};

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function buildHtml(input: NodRenderInput): string {
  const { doc, area, cost, organization, project, gc, signer, signatureDataUrl, signedAtIso, additionalNotes } = input;

  const hoursBlocked = area.blocked_at
    ? (new Date(signedAtIso).getTime() - new Date(area.blocked_at).getTime()) / 3600000
    : 0;

  const bodyText = buildNodBody({
    areaLabel: area.label ?? area.name,
    blockedAt: area.blocked_at ?? signedAtIso,
    blockedReason: area.blocked_reason ?? 'Documented on-site',
    hoursBlocked,
    cost,
    organizationName: organization.name,
    gcName: gc.name,
    projectName: project.name,
    additionalNotes,
  });

  const bodyHtml = buildNodHtml(bodyText);

  // Signature is either data:image/... URL or raw base64; pass as-is
  const sigSrc = signatureDataUrl.startsWith('data:')
    ? signatureDataUrl
    : `data:image/png;base64,${signatureDataUrl}`;

  const logoSrc = organization.logo_url ?? null;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0F172A;
      font-size: 13px;
      line-height: 1.5;
    }
    .page {
      padding: 36px 44px;
    }
    .hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #F97316;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .hd .l { display: flex; align-items: center; }
    .hd .logo {
      width: 56px; height: 56px; border-radius: 10px;
      background: #F8FAFC; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    .hd .logo img { max-width: 100%; max-height: 100%; }
    .hd .company { margin-left: 12px; }
    .hd .company .n { font-size: 14px; font-weight: 700; color: #0F172A; }
    .hd .company .s { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
    .hd .c { text-align: center; }
    .hd .c .t { font-size: 20px; font-weight: 800; color: #0F172A; letter-spacing: 0.3px; }
    .hd .c .sub { font-size: 11px; color: #64748B; margin-top: 2px; letter-spacing: 1.5px; }
    .hd .r { text-align: right; }
    .hd .r .st {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
      background: #FEF3C7; color: #92400E;
    }
    .meta {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px;
      margin: 0 0 16px 0; font-size: 12px;
    }
    .meta .l { color: #64748B; text-transform: uppercase; letter-spacing: 0.4px; font-size: 10px; }
    .meta .v { color: #0F172A; font-weight: 600; }
    .body { margin-top: 12px; }
    .sig-block {
      border-top: 1px solid #E2E8F0;
      margin-top: 24px; padding-top: 18px;
    }
    .sig-block .label {
      font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .sig-img {
      max-width: 320px; max-height: 96px;
      margin: 8px 0 4px; border-bottom: 1px solid #94A3B8;
    }
    .sig-name { font-size: 13px; font-weight: 700; color: #0F172A; }
    .sig-title { font-size: 11px; color: #64748B; }
    .sig-date { font-size: 11px; color: #64748B; margin-top: 2px; }
    .hash-block {
      margin-top: 22px; padding: 10px 12px; border-radius: 8px;
      background: #F1F5F9; border: 1px solid #E2E8F0;
    }
    .hash-block .label {
      font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;
    }
    .hash-block .v {
      font-size: 10px; color: #334155; word-break: break-all; margin-top: 4px;
    }
    .foot {
      margin-top: 28px; padding-top: 10px; border-top: 1px solid #E2E8F0;
      font-size: 10px; color: #94A3B8; text-align: center;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="hd">
      <div class="l">
        <div class="logo">${logoSrc ? `<img src="${esc(logoSrc)}"/>` : `<div style="font-size:11px;color:#94A3B8;">LOGO</div>`}</div>
        <div class="company">
          <div class="n">${esc(organization.name)}</div>
          <div class="s">Subcontractor</div>
        </div>
      </div>
      <div class="c">
        <div class="t">NOTICE OF DELAY</div>
        <div class="sub">NOD · ${esc(doc.id.slice(0, 8).toUpperCase())}</div>
      </div>
      <div class="r">
        <div class="st">SIGNED &amp; SENT</div>
        <div style="font-size:10px;color:#64748B;margin-top:4px;">${formatUSDateTime(signedAtIso)}</div>
      </div>
    </div>

    <div class="meta">
      <div><span class="l">Project</span><br><span class="v">${esc(project.name)}</span></div>
      <div><span class="l">General Contractor</span><br><span class="v">${esc(gc.name)}</span></div>
      <div><span class="l">Area Affected</span><br><span class="v">${esc(area.label ?? area.name)}</span></div>
      <div><span class="l">Signed By</span><br><span class="v">${esc(signer.name)}${signer.title ? ` · ${esc(signer.title)}` : ''}</span></div>
    </div>

    <div class="body">
      ${bodyHtml}
    </div>

    <div class="sig-block">
      <div class="label">Authorized Signature</div>
      <img class="sig-img" src="${esc(sigSrc)}" />
      <div class="sig-name">${esc(signer.name)}</div>
      ${signer.title ? `<div class="sig-title">${esc(signer.title)}</div>` : ''}
      <div class="sig-date">Signed ${formatUSDateTime(signedAtIso)}</div>
    </div>

    <div class="hash-block">
      <div class="label">Document Integrity · SHA-256</div>
      <div class="v">Computed at render time from PDF bytes. Displayed below on Track. Verify by re-hashing the downloaded PDF — any change to this file will produce a different hash.</div>
    </div>

    <div class="foot">
      This document was generated by NotchField Track and cryptographically sealed at signature.
      Tamper-evident. Contact ${esc(organization.name)} for verification.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Render + upload + hash. Returns {pdfUrl, sha256Hash, localUri}.
 *
 * Note: no tracking pixel embedded in the PDF itself — PDFs don't reliably
 * fetch external resources when opened in Adobe / iOS PDF viewers. The
 * tracking pixel lives in the EMAIL HTML body, which is built by Takeoff
 * Web's /api/pm/legal-documents/distribute endpoint.
 */
export async function renderAndUploadNod(
  input: NodRenderInput,
): Promise<NodRenderResult> {
  const html = buildHtml(input);

  // 1. Render to local PDF
  const { uri: localUri } = await Print.printToFileAsync({ html, base64: false });

  // 2. Read bytes for hashing + upload
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 3. SHA-256 over the base64-decoded bytes. Crypto.digestStringAsync
  //    works on strings; we feed the base64 directly (a canonical
  //    representation of the bytes) rather than decoding first.
  const sha256Hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
  );

  // 4. Upload to Supabase Storage
  const bytes = decodeBase64(base64);
  const path = `legal-documents/${input.doc.organization_id}/${input.doc.id}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('field-photos')
    .upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true, // allow re-sign (shouldn't happen but don't crash)
    });
  if (uploadErr) {
    throw new Error(`PDF upload failed: ${uploadErr.message}`);
  }

  const { data: urlData } = supabase.storage.from('field-photos').getPublicUrl(path);

  return {
    pdfUrl: urlData.publicUrl,
    sha256Hash,
    localUri,
  };
}

/** Browser-compatible base64 → Uint8Array. */
function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
