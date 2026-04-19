import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import {
  patchToolboxContent,
  setToolboxStatus,
} from '../services/toolboxService';
import { ToolboxContentSchema, type ToolboxContent } from '../types';
import {
  appendSignature as appendPtpSignature,
  removeSignature as removePtpSignature,
} from '@/features/safety/ptp/services/ptpService';
import type { PtpSignature, SafetyDocument } from '@/features/safety/ptp/types';

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function loadDoc(docId: string): Promise<SafetyDocument | null> {
  const local = await localQuery<Record<string, unknown>>(
    `SELECT * FROM safety_documents WHERE id = ? LIMIT 1`,
    [docId],
  );
  const row = local?.[0];
  const source =
    row ??
    (
      await supabase
        .from('safety_documents')
        .select('*')
        .eq('id', docId)
        .maybeSingle()
    ).data;
  if (!source) return null;
  const r = source as Record<string, unknown>;
  return {
    id: r.id as string,
    project_id: r.project_id as string,
    organization_id: r.organization_id as string,
    number: (r.number as number | undefined) ?? undefined,
    doc_type: 'toolbox',
    title: r.title as string,
    content: parseJson<Record<string, unknown>>(r.content, {}),
    status: (r.status as SafetyDocument['status']) ?? 'draft',
    signatures: parseJson<PtpSignature[]>(r.signatures, []),
    created_by: r.created_by as string,
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string) ?? (r.created_at as string),
  };
}

/**
 * Load + mutate a single toolbox talk document. Mirrors the PTP `usePtp`
 * hook; signature append/remove use the shared PTP helpers (same JSONB
 * read-modify-write pattern).
 */
export function useToolbox(docId: string | null | undefined) {
  const [doc, setDoc] = useState<SafetyDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    try {
      setDoc(await loadDoc(docId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load toolbox doc');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveContent = useCallback(
    async (patch: Partial<ToolboxContent>) => {
      if (!docId) return { success: false, error: 'No document id' };
      const result = await patchToolboxContent(docId, patch);
      if (result.success) {
        setDoc((prev) =>
          prev ? { ...prev, content: { ...(prev.content as object), ...patch } } : prev,
        );
      }
      return result;
    },
    [docId],
  );

  const replaceContent = useCallback(
    async (next: ToolboxContent) => {
      if (!docId) return { success: false, error: 'No document id' };
      const parsed = ToolboxContentSchema.safeParse(next);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid content' };
      }
      return saveContent(parsed.data);
    },
    [docId, saveContent],
  );

  const addSignature = useCallback(
    async (sig: PtpSignature) => {
      if (!docId) return { success: false, error: 'No document id' };
      const result = await appendPtpSignature(docId, sig);
      if (result.success) {
        setDoc((prev) =>
          prev
            ? { ...prev, signatures: [...(prev.signatures ?? []), sig] }
            : prev,
        );
      }
      return result;
    },
    [docId],
  );

  const removeSignatureAt = useCallback(
    async (index: number) => {
      if (!docId) return { success: false, error: 'No document id' };
      const result = await removePtpSignature(docId, index);
      if (result.success) {
        setDoc((prev) => {
          if (!prev) return prev;
          const next = [...(prev.signatures ?? [])];
          next.splice(index, 1);
          return { ...prev, signatures: next };
        });
      }
      return result;
    },
    [docId],
  );

  const updateStatus = useCallback(
    async (status: 'draft' | 'active' | 'completed') => {
      if (!docId) return { success: false, error: 'No document id' };
      const result = await setToolboxStatus(docId, status);
      if (result.success) {
        setDoc((prev) => (prev ? { ...prev, status } : prev));
      }
      return result;
    },
    [docId],
  );

  return {
    doc,
    loading,
    error,
    reload: load,
    saveContent,
    replaceContent,
    addSignature,
    removeSignatureAt,
    updateStatus,
  };
}
