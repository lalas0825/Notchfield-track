/**
 * Supabase Connector for PowerSync
 * ==================================
 * Bridges PowerSync ↔ Supabase:
 *   - Provides JWT tokens for sync authentication
 *   - Handles CRUD uploads (local changes → Supabase REST API)
 *
 * IMPORTANT: Strips auto-generated columns (serial `number`, `updated_at`)
 * before upserting to Postgres. These columns have server-side defaults
 * (nextval, now()) that conflict with NULL/0 values from local SQLite.
 */

import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import { supabase } from '../supabase/client';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '';

/**
 * Columns that Postgres auto-generates via DEFAULT/SERIAL.
 * These must be excluded from INSERT/UPSERT operations because:
 * - `number`: uses nextval() sequence — sending NULL/0 causes type errors
 * - `updated_at`: uses now() trigger — let Postgres handle it
 *
 * `id` and `created_at` are NOT excluded because we generate them locally.
 */
const AUTO_GENERATED_COLUMNS = new Set([
  'number',
  'updated_at',
]);

/**
 * Clean opData by removing auto-generated columns and null/undefined values
 * that would conflict with NOT NULL + DEFAULT constraints.
 */
/**
 * Columns known to contain JSONB data in Postgres.
 * When PowerSync stores these locally, they're JSON strings.
 * Before uploading to Supabase, parse them back to objects.
 */
const JSONB_COLUMNS = new Set([
  'photos', 'resolution_photos', 'content', 'signatures',
  'areas_worked', 'photo_urls',
]);

function cleanData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data) return {};

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip auto-generated columns
    if (AUTO_GENERATED_COLUMNS.has(key)) continue;

    // Parse JSONB columns (stored as strings in SQLite)
    if (JSONB_COLUMNS.has(key) && typeof value === 'string') {
      try {
        cleaned[key] = JSON.parse(value);
      } catch {
        cleaned[key] = value;
      }
      continue;
    }

    cleaned[key] = value;
  }
  return cleaned;
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const initial = await supabase.auth.getSession();
    if (initial.error || !initial.data.session) {
      throw new Error('Not authenticated — cannot sync');
    }
    let session = initial.data.session;

    // Bug fix 2026-04-25: PowerSync was getting stuck "connected: false" after
    // offline → online transitions because getSession() returns the CACHED token,
    // not a refreshed one. If the cached JWT was expired, PowerSync handshake
    // failed and the WebSocket gave up. autoRefreshToken in supabase-js doesn't
    // fire reliably on RN when the app was backgrounded.
    //
    // Fix: proactively refresh if the token expires within 60 seconds. PowerSync
    // calls fetchCredentials on every reconnect attempt, so this self-heals
    // without an external nudge.
    if (session.expires_at) {
      const secondsUntilExpiry = session.expires_at - Math.floor(Date.now() / 1000);
      if (secondsUntilExpiry < 60) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.error && refreshed.data.session) {
          session = refreshed.data.session;
        } else {
          // Bug fix 2026-04-25 (round 2): if refresh fails, the refresh_token
          // is dead too (Supabase default 30-day TTL). Silent retry would
          // leave the user stuck in "Reconnecting…" forever. Sign out cleanly
          // — AuthGate redirects to /login. The user re-auths and gets a
          // fresh refresh_token good for another 30 days.
          // eslint-disable-next-line no-console
          console.warn('[PowerSync] refresh_token dead, signing out:', refreshed.error?.message);
          await supabase.auth.signOut().catch(() => undefined);
          throw new Error('Session expired — please sign in again');
        }
      }
    }

    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        await this.applyOperation(op);
      }
      await transaction.complete();
    } catch (error) {
      console.error('[PowerSync] Upload failed:', error);
      throw error;
    }
  }

  private async applyOperation(op: CrudEntry): Promise<void> {
    const table = op.table;
    const id = op.id;
    const data = cleanData(op.opData);

    switch (op.op) {
      case UpdateType.PUT: {
        const { error } = await supabase
          .from(table)
          .upsert({ ...data, id });

        if (error) {
          await this.logUploadFailure(op.op, table, id, data, error.message);
          throw new Error(`PUT ${table}/${id}: ${error.message}`);
        }
        break;
      }

      case UpdateType.PATCH: {
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', id);

        if (error) {
          await this.logUploadFailure(op.op, table, id, data, error.message);
          throw new Error(`PATCH ${table}/${id}: ${error.message}`);
        }
        break;
      }

      case UpdateType.DELETE: {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', id);

        if (error) {
          await this.logUploadFailure(op.op, table, id, data, error.message);
          throw new Error(`DELETE ${table}/${id}: ${error.message}`);
        }
        break;
      }
    }
  }

  /**
   * Dump the offending row + current auth context to the console when an
   * upload fails. Makes RLS/constraint violations debuggable from the
   * device log instead of guessing which field tripped the policy.
   */
  private async logUploadFailure(
    op: UpdateType,
    table: string,
    id: string,
    data: Record<string, unknown>,
    message: string,
  ): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUid = session?.user?.id ?? null;

      // eslint-disable-next-line no-console
      console.error(
        `[PowerSync] Upload rejected — ${op} ${table}/${id}\n` +
          `  error:       ${message}\n` +
          `  auth.uid():  ${authUid}\n` +
          `  row.org:     ${data.organization_id ?? '(missing)'}\n` +
          `  row.by:      ${data.assigned_by ?? data.created_by ?? data.reported_by ?? '(n/a)'}\n` +
          `  row.worker:  ${data.worker_id ?? '(n/a)'}\n` +
          `  payload:     ${JSON.stringify(data, null, 2)}`,
      );
    } catch {
      // never let logging mask the real error
    }
  }
}
