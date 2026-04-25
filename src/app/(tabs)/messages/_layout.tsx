import { Stack } from 'expo-router';

/**
 * Sprint 53A.1 (fix 2026-04-25) — Stack layout for the Messages tab.
 *
 * Without this _layout.tsx file, expo-router can't properly integrate the
 * `messages` folder with the parent Tabs navigator: the explicit
 * <Tabs.Screen name="messages"> declaration in (tabs)/_layout.tsx gets
 * IGNORED, and the route falls through to auto-discovered placement
 * (broken icon, appended at the end of the tab bar after More).
 *
 * Every other tab folder (home/, board/, plans/, tickets/, docs/,
 * deliveries/, more/) has its own _layout.tsx with a Stack — Messages
 * was missing it. Pattern matches more/_layout.tsx (header visible).
 */
export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    />
  );
}
