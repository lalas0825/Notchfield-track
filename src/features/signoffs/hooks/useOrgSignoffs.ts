/**
 * Sprint 72 — useOrgSignoffs.
 *
 * Reads sign-offs for the current org (PowerSync local), filtered by status
 * tab and scoped to an optional projectId. Used by the Compliance list
 * screen + supervisor's signoff queue.
 *
 * Sync rule excludes status IN ('declined','expired','cancelled') so the
 * local table only contains active rows. The hook returns whatever is
 * there with the requested filter applied client-side.
 *
 * Fully offline via PowerSync. Realtime subscription updates as Web's
 * send/sign/decline endpoints flip statuses on other devices.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type {
  SignoffDocStatus,
  SignoffDocument,
  SignoffEvidencePhoto,
  SignoffEvidenceRule,
  SignoffSignerRole,
  SignoffStatusAfterSign,
} from '../types';

type RawRow = Record<string, unknown>;

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function rowToSignoff(row: RawRow): SignoffDocument {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    project_id: row.project_id as string,
    number: typeof row.number === 'number' ? (row.number as number) : 0,
    template_id: (row.template_id as string | null) ?? null,
    title: (row.title as string) ?? '',
    body: (row.body as string) ?? '',
    notes: (row.notes as string | null) ?? null,
    signer_role: (row.signer_role as SignoffSignerRole) ?? 'gc',
    trade: (row.trade as string | null) ?? null,
    status: (row.status as SignoffDocStatus) ?? 'draft',
    evidence_photos: parseJsonArray<SignoffEvidencePhoto>(row.evidence_photos),
    required_evidence_snapshot: parseJsonArray<SignoffEvidenceRule>(
      row.required_evidence_snapshot,
    ),
    status_after_sign:
      (row.status_after_sign as SignoffStatusAfterSign) ?? 'archives',
    created_by: (row.created_by as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    sent_to_email: (row.sent_to_email as string | null) ?? null,
    signed_at: (row.signed_at as string | null) ?? null,
    signed_by_name: (row.signed_by_name as string | null) ?? null,
    signed_by_company: (row.signed_by_company as string | null) ?? null,
    declined_at: (row.declined_at as string | null) ?? null,
    declined_reason: (row.declined_reason as string | null) ?? null,
    pdf_url: (row.pdf_url as string | null) ?? null,
    sha256_hash: (row.sha256_hash as string | null) ?? null,
    spawned_from_object_id: (row.spawned_from_object_id as string | null) ?? null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  };
}

export type SignoffStatusTab = 'all' | 'draft' | 'pending_signature' | 'signed';

export type UseOrgSignoffsOpts = {
  /** Limit to one project; omit to read across all org projects. */
  projectId?: string | null;
  /** Status filter — defaults to 'all' (everything synced). */
  status?: SignoffStatusTab;
  /** Soft cap for performance. Defaults to 200. */
  limit?: number;
};

export function useOrgSignoffs(opts: UseOrgSignoffsOpts = {}) {
  const orgId = useAuthStore((s) => s.profile?.organization_id ?? null);
  const projectId = opts.projectId ?? null;
  const status: SignoffStatusTab = opts.status ?? 'all';
  const limit = opts.limit ?? 200;

  const [signoffs, setSignoffs] = useState<SignoffDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!orgId) {
      if (mountedRef.current) {
        setSignoffs([]);
        setLoading(false);
      }
      return;
    }

    const where: string[] = ['organization_id = ?'];
    const params: unknown[] = [orgId];
    if (projectId) {
      where.push('project_id = ?');
      params.push(projectId);
    }
    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    params.push(limit);

    const rows = await localQuery<RawRow>(
      `SELECT * FROM signoff_documents
         WHERE ${where.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT ?`,
      params,
    );
    if (mountedRef.current) {
      setSignoffs(rows ? rows.map(rowToSignoff) : []);
      setLoading(false);
    }
  }, [orgId, projectId, status, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Realtime — Web flips status on send/sign/decline; pdf_url populates
  // async after sign. Subscribe to all signoff_documents updates for the
  // org so the UI flips immediately.
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`signoffs_org_${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'signoff_documents',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, reload]);

  const counts = useMemo(() => {
    const out = { draft: 0, pending_signature: 0, signed: 0, total: 0 };
    for (const s of signoffs) {
      out.total += 1;
      if (s.status === 'draft') out.draft += 1;
      else if (s.status === 'pending_signature') out.pending_signature += 1;
      else if (s.status === 'signed') out.signed += 1;
    }
    return out;
  }, [signoffs]);

  return { signoffs, counts, loading, reload };
}
