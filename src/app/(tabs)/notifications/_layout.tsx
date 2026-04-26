import { Stack } from 'expo-router';

/**
 * Sprint 69 — Stack layout for the (hidden) Notifications tab.
 *
 * Without this _layout.tsx, expo-router can't reliably bind the
 * <Tabs.Screen name="notifications" href={null}/> declaration in
 * (tabs)/_layout.tsx — the route falls through to auto-discovery and the
 * `href: null` hide hint gets dropped, surfacing a broken icon at the end
 * of the tab bar (lesson from Sprint 53A.1 messages tab).
 *
 * Pattern matches messages/_layout.tsx — header is rendered by the screen
 * itself via Stack.Screen options, so we only set the dark-theme defaults.
 */
export default function NotificationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    />
  );
}
