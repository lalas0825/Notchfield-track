/**
 * PowerSync Local-First Write Helpers
 * =====================================
 * All writes go through PowerSync's local SQLite first.
 * The SupabaseConnector.uploadData() syncs changes to Supabase.
 * This enables true offline-first: writes work without internet.
 *
 * On web, falls back to direct Supabase writes.
 */

import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

function generateUUID(): string {
  // crypto.randomUUID available in modern RN
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the PowerSync database instance (native only).
 * Returns null on web.
 */
function getPowerSync(): any {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { powerSync } = require('./client');
    return powerSync;
  } catch {
    return null;
  }
}

/**
 * Insert a row via PowerSync (offline-first) or Supabase (web fallback).
 */
export async function localInsert(
  table: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; id: string; error?: string }> {
  const id = (data.id as string) ?? generateUUID();
  const row = { ...data, id };

  const ps = getPowerSync();
  if (ps) {
    try {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map((k) => {
        const v = (row as Record<string, unknown>)[k];
        if (v === null || v === undefined) return null;
        // Serialize arrays and objects for SQLite (no native JSON type)
        if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
        return v;
      });

      await ps.execute(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values,
      );
      return { success: true, id };
    } catch (err: any) {
      return { success: false, id, error: err?.message ?? 'PowerSync insert failed' };
    }
  }

  // Web fallback
  const { error } = await supabase.from(table).insert(row);
  if (error) return { success: false, id, error: error.message };
  return { success: true, id };
}

/**
 * Update a row via PowerSync (offline-first) or Supabase (web fallback).
 */
export async function localUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const ps = getPowerSync();
  if (ps) {
    try {
      const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
      const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
      const values: unknown[] = entries.map(([_, v]) => {
        if (v === null || v === undefined) return null;
        if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
        return v;
      });
      values.push(id);

      await ps.execute(
        `UPDATE ${table} SET ${setClause} WHERE id = ?`,
        values,
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'PowerSync update failed' };
    }
  }

  // Web fallback
  const { error } = await supabase.from(table).update(data).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Delete a row via PowerSync (offline-first) or Supabase (web fallback).
 */
export async function localDelete(
  table: string,
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const ps = getPowerSync();
  if (ps) {
    try {
      await ps.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'PowerSync delete failed' };
    }
  }

  // Web fallback
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Delete rows matching a WHERE clause via PowerSync or Supabase.
 */
export async function localDeleteWhere(
  table: string,
  column: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  const ps = getPowerSync();
  if (ps) {
    try {
      await ps.execute(`DELETE FROM ${table} WHERE ${column} = ?`, [value]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'PowerSync delete failed' };
    }
  }

  // Web fallback
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Update rows matching a WHERE clause (for batch updates like end-of-day).
 */
export async function localUpdateWhere(
  table: string,
  data: Record<string, unknown>,
  whereColumn: string,
  whereValue: unknown,
  extraWhere?: { column: string; isNull: boolean },
): Promise<{ success: boolean; error?: string }> {
  const ps = getPowerSync();
  if (ps) {
    try {
      const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
      const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
      const values = entries.map(([_, v]) => v ?? null);
      values.push(whereValue as any);

      let sql = `UPDATE ${table} SET ${setClause} WHERE ${whereColumn} = ?`;
      if (extraWhere?.isNull) {
        sql += ` AND ${extraWhere.column} IS NULL`;
      }

      await ps.execute(sql, values);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'PowerSync update failed' };
    }
  }

  // Web fallback
  let query = supabase.from(table).update(data).eq(whereColumn, whereValue as string);
  if (extraWhere?.isNull) {
    query = query.is(extraWhere.column, null);
  }
  const { error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Query rows from PowerSync local SQLite (offline-first read).
 * Returns null on web (caller should fall back to Supabase).
 *
 * Use this for reads instead of `supabase.from(...).select(...)` when the
 * data is in a synced PowerSync table — it works fully offline and is much
 * faster than a network round-trip.
 */
export async function localQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[] | null> {
  const ps = getPowerSync();
  if (!ps) return null;
  try {
    // 3-second timeout — if PowerSync isn't ready, fall back to Supabase
    const result = await Promise.race([
      ps.getAll(sql, params),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('localQuery timeout')), 3000),
      ),
    ]);
    return result as T[];
  } catch (err) {
    console.warn('[localQuery] error:', err);
    return null;
  }
}

export { generateUUID };
