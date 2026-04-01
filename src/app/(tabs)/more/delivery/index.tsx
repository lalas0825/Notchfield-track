import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDelivery } from '@/features/delivery/hooks/useDelivery';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: '#F59E0B', label: 'Pending' },
  in_transit: { color: '#3B82F6', label: 'In Transit' },
  delivered: { color: '#22C55E', label: 'Delivered' },
  partial: { color: '#F97316', label: 'Partial' },
  rejected: { color: '#EF4444', label: 'Rejected' },
  consumed: { color: '#94A3B8', label: 'Consumed' },
};

export default function DeliveryListScreen() {
  const router = useRouter();
  const { tickets, loading, counts } = useDelivery();

  return (
    <>
      <Stack.Screen options={{ title: 'Deliveries' }} />
      <View className="flex-1 bg-background">
        {/* KPI bar */}
        <View className="flex-row items-center justify-around border-b border-border px-2 py-3">
          <View className="items-center">
            <Text className="text-xl font-bold text-warning">{counts.pending}</Text>
            <Text className="text-xs text-slate-500">Pending</Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-brand-orange">{counts.partial}</Text>
            <Text className="text-xs text-slate-500">Partial</Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-success">{counts.delivered}</Text>
            <Text className="text-xs text-slate-500">Delivered</Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-slate-400">{counts.total}</Text>
            <Text className="text-xs text-slate-500">Total</Text>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : tickets.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cube-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              No deliveries yet.{'\n'}Deliveries are created in Takeoff web.
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4 pt-3">
            {tickets.map((ticket) => {
              const config = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.pending;
              return (
                <Pressable
                  key={ticket.id}
                  onPress={() => router.push(`/(tabs)/more/delivery/${ticket.id}` as any)}
                  className="mb-2 rounded-xl border border-border bg-card px-4 py-4 active:opacity-80"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-medium text-white">{ticket.supplier_name}</Text>
                      {ticket.supplier_po && (
                        <Text className="mt-0.5 text-sm text-slate-400">PO: {ticket.supplier_po}</Text>
                      )}
                      <Text className="mt-0.5 text-xs text-slate-500">
                        {ticket.delivery_date ? new Date(ticket.delivery_date).toLocaleDateString() : 'No date'}
                      </Text>
                    </View>
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${config.color}20` }}>
                      <Text className="text-xs font-bold" style={{ color: config.color }}>{config.label}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            <View className="h-24" />
          </ScrollView>
        )}
      </View>
    </>
  );
}
