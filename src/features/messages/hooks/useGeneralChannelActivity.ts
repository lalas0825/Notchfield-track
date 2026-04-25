/**
 * Sprint 53A.1 — Activity count for the project-level "General" channel.
 *
 * Returns the count of messages in the last N hours where `area_id IS NULL`
 * (the project-wide channel). Used by ProjectNotesIcon in the Home header
 * to show a badge when there's recent PM/foreman activity worth checking.
 *
 * Local-first via PowerSync. Refreshes on focus so the badge reflects
 * fresh state after the user navigates back from the General channel
 * screen (where they'll have just read everything).
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { localQuery } from '@/shared/lib/powersync/write';

export function useGeneralChannelActivity(
  projectId: string | null,
  windowHours = 24,
) {
  const [recentCount, setRecentCount] = useState(0);

  const reload = useCallback(async () => {
    if (!projectId) {
      setRecentCount(0);
      return;
    }
    const since = new Date(Date.now() - windowHours * 3600000).toISOString();
    const rows = await localQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM field_messages
         WHERE project_id = ?
           AND area_id IS NULL
           AND created_at >= ?`,
      [projectId, since],
    );
    setRecentCount((rows?.[0]?.n as number) ?? 0);
  }, [projectId, windowHours]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { recentCount, reload };
}
