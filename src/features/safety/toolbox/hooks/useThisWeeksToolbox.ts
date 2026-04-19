import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getToolboxLibrary,
  getRecentDeliveries,
  getWeeklyOverride,
  getRecentPtpTags,
  getThisWeeksDelivery,
} from '../services/toolboxService';
import {
  scheduleToolboxTopic,
  weekStartDate,
} from '../services/schedulerEngine';
import type {
  ScheduleResult,
  ToolboxLibraryTopic,
} from '../types';

/**
 * Everything the Home card + Screen 1 need in one call:
 *   - scheduler result (suggested + alternatives + explanation)
 *   - whether this week's talk was already delivered
 *   - the delivered row (if any) for resume / read-only links
 *
 * Refetches on focus so the Home card reflects fresh state when the foreman
 * navigates back from the wizard.
 */
export function useThisWeeksToolbox(
  orgId: string | null | undefined,
  projectId: string | null | undefined,
  primaryTrades: string[],
) {
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [library, setLibrary] = useState<ToolboxLibraryTopic[]>([]);
  const [weekStart, setWeekStart] = useState<string>(weekStartDate(new Date()));
  const [delivered, setDelivered] = useState<{
    id: string;
    status: string;
    content: Record<string, unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const week = weekStartDate(now);
      setWeekStart(week);

      const [lib, history, override, ptpTags, thisWeeks] = await Promise.all([
        getToolboxLibrary(orgId),
        getRecentDeliveries(projectId, 16),
        getWeeklyOverride(projectId, week),
        getRecentPtpTags(projectId, 1),
        getThisWeeksDelivery(projectId, week),
      ]);

      setLibrary(lib);
      setDelivered(thisWeeks);

      setResult(
        scheduleToolboxTopic({
          library: lib,
          history,
          primaryTrades,
          currentDate: now,
          override,
          ptpSignal: ptpTags.length ? { tags: ptpTags } : null,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load toolbox state');
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, primaryTrades]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return {
    result,
    library,
    weekStart,
    delivered,
    loading,
    error,
    reload: load,
  };
}
