import { useEffect } from 'react';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafetyForm } from '@/features/safety/components/SafetyForm';
import { DOC_TYPE_LABELS, type DocType } from '@/features/safety/types/schemas';

/**
 * Legacy new-safety-document entry. Handles JHA and Toolbox Talk only.
 * Deep links that still ask for `type=ptp` are redirected to the new wizard
 * at /(tabs)/docs/safety/ptp/new so old shortcuts keep working.
 */
export default function NewSafetyDocScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();

  // Safety net — anything asking for PTP goes to the new wizard.
  useEffect(() => {
    if (type === 'ptp') {
      router.replace('/(tabs)/docs/safety/ptp/new' as any);
    }
  }, [type, router]);

  if (type === 'ptp') {
    return <Redirect href={'/(tabs)/docs/safety/ptp/new' as any} />;
  }

  const docType = (type === 'toolbox_talk' ? 'toolbox_talk' : 'jha') as Exclude<DocType, 'ptp'>;

  return (
    <>
      <Stack.Screen
        options={{
          title: `New ${DOC_TYPE_LABELS[docType] ?? 'Document'}`,
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <SafetyForm docType={docType} />
    </>
  );
}
