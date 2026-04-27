import { Stack } from 'expo-router';

/**
 * Sprint 71 Phase 2 — Stack layout for the supervisor Compliance route.
 * Required per the expo-router lesson — every nested folder under
 * (tabs)/ needs an explicit _layout.tsx for the Stack screen options
 * to bind correctly.
 */
export default function ComplianceLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    />
  );
}
