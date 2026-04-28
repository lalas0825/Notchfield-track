import { Stack } from 'expo-router';

/**
 * Sprint 72 — Stack layout for sign-off detail routes.
 *
 * Sibling to [areaId].tsx under board/. Memory `feedback_expo_router_tab_folder_needs_layout`:
 * every nested folder under (tabs)/ needs an explicit _layout.tsx for the
 * Stack screens to bind their options correctly. Without it, headerLeft /
 * title / etc are silently bypassed.
 */
export default function SignoffLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    />
  );
}
