import { Stack } from 'expo-router';

/**
 * Sprint 71 — Stack layout for deficiency detail routes.
 *
 * Sibling to [areaId].tsx under board/. Required per the expo-router
 * lesson (Sprint 53A.1): every nested folder under (tabs)/ needs an
 * explicit _layout.tsx for the Stack screens to bind their options
 * correctly. Without it, headerLeft / title / etc are silently bypassed.
 */
export default function DeficiencyLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    />
  );
}
