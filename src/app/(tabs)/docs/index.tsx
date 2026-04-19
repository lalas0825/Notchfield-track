import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafetyDocs } from '@/features/safety/hooks/useSafetyDocs';
import { usePunchList } from '@/features/punch/hooks/usePunchList';
import { useLegalDocs } from '@/features/legal/hooks/useLegalDocs';
import { DOC_TYPE_LABELS } from '@/features/safety/types/schemas';

type Tab = 'safety' | 'punch' | 'legal';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  active: '#22C55E',
  closed: '#64748B',
  submitted: '#F59E0B',
  reviewed: '#3B82F6',
};

export default function DocsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('safety');
  const { docs: safetyDocs, loading: safetyLoading } = useSafetyDocs();
  const { items: punchItems, loading: punchLoading, counts: punchCounts } = usePunchList();
  const { docs: legalDocs, counts: legalCounts, isSupervisor, pendingNods } = useLegalDocs();
  const [fabOpen, setFabOpen] = useState(false);

  const loading = tab === 'safety' ? safetyLoading : tab === 'punch' ? punchLoading : false;

  return (
    <View className="flex-1 bg-background">
      {/* Tab bar */}
      <View className="flex-row border-b border-border">
        <Pressable
          onPress={() => setTab('safety')}
          className={`flex-1 items-center py-3 ${tab === 'safety' ? 'border-b-2 border-brand-orange' : ''}`}
        >
          <Text className={`text-base font-medium ${tab === 'safety' ? 'text-brand-orange' : 'text-slate-400'}`}>
            Safety
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('punch')}
          className={`flex-1 items-center py-3 ${tab === 'punch' ? 'border-b-2 border-brand-orange' : ''}`}
        >
          <View className="flex-row items-center">
            <Text className={`text-base font-medium ${tab === 'punch' ? 'text-brand-orange' : 'text-slate-400'}`}>
              Punch
            </Text>
            {punchCounts.open > 0 && (
              <View className="ml-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1">
                <Text className="text-[10px] font-bold text-white">{punchCounts.open}</Text>
              </View>
            )}
          </View>
        </Pressable>
        {isSupervisor && (
          <Pressable
            onPress={() => setTab('legal')}
            className={`flex-1 items-center py-3 ${tab === 'legal' ? 'border-b-2 border-brand-orange' : ''}`}
          >
            <View className="flex-row items-center">
              <Text className={`text-base font-medium ${tab === 'legal' ? 'text-brand-orange' : 'text-slate-400'}`}>
                Legal
              </Text>
              {(legalCounts.draft + pendingNods.length) > 0 && (
                <View className="ml-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-warning px-1">
                  <Text className="text-[10px] font-bold text-white">{legalCounts.draft + pendingNods.length}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4">

          {/* ─── Safety tab ─── */}
          {tab === 'safety' && (
            <>
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
            </>
          )}

          {/* ─── Punch tab ─── */}
          {tab === 'punch' && (
            <>
              {punchItems.length === 0 ? (
                <EmptyState icon="checkmark-done-circle-outline" message="No punch items yet." />
              ) : (
                punchItems.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/(tabs)/docs/punch/${item.id}` as any)}
                    className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-4 py-4 active:opacity-80"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                      <Ionicons name="flag" size={20} color="#A855F7" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-medium text-white" numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text className="mt-0.5 text-sm text-slate-400">
                        {item.priority} priority
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </Pressable>
                ))
              )}
            </>
          )}

          {/* ─── Legal tab ─── */}
          {tab === 'legal' && isSupervisor && (
            <>
              {legalDocs.length === 0 ? (
                <EmptyState icon="shield-outline" message="No legal documents. NODs auto-generate when areas are blocked >24h." />
              ) : (
                legalDocs.map((doc) => (
                  <Pressable
                    key={doc.id}
                    onPress={() => router.push(`/(tabs)/docs/legal/${doc.id}` as any)}
                    className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-4 py-4 active:opacity-80"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
                      <Ionicons name="document-lock" size={20} color="#EF4444" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-medium text-white" numberOfLines={1}>{doc.title}</Text>
                      <Text className="mt-0.5 text-sm text-slate-400">
                        {doc.document_type.toUpperCase()} · {new Date(doc.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <StatusBadge status={doc.status} />
                  </Pressable>
                ))
              )}
            </>
          )}

          <View className="h-32" />
        </ScrollView>
      )}

      {/* ─── FAB — Safety docs only (Work Tickets moved to More tab) ─── */}
      {fabOpen && (
        <View className="absolute bottom-28 right-4">
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
