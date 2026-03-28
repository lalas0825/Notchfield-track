import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useLegalDocs } from '@/features/legal/hooks/useLegalDocs';
import { generateNodDraft } from '@/features/legal/services/legal-service';

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  draft: { color: '#F59E0B', label: 'Draft', icon: 'document-text-outline' },
  signed: { color: '#3B82F6', label: 'Signed', icon: 'checkmark-done' },
  sent: { color: '#22C55E', label: 'Sent', icon: 'send' },
  opened: { color: '#22C55E', label: 'Opened', icon: 'eye' },
};

export default function LegalListScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { docs, pendingNods, loading, reload, counts, isSupervisor } = useLegalDocs();

  if (!isSupervisor) {
    return (
      <>
        <Stack.Screen options={{ title: 'Legal Documents' }} />
        <View className="flex-1 items-center justify-center bg-background px-8">
          <Ionicons name="lock-closed" size={48} color="#334155" />
          <Text className="mt-4 text-center text-base text-slate-400">
            Legal documents are only visible to supervisors and project managers.
          </Text>
        </View>
      </>
    );
  }

  const handleGenerateNod = async (area: { id: string; name: string; hours_blocked: number; blocked_reason?: string; blocked_at?: string }) => {
    if (!profile || !activeProject) return;
    await generateNodDraft({
      organizationId: profile.organization_id,
      projectId: activeProject.id,
      areaId: area.id,
      areaName: area.name,
      blockedReason: area.blocked_reason ?? 'Unknown',
      blockedAt: area.blocked_at ?? new Date().toISOString(),
      hoursBlocked: area.hours_blocked,
    });
    await reload();
  };

  return (
    <>
      <Stack.Screen options={{ title: `Legal (${counts.draft} drafts)` }} />
      <View className="flex-1 bg-background">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : (
          <ScrollView className="flex-1 px-4 pt-4">
            {/* Pending NODs — areas blocked >24h without a NOD */}
            {pendingNods.length > 0 && (
              <View className="mb-4">
                <Text className="mb-2 text-sm font-bold uppercase text-warning">
                  NOD Required ({pendingNods.length})
                </Text>
                {pendingNods.map((area) => (
                  <Pressable
                    key={area.id}
                    onPress={() => handleGenerateNod(area as any)}
                    className="mb-2 flex-row items-center rounded-xl border border-warning/30 bg-amber-500/5 px-4 py-3 active:opacity-80"
                  >
                    <Ionicons name="alert-circle" size={20} color="#F59E0B" />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-medium text-white">{area.name}</Text>
                      <Text className="text-sm text-warning">
                        Blocked {Math.round(area.hours_blocked)}h — tap to generate NOD
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={22} color="#F59E0B" />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Document list */}
            {docs.length === 0 && pendingNods.length === 0 ? (
              <View className="items-center py-16">
                <Ionicons name="shield-outline" size={48} color="#334155" />
                <Text className="mt-4 text-center text-base text-slate-400">
                  No legal documents.{'\n'}NODs are auto-generated when areas are blocked &gt;24h.
                </Text>
              </View>
            ) : (
              docs.map((doc) => {
                const config = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.draft;
                return (
                  <Pressable
                    key={doc.id}
                    onPress={() => router.push(`/(tabs)/docs/legal/${doc.id}` as any)}
                    className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-4 py-4 active:opacity-80"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${config.color}20` }}>
                      <Ionicons name={config.icon} size={20} color={config.color} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-medium text-white" numberOfLines={1}>{doc.title}</Text>
                      <Text className="mt-0.5 text-xs text-slate-400">
                        {doc.document_type.toUpperCase()} · {new Date(doc.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${config.color}20` }}>
                      <Text className="text-xs font-medium" style={{ color: config.color }}>{config.label}</Text>
                    </View>
                    {doc.sha256_hash && (
                      <Ionicons name="shield-checkmark" size={14} color="#22C55E" style={{ marginLeft: 6 }} />
                    )}
                  </Pressable>
                );
              })
            )}

            <View className="h-24" />
          </ScrollView>
        )}
      </View>
    </>
  );
}
