/**
 * Sprint 73 Payroll Ask #4 — Foreman Weekly Timesheet screen.
 *
 * Replaces the paper weekly timesheet workflow at Jantile (and any other
 * pilot org). Foreman reviews the auto-aggregated week (Sat→Fri) of
 * their crew's hours, optionally adds notes, and taps "Submit to
 * Supervisor". Web pings the supervisor; foreman sees a locked
 * "Submitted ✓" state until approved or disputed.
 *
 * Triggers:
 *   - Saturday 8AM push notif from Web ("Confirma horas de la semana")
 *     deep-links here. Push handler routes entity_type='foreman_submission'
 *     into this screen.
 *   - Manual entry: More → Weekly Timesheet
 *
 * Edit affordance (per-cell adjustment) deferred — Web's fallback is
 * supervisor edits manually if needed. Will revisit if pilot reports
 * frequent corrections at submission time.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/features/projects/store/project-store';
import {
  useWeeklyTimesheet,
  WEEK_DAYS,
  type WorkerWeekRow,
} from '@/features/payroll/hooks/useWeeklyTimesheet';
import {
  getForemanSubmission,
  submitForemanWeekly,
  type ForemanSubmissionRecord,
} from '@/features/payroll/services/payrollApiClient';
import { logger } from '@/shared/lib/logger';

type Mode = 'idle' | 'submitting';

export default function WeeklyTimesheetScreen() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = activeProject?.id ?? null;
  const projectName = activeProject?.name ?? '';

  const { range, workers, hoursSummary, loading, reload } =
    useWeeklyTimesheet();

  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [submission, setSubmission] = useState<ForemanSubmissionRecord | null>(
    null,
  );
  const [submissionLoaded, setSubmissionLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubmission = useCallback(async () => {
    if (!projectId) return;
    try {
      const rec = await getForemanSubmission(projectId, range.weekEnding);
      setSubmission(rec);
    } catch (e) {
      logger.warn('[timesheet] getForemanSubmission failed', e);
    } finally {
      setSubmissionLoaded(true);
    }
  }, [projectId, range.weekEnding]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([reload(), fetchSubmission()]);
    } finally {
      setRefreshing(false);
    }
  }, [reload, fetchSubmission]);

  const handleSubmit = useCallback(() => {
    if (!projectId) return;
    if (workers.length === 0) {
      Alert.alert(
        'No hours to submit',
        'Your crew has no logged time for this week. Submit anyway only if intentional (e.g. shutdown week).',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit empty', style: 'destructive', onPress: doSubmit },
        ],
      );
      return;
    }
    Alert.alert(
      'Submit to Supervisor',
      `Submit ${hoursSummary.grand_total.toFixed(1)}h across ${workers.length} ${workers.length === 1 ? 'worker' : 'workers'} for week ending ${range.weekEnding}? You won't be able to edit after submission unless the supervisor disputes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', style: 'default', onPress: doSubmit },
      ],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, workers.length, hoursSummary.grand_total, range.weekEnding]);

  const doSubmit = useCallback(async () => {
    if (!projectId) return;
    setMode('submitting');
    try {
      const result = await submitForemanWeekly({
        project_id: projectId,
        week_ending: range.weekEnding,
        hours_summary: hoursSummary,
        foreman_notes: notes.trim() || null,
      });
      logger.info('[timesheet] submission created', result.submission_id);
      // Re-fetch the submission record so the lock state reflects accurately.
      await fetchSubmission();
      Alert.alert(
        'Submitted',
        'Your weekly timesheet was sent to the supervisor for review.',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not submit.';
      Alert.alert('Submission failed', msg);
    } finally {
      setMode('idle');
    }
  }, [projectId, range.weekEnding, hoursSummary, notes, fetchSubmission]);

  const isLocked =
    submission?.status === 'pending_supervisor_review' ||
    submission?.status === 'approved';

  return (
    <View style={Wrap}>
      <Stack.Screen options={{ title: 'Weekly Timesheet' }} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
          />
        }
      >
        {/* Project + week */}
        <View
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#1E293B',
            backgroundColor: '#1E293B',
          }}
        >
          <Text style={Label}>WEEK ENDING {range.weekEnding}</Text>
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginTop: 4 }}>
            {range.label}
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>
            Project: {projectName || '—'}
          </Text>
        </View>

        {/* Submission status banner (if locked) */}
        {submission ? (
          <SubmissionBanner submission={submission} />
        ) : null}

        {/* Stats strip */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <SummaryChip
            color="#22C55E"
            label="Man-hours"
            value={hoursSummary.grand_total.toFixed(1)}
          />
          <SummaryChip
            color="#3B82F6"
            label="Workers"
            value={String(workers.length)}
          />
        </View>

        {/* Grid */}
        {loading && !submissionLoaded ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <ActivityIndicator color="#F97316" />
          </View>
        ) : workers.length === 0 ? (
          <View style={{ padding: 48, alignItems: 'center' }}>
            <Ionicons name="people-outline" size={40} color="#475569" />
            <Text
              style={{
                color: '#94A3B8',
                marginTop: 12,
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              No hours logged for your crew this week.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <Header />
              {workers.map((w) => (
                <WorkerRow key={w.worker_id} worker={w} />
              ))}
            </View>
          </ScrollView>
        )}

        {/* Notes (only editable when not locked) */}
        <Text style={[Label, { marginTop: 18 }]}>
          Notes (optional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Pedro left Thu morning for medical appointment..."
          placeholderTextColor="#64748B"
          multiline
          numberOfLines={3}
          style={[Input, { minHeight: 72, textAlignVertical: 'top' }]}
          editable={!isLocked && mode !== 'submitting'}
        />

        {/* Submit / Locked CTA */}
        {isLocked ? (
          <View style={[InfoBox, { marginTop: 24 }]}>
            <Ionicons
              name="lock-closed"
              size={16}
              color={submission?.status === 'approved' ? '#22C55E' : '#F59E0B'}
            />
            <Text
              style={{
                color: '#CBD5E1',
                fontSize: 13,
                marginLeft: 8,
                flex: 1,
              }}
            >
              {submission?.status === 'approved'
                ? 'Approved by supervisor — payroll processing.'
                : 'Submitted — pending supervisor review.'}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={mode === 'submitting'}
            style={[
              SubmitBtn,
              mode === 'submitting' && { opacity: 0.5 },
            ]}
          >
            {mode === 'submitting' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={SubmitBtnText}>Submit to Supervisor</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Header() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={[NameCell, { backgroundColor: '#0F172A' }]}>
        <Text style={HeaderText}>Worker</Text>
      </View>
      {WEEK_DAYS.map((d) => (
        <View key={d} style={[DayCell, { backgroundColor: '#0F172A' }]}>
          <Text style={HeaderText}>{d}</Text>
        </View>
      ))}
      <View style={[TotalCell, { backgroundColor: '#0F172A' }]}>
        <Text style={HeaderText}>Total</Text>
      </View>
    </View>
  );
}

function WorkerRow({ worker }: { worker: WorkerWeekRow }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
      }}
    >
      <View style={NameCell}>
        <Text numberOfLines={1} style={CellText}>
          {worker.full_name}
        </Text>
      </View>
      {WEEK_DAYS.map((d) => (
        <View key={d} style={DayCell}>
          <Text style={CellText}>
            {worker.days[d] > 0 ? worker.days[d].toFixed(1) : '—'}
          </Text>
        </View>
      ))}
      <View style={TotalCell}>
        <Text style={[CellText, { color: '#22C55E', fontWeight: '700' }]}>
          {worker.total.toFixed(1)}
        </Text>
      </View>
    </View>
  );
}

function SubmissionBanner({
  submission,
}: {
  submission: ForemanSubmissionRecord;
}) {
  const status = submission.status;
  const color =
    status === 'approved'
      ? '#22C55E'
      : status === 'disputed'
        ? '#F59E0B'
        : status === 'cancelled'
          ? '#64748B'
          : '#3B82F6';
  const label =
    status === 'approved'
      ? 'Approved by supervisor'
      : status === 'disputed'
        ? 'Disputed by supervisor'
        : status === 'cancelled'
          ? 'Cancelled'
          : 'Submitted — pending review';
  return (
    <View
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: `${color}15`,
        borderWidth: 1,
        borderColor: `${color}40`,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons
          name={
            status === 'approved'
              ? 'checkmark-circle'
              : status === 'disputed'
                ? 'alert-circle'
                : 'time'
          }
          size={18}
          color={color}
        />
        <Text style={{ color, fontWeight: '700', fontSize: 14 }}>{label}</Text>
      </View>
      {submission.supervisor_dispute_reason ? (
        <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 6 }}>
          {submission.supervisor_dispute_reason}
        </Text>
      ) : null}
    </View>
  );
}

function SummaryChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        borderRadius: 10,
        backgroundColor: `${color}15`,
        borderWidth: 1,
        borderColor: `${color}40`,
        alignItems: 'center',
      }}
    >
      <Text style={{ color, fontSize: 18, fontWeight: '700' }}>{value}</Text>
      <Text
        style={{
          color: '#94A3B8',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const Wrap = { flex: 1, backgroundColor: '#0F172A' };

const Label = {
  color: '#94A3B8',
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
  marginBottom: 6,
};

const Input = {
  backgroundColor: '#1E293B',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
  color: '#F8FAFC',
  fontSize: 14,
  borderWidth: 1,
  borderColor: '#334155',
};

const SubmitBtn = {
  marginTop: 24,
  height: 56,
  borderRadius: 14,
  backgroundColor: '#F97316',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
};

const SubmitBtnText = {
  color: '#FFFFFF',
  fontSize: 17,
  fontWeight: '700' as const,
};

const InfoBox = {
  padding: 12,
  borderRadius: 10,
  backgroundColor: '#1E293B',
  borderWidth: 1,
  borderColor: '#334155',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
};

const NameCell = {
  width: 140,
  paddingHorizontal: 10,
  paddingVertical: 10,
  justifyContent: 'center' as const,
};

const DayCell = {
  width: 56,
  paddingVertical: 10,
  alignItems: 'center' as const,
};

const TotalCell = {
  width: 64,
  paddingVertical: 10,
  alignItems: 'center' as const,
};

const HeaderText = {
  color: '#64748B',
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
};

const CellText = {
  color: '#F8FAFC',
  fontSize: 13,
};
