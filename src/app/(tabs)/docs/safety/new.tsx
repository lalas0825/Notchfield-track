import { Stack, useLocalSearchParams } from 'expo-router';
import { SafetyForm } from '@/features/safety/components/SafetyForm';
import { DOC_TYPE_LABELS, type DocType } from '@/features/safety/types/schemas';

export default function NewSafetyDocScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const docType = (type ?? 'jha') as DocType;

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
