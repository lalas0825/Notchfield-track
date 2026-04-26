import { Stack } from 'expo-router';

/**
 * Sprint 70 — Stack layout for the (hidden) Today tab.
 *
 * Without this _layout.tsx, expo-router can't reliably bind the
 * <Tabs.Screen name="today" href={null}/> declaration in
 * (tabs)/_layout.tsx — same lesson as Sprint 53A.1 messages tab and
 * Sprint 69 notifications tab.
 */
export default function TodayLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    />
  );
}
