import { Stack } from 'expo-router';

/**
 * Sprint 72 — Stack layout for sign-offs route under More.
 * Memory feedback_expo_router_tab_folder_needs_layout: every folder under
 * (tabs)/ needs an explicit _layout.tsx for Stack.Screen options to bind.
 */
export default function SignoffsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    />
  );
}
