import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localUpdate, generateUUID } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import type { DocType, SignatureEntry } from '../types/schemas';
import { logger } from '@/shared/lib/logger';

export type SafetyDocRow = {
  id: string;
  project_id: string;
  organization_id: string;
  number: number;
  doc_type: string;
  title: string;
  content: Record<string, unknown>;
  status: string;
  signatures: SignatureEntry[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

export function useSafetyDocs() {
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [docs, setDocs] = useState<SafetyDocRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    if (!activeProject || !profile) return;

    setLoading(true);
    const { data } = await supabase
      .from('safety_documents')
      .select('*')
      .eq('project_id', activeProject.id)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    setDocs((data ?? []) as SafetyDocRow[]);
    setLoading(false);
  }, [activeProject, profile]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const createDoc = useCallback(
    async (params: {
      doc_type: DocType;
      title: string;
      content: Record<string, unknown>;
      signatures: SignatureEntry[];
    }): Promise<{ success: boolean; error?: string }> => {
      if (!user || !activeProject || !profile) {
        return { success: false, error: 'Not authenticated' };
      }

      const result = await localInsert('safety_documents', {
        id: generateUUID(),
        project_id: activeProject.id,
        organization_id: profile.organization_id,
        doc_type: params.doc_type,
        title: params.title,
        content: params.content,
        signatures: params.signatures,
        status: 'active',
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      if (!result.success) {
        console.error('[Safety] Create failed:', result.error);
        return { success: false, error: result.error };
      }

      logger.info(`[Safety] ${params.doc_type} created: ${params.title}`);
      await fetchDocs();
      return { success: true };
    },
    [user, activeProject, profile, fetchDocs],
  );

  const closeDoc = useCallback(
    async (docId: string): Promise<{ success: boolean; error?: string }> => {
      const result = await localUpdate('safety_documents', docId, { status: 'closed' });

      if (!result.success) return { success: false, error: result.error };
      await fetchDocs();
      return { success: true };
    },
    [fetchDocs],
  );

  return { docs, loading, fetchDocs, createDoc, closeDoc };
}
