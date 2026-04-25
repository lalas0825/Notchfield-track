import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useGeneralChannelActivity } from '@/features/messages/hooks/useGeneralChannelActivity';

const TAB_BAR_STYLE = {
  backgroundColor: '#0F172A',
  borderTopColor: '#334155',
  height: 88,
  paddingBottom: 24,
};

const ACTIVE_COLOR = '#F97316';
const INACTIVE_COLOR = '#94A3B8';

export default function TabsLayout() {
  // Sprint 53A.1 fix 2026-04-25: subscribe to General channel activity here
  // so the Messages tab's tabBarBadge re-renders when the count changes.
  // Same hook as the Home header ProjectNotesIcon — single source of truth.
  // ProjectNotesScreen calls markGeneralChannelVisited on blur to reset.
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeProjectId = useProjectStore((s) => s.activeProject?.id ?? null);
  const { recentCount } = useGeneralChannelActivity(userId, activeProjectId);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: 'Board',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tickets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="docs"
        options={{
          title: 'Safety',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Delivery',
          // MaterialCommunityIcons used because Ionicons has no truck glyph;
          // 'truck-delivery' is a truck silhouette with a package indicator,
          // matching the deliveries surface semantics better than a passenger car.
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="truck-delivery" size={size} color={color} />
          ),
        }}
      />
      {/* Sprint 53A.1 — Project-wide General channel. Positioned between
          Delivery and More per pilot feedback (2026-04-25). The route file
          is `messages/index.tsx` (renamed from messages/general.tsx) so a
          tap on the tab opens the General channel directly. tabBarBadge
          shows recentCount (unread, computed against last_visited from
          AsyncStorage); resets to 0 when the user leaves the screen. */}
      <Tabs.Screen
        name="messages"
        options={{
          // "Messages" was truncating to "Messa..." in the tab bar (8 tabs
          // total, narrow per-tab width). "Notes" matches the screen's
          // header title (Project Notes) and is shorter.
          title: 'Notes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
          tabBarBadge: recentCount > 0 ? recentCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
