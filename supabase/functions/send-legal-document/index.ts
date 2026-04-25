// Sprint 53C — Send NOD / REA email with tracking pixel.
//
// Called by Track from NodSignModal after the PDF is rendered and uploaded.
// Responsibilities:
//   1. Generate tracking_token (UUID) for open-receipt pixel
//   2. Send email via Resend with PDF attachment (fetched from the URL Track
//      uploaded). Embed tracking pixel URL in the HTML body.
//   3. Return { tracking_token, sent_at } so Track can finish the DB transaction
//      (applySignAndSend).
//
// DOES NOT write to legal_documents. Track owns that (single-point-of-truth
// for the sign+send transaction). If the DB update fails on Track's side, the
// email is already sent, but a retry will re-send — idempotency is handled
// by the client-side queue check on pdf_url + status.
//
// Env:
//   SUPABASE_URL                (auto)
//   SUPABASE_SERVICE_ROLE_KEY   (auto) — used only if we need to re-read doc later
//   RESEND_API_KEY              (manual) — must be set in Supabase function secrets
//   LEGAL_FROM_EMAIL            (manual, optional) — defaults to noreply@notchfield.com
//
// Security:
//   verify_jwt=true. Track calls this function with the supervisor's session
//   bearer token, so RLS isn't bypassed. Service role key only used for the
//   Storage download (which needs to fetch via signed URL or bucket-read).
//
// Deploy:
//   supabase functions deploy send-legal-document --project-ref msmpsxalfalzinuorwlg
//   supabase secrets set RESEND_API_KEY=<key>
//
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const FROM_EMAIL = Deno.env.get('LEGAL_FROM_EMAIL') ?? 'noreply@notchfield.com';

type RequestBody = {
  docId: string;
  organizationId: string;
  recipientEmail: string;
  recipientName?: string;
  senderName: string;
  projectName: string;
  gcCompany: string;
  pdfUrl: string;        // public URL to the uploaded PDF
  areaLabel: string;
  trackingTokenHint?: string; // client can propose a token; we generate if missing
};

type ResponseBody = {
  success: boolean;
  sent_at?: string;
  tracking_token?: string;
  error?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) {
    return json({ success: false, error: 'RESEND_API_KEY not configured' }, 500);
  }

  const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'invalid JSON' }, 400);
  }

  const required = ['docId', 'organizationId', 'recipientEmail', 'senderName', 'projectName', 'gcCompany', 'pdfUrl', 'areaLabel'] as const;
  for (const k of required) {
    if (!(body as any)[k]) return json({ success: false, error: `missing field: ${k}` }, 400);
  }

  // Tracking token — UUID the client embedded in their PDF, or a new one
  const trackingToken = body.trackingTokenHint && /^[0-9a-f-]{36}$/i.test(body.trackingTokenHint)
    ? body.trackingTokenHint
    : crypto.randomUUID();

  const pixelUrl = `${SUPA_URL}/functions/v1/legal-tracking-pixel/${trackingToken}`;

  // Fetch the PDF bytes from the public URL
  let pdfBase64: string;
  try {
    const pdfRes = await fetch(body.pdfUrl);
    if (!pdfRes.ok) throw new Error(`PDF fetch ${pdfRes.status}`);
    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    // Base64 encode for Resend attachments
    pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
  } catch (e) {
    return json({ success: false, error: `PDF fetch failed: ${e instanceof Error ? e.message : 'unknown'}` }, 502);
  }

  const subject = `Notice of Delay — ${body.projectName}`;
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0F172A;">
  <div style="border-bottom:2px solid #F97316;padding-bottom:10px;margin-bottom:18px;">
    <div style="font-size:12px;letter-spacing:1.2px;color:#64748B;text-transform:uppercase;">Notice of Delay</div>
    <div style="font-size:20px;font-weight:700;margin-top:2px;">${escapeHtml(body.projectName)}</div>
  </div>
  <p style="font-size:14px;line-height:22px;color:#1E293B;">
    Dear ${escapeHtml(body.gcCompany)},
  </p>
  <p style="font-size:14px;line-height:22px;color:#1E293B;">
    Please find attached a Notice of Delay regarding ongoing work at
    <strong>${escapeHtml(body.areaLabel)}</strong> on the <strong>${escapeHtml(body.projectName)}</strong> project.
  </p>
  <p style="font-size:14px;line-height:22px;color:#1E293B;">
    Per the General Conditions of our contract, please acknowledge receipt within
    <strong>48 hours</strong>. Failure to respond will be documented as non-response
    and may form the basis of a future Request for Equitable Adjustment.
  </p>
  <p style="font-size:14px;line-height:22px;color:#1E293B;">
    Sincerely,<br/>
    <strong>${escapeHtml(body.senderName)}</strong>
  </p>
  <div style="font-size:11px;color:#94A3B8;margin-top:24px;border-top:1px solid #E2E8F0;padding-top:10px;">
    This notice is digitally signed and tamper-evident via SHA-256 hash.
    Attached PDF is the authoritative record.
  </div>
  <img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:block;"/>
</div>`;

  // Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${body.senderName} <${FROM_EMAIL}>`,
      to: [body.recipientEmail],
      subject,
      html,
      attachments: [
        {
          filename: `NOD-${body.projectName.replace(/[^a-z0-9]+/gi, '-')}.pdf`,
          content: pdfBase64,
        },
      ],
      headers: {
        'X-NotchField-Doc-Id': body.docId,
        'X-NotchField-Tracking-Token': trackingToken,
      },
    }),
  });

  if (!resendRes.ok) {
    const text = await resendRes.text();
    console.error('resend failure', resendRes.status, text);
    return json({ success: false, error: `email send failed: ${resendRes.status}` }, 502);
  }

  const sentAt = new Date().toISOString();
  const response: ResponseBody = { success: true, sent_at: sentAt, tracking_token: trackingToken };
  return json(response, 200);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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
