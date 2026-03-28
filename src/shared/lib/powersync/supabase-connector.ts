/**
 * Supabase Connector for PowerSync
 * ==================================
 * Bridges PowerSync ↔ Supabase:
 *   - Provides JWT tokens for sync authentication
 *   - Handles CRUD uploads (local changes → Supabase REST API)
 *
 * PowerSync calls fetchCredentials() to get a valid token,
 * and uploadData() to push local writes to Supabase.
 */

import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import { supabase } from '../supabase/client';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '';

export class SupabaseConnector implements PowerSyncBackendConnector {
  /**
   * Provides PowerSync with the Supabase JWT for authenticated sync.
   * Called automatically by PowerSync when token expires.
   */
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

  /**
   * Uploads local CRUD operations to Supabase.
   * Called by PowerSync when there are pending local changes.
   *
   * Strategy: process each operation sequentially via Supabase REST.
   * On conflict: last-write-wins (field data is authoritative).
   */
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
    const data = op.opData;

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
          .update(data!)
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
