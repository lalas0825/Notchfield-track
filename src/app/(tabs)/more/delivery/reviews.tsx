import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import DeliveryReviewCard from '@/features/delivery/components/DeliveryReviewCard';
import RequestChangesSheet from '@/features/delivery/components/RequestChangesSheet';
import {
  fetchPendingReviews,
  fetchDeliveryItems,
  approveTicket,
  requestChanges,
  type DeliveryTicket,
  type DeliveryItem,
} from '@/features/delivery/services/delivery-service';
import { haptic } from '@/shared/lib/haptics';

type TicketWithItems = { ticket: DeliveryTicket; items: DeliveryItem[] };

export default function DeliveryReviewScreen() {
  const profile = useAuthStore((s) => s.profile);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [data, setData] = useState<TicketWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<DeliveryTicket | null>(null);

  const load = useCallback(async () => {
    if (!activeProject || !profile) return;
    setLoading(true);
    const tickets = await fetchPendingReviews(activeProject.id, profile.organization_id);
    const results = await Promise.all(
      tickets.map(async (ticket) => ({ ticket, items: await fetchDeliveryItems(ticket.id) })),
    );
    setData(results);
    setLoading(false);
  }, [activeProject, profile]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (ticketId: string) => {
    const result = await approveTicket(ticketId);
    if (result.success) {
      haptic.success();
      setData((prev) => prev.filter((d) => d.ticket.id !== ticketId));
    } else {
      Alert.alert('Error', result.error ?? 'Could not approve ticket.');
    }
  };

  const handleOpenSheet = (ticket: DeliveryTicket) => {
    setSelectedTicket(ticket);
    setSheetVisible(true);
    haptic.medium();
  };

  const handleSubmitChanges = async (note: string) => {
    if (!selectedTicket) return;
    const result = await requestChanges(selectedTicket.id, note, selectedTicket.notes);
    setSheetVisible(false);
    setSelectedTicket(null);
    if (result.success) {
      haptic.success();
      load();
    } else {
      Alert.alert('Error', result.error ?? 'Could not send request.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Pending Reviews' }} />
      <View className="flex-1 bg-background">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : data.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="checkmark-circle-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              No tickets pending review.
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4 pt-3">
            {data.map(({ ticket, items }) => (
              <DeliveryReviewCard
                key={ticket.id}
                ticket={ticket}
                items={items}
                onApprove={() => handleApprove(ticket.id)}
                onRequestChanges={() => handleOpenSheet(ticket)}
              />
            ))}
            <View className="h-24" />
          </ScrollView>
        )}
      </View>
      <RequestChangesSheet
        visible={sheetVisible}
        onClose={() => { setSheetVisible(false); setSelectedTicket(null); }}
        onSubmit={handleSubmitChanges}
      />
    </>
  );
}
