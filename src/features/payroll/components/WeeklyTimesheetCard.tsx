/**
 * Sprint 73 Payroll Ask #4 — Home card for the Weekly Timesheet flow.
 *
 * Always-on (not Saturday-only) so the foreman can review accumulating
 * crew hours mid-week, catch tap errors early, and plan headcount.
 * Four states drive the visual:
 *
 *   running    (Mon-Fri, hours > 0, no submission)  → blue, info
 *   urgent     (Sat-Mon, no submission, hours > 0)  → orange, action
 *   submitted  (submission status = pending review) → green, lock
 *   disputed   (submission status = disputed)       → red, action
 *   empty      (no hours this week + not Sat-Mon)   → hidden (no card rendered)
 *
 * Tap → /(tabs)/more/timesheet for the full review + submit flow.
 *
 * Role-gated: foreman-only. Workers don't submit; supervisors review on
 * Web. (Per SPRINT_TRACK_PAYROLL.md permission matrix.)
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { normalizeTrackRole } from '@/shared/lib/permissions/trackPermissions';
import { useWeeklyTimesheet } from '../hooks/useWeeklyTimesheet';
import {
  getForemanSubmission,
  type ForemanSubmissionRecord,
} from '../services/payrollApiClient';
import { logger } from '@/shared/lib/logger';

type CardState = 'running' | 'urgent' | 'submitted' | 'disputed';

export function WeeklyTimesheetCard() {
  const router = useRouter();
  const role = useAuthStore((s) => normalizeTrackRole(s.profile?.role));
  const activeProjectId = useProjectStore((s) => s.activeProject?.id ?? null);

  const { range, workers, hoursSummary, loading } = useWeeklyTimesheet();
  const [submission, setSubmission] = useState<ForemanSubmissionRecord | null>(
    null,
  );

  useEffect(() => {
    if (!activeProjectId) return;
    let cancel = false;
    getForemanSubmission(activeProjectId, range.weekEnding)
      .then((rec) => {
        if (!cancel) setSubmission(rec);
      })
      .catch((e) => logger.warn('[timesheet card] fetch submission failed', e));
    return () => {
      cancel = true;
    };
  }, [activeProjectId, range.weekEnding]);

  // Card is foreman-only. Supervisors approve via Web; workers don't submit.
  if (role !== 'foreman') return null;

  // Hide entirely if loading initial data, no project, or zero hours
  // outside the Sat-Mon urgent window — keeps Home uncluttered when
  // there's nothing useful to surface.
  if (loading || !activeProjectId) return null;

  const today = new Date().getDay(); // Sun=0..Sat=6
  const isUrgentWindow = today === 6 || today === 0 || today === 1; // Sat/Sun/Mon
  const totalHours = hoursSummary.grand_total;

  let state: CardState | null = null;
  if (submission?.status === 'disputed') state = 'disputed';
  else if (submission?.status === 'pending_supervisor_review') state = 'submitted';
  else if (submission?.status === 'approved') state = 'submitted';
  else if (isUrgentWindow && totalHours > 0) state = 'urgent';
  else if (totalHours > 0) state = 'running';
  // else: state stays null → don't render

  if (!state) return null;

  const onPress = () => router.push('/(tabs)/more/timesheet' as any);

  const config = STATE_CONFIG[state];
  const subtitle =
    state === 'submitted'
      ? `Submitted · ${totalHours.toFixed(1)}h · ${workers.length} ${workers.length === 1 ? 'worker' : 'workers'}`
      : state === 'disputed'
        ? submission?.supervisor_dispute_reason ?? 'Supervisor disputed — re-submit'
        : `${totalHours.toFixed(1)}h so far · ${workers.length} ${workers.length === 1 ? 'worker' : 'workers'}`;

  return (
    <Pressable
      onPress={onPress}
      className="mb-4 rounded-2xl border p-4 active:opacity-80"
      style={{
        borderColor: `${config.color}55`,
        backgroundColor: `${config.color}15`,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${config.color}30` }}
        >
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>
        <View className="ml-3 flex-1">
          <Text
            className="text-base font-bold"
            style={{ color: config.color }}
            numberOfLines={1}
          >
            {config.title}
          </Text>
          <Text
            className="mt-0.5 text-sm text-slate-300"
            numberOfLines={1}
          >
            {range.label} · {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={config.color} />
      </View>
    </Pressable>
  );
}

const STATE_CONFIG: Record<
  CardState,
  { color: string; icon: keyof typeof Ionicons.glyphMap; title: string }
> = {
  running: {
    color: '#3B82F6',
    icon: 'time',
    title: 'Weekly timesheet',
  },
  urgent: {
    color: '#F97316',
    icon: 'alert-circle',
    title: 'Submit this week',
  },
  submitted: {
    color: '#22C55E',
    icon: 'checkmark-circle',
    title: 'Timesheet submitted',
  },
  disputed: {
    color: '#EF4444',
    icon: 'close-circle',
    title: 'Supervisor disputed',
  },
};
