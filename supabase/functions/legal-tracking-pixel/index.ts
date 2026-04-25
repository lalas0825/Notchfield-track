// Sprint 53C — 1×1 tracking pixel for NOD open receipts.
//
// URL: /functions/v1/legal-tracking-pixel/{tracking_token}
// Returns: 1×1 transparent PNG + UPDATEs legal_documents:
//   status='opened', opened_at=now(), receipt_ip=<x-forwarded-for>,
//   receipt_device=<user-agent>
// Idempotent: first read wins (opened_at IS NULL guard).
//
// verify_jwt=false because the email client that loads this pixel doesn't
// have a JWT. Auth is via the tracking_token itself (unguessable UUID).
// Service-role client bypasses RLS to write receipt fields.
//
// Deploy:
//   supabase functions deploy legal-tracking-pixel --no-verify-jwt \
//     --project-ref msmpsxalfalzinuorwlg
//
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// 1×1 transparent PNG (bytes) — inline so we avoid a file dep
const PIXEL = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const token = parts[parts.length - 1]; // last segment

  // Fire-and-forget DB update — do NOT await before returning the pixel,
  // so email clients don't hang. Any failure is logged and dropped.
  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    (async () => {
      try {
        const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';
        const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        if (!SUPA_URL || !SERVICE_KEY) return;

        const client = createClient(SUPA_URL, SERVICE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;
        const device = req.headers.get('user-agent') ?? null;

        await client
          .from('legal_documents')
          .update({
            status: 'opened',
            opened_at: new Date().toISOString(),
            receipt_ip: ip,
            receipt_device: device,
          })
          .eq('tracking_token', token)
          .is('opened_at', null); // first-read-wins
      } catch (e) {
        console.error('[legal-tracking-pixel] update failed', e);
      }
    })();
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Length': String(PIXEL.byteLength),
    },
  });
});
