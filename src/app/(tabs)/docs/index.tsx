import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafetyDocs } from '@/features/safety/hooks/useSafetyDocs';
import { DOC_TYPE_LABELS } from '@/features/safety/types/schemas';

/**
 * Safety screen — Sprint 53A.1 simplification.
 *
 * Previously had Safety / Punch / Legal sub-tabs. After pilot feedback
 * (2026-04-25) the sub-tabs were removed: Safety should be single-purpose
 * (PTP / JHA / Toolbox). Punch + Legal moved to the More menu as their
 * own dedicated entries.
 *
 * The standalone screens at /docs/punch/* and /docs/legal/* are still
 * the destinations — only the entry point changed.
 */

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  active: '#22C55E',
  closed: '#64748B',
  submitted: '#F59E0B',
  reviewed: '#3B82F6',
};

export default function DocsScreen() {
  const router = useRouter();
  const { docs: safetyDocs, loading } = useSafetyDocs();
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Safety' }} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4">
          {safetyDocs.length === 0 ? (
            <EmptyState icon="shield-outline" message="No safety documents yet." />
          ) : (
            safetyDocs.map((doc) => (
              <Pressable
                key={doc.id}
                onPress={() => {
                  // PTPs / Toolbox Talks in draft resume in their wizard;
                  // everything else opens the read-only detail view.
                  let route = `/(tabs)/docs/safety/${doc.id}`;
                  if (doc.status === 'draft') {
                    if (doc.doc_type === 'ptp') route = `/(tabs)/docs/safety/ptp/${doc.id}`;
                    else if (doc.doc_type === 'toolbox') route = `/(tabs)/docs/safety/toolbox/${doc.id}`;
                  }
                  router.push(route as any);
                }}
                className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-4 py-4 active:opacity-80"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-brand-orange/20">
                  <Ionicons
                    name={doc.doc_type === 'jha' ? 'warning' : doc.doc_type === 'ptp' ? 'clipboard' : 'chatbubbles'}
                    size={20}
                    color="#F97316"
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-white" numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text className="mt-0.5 text-sm text-slate-400">
                    {DOC_TYPE_LABELS[doc.doc_type as keyof typeof DOC_TYPE_LABELS]} · #{doc.number}
                  </Text>
                </View>
                <StatusBadge status={doc.status} />
              </Pressable>
            ))
          )}
          <View className="h-32" />
        </ScrollView>
      )}

      {/* FAB stack: option pills appear ABOVE the FAB. Bumped to bottom-44
          (176dp) per pilot feedback 2026-04-25 — the pills container at
          bottom-28 was overlapping the FAB itself with the bottom-most
          option (Toolbox). bottom-44 keeps Toolbox just above the FAB top. */}
      {fabOpen && (
        <View className="absolute right-4" style={{ bottom: 176 }}>
          <FabOption
            icon="warning"
            label="JHA"
            color="#EF4444"
            onPress={() => {
              setFabOpen(false);
              router.push('/(tabs)/docs/safety/new?type=jha' as any);
            }}
          />
          <FabOption
            icon="clipboard"
            label="PTP"
            color="#F59E0B"
            onPress={() => {
              setFabOpen(false);
              router.push('/(tabs)/docs/safety/ptp/new' as any);
            }}
          />
          <FabOption
            icon="chatbubbles"
            label="Toolbox"
            color="#22C55E"
            onPress={() => {
              setFabOpen(false);
              router.push('/(tabs)/docs/safety/toolbox/new' as any);
            }}
          />
        </View>
      )}

      <Pressable
        onPress={() => setFabOpen(!fabOpen)}
        className="absolute bottom-24 right-4 h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg active:opacity-80"
      >
        <Ionicons name={fabOpen ? 'close' : 'add'} size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#94A3B8';
  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}20` }}>
      <Text className="text-xs font-medium capitalize" style={{ color }}>
        {status}
      </Text>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  return (
    <View className="items-center py-16">
      <Ionicons name={icon} size={48} color="#334155" />
      <Text className="mt-4 text-center text-base text-slate-400">{message}</Text>
    </View>
  );
}

function FabOption({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 flex-row items-center self-end rounded-full border border-border bg-card py-2 pl-4 pr-3 active:opacity-80"
    >
      <Text className="mr-3 text-sm font-medium text-white">{label}</Text>
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}20` }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
    </Pressable>
  );
}
