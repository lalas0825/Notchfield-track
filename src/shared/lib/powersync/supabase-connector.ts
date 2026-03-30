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
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      throw new Error('Not authenticated — cannot sync');
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

        if (error) throw new Error(`PUT ${table}/${id}: ${error.message}`);
        break;
      }

      case UpdateType.PATCH: {
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', id);

        if (error) throw new Error(`PATCH ${table}/${id}: ${error.message}`);
        break;
      }

      case UpdateType.DELETE: {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', id);

        if (error) throw new Error(`DELETE ${table}/${id}: ${error.message}`);
        break;
      }
    }
  }
}
