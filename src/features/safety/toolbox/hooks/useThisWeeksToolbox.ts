import { useCallback, useState } from 'react';
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
  // Start true so the card stays hidden until the first load resolves.
  // Subsequent focus refetches DON'T re-enter loading, so the card holds its
  // last-known state while re-fetching silently (prevents opacity flash).
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Collapse the array into a stable string key so callers can pass `[]`
  // inline without triggering an infinite setState loop (the array
  // reference changes on every render; its content doesn't).
  const tradesKey = primaryTrades.join('|');

  const load = useCallback(async () => {
    if (!orgId || !projectId) {
      setLoading(false);
      return;
    }
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

      const trades = tradesKey ? tradesKey.split('|') : [];
      setResult(
        scheduleToolboxTopic({
          library: lib,
          history,
          primaryTrades: trades,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, projectId, tradesKey]);

  // useFocusEffect fires on initial mount AND every refocus — one effect is
  // enough. The prior duplicate useEffect was double-loading on mount.
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
