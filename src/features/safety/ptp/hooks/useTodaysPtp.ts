import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import type { PtpContent, PtpSignature, SafetyDocument } from '../types';

/**
 * Load today's PTP for the current foreman so the Home screen can surface
 * a "Morning PTP" card. Runs on focus so the card refreshes whenever the
 * user navigates back to Home.
 *
 * "Today" = local-time day match against `content.ptp_date` (yyyy-mm-dd).
 */
export function useTodaysPtp(foremanId: string | null | undefined, projectId: string | null | undefined) {
  const [doc, setDoc] = useState<SafetyDocument | null>(null);
  // Start true so the card stays hidden until the first load resolves
  // (prevents the "CTA flashes → disappears → real state appears" cycle).
  // Subsequent focus refetches DON'T toggle this back to true, so the card
  // holds its last-known state while re-fetching silently.
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!foremanId || !projectId) {
      setDoc(null);
      setLoading(false);
      return;
    }
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Offline-first — read local candidates and filter in JS.
      const local = await localQuery<Record<string, unknown>>(
        `SELECT * FROM safety_documents
         WHERE doc_type = 'ptp'
           AND created_by = ?
           AND project_id = ?
         ORDER BY created_at DESC
         LIMIT 20`,
        [foremanId, projectId],
      );

      const pool: Record<string, unknown>[] = local ?? (
        (
          await supabase
            .from('safety_documents')
            .select('*')
            .eq('doc_type', 'ptp')
            .eq('created_by', foremanId)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(20)
        ).data ?? []
      );

      const match = pool
        .map((r) => {
          const content = parseJson<PtpContent>(r.content, {} as PtpContent);
          return { row: r, content };
        })
        .find(({ content }) => content.ptp_date === today);

      if (match) {
        setDoc({
          id: match.row.id as string,
          project_id: match.row.project_id as string,
          organization_id: match.row.organization_id as string,
          number: match.row.number as number | undefined,
          doc_type: 'ptp',
          title: match.row.title as string,
          content: match.content,
          status: (match.row.status as SafetyDocument['status']) ?? 'draft',
          signatures: parseJson<PtpSignature[]>(match.row.signatures, []),
          created_by: match.row.created_by as string,
          created_at: match.row.created_at as string,
          updated_at: (match.row.updated_at as string) ?? (match.row.created_at as string),
        });
      } else {
        setDoc(null);
      }
    } finally {
      setLoading(false);
    }
  }, [foremanId, projectId]);

  // useFocusEffect fires on initial mount AND on every refocus, so one effect
  // is enough. The prior duplicate useEffect was double-loading on mount.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { doc, loading, reload: load };
}

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
