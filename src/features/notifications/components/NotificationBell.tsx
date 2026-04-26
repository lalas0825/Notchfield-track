/**
 * Sprint 69 — Notification Bell.
 *
 * Header icon mounted in the Home screen alongside ProjectNotesIcon. Shows a
 * red badge with the count of unread notifications (no read_at, not
 * archived). Tap → /(tabs)/notifications full-screen list.
 *
 * Design mirrors ProjectNotesIcon (Sprint 53A.1) so they sit side-by-side
 * cleanly. Same 40dp circular tappable, same badge style, same hitSlop.
 *
 * Hides when activeProject is null — same rule as ProjectNotesIcon (the
 * Welcome state has no header chrome).
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useNotifications } from '../hooks/useNotifications';

export function NotificationBell() {
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const { unreadCount } = useNotifications();

  if (!activeProject) return null;

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/notifications' as any)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `Notifications: ${unreadCount} unread`
          : 'Notifications'
      }
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <Ionicons name="notifications" size={20} color="#94A3B8" />
      {unreadCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: '#EF4444',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#0F172A',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
