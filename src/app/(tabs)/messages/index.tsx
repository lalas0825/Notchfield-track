/**
 * Sprint 53A.1 — Project-level General channel screen.
 *
 * Full-screen view of messages where `area_id IS NULL`. Mirror of the
 * per-area thread mounted inside AreaDetail, but anchored to the project
 * instead of a specific area. Reuses MessageThread + MessageComposer at
 * 100% — only difference is `areaId={null}` on the thread.
 *
 * Entry points:
 *   - Bottom tab "Messages" (chatbubbles, between Delivery + More)
 *   - Home header chat icon (ProjectNotesIcon) — quick badge on Home
 *   - Push notification when the message has area_id=null
 */

import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { markGeneralChannelVisited } from '@/features/messages/hooks/useGeneralChannelActivity';

export default function ProjectNotesScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const activeProject = useProjectStore((s) => s.activeProject);

  // Sprint 53A.1 fix 2026-04-25: when the user leaves the screen, mark
  // visited. The header icon + bottom tab badge then query the count of
  // messages newer than the last visit (excluding own messages), so the
  // badge resets to 0 next time they're on Home / another tab.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (user?.id && activeProject?.id) {
          markGeneralChannelVisited(user.id, activeProject.id).catch(() => undefined);
        }
      };
    }, [user?.id, activeProject?.id]),
  );

  if (!user || !profile || !activeProject) {
    return (
      <>
        <Stack.Screen options={{ title: 'Project Notes' }} />
        <View className="flex-1 items-center justify-center bg-background px-6">
          <Ionicons name="chatbubbles-outline" size={48} color="#334155" />
          <Text className="mt-4 text-center text-base text-slate-400">
            Select a project to see its notes.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Project Notes',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <ScrollView
        className="flex-1 bg-background px-4 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {/* Project context header */}
        <View className="mb-3 flex-row items-center">
          <Ionicons name="business" size={14} color="#F97316" />
          <Text className="ml-1.5 text-base text-brand-orange">
            {activeProject.name}
          </Text>
        </View>
        <Text className="mb-4 text-sm text-slate-500">
          Project-wide announcements and notes. Use area threads for location-specific work.
        </Text>

        {/* Reuses MessageThread with areaId=null = project channel */}
        <MessageThread projectId={activeProject.id} areaId={null} />

        <View className="h-12" />
      </ScrollView>
    </>
  );
}
