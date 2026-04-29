import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useCrew } from '@/features/crew/hooks/useCrew';
import { useCertAlerts } from '@/features/crew/hooks/useCertAlerts';
import { useStaleEntries } from '@/features/crew/hooks/useStaleEntries';
import { WorkerCard } from '@/features/crew/components/WorkerCard';
import { AreaPicker } from '@/features/crew/components/AreaPicker';
import { CrewHistoryView } from '@/features/crew/components/CrewHistoryView';

type Step = 'workers' | 'area';
type Tab = 'today' | 'history';

export default function CrewScreen() {
  // Selectors (not full-store destructuring) so unrelated state changes
  // in these stores don't re-render this screen and re-fire the useCrew
  // reload loop. See useCrew.ts header for the full incident note.
  const profile = useAuthStore((s) => s.profile);
  const activeProject = useProjectStore((s) => s.activeProject);
  const {
    workers,
    areas,
    assignments,
    todayHours,
    assignWorker,
    endShift,
    getWorkerAssignment,
    getAreaWorkers,
  } = useCrew();
  const { getCertSummary, hasExpiredCerts } = useCertAlerts(profile?.organization_id);
  const stale = useStaleEntries(activeProject?.id ?? null);

  const [tab, setTab] = useState<Tab>('today');
  const [step, setStep] = useState<Step>('workers');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const handleCloseStale = () => {
    Alert.alert(
      'Close stale entries',
      `${stale.count} ${stale.count === 1 ? 'entry has' : 'entries have'} been open over 18 hours. Each will be capped at 8pm of the day it started — usually means a forgotten End Day. This is a one-time cleanup; proper end-of-day cron is a Web team follow-up.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close all',
          style: 'destructive',
          onPress: () => {
            stale.closeAll();
          },
        },
      ],
    );
  };

  const toggleWorker = (id: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id],
    );
  };

  /**
   * Run the assignment loop with guaranteed loading-state cleanup. The
   * old code didn't wrap the for-loop in try/finally, so any throw from
   * `assignWorker` (PowerSync write race, network blip on the
   * fetchAssignments refetch, etc.) left `assigning` stuck at true and
   * the Assign button spun forever. Surface the error to the user
   * instead of swallowing.
   */
  const runAssignLoop = async () => {
    if (!selectedArea) return;
    setAssigning(true);
    const failures: string[] = [];
    try {
      for (const workerId of selectedWorkers) {
        try {
          const res = await assignWorker(workerId, selectedArea);
          if (!res?.success) {
            const name =
              workers.find((w) => w.id === workerId)?.full_name ?? 'Worker';
            failures.push(`${name}: ${res?.error ?? 'unknown error'}`);
          }
        } catch (e) {
          const name =
            workers.find((w) => w.id === workerId)?.full_name ?? 'Worker';
          const msg = e instanceof Error ? e.message : 'unknown error';
          failures.push(`${name}: ${msg}`);
        }
      }
    } finally {
      // ALWAYS reset loading + step state, even if some workers failed.
      // Otherwise the button stays stuck on the loading spinner.
      setAssigning(false);
      setSelectedWorkers([]);
      setSelectedArea(null);
      setStep('workers');
    }
    if (failures.length > 0) {
      Alert.alert(
        'Some assignments failed',
        failures.join('\n') +
          '\n\nThe ones that succeeded are saved; you can retry the failed ones.',
      );
    }
  };

  const handleAssign = async () => {
    if (!selectedArea || selectedWorkers.length === 0) return;

    // Check for expired certs first — confirm before running the loop.
    const expiredWorkers = selectedWorkers.filter((id) => hasExpiredCerts(id));
    if (expiredWorkers.length > 0) {
      const names = expiredWorkers
        .map((id) => workers.find((w) => w.id === id)?.full_name ?? 'Unknown')
        .join(', ');

      Alert.alert(
        'Expired Certifications',
        `${names} ${expiredWorkers.length === 1 ? 'has' : 'have'} expired certifications. Assign anyway under your responsibility?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Assign Anyway',
            style: 'destructive',
            onPress: () => {
              runAssignLoop();
            },
          },
        ],
      );
      return;
    }

    runAssignLoop();
  };

  /**
   * Sprint 73 Payroll Ask #1 — "End Shift" foreman-scoped close.
   * Renamed from "End Day" + switched from project-wide to foreman-scoped:
   * closes only THIS foreman's open entries + assignments. Lets multi-
   * foreman projects co-exist without one foreman accidentally closing
   * another's crew. Critical for clean payroll data — see
   * SPRINT_TRACK_PAYROLL.md Ask #1.
   */
  const handleEndShift = () => {
    Alert.alert(
      'End Shift',
      "Close all your crew's open time entries for today? Each worker's hours are saved to payroll. This cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Shift',
          style: 'destructive',
          onPress: async () => {
            await endShift();
          },
        },
      ],
    );
  };

  // Area name lookup for display
  const areaName = (areaId: string) =>
    areas.find((a) => a.id === areaId)?.name ?? 'Unknown';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Crew Management',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <View className="flex-1 bg-background">
        {/* Top tabs — Today (workspace) / History (reporting) */}
        <View className="flex-row border-b border-border">
          <Pressable
            onPress={() => setTab('today')}
            className={`flex-1 items-center py-3 ${tab === 'today' ? 'border-b-2 border-brand-orange' : ''}`}
          >
            <Text className={`text-base font-bold ${tab === 'today' ? 'text-brand-orange' : 'text-slate-400'}`}>
              Today
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('history')}
            className={`flex-1 items-center py-3 ${tab === 'history' ? 'border-b-2 border-brand-orange' : ''}`}
          >
            <Text className={`text-base font-bold ${tab === 'history' ? 'text-brand-orange' : 'text-slate-400'}`}>
              History
            </Text>
          </Pressable>
        </View>

        {/* Stale entries banner — visible from both tabs (cross-cutting concern).
            Copy 2026-04-29: was "not closed from a previous day" which conflated
            calendar-date with the actual >18h-open detection. Now states the
            literal threshold so the foreman knows what's flagged and why. */}
        {stale.count > 0 ? (
          <View className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <View className="flex-row items-center">
              <Ionicons name="alert-circle" size={18} color="#F59E0B" />
              <Text className="ml-2 flex-1 text-sm font-bold text-amber-500">
                {stale.count} {stale.count === 1 ? 'entry' : 'entries'} open over 18 hours
              </Text>
              <Pressable
                onPress={handleCloseStale}
                disabled={stale.closing}
                className="rounded-lg bg-amber-500 px-3 py-1.5 active:opacity-80"
                style={{ opacity: stale.closing ? 0.5 : 1 }}
              >
                <Text className="text-xs font-bold text-black">
                  {stale.closing ? 'Closing…' : 'Close all'}
                </Text>
              </Pressable>
            </View>
            <Text className="ml-6 mt-1 text-[11px] text-amber-300">
              Caps each at 8pm of the day it started — likely a forgotten End Day.
            </Text>
          </View>
        ) : null}

        {tab === 'history' ? (
          <CrewHistoryView />
        ) : (
          <>
            {/* Today summary bar */}
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
              <View className="flex-row items-center">
                <Ionicons name="people" size={18} color="#F97316" />
                <Text className="ml-2 text-base font-medium text-white">
                  {assignments.length} assigned
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="time" size={18} color="#22C55E" />
                <Text className="ml-2 text-base font-medium text-white">
                  {todayHours.toFixed(1)}h today
                </Text>
              </View>
            </View>

            {/* Step indicator */}
            <View className="flex-row border-b border-border">
              <Pressable
                onPress={() => setStep('workers')}
                className={`flex-1 items-center py-3 ${step === 'workers' ? 'border-b-2 border-brand-orange' : ''}`}
              >
                <Text className={`text-base font-medium ${step === 'workers' ? 'text-brand-orange' : 'text-slate-400'}`}>
                  1. Select Workers
                </Text>
              </Pressable>
              <Pressable
                onPress={() => selectedWorkers.length > 0 && setStep('area')}
                className={`flex-1 items-center py-3 ${step === 'area' ? 'border-b-2 border-brand-orange' : ''}`}
              >
                <Text className={`text-base font-medium ${step === 'area' ? 'text-brand-orange' : 'text-slate-400'}`}>
                  2. Pick Area
                </Text>
              </Pressable>
            </View>

        {/* Content */}
        <ScrollView className="flex-1 px-4 pt-4">
          {step === 'workers' && (
            <>
              {workers.length === 0 ? (
                <View className="items-center py-12">
                  <Ionicons name="people-outline" size={48} color="#334155" />
                  <Text className="mt-4 text-center text-base text-slate-400">
                    No workers in your organization.
                  </Text>
                </View>
              ) : (
                workers.map((worker) => {
                  const assignment = getWorkerAssignment(worker.id);
                  const certSummary = getCertSummary(worker.id);
                  return (
                    <WorkerCard
                      key={worker.id}
                      worker={worker}
                      currentArea={assignment ? areaName(assignment.area_id) : null}
                      selected={selectedWorkers.includes(worker.id)}
                      onPress={() => toggleWorker(worker.id)}
                      certStatus={certSummary?.worstStatus ?? null}
                    />
                  );
                })
              )}
            </>
          )}

          {step === 'area' && (
            <AreaPicker
              areas={areas}
              selectedAreaId={selectedArea}
              onSelect={setSelectedArea}
              getAreaWorkers={getAreaWorkers}
            />
          )}

          <View className="h-32" />
        </ScrollView>

        {/* Bottom action bar */}
        <View className="border-t border-border bg-card px-4 pb-8 pt-3">
          {step === 'workers' && selectedWorkers.length > 0 && (
            <Pressable
              onPress={() => setStep('area')}
              className="h-14 flex-row items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
            >
              <Text className="text-lg font-bold text-white">
                Next — Pick Area ({selectedWorkers.length} selected)
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </Pressable>
          )}

          {step === 'area' && selectedArea && (
            <Pressable
              onPress={handleAssign}
              disabled={assigning}
              className="h-14 flex-row items-center justify-center rounded-xl bg-success active:opacity-80"
            >
              {assigning ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                  <Text className="ml-2 text-lg font-bold text-white">
                    Assign {selectedWorkers.length} → {areaName(selectedArea)}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {step === 'workers' && selectedWorkers.length === 0 && assignments.length > 0 && (
            <Pressable
              onPress={handleEndShift}
              className="h-14 flex-row items-center justify-center rounded-xl border border-danger active:opacity-80"
            >
              <Ionicons name="moon" size={20} color="#EF4444" />
              <Text className="ml-2 text-lg font-bold text-danger">End Shift</Text>
            </Pressable>
          )}
        </View>
          </>
        )}
      </View>
    </>
  );
}
