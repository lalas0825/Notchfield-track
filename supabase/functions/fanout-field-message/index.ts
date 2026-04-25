// Sprint 53A — Fanout push notification on field_messages INSERT.
//
// Triggered by a Supabase Database Webhook on `INSERT INTO field_messages`.
// Webhook body shape (Supabase default):
//   { type: 'INSERT', table: 'field_messages', record: { ... }, schema: 'public' }
//
// Recipients = all profiles in same project (via project_workers.workers.profile_id)
//              MINUS the sender_id.
// Push delivered via Expo Push API (https://exp.host/--/api/v2/push/send).
//
// Required env vars:
//   - SUPABASE_URL                   (auto-provided)
//   - SUPABASE_SERVICE_ROLE_KEY      (auto-provided; bypasses RLS)
//
// Deploy:
//   supabase functions deploy fanout-field-message --project-ref msmpsxalfalzinuorwlg
//
// Wire (after deploy):
//   Supabase Dashboard → Database → Webhooks → New
//     Name:   fanout-field-message-on-insert
//     Table:  field_messages
//     Events: INSERT
//     Type:   HTTP Request (Edge Function)
//     URL:    https://msmpsxalfalzinuorwlg.functions.supabase.co/fanout-field-message
//     Method: POST
//     HTTP Headers: Authorization: Bearer {service_role_key}
//
// Notes:
//   - Failures don't block the INSERT (the trigger is fire-and-forget).
//   - Expo Push API has a 100-message-per-call cap; we batch.
//   - We deliberately don't dedupe stale tokens here — UNIQUE constraint
//     + active flag in device_tokens covers it.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

interface FieldMessageRecord {
  id: string;
  organization_id: string;
  project_id: string;
  area_id: string | null;
  sender_id: string;
  message_type: 'info' | 'blocker' | 'safety' | 'question';
  message: string;
  photos: unknown;
  created_at: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: FieldMessageRecord;
  schema: string;
  old_record?: FieldMessageRecord | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response('missing env vars', { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }

  if (payload.type !== 'INSERT' || payload.table !== 'field_messages') {
    return new Response('ignored: wrong event', { status: 200 });
  }

  const record = payload.record;
  if (!record?.id || !record.project_id || !record.sender_id) {
    return new Response('ignored: missing fields', { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Find recipients: profile_ids of workers active on this project, minus sender
  const { data: pw, error: pwErr } = await supabase
    .from('project_workers')
    .select('workers(profile_id)')
    .eq('project_id', record.project_id)
    .eq('active', true);

  if (pwErr) {
    console.error('project_workers lookup failed', pwErr);
    return new Response('lookup failed', { status: 500 });
  }

  const recipientProfileIds = (pw ?? [])
    .map((row: any) => row.workers?.profile_id)
    .filter((id: unknown): id is string => typeof id === 'string' && id !== record.sender_id);

  if (recipientProfileIds.length === 0) {
    return new Response('no recipients', { status: 200 });
  }

  // 2) Sender display name
  const { data: sender } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', record.sender_id)
    .maybeSingle();
  const senderName = (sender?.full_name as string | undefined) ?? 'Someone';

  // 3) Area label (optional)
  let areaLabel = 'Project';
  if (record.area_id) {
    const { data: area } = await supabase
      .from('production_areas')
      .select('label, name')
      .eq('id', record.area_id)
      .maybeSingle();
    areaLabel =
      (area?.label as string | undefined) ?? (area?.name as string | undefined) ?? 'Area';
  }

  // 4) Active device tokens for those recipients
  const { data: tokens, error: tokErr } = await supabase
    .from('device_tokens')
    .select('expo_push_token, user_id')
    .in('user_id', recipientProfileIds)
    .eq('active', true);

  if (tokErr) {
    console.error('device_tokens lookup failed', tokErr);
    return new Response('token lookup failed', { status: 500 });
  }

  if (!tokens?.length) {
    return new Response('no active devices', { status: 200 });
  }

  // 5) Strip [SYS:...] prefix for display body (Track-side convention)
  const displayBody = record.message.replace(/^\[SYS:[^\]]+\]\s*/, '');
  const truncated = displayBody.length > 100 ? displayBody.slice(0, 97) + '...' : displayBody;

  const isHighPriority =
    record.message_type === 'blocker' || record.message_type === 'safety';

  const messages = tokens.map((t: { expo_push_token: string }) => ({
    to: t.expo_push_token,
    sound: 'default',
    title: `${senderName} · ${areaLabel}`,
    body: truncated,
    data: {
      kind: 'field_message',
      message_id: record.id,
      area_id: record.area_id,
      project_id: record.project_id,
    },
    priority: isHighPriority ? 'high' : 'default',
    channelId: 'default',
  }));

  // 6) Batch send to Expo Push API
  const errors: string[] = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        const text = await res.text();
        errors.push(`batch ${i}-${i + batch.length}: ${res.status} ${text}`);
      }
    } catch (e) {
      errors.push(`batch ${i}-${i + batch.length}: ${e instanceof Error ? e.message : 'err'}`);
    }
  }

  if (errors.length) {
    console.error('expo push partial failure', errors);
    return new Response(JSON.stringify({ delivered: messages.length - errors.length, errors }), {
      status: 207, // Multi-Status — some delivered, some failed
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ delivered: messages.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
