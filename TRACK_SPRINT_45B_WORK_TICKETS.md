# SPRINT TRACK 45B — Work Tickets (Native App)
# MODEL: /model claude-opus-4-6
# Repo: notchfield-track (NOT notchfield-takeoff — this is the native Expo app)
# Priority: BEFORE PILOT — foremen and supervisors write tickets from the field

---

## Context

Read CLAUDE.md (Track repo) before starting.

**Database is SHARED with Takeoff Web.** Both apps read/write the same Supabase
tables. Work tickets created in Track appear instantly in Takeoff Web's PM
dashboard, and vice versa. No sync layer between apps — both talk to Supabase
directly.

**Critical reference:** Takeoff Web has the complete work ticket system already
working end-to-end. Before implementing anything, read these files in the
notchfield-takeoff repo (ask the user to paste them if you can't access):

1. `FIXES_WORK_TICKET_SIGNATURES.md` — full debugging report of a bug we just
   fixed. The lessons here are CRITICAL. Follow them or you will repeat the
   bug in Track.
2. `src/features/pm/services/workTicketPdfRenderer.ts` — PDF layout reference
3. `src/app/api/sign/[token]/route.ts` — sign endpoint (Track can reuse this
   via its public URL)
4. `src/shared/types/documents.ts` — shared types (TmWorkTicket, LaborEntry,
   MaterialEntry, DocumentSignature, SignerRole, SignatureStatus)

**Critical discovery from today's debugging:**
The `signatures` storage bucket upload policy previously required
`auth.role() = 'authenticated'`. The public sign route uses the anon client,
so every upload silently failed. We fixed it by dropping the auth check on the
INSERT policy (matching Jantile Tracker's proven approach). Track MUST follow
this rule too: signatures are secured by the one-time token at the app layer,
not by storage RLS.

**Architecture rule:** In Track, the foreman and supervisor are the PRIMARY
creators of work tickets. This is more important than the Takeoff Web side —
web is read/manage, Track is write/create/sign.

---

## PART 0: Database (already exists — DO NOT recreate)

These tables exist in Supabase. Track just inserts/selects/updates rows.
DO NOT run migrations for these — they're shared.

```sql
-- work_tickets (SERIAL number, project-scoped)
-- Columns used by Track:
--   id, organization_id, project_id, number (auto), service_date,
--   trade, area, area_description, floor, foreman_name, foreman_id,
--   priority ('normal'|'urgent'), work_description,
--   labor JSONB (LaborEntry[]),
--   materials JSONB (MaterialEntry[]),
--   gc_notes, status ('draft'|'pending'|'signed'|'declined'),
--   created_at, updated_at, created_by

-- document_signatures (one row per ticket that's been sent for signature)
-- Columns used by Track:
--   id, organization_id, document_type ('work_ticket'),
--   document_id (FK to work_tickets.id), project_id,
--   signer_name, signer_email, signer_role, signature_url (storage URL),
--   status ('pending'|'signed'|'declined'), token (UUID — public signing link),
--   content_hash, hash_algorithm ('SHA-256'), hashed_at,
--   ip_address, user_agent, signed_at, created_at
```

**Storage bucket:** `signatures` — PUBLIC, upload allowed for anon + authenticated.
File path convention: `{organization_id}/{token}.png`. DO NOT invent a new path.
Takeoff Web uses this convention and if Track uses a different one, signatures
won't load cross-app.

---

## PART 1: Shared Zod Schemas

Create or update `src/features/workTickets/schemas.ts` with schemas that
MIRROR Takeoff Web's types exactly. Same field names, same types, same enums.

```typescript
import { z } from 'zod';

export const LaborEntrySchema = z.object({
  name: z.string(),
  classification: z.enum(['Mechanic', 'Helper', 'Apprentice', 'Foreman']),
  regular_hours: z.number().min(0),
  overtime_hours: z.number().min(0),
});

export const MaterialEntrySchema = z.object({
  description: z.string(),
  quantity: z.number().min(0),
  unit: z.string(),
});

export const WorkTicketPrioritySchema = z.enum(['normal', 'urgent']);
export const WorkTicketStatusSchema = z.enum(['draft', 'pending', 'signed', 'declined']);

export const WorkTicketSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  project_id: z.string().uuid(),
  number: z.number().int().nullable(),
  service_date: z.string().nullable(),
  trade: z.string(),
  area: z.string().nullable(),
  area_description: z.string().nullable(),
  floor: z.string().nullable(),
  foreman_name: z.string().nullable(),
  foreman_id: z.string().uuid().nullable(),
  priority: WorkTicketPrioritySchema.default('normal'),
  work_description: z.string(),
  labor: z.array(LaborEntrySchema).default([]),
  materials: z.array(MaterialEntrySchema).default([]),
  gc_notes: z.string().nullable(),
  status: WorkTicketStatusSchema.default('draft'),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable(),
});

export type LaborEntry = z.infer<typeof LaborEntrySchema>;
export type MaterialEntry = z.infer<typeof MaterialEntrySchema>;
export type WorkTicket = z.infer<typeof WorkTicketSchema>;

export const DocumentSignatureSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  document_type: z.enum(['work_ticket', 'jha', 'ptp', 'toolbox', 'signoff']),
  document_id: z.string().uuid(),
  project_id: z.string().uuid(),
  signer_name: z.string(),
  signer_email: z.string().nullable(),
  signer_role: z.enum(['gc', 'supervisor', 'foreman', 'pm', 'worker']),
  signature_url: z.string().nullable(),
  status: z.enum(['pending', 'signed', 'declined']),
  token: z.string().uuid(),
  content_hash: z.string().nullable(),
  hash_algorithm: z.string().nullable(),
  hashed_at: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  signed_at: z.string().nullable(),
  created_at: z.string(),
});

export type DocumentSignature = z.infer<typeof DocumentSignatureSchema>;
```

---

## PART 2: workTicketService.ts

**Location:** `src/features/workTickets/services/workTicketService.ts`

**Critical rule:** ALL operations go through the direct Supabase client. NEVER
use PowerSync for `document_signatures` or signature upload. PowerSync delay
breaks signing flows (lesson from Jantile Tracker's CLAUDE.md).

For `work_tickets` CRUD: PowerSync is OK (drafts can be created offline and
sync later). For anything touching `document_signatures` or the `signatures`
bucket: MUST be online + direct Supabase.

```typescript
import { supabase } from '@/lib/supabase'; // direct client
import { WorkTicket, LaborEntry, MaterialEntry, DocumentSignature } from '../schemas';

export const workTicketService = {
  // Create a new ticket (draft)
  async create(params: {
    organization_id: string;
    project_id: string;
    trade: string;
    service_date: string;
    foreman_name: string;
    foreman_id: string;
    area?: string;
    area_description?: string;
    floor?: string;
    priority: 'normal' | 'urgent';
    work_description: string;
    labor: LaborEntry[];
    materials: MaterialEntry[];
  }): Promise<WorkTicket> {
    const { data, error } = await supabase
      .from('work_tickets')
      .insert({ ...params, status: 'draft' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<WorkTicket>): Promise<WorkTicket> {
    const { data, error } = await supabase
      .from('work_tickets')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listByProject(projectId: string): Promise<WorkTicket[]> {
    const { data, error } = await supabase
      .from('work_tickets')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<WorkTicket | null> {
    const { data, error } = await supabase
      .from('work_tickets')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async deleteDraft(id: string): Promise<void> {
    const { error } = await supabase
      .from('work_tickets')
      .delete()
      .eq('id', id)
      .eq('status', 'draft'); // safety: can only delete drafts
    if (error) throw error;
  },

  // Signatures
  async getSignature(ticketId: string): Promise<DocumentSignature | null> {
    const { data, error } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('document_type', 'work_ticket')
      .eq('document_id', ticketId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Create a pending signature request (used for BOTH in-app signing and link share)
  async createSignatureRequest(params: {
    ticketId: string;
    organization_id: string;
    project_id: string;
    signerName: string;
    signerRole: 'gc' | 'pm';
  }): Promise<DocumentSignature> {
    const { data, error } = await supabase
      .from('document_signatures')
      .insert({
        document_type: 'work_ticket',
        document_id: params.ticketId,
        organization_id: params.organization_id,
        project_id: params.project_id,
        signer_name: params.signerName,
        signer_role: params.signerRole,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;

    // Update ticket status to pending
    await supabase
      .from('work_tickets')
      .update({ status: 'pending' })
      .eq('id', params.ticketId);

    return data;
  },

  // In-app signing flow (GC signs on the foreman's phone)
  async signInApp(params: {
    signatureId: string;
    token: string;
    organizationId: string;
    signerName: string;
    signerTitle: string;
    signatureDataUrl: string; // base64 PNG from SignaturePad
    gcNotes?: string;
  }): Promise<void> {
    const { signatureId, token, organizationId, signerName, signerTitle,
            signatureDataUrl, gcNotes } = params;

    // 1. Decode base64 → bytes
    const base64 = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    // 2. Upload to storage — path convention MUST match Takeoff Web:
    //    `{org_id}/{token}.png` in the `signatures` bucket
    const filePath = `${organizationId}/${token}.png`;
    const { error: uploadErr } = await supabase.storage
      .from('signatures')
      .upload(filePath, bytes, { contentType: 'image/png', upsert: true });

    if (uploadErr) {
      console.error('[workTicketService] signature upload failed', uploadErr);
      throw new Error(`Signature upload failed: ${uploadErr.message}`);
    }

    // 3. Get public URL
    const { data: urlData } = supabase.storage
      .from('signatures')
      .getPublicUrl(filePath);

    // 4. Compute SHA-256 hash of the signed payload (for integrity)
    const payload = JSON.stringify({
      signatureId, signerName, signerTitle, signedAt: new Date().toISOString()
    });
    const contentHash = await sha256(payload);

    // 5. Update document_signatures
    const { error: sigErr } = await supabase
      .from('document_signatures')
      .update({
        status: 'signed',
        signature_url: urlData.publicUrl,
        signed_at: new Date().toISOString(),
        signer_name: signerTitle ? `${signerName} — ${signerTitle}` : signerName,
        content_hash: contentHash,
        hash_algorithm: 'SHA-256',
        hashed_at: new Date().toISOString(),
        ip_address: null, // Track doesn't have IP — skip
        user_agent: 'NotchField Track (iOS/Android)',
      })
      .eq('id', signatureId);

    if (sigErr) throw sigErr;

    // 6. Update parent ticket: status + gc_notes
    const { data: sig } = await supabase
      .from('document_signatures')
      .select('document_id')
      .eq('id', signatureId)
      .single();

    if (sig) {
      const ticketUpdate: Record<string, unknown> = { status: 'signed' };
      if (gcNotes) ticketUpdate.gc_notes = gcNotes;
      await supabase.from('work_tickets').update(ticketUpdate).eq('id', sig.document_id);
    }
  },

  // Link share mode — just returns the URL to share
  getSigningUrl(token: string): string {
    const baseUrl = process.env.EXPO_PUBLIC_APP_URL ?? 'https://notch-field-takeoff.vercel.app';
    return `${baseUrl}/sign/${token}`;
  },
};

// Helper: SHA-256 using expo-crypto
async function sha256(input: string): Promise<string> {
  const Crypto = require('expo-crypto');
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
}
```

---

## PART 3: Screens

### 3.1 WorkTicketListScreen
**Location:** `src/features/workTickets/screens/WorkTicketListScreen.tsx`

```
┌─────────────────────────────────────┐
│ ← Work Tickets                      │
├─────────────────────────────────────┤
│ 🔍 Search...                        │
│ [All] [Draft] [Pending] [Signed]    │
├─────────────────────────────────────┤
│ #1005 · Tile                  🟡   │
│ 200 Hamilton · Floor 3              │
│ April 10, 2026 · 8.0 hrs            │
│ Draft                               │
├─────────────────────────────────────┤
│ #1004 · Tile                  🟢   │
│ 200 Hamilton · Floor 2              │
│ April 9, 2026 · 16.0 hrs            │
│ Signed by John Doe                  │
├─────────────────────────────────────┤
│ #1003 · Tile                  🟠   │
│ 200 Hamilton · Lobby                │
│ April 9, 2026 · 6.0 hrs             │
│ Pending signature                   │
└─────────────────────────────────────┘
                              [ + ]
```

Features:
- Filter chips: All / Draft / Pending / Signed
- Search by ticket number or work description
- Each row: number, trade, location, date, total hours, status badge
- FAB "+" button (bottom-right) → opens WorkTicketFormScreen
- Realtime subscription: `supabase.channel('work_tickets').on('postgres_changes', ...)` to auto-refresh
- Pull to refresh

### 3.2 WorkTicketFormScreen
**Location:** `src/features/workTickets/screens/WorkTicketFormScreen.tsx`

```
┌─────────────────────────────────────┐
│ ← New Work Ticket          [Save]  │
├─────────────────────────────────────┤
│ PROJECT                             │
│ [200 Hamilton Ave ▼]                │
│                                     │
│ SERVICE DATE                        │
│ [📅 April 10, 2026]                 │
│                                     │
│ TRADE                               │
│ [Tile ▼]                            │
│                                     │
│ LOCATION                            │
│ Floor    [Floor 3          ]        │
│ Area     [Restroom 0312    ]        │
│                                     │
│ PRIORITY                            │
│ ( ) Normal  ( ) Urgent              │
│                                     │
│ WORK DESCRIPTION *                  │
│ ┌─────────────────────────────────┐ │
│ │ Repair damaged tile in...       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ LABOR                   [+ Add]    │
│ ├ John Doe (Mechanic) 8h reg 0h OT │
│ └ Jane Smith (Helper) 8h reg 0h OT │
│                                     │
│ MATERIALS               [+ Add]    │
│ ├ 12x24 Tile · 50 · sqft           │
│ └ Thinset · 3 · bags               │
│                                     │
│ [Save as Draft]  [Save & Send]     │
└─────────────────────────────────────┘
```

Features:
- Auto-fill `foreman_name` and `foreman_id` from current profile
- Auto-fill `organization_id` and default `project_id` from active job context
- Zod validation using `WorkTicketSchema.pick({ ... })`
- "Save as Draft" → status='draft'
- "Save & Send" → saves + navigates to signing flow
- Can be saved offline (PowerSync syncs later)

### 3.3 WorkTicketDetailScreen
**Location:** `src/features/workTickets/screens/WorkTicketDetailScreen.tsx`

Shows the full ticket with all details and actions based on status.

Actions by Status:

**Draft:**
- [Edit] — opens edit mode (same form as create, pre-filled)
- [Delete] — confirm dialog, deletes ticket
- [Send for Signature] — opens Send modal
- All fields editable

**Pending Signature:**
- [Resend] — opens Send modal again (new token)
- [Cancel Signature Request] — reverts to draft
- Read-only display
- Shows: "Waiting for {signer_name} to sign"

**Signed:**
- Read-only display
- Shows: signature image, signer name, signed date
- Shows: SHA-256 hash with green checkmark "✅ Integrity verified"
- [Download PDF] — generate and share PDF with signature overlay
- [Verify Hash] — re-compute hash and compare (shows result)

**Declined:**
- Shows: decline reason
- [Edit & Resend] — revert to draft for editing, then resend

---

## PART 4: Signature Pad (In-App Signing)

**Location:** `src/features/workTickets/screens/SignaturePadScreen.tsx`

Library: `react-native-signature-canvas` (or `@jonasmerlin/react-native-signature-canvas`)

```
┌─────────────────────────────────────┐
│ ← Sign Ticket #1005                 │
├─────────────────────────────────────┤
│                                     │
│ Hand this phone to the GC to        │
│ review and sign.                    │
│                                     │
│ SIGNER NAME *                       │
│ [________________]                  │
│                                     │
│ TITLE (optional)                    │
│ [________________]                  │
│                                     │
│ NOTES FOR FOREMAN                   │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ DRAW SIGNATURE                      │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │      (canvas area)              │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│ [Clear]                             │
│                                     │
│ By signing, I confirm this work     │
│ was performed as described above.   │
│                                     │
│         [Submit Signature]          │
└─────────────────────────────────────┘
```

Features:
- Signature canvas returns base64 PNG via `onOK(signature)` callback
- Signer name required
- Title optional (stored as "Name — Title" in DB)
- GC notes (optional textarea) → written to work_tickets.gc_notes
- Submit flow:
  1. Check online (block if offline with clear message)
  2. Create signature request if not already pending
  3. Call `workTicketService.signInApp({ ... })`
  4. Show success alert + navigate back to detail screen

**Offline behavior:** Signing REQUIRES online. If offline, show:
```
⚠️ No connection
Signing requires an active internet connection to upload the
signature. Please connect to WiFi or cellular data and try again.
[OK]
```

---

## PART 5: Send Link Flow (alternative signing mode)

If the GC is NOT physically present, foreman can share a link.

```typescript
// In WorkTicketDetailScreen "Send Link" button
import { Share } from 'react-native';

async function handleSendLink() {
  // 1. Create signature request
  const sig = await workTicketService.createSignatureRequest({
    ticketId: ticket.id,
    organization_id: ticket.organization_id,
    project_id: ticket.project_id,
    signerName: '', // GC will enter on the page
    signerRole: 'gc',
  });

  // 2. Generate public URL
  const url = workTicketService.getSigningUrl(sig.token);

  // 3. Open native share sheet
  await Share.share({
    message: `Please sign Work Ticket #${ticket.number} for ${projectName}:\n\n${url}`,
    url, // iOS
  });

  // 4. Show toast
  Toast.show('Link shared. You will be notified when the GC signs.');
}
```

The realtime subscription on WorkTicketDetailScreen will auto-refresh when
the GC signs on the web page. No manual refresh needed.

---

## PART 6: PDF Generation (expo-print — NOT jsPDF)

**Location:** `src/features/workTickets/services/workTicketPdf.ts`

Use `expo-print` + HTML template, exactly like Jantile Tracker. The signature
is embedded via `<img src="{public_url}" crossorigin="anonymous" />` — no
fetch, no base64, no canvas dance. The browser renderer inside expo-print
loads the image from the public Supabase URL.

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { WorkTicket, DocumentSignature } from '../schemas';

export async function generateWorkTicketPdf(
  ticket: WorkTicket,
  signature: DocumentSignature | null,
  projectName: string,
  company: { name: string; address: string | null; phone: string | null; logoUrl: string | null }
): Promise<string> {
  const html = buildHtml(ticket, signature, projectName, company);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function shareWorkTicketPdf(pdfUri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing not available on this device');
  }
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Work Ticket PDF',
    UTI: 'com.adobe.pdf',
  });
}

function buildHtml(
  ticket: WorkTicket,
  signature: DocumentSignature | null,
  projectName: string,
  company: { name: string; address: string | null; phone: string | null; logoUrl: string | null }
): string {
  const totalHours = ticket.labor.reduce(
    (acc, l) => acc + l.regular_hours + l.overtime_hours, 0
  );

  const laborRows = ticket.labor.map(l => `
    <tr>
      <td>${escape(l.name)}</td>
      <td>${escape(l.classification)}</td>
      <td>${l.regular_hours}</td>
      <td>${l.overtime_hours}</td>
      <td>${(l.regular_hours + l.overtime_hours).toFixed(1)} hrs</td>
    </tr>
  `).join('');

  const materialRows = ticket.materials.map(m => `
    <tr>
      <td>${escape(m.description)}</td>
      <td>${m.quantity}</td>
      <td>${escape(m.unit)}</td>
    </tr>
  `).join('');

  const signatureSection = signature?.status === 'signed' && signature.signature_url
    ? `
      <div class="signature">
        <div class="sig-label">AUTHORIZATION SIGNATURE</div>
        <img src="${signature.signature_url}" crossorigin="anonymous"
             style="height:60px;object-fit:contain;" />
        <div class="signed-by">
          Signed by: ${escape(signature.signer_name)} (${escape(signature.signer_role.toUpperCase())})
        </div>
        <div class="signed-date">
          Date: ${formatDate(signature.signed_at)}
        </div>
        ${signature.content_hash ? `
          <div class="hash">
            <div class="hash-label">SHA-256 Integrity Hash:</div>
            <div class="hash-value">${signature.content_hash}</div>
          </div>
        ` : ''}
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

  return `
    <!DOCTYPE html>
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
          ${company.logoUrl
            ? `<img src="${company.logoUrl}" crossorigin="anonymous" style="max-height:50px;max-width:140px;" />`
            : `<div style="font-size:16px;font-weight:bold;">${escape(company.name)}</div>
               <div class="title-underline" style="margin:6px 0;"></div>`
          }
          ${company.address ? `<div class="company">${escape(company.address)}</div>` : ''}
          ${company.phone ? `<div class="company">${escape(company.phone)}</div>` : ''}
        </div>
        <div>
          <div class="title">ORDER FOR ADDITIONAL WORK</div>
          <div class="title-underline"></div>
          ${ticket.number ? `<div class="ticket-number">T&amp;M Work Ticket #${ticket.number}</div>` : ''}
        </div>
      </div>

      <div class="divider"></div>

      <div class="meta-grid">
        <div>
          <div class="meta-label">Project</div>
          <div class="meta-value">${escape(projectName)}</div>
        </div>
        <div>
          <div class="meta-label">Service Date</div>
          <div class="meta-value">${formatDate(ticket.service_date)}</div>
        </div>
        <div>
          <div class="meta-label">Trade</div>
          <div class="meta-value">${escape(ticket.trade)}</div>
        </div>
        <div>
          <div class="meta-label">Priority</div>
          <div class="meta-value">${ticket.priority === 'urgent' ? '⚠ URGENT' : 'Normal'}</div>
        </div>
        ${(ticket.floor || ticket.area_description) ? `
          <div style="grid-column: 1 / -1;">
            <div class="meta-label">Location</div>
            <div class="meta-value">${escape([ticket.floor, ticket.area_description].filter(Boolean).join(' · '))}</div>
          </div>
        ` : ''}
        ${ticket.foreman_name ? `
          <div>
            <div class="meta-label">Foreman</div>
            <div class="meta-value">${escape(ticket.foreman_name)}</div>
          </div>
        ` : ''}
      </div>

      <div class="divider"></div>

      <div class="section-label">Work Description</div>
      <div class="description">${escape(ticket.work_description)}</div>

      ${ticket.labor.length > 0 ? `
        <div style="margin-top:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="section-label">Labor</div>
            <div class="total-hours">Total: ${totalHours.toFixed(1)} hrs</div>
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
      ` : ''}

      ${ticket.materials.length > 0 ? `
        <div style="margin-top:24px;">
          <div class="section-label">Materials</div>
          <table>
            <thead>
              <tr><th>Description</th><th>Qty</th><th>Unit</th></tr>
            </thead>
            <tbody>${materialRows}</tbody>
          </table>
        </div>
      ` : ''}

      ${ticket.gc_notes ? `
        <div style="margin-top:24px;">
          <div class="section-label">GC Notes</div>
          <div class="description">${escape(ticket.gc_notes)}</div>
        </div>
      ` : ''}

      ${signatureSection}

      <div class="footer">
        <div>Powered by NotchField</div>
        <div>Page 1</div>
      </div>
    </body>
    </html>
  `;
}

function escape(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}
```

---

## PART 7: Realtime Subscriptions

On `WorkTicketListScreen` and `WorkTicketDetailScreen`, subscribe to changes:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('work_tickets_' + ticketId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'work_tickets',
        filter: `id=eq.${ticketId}`,
      },
      (payload) => {
        // Refresh ticket data
        refetch();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'document_signatures',
        filter: `document_id=eq.${ticketId}`,
      },
      (payload) => {
        // Refresh signature data
        refetch();
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [ticketId]);
```

---

## PART 8: Permissions

Role-based visibility in Track:

| Role | Create Ticket | Edit Draft | Sign (in-app) | View Signed | Delete Draft |
|------|:---:|:---:|:---:|:---:|:---:|
| foreman | ✅ | own only | ✅ (hand to GC) | ✅ project-scoped | own drafts only |
| supervisor | ✅ | all drafts | ✅ | ✅ all projects | any draft |
| worker | ❌ | ❌ | ❌ | ✅ read-only | ❌ |
| pm | ❌ (use Web) | ❌ | ❌ | ✅ read-only | ❌ |

Enforce in UI with `useProfile()` role check. DB-level enforcement via RLS
policies on `work_tickets` (inherited from org membership — already configured).

---

## Critical Rules (from Jantile Tracker's hard-won lessons)

1. **NEVER use PowerSync for signing operations.** `document_signatures` inserts/
   updates and signature uploads MUST go through the direct Supabase client.
   PowerSync sync delay breaks signing flows. This is a battle-tested rule.
   Work ticket CRUD can use PowerSync (drafts offline = fine). Signing cannot.

2. **Storage path convention:** `signatures/{organization_id}/{token}.png`.
   DO NOT change this. Takeoff Web uses this path — if Track uses a different
   one, cross-app signature loading will break.

3. **Signature upload MUST check the error response.** Silent failures created
   the bug we fixed today. After every `supabase.storage.upload()`, check
   `{ error }` and throw/toast if non-null.

4. **PDF signature embed = HTML `<img src="{public_url}" crossorigin="anonymous" />`.**
   Do NOT fetch + base64 + jsPDF in React Native. Use expo-print + HTML. The
   bucket is public and returns `Access-Control-Allow-Origin: *` — direct img
   tag works.

5. **Typed contracts match Takeoff Web exactly.** Never diverge field names or
   enum values from Takeoff's `src/shared/types/documents.ts`. If Takeoff adds
   a field, Track adds it. Mirror, don't fork.

6. **Number is SERIAL.** Don't compute ticket numbers in the app. Just INSERT
   and read the returned `number` column. The sequence is shared across Web
   and Track — impossible to duplicate.

7. **Online check before signing.** Track must refuse to sign if offline.
   Show a clear message and let the user retry when reconnected.

---

## File Structure (Track repo)

```
src/features/workTickets/
├── schemas.ts                        — Zod schemas (mirror Takeoff types)
├── services/
│   ├── workTicketService.ts          — CRUD + sign + signature request
│   └── workTicketPdf.ts              — expo-print HTML template + share
├── screens/
│   ├── WorkTicketListScreen.tsx      — list with filters + FAB
│   ├── WorkTicketFormScreen.tsx      — create/edit form
│   ├── WorkTicketDetailScreen.tsx    — view + actions
│   └── SignaturePadScreen.tsx        — in-app signing
├── components/
│   ├── WorkTicketCard.tsx            — list item
│   ├── LaborEditor.tsx               — labor entries CRUD
│   ├── MaterialEditor.tsx            — materials CRUD
│   └── StatusBadge.tsx               — draft/pending/signed color badge
└── hooks/
    ├── useWorkTickets.ts             — list query + realtime
    └── useWorkTicket.ts              — single ticket + realtime
```

---

## Dependencies to Install

```bash
npx expo install expo-print expo-sharing expo-crypto
npm install react-native-signature-canvas
# OR
npm install @jonasmerlin/react-native-signature-canvas
```

---

## Verify

1. WorkTicketListScreen loads tickets from current project, filterable
2. Realtime: a ticket created in Takeoff Web appears instantly in Track (no refresh)
3. Creating a new ticket in Track assigns a unique SERIAL number
4. Ticket saved offline syncs when back online (PowerSync)
5. SignaturePadScreen captures signature, uploads to storage at correct path
6. Signed ticket appears as `status='signed'` in Takeoff Web immediately
7. Signature URL from Track = same format as Takeoff Web
8. Link share mode: creates pending signature, Share sheet opens
9. GC signs on web link → Track detail screen auto-refreshes (realtime)
10. PDF generation via expo-print produces valid PDF with letterhead + signature embedded
11. Signed PDF can be shared via native Share sheet
12. Offline attempt to sign: shows clear error, refuses to proceed
13. Upload errors are caught and displayed (no silent failures)
14. Foreman can only delete their OWN drafts
15. Worker role cannot create or sign tickets (UI disabled)
16. Content hash (SHA-256) computed and stored on sign
17. Realtime subscription unsubscribes on screen unmount (no leaks)
18. Types match Takeoff Web exactly (copy-paste from documents.ts works)
19. Foreman name and ID auto-fill from current profile
20. TypeScript passes strict mode

---

## Testing Checklist (end-to-end)

1. **Track → Web flow:**
   - Foreman creates ticket in Track
   - Opens Takeoff Web → PM dashboard
   - Ticket appears with correct number, labor, materials
   - PM sees "Pending" status

2. **Track in-app signing:**
   - Foreman at jobsite, GC present
   - Foreman taps "Sign Now" on Track
   - Hands phone to GC
   - GC signs, enters name + title
   - Signature uploads to storage
   - Back on Track: ticket shows "Signed"
   - Open Takeoff Web: ticket is signed, PDF download shows signature embedded

3. **Track link share signing:**
   - Foreman taps "Send Link"
   - iMessage sheet opens with link
   - GC opens link on their phone → fills form → signs
   - Track detail screen auto-updates to "Signed"
   - PDF preview on Track shows signature

4. **Web signing → Track sees it:**
   - PM creates ticket in Takeoff Web
   - Generates signing link, emails GC
   - GC signs
   - Foreman's Track WorkTicketListScreen auto-refreshes (realtime)
   - Ticket shows "Signed" in Track

5. **Cross-app consistency:**
   - Open same ticket in both Takeoff Web and Track
   - Status, signature, notes, hash all match
   - PDF from both apps is visually identical (same data, same layout logic)
