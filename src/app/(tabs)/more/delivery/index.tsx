import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDelivery } from '@/features/delivery/hooks/useDelivery';

/** Format TIME string (HH:MM:SS or HH:MM) to 12h format */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: '#F59E0B', label: 'Pending' },
  shipped: { color: '#3B82F6', label: 'Shipped' },
  in_transit: { color: '#3B82F6', label: 'In Transit' },
  delivered: { color: '#22C55E', label: 'Delivered' },
  confirmed: { color: '#22C55E', label: 'Confirmed' },
  partial: { color: '#F97316', label: 'Partial' },
  rejected: { color: '#EF4444', label: 'Rejected' },
  consumed: { color: '#94A3B8', label: 'Consumed' },
};

export default function DeliveryListScreen() {
  const router = useRouter();
  const { rows, loading, counts } = useDelivery();

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
        ) : rows.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cube-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              No deliveries yet.{'\n'}Deliveries are created in Takeoff web.
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4 pt-3">
            {rows.map((row) => {
              const config = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pending;
              const showShipmentLabel =
                row.type === 'shipment' && (row.total_shipments ?? 1) > 1;
              const dateStr = row.ship_date ?? row.delivery_date ?? null;
              return (
                <Pressable
                  key={row.id}
                  onPress={() =>
                    router.push(`/(tabs)/more/delivery/${row.id}?type=${row.type}` as any)
                  }
                  className="mb-2 rounded-xl border border-border bg-card px-4 py-4 active:opacity-80"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex-row flex-wrap items-center">
                        {row.ticket_number && (
                          <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#60A5FA', marginRight: 6 }}>
                            {row.ticket_number}
                          </Text>
                        )}
                        {showShipmentLabel && (
                          <Text className="mr-2 text-xs font-bold text-brand-orange">
                            · Shipment {row.shipment_number} of {row.total_shipments}
                          </Text>
                        )}
                        <Text className="text-base font-medium text-white">{row.supplier_name}</Text>
                      </View>
                      {row.supplier_po && (
                        <Text className="mt-0.5 text-sm text-slate-400">PO: {row.supplier_po}</Text>
                      )}
                      <View className="mt-0.5 flex-row items-center">
                        <Text className="text-xs text-slate-500">
                          {dateStr ? new Date(dateStr).toLocaleDateString() : 'No date'}
                        </Text>
                        {row.delivery_time && (
                          <Text className="ml-2 text-xs text-slate-400">
                            🕐 {formatTime(row.delivery_time)}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View className="items-end">
                      {row.has_shortages && (
                        <View className="mb-1 rounded-full bg-amber-500/20 px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-warning">⚠️ Partial</Text>
                        </View>
                      )}
                      {row.priority === 'urgent' && (
                        <View className="mb-1 rounded-full bg-red-500/20 px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-danger">URGENT</Text>
                        </View>
                      )}
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${config.color}20` }}>
                        <Text className="text-xs font-bold" style={{ color: config.color }}>{config.label}</Text>
                      </View>
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
