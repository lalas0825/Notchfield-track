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
        // Each tab folder ships its own Stack (board/_layout.tsx,
        // more/_layout.tsx, etc.) which manages headers + back buttons
        // for nested screens. The outer Tabs header rendering at the
        // same time was double-stacking and visually swallowing the
        // Stack's back arrow on More — pilot reported "si estoy dentro
        // de un tab no tengo como regresar" 2026-04-29. Hide the outer
        // Tabs header globally; let each Stack's headers be the sole
        // source of titles + back navigation.
        headerShown: false,
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
          // MaterialCommunityIcons used because Ionicons has no truck glyph.
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="truck" size={size} color={color} />
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
      {/* Sprint 69 — Notifications screen. Hidden from the tab bar; entry
          is the bell icon in the Home header (<NotificationBell/>). The
          `href: null` hint is what tells expo-router not to render a
          tab-bar button for this route while still keeping it inside the
          Tabs navigator (so the bottom bar stays visible while reading
          notifications). */}
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      {/* Sprint 70 — Today action queue. Hidden tab; entry is the
          checkbox icon in the Home header (<TodayHeaderIcon/>). Same
          href:null rationale as notifications above. */}
      <Tabs.Screen
        name="today"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
