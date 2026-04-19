/**
 * Toolbox wizard — multi-step over a single safety_documents row.
 *
 * Flow: present → signatures → distribute → done.
 *
 * Persists to the shared DB row via PowerSync + direct Supabase for
 * signatures. Resuming lands the foreman on the right step based on
 * photo_urls / signatures / content.distribution presence.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useMyWorker } from '@/features/workers/hooks/useMyWorker';
import { workerFullName } from '@/features/workers/types';
import { OnboardingBlocker } from '@/features/workers/components/OnboardingBlocker';
import { useToolbox } from '@/features/safety/toolbox/hooks/useToolbox';
import { ToolboxPresent } from '@/features/safety/toolbox/components/ToolboxPresent';
import { ToolboxDistribute } from '@/features/safety/toolbox/components/ToolboxDistribute';
import { buildToolboxLabels } from '@/features/safety/toolbox/services/buildToolboxLabels';
import { ToolboxContentSchema, type ToolboxContent } from '@/features/safety/toolbox/types';
import { PtpSignatures } from '@/features/safety/ptp/components/PtpSignatures';

type Step = 'present' | 'signatures' | 'distribute';

const STEP_TITLES: Record<Step, string> = {
  present: 'Weekly Safety',
  signatures: 'Crew Sign-Off',
  distribute: 'Send Talk',
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

export default function ToolboxWizardScreen() {
  const { id, step: initialStep } = useLocalSearchParams<{ id: string; step?: string }>();
  const router = useRouter();
  const { profile, user } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { worker: myWorker, loading: myWorkerLoading, needsOnboarding } = useMyWorker();

  const { doc, loading, saveContent, addSignature, removeSignatureAt } = useToolbox(id);

  const content = useMemo<ToolboxContent | null>(() => {
    if (!doc) return null;
    const parsed = ToolboxContentSchema.safeParse(doc.content);
    return parsed.success ? parsed.data : null;
  }, [doc]);

  const [step, setStep] = useState<Step>('present');
  const [defaultRecipients, setDefaultRecipients] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string>(activeProject?.name ?? '');
  const [projectAddress, setProjectAddress] = useState<string | undefined>(undefined);
  const [oshaCitations, setOshaCitations] = useState(true);
  const [discussionNotes, setDiscussionNotes] = useState('');

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

  // Resume-step guard — run once on mount. If we re-ran on every content
  // change, manual step transitions (Present→Sign→Send) would keep
  // bouncing back to the auto-resume target.
  const didInitStep = useRef(false);
  useEffect(() => {
    if (didInitStep.current) return;
    if (!content) return;
    didInitStep.current = true;

    if (
      initialStep === 'present' ||
      initialStep === 'signatures' ||
      initialStep === 'distribute'
    ) {
      setStep(initialStep);
    } else {
      const sigCount = doc?.signatures?.length ?? 0;
      const distributed = content.distribution?.distributed_at;
      if (distributed) {
        setStep('distribute');
      } else if (sigCount > 0) {
        setStep('signatures');
      } else {
        setStep('present');
      }
    }
    setDiscussionNotes(content.discussion_notes ?? '');
  }, [content, doc?.signatures, initialStep]);

  if (loading || myWorkerLoading || !content || !doc || !profile || !user || !activeProject) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }

  if (needsOnboarding || !myWorker) {
    return <OnboardingBlocker />;
  }

  const handlePresentContinue = async ({
    photo_urls,
    delivered_language,
  }: {
    photo_urls: string[];
    delivered_language: 'en' | 'es' | 'both';
  }) => {
    const result = await saveContent({ photo_urls, delivered_language });
    if (!result.success) {
      Alert.alert('Save failed', result.error ?? 'Could not save progress');
      return;
    }
    setStep('signatures');
  };

  const handleToggleOsha = (next: boolean) => {
    setOshaCitations(next);
  };

  const handleDiscussionNotesChange = (next: string) => {
    setDiscussionNotes(next);
    // Debounced write would be nicer; shallow save on every keystroke is
    // fine here because writes go local-first via PowerSync.
    saveContent({ discussion_notes: next });
  };

  const labels = buildToolboxLabels({
    title: doc.title,
    projectName,
    projectAddress,
    foremanName: content.foreman_name,
    dateIso: content.delivered_date,
    shift: content.shift,
    language: content.delivered_language,
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

        {step === 'present' ? (
          <ToolboxPresent
            docId={doc.id}
            organizationId={profile.organization_id}
            topic={content.topic_snapshot}
            initialPhotoUrls={content.photo_urls}
            initialLanguageUsed={content.delivered_language}
            onContinue={handlePresentContinue}
            onBack={() => router.back()}
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
            onBack={() => setStep('present')}
          />
        ) : null}

        {step === 'distribute' ? (
          <ToolboxDistribute
            docId={doc.id}
            labels={labels}
            defaultRecipients={defaultRecipients}
            oshaCitationsIncluded={oshaCitations}
            discussionNotes={discussionNotes}
            signatureCount={doc.signatures?.length ?? 0}
            onToggleOshaCitations={handleToggleOsha}
            onDiscussionNotesChange={handleDiscussionNotesChange}
            onSent={(result) => {
              const msg = result.queued
                ? 'Toolbox queued — will send when back online.'
                : `Toolbox sent to ${result.emailsSent ?? 0} recipient${result.emailsSent === 1 ? '' : 's'}.`;
              Alert.alert('Submitted', msg, [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(tabs)/home'),
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
  const order: Step[] = ['present', 'signatures', 'distribute'];
  const currentIdx = order.indexOf(current);
  const labels = ['Present', 'Sign', 'Send'];

  return (
    <View className="flex-row items-center border-b border-border bg-card px-4 py-2">
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
            <Text
              className="ml-1 text-xs"
              style={{ color: active ? '#F97316' : done ? '#22C55E' : '#64748B' }}
            >
              {labels[i]}
            </Text>
            {i < order.length - 1 ? (
              <View
                className={`mx-1 h-0.5 flex-1 ${done ? 'bg-success' : 'bg-slate-700'}`}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
