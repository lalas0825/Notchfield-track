import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
import type { TicketRow } from '@/features/tickets/hooks/useTickets';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  submitted: '#F59E0B',
  reviewed: '#3B82F6',
  closed: '#22C55E',
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('work_tickets')
        .select('id, project_id, number, title, description, status, floor, area, photos, created_by, created_at')
        .eq('id', id)
        .single();
      setTicket(data as TicketRow | null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-base text-slate-400">Ticket not found</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[ticket.status] ?? '#94A3B8';
  const photos = (ticket.photos ?? []) as string[];

  return (
    <>
      <Stack.Screen
        options={{
          title: `Ticket #${ticket.number}`,
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <ScrollView className="flex-1 bg-background px-4 pt-4">
        {/* Header */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-xl font-bold text-white">{ticket.title}</Text>
            <View
              className="ml-2 rounded-full px-3 py-1"
              style={{ backgroundColor: `${statusColor}20` }}
            >
              <Text className="text-xs font-bold capitalize" style={{ color: statusColor }}>
                {ticket.status}
              </Text>
            </View>
          </View>
          <Text className="mt-2 text-sm text-slate-400">
            {new Date(ticket.created_at).toLocaleString()}
          </Text>
        </View>

        {/* Location */}
        {(ticket.area || ticket.floor) && (
          <View className="mb-4 flex-row items-center rounded-xl border border-border bg-card px-4 py-3">
            <Ionicons name="location" size={18} color="#F97316" />
            <Text className="ml-2 text-base text-white">
              {[ticket.floor, ticket.area].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        {/* Description */}
        {ticket.description && (
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-slate-400">Details</Text>
            <Text className="text-base leading-6 text-white">{ticket.description}</Text>
          </View>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-slate-400">
              Photos ({photos.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {photos.map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    className="h-40 w-40 rounded-xl"
                    resizeMode="cover"
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View className="h-24" />
      </ScrollView>
    </>
  );
}
