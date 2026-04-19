import { useEffect } from 'react';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafetyForm } from '@/features/safety/components/SafetyForm';
import { DOC_TYPE_LABELS } from '@/features/safety/types/schemas';

/**
 * Legacy new-safety-document entry. Handles JHA only.
 * Deep links asking for `type=ptp` redirect to the PTP wizard.
 * Deep links asking for `type=toolbox` (or the old `toolbox_talk` alias)
 * redirect to the Toolbox wizard.
 */
export default function NewSafetyDocScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();

  const redirectTarget =
    type === 'ptp'
      ? '/(tabs)/docs/safety/ptp/new'
      : type === 'toolbox' || type === 'toolbox_talk'
        ? '/(tabs)/docs/safety/toolbox/new'
        : null;

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget as any);
  }, [redirectTarget, router]);

  if (redirectTarget) return <Redirect href={redirectTarget as any} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: `New ${DOC_TYPE_LABELS.jha}`,
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <SafetyForm docType="jha" />
    </>
  );
}
