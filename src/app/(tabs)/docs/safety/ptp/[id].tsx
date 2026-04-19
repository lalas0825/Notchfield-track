/**
 * PTP wizard — multi-step editor over a single safety_documents row.
 *
 * Flow:
 *   tasks → review → signatures → distribute → done
 *
 * Each step saves progress to the shared DB row via PowerSync, so the PM
 * sees incremental progress in Takeoff web without any sync layer. Closing
 * the app and reopening resumes at the right step.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useMyWorker } from '@/features/workers/hooks/useMyWorker';
import { workerFullName } from '@/features/workers/types';
import { usePtp } from '@/features/safety/ptp/hooks/usePtp';
import { useJhaLibrary } from '@/features/safety/ptp/hooks/useJhaLibrary';
import { PtpTaskPicker } from '@/features/safety/ptp/components/PtpTaskPicker';
import { PtpReview } from '@/features/safety/ptp/components/PtpReview';
import { PtpSignatures } from '@/features/safety/ptp/components/PtpSignatures';
import { PtpDistribute } from '@/features/safety/ptp/components/PtpDistribute';
import { OnboardingBlocker } from '@/features/workers/components/OnboardingBlocker';
import { buildPtpLabels } from '@/features/safety/ptp/services/buildPtpLabels';
import {
  PtpContentSchema,
  type PtpContent,
  type PtpSelectedTask,
  type Trade,
} from '@/features/safety/ptp/types';

type Step = 'tasks' | 'review' | 'signatures' | 'distribute';

const STEP_TITLES: Record<Step, string> = {
  tasks: 'What are we doing?',
  review: 'Review & Sign',
  signatures: 'Crew Sign-Off',
  distribute: 'Send PTP',
};

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

export default function PtpWizardScreen() {
  const { id, step: initialStep } = useLocalSearchParams<{ id: string; step?: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { worker: myWorker, loading: myWorkerLoading, needsOnboarding } = useMyWorker();

  const { doc, loading, saveContent, addSignature, removeSignatureAt } = usePtp(id);

  const content: PtpContent | null = useMemo(() => {
    if (!doc) return null;
    const parsed = PtpContentSchema.safeParse(doc.content);
    return parsed.success ? parsed.data : null;
  }, [doc]);

  const [step, setStep] = useState<Step>('tasks');
  const [defaultRecipients, setDefaultRecipients] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string>(activeProject?.name ?? '');
  const [projectAddress, setProjectAddress] = useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [oshaCitations, setOshaCitations] = useState(true);

  const library = useJhaLibrary(
    profile?.organization_id ?? null,
    activeProject?.id ?? null,
    (content?.trade as Trade) ?? null,
  );

  // Load project details for labels + default recipients
  useEffect(() => {
    async function load() {
      if (!activeProject) return;
      type Row = {
        id: string;
        name: string;
        address: string | null;
        safety_distribution_emails: string | string[] | null;
      };
      const local = await localQuery<Row>(
        `SELECT id, name, address, safety_distribution_emails FROM projects WHERE id = ? LIMIT 1`,
        [activeProject.id],
      );
      let row: Row | null = local?.[0] ?? null;
      if (!row) {
        const { data } = await supabase
          .from('projects')
          .select('id, name, address, safety_distribution_emails')
          .eq('id', activeProject.id)
          .maybeSingle();
        if (data) row = data as Row;
      }
      if (row) {
        setProjectName(row.name);
        setProjectAddress(row.address ?? undefined);
        setDefaultRecipients(parseJson<string[]>(row.safety_distribution_emails, []));
      }
    }
    load();
  }, [activeProject]);

  // Resolve initial step once content loads
  useEffect(() => {
    if (!content) return;
    if (initialStep === 'tasks' || initialStep === 'review' || initialStep === 'signatures' || initialStep === 'distribute') {
      setStep(initialStep);
      return;
    }
    if (content.selected_tasks.length === 0) {
      setStep('tasks');
    } else if (!doc?.signatures || doc.signatures.length === 0) {
      setStep('review');
    } else {
      setStep('signatures');
    }
    setOshaCitations(content.osha_citations_included ?? true);
    setSelectedIds(new Set(content.selected_tasks.map((t) => t.jha_library_id)));
  }, [content, doc?.signatures, initialStep]);

  if (loading || myWorkerLoading || !content || !doc || !profile || !activeProject) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }

  // PM hasn't added this foreman to Manpower yet — block the whole flow.
  if (needsOnboarding || !myWorker) {
    return <OnboardingBlocker />;
  }

  const handleTasksContinue = async (selected: PtpSelectedTask[]) => {
    const next: PtpContent = { ...content, selected_tasks: selected };
    const result = await saveContent(next);
    if (!result.success) {
      Alert.alert('Save failed', result.error ?? 'Could not save tasks');
      return;
    }
    setStep('review');
  };

  const handleReviewContinue = async (trimmedTasks: PtpSelectedTask[]) => {
    // Persist any hazard deletions the foreman made in the Review step
    const next: PtpContent = { ...content, selected_tasks: trimmedTasks };
    const result = await saveContent(next);
    if (!result.success) {
      Alert.alert('Save failed', result.error ?? 'Could not save review');
      return;
    }
    setStep('signatures');
  };

  const handleToggleOsha = async (value: boolean) => {
    setOshaCitations(value);
    await saveContent({ ...content, osha_citations_included: value });
  };

  const labels = buildPtpLabels({
    title: doc.title,
    projectName,
    projectAddress,
    foremanName: content.foreman_name,
    dateIso: content.ptp_date,
    shift: content.shift,
    areaLabel: content.area_label,
    trade: content.trade,
    weather: content.weather ?? null,
    oshaCitationsIncluded: oshaCitations,
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: STEP_TITLES[step],
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <View className="flex-1 bg-background">
        <StepIndicator current={step} />

        {step === 'tasks' ? (
          <PtpTaskPicker
            items={library.items}
            selectedIds={selectedIds}
            onToggle={(id) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onContinue={handleTasksContinue}
            onBack={() => router.back()}
            loading={library.loading}
          />
        ) : null}

        {step === 'review' ? (
          <PtpReview
            selectedTasks={content.selected_tasks}
            onContinue={handleReviewContinue}
            onBack={() => setStep('tasks')}
          />
        ) : null}

        {step === 'signatures' ? (
          <PtpSignatures
            docId={doc.id}
            projectId={activeProject.id}
            foremanWorkerId={myWorker.id}
            foremanWorkerName={workerFullName(myWorker)}
            foremanSstCardNumber={myWorker.sst_card_number ?? null}
            organizationId={profile.organization_id}
            createdBy={profile.id}
            signatures={doc.signatures ?? []}
            onAddSignature={addSignature}
            onRemoveSignature={removeSignatureAt}
            onContinue={() => setStep('distribute')}
            onBack={() => setStep('review')}
          />
        ) : null}

        {step === 'distribute' ? (
          <PtpDistribute
            docId={doc.id}
            labels={labels}
            defaultRecipients={defaultRecipients}
            oshaCitationsIncluded={oshaCitations}
            onToggleOshaCitations={handleToggleOsha}
            onSent={(result) => {
              const msg = result.queued
                ? 'PTP queued — will send when back online.'
                : `PTP sent to ${result.emailsSent ?? 0} recipient${result.emailsSent === 1 ? '' : 's'}.`;
              Alert.alert('Submitted', msg, [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(tabs)/docs'),
                },
              ]);
            }}
            onBack={() => setStep('signatures')}
          />
        ) : null}
      </View>
    </>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const order: Step[] = ['tasks', 'review', 'signatures', 'distribute'];
  const currentIdx = order.indexOf(current);

  return (
    <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-2">
      {order.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <View key={s} className="flex-1 flex-row items-center">
            <View
              className={`h-6 w-6 items-center justify-center rounded-full ${
                active ? 'bg-brand-orange' : done ? 'bg-success' : 'bg-slate-700'
              }`}
            >
              {done ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text className="text-xs font-bold text-white">{i + 1}</Text>
              )}
            </View>
            {i < order.length - 1 ? (
              <View className={`mx-1 h-0.5 flex-1 ${done ? 'bg-success' : 'bg-slate-700'}`} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// Horizontal padding wrapper kept available for future screens that don't
// lay out edge-to-edge.
export function Stage({ children }: { children: React.ReactNode }) {
  return <ScrollView className="flex-1 px-4">{children}</ScrollView>;
}
