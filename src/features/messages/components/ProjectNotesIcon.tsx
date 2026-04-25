/**
 * Sprint 53A.1 — Project Notes header icon.
 *
 * Tappable chat-bubble icon mounted in the Home screen header. Shows a red
 * badge with the count of General-channel messages from the last 24h.
 * Tap → navigates to /(tabs)/messages/general (full-screen project-wide
 * thread).
 *
 * Why on Home and not in a tab: General is a low-frequency channel
 * (announcements, project-wide alerts). Putting it in the tab bar would
 * waste a slot since most foreman traffic is per-area. Header icon with
 * badge keeps it discoverable without ranking it equal to Production
 * Board / Plans / Safety / etc.
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useGeneralChannelActivity } from '../hooks/useGeneralChannelActivity';

export function ProjectNotesIcon() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeProject = useProjectStore((s) => s.activeProject);
  const { recentCount } = useGeneralChannelActivity(userId, activeProject?.id ?? null);

  if (!activeProject) return null;

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/messages' as any)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        recentCount > 0
          ? `Project notes: ${recentCount} recent`
          : 'Project notes'
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
      <Ionicons name="chatbubbles" size={20} color="#94A3B8" />
      {recentCount > 0 && (
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
            {recentCount > 99 ? '99+' : recentCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
