/**
 * Work Tickets List — Sprint 45B
 * Realtime subscription auto-refreshes when tickets/signatures change.
 */

import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/features/projects/store/project-store';
import { ProjectSwitcher } from '@/features/projects/components/ProjectSwitcher';
import { useWorkTickets, type TicketFilter } from '@/features/work-tickets/hooks/useWorkTickets';
import {
  ensureLabor,
  type WorkTicketWithSignature,
} from '@/features/work-tickets/services/work-tickets-service';
import { totalHours, workerCount } from '@/features/work-tickets/types';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:    { color: '#9CA3AF', label: 'Draft' },
  pending:  { color: '#F59E0B', label: 'Pending Signature' },
  signed:   { color: '#22C55E', label: 'Signed' },
  declined: { color: '#EF4444', label: 'Declined' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso ?? '';
  }
}

function TicketCard({
  ticket,
  onPress,
}: {
  ticket: WorkTicketWithSignature;
  onPress: () => void;
}) {
  const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.draft;
  const labor = ensureLabor(ticket.labor);
  const hours = totalHours(labor);
  const workers = workerCount(labor);

  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-xl border border-border bg-card px-4 py-3 active:opacity-75"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View className="flex-row items-center">
            <Text
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                fontWeight: '700',
                color: '#0F172A',
                backgroundColor: '#F8FAFC',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                marginRight: 6,
                overflow: 'hidden',
              }}
            >
              #{ticket.number ?? '—'}
            </Text>
            <Text className="flex-1 text-sm font-semibold text-white" numberOfLines={1}>
              {ticket.work_description ?? '(no description)'}
            </Text>
          </View>

          <View className="mt-1 flex-row items-center">
            <Text className="text-xs text-slate-500">
              {fmtDate(ticket.service_date)}
              {ticket.trade ? ` · ${ticket.trade}` : ''}
            </Text>
          </View>

          {(ticket.floor || ticket.area_description) && (
            <View className="mt-0.5 flex-row items-center">
              <Ionicons name="location-outline" size={11} color="#64748B" />
              <Text className="ml-1 text-xs text-slate-500" numberOfLines={1}>
                {[ticket.floor, ticket.area_description].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}

          <View className="mt-1 flex-row items-center">
            <Ionicons name="people-outline" size={11} color="#64748B" />
            <Text className="ml-1 text-xs text-slate-500">
              {workers} {workers === 1 ? 'worker' : 'workers'} · {hours.toFixed(1)} hrs
            </Text>
            {ticket.priority === 'urgent' && (
              <Text className="ml-2 text-xs font-bold text-red-500">⚡ URGENT</Text>
            )}
          </View>

          {ticket.status === 'signed' && ticket.sig_signer_name && (
            <View className="mt-1 flex-row items-center">
              <Ionicons name="checkmark-circle" size={11} color="#22C55E" />
              <Text className="ml-1 text-xs text-green-500">
                Signed by {ticket.sig_signer_name}
              </Text>
            </View>
          )}

          {ticket.status === 'pending' && (
            <View className="mt-1 flex-row items-center">
              <Ionicons name="time-outline" size={11} color="#F59E0B" />
              <Text className="ml-1 text-xs text-amber-500">
                {ticket.sig_signer_name ? `Waiting for ${ticket.sig_signer_name}` : 'Pending signature'}
              </Text>
            </View>
          )}
        </View>

        <View
          className="rounded-full px-2 py-1"
          style={{ backgroundColor: `${cfg.color}20` }}
        >
          <Text className="text-[10px] font-bold" style={{ color: cfg.color }}>
            {cfg.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function WorkTicketsListScreen() {
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const { tickets, loading, filter, setFilter, search, setSearch, counts, reload } = useWorkTickets(
    activeProject?.id ?? null,
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const filterTabs: { value: TicketFilter; label: string; count: number }[] = [
    { value: 'all',     label: 'All',     count: counts.all },
    { value: 'draft',   label: 'Drafts',  count: counts.draft },
    { value: 'pending', label: 'Pending', count: counts.pending },
    { value: 'signed',  label: 'Signed',  count: counts.signed },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Work Tickets',
          headerRight: () =>
            activeProject ? (
              <Pressable
                onPress={() => router.push('/(tabs)/more/work-tickets/create' as any)}
                hitSlop={12}
              >
                <Ionicons name="add-circle" size={28} color="#0EA5E9" />
              </Pressable>
            ) : null,
        }}
      />

      <View className="flex-1 bg-background">
        {/* Search + filter chips */}
        {activeProject && (
          <>
            <View className="mx-4 mt-3 flex-row items-center rounded-xl border border-border bg-card px-3">
              <Ionicons name="search" size={16} color="#64748B" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by #, description, area..."
                placeholderTextColor="#64748B"
                className="ml-2 h-10 flex-1 text-sm text-white"
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="border-b border-border px-3 py-2"
              contentContainerStyle={{ gap: 8 }}
            >
              {filterTabs.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => setFilter(t.value)}
                  className={`rounded-full px-3 py-1.5 ${
                    filter === t.value ? 'bg-brand-orange' : 'border border-border bg-card'
                  }`}
                  style={{ minHeight: 36 }}
                >
                  <Text
                    className={`text-xs font-bold ${
                      filter === t.value ? 'text-white' : 'text-slate-400'
                    }`}
                  >
                    {t.label} ({t.count})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {!activeProject ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="business-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              Select a project to view work tickets.
            </Text>
            <View className="mt-6">
              <ProjectSwitcher />
            </View>
          </View>
        ) : loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : tickets.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="document-text-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              {filter === 'all'
                ? 'No work tickets yet. Tap + to create one.'
                : `No ${filter} tickets.`}
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-4 pt-3"
            refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#F97316" />}
          >
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onPress={() => router.push(`/(tabs)/more/work-tickets/${ticket.id}` as any)}
              />
            ))}
            <View className="h-24" />
          </ScrollView>
        )}

        {activeProject && (
          <Pressable
            onPress={() => router.push('/(tabs)/more/work-tickets/create' as any)}
            className="absolute bottom-6 right-4 h-14 flex-row items-center rounded-full bg-success px-5 shadow-lg active:opacity-80"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text className="ml-2 text-base font-bold text-white">New Ticket</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}
