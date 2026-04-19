import { useCallback, useEffect, useState } from 'react';
import {
  getPtpById,
  updatePtpContent,
  appendSignature,
  removeSignature,
  setPtpStatus,
} from '../services/ptpService';
import type { PtpContent, PtpSignature, SafetyDocument } from '../types';

/**
 * Load + mutate a single PTP document by id. Returns helpers that re-sync
 * state after every write so the UI stays consistent without a full refetch.
 */
export function usePtp(docId: string | null | undefined) {
  const [doc, setDoc] = useState<SafetyDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    try {
      const next = await getPtpById(docId);
      setDoc(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PTP');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveContent = useCallback(
    async (content: PtpContent) => {
      if (!docId) return { success: false, error: 'No document id' };
      const result = await updatePtpContent(docId, content);
      if (result.success) {
        setDoc((prev) => (prev ? { ...prev, content } : prev));
      }
      return result;
    },
    [docId],
  );

  const addSignature = useCallback(
    async (sig: PtpSignature) => {
      if (!docId) return { success: false, error: 'No document id' };
      const result = await appendSignature(docId, sig);
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
      const result = await removeSignature(docId, index);
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
    async (status: SafetyDocument['status']) => {
      if (!docId) return { success: false, error: 'No document id' };
      const result = await setPtpStatus(docId, status);
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
    addSignature,
    removeSignatureAt,
    updateStatus,
  };
}
