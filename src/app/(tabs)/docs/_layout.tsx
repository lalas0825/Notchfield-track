import { Stack } from 'expo-router';
import { usePtpDistributionFlusher } from '@/features/safety/ptp/hooks/usePtpDistributionFlusher';

export default function DocsLayout() {
  // Retry any PTP distributes that were queued offline
  usePtpDistributionFlusher();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    />
  );
}
