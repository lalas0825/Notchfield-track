import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DeliveryTicket, DeliveryItem } from '../services/delivery-service';

type Props = {
  ticket: DeliveryTicket;
  items: DeliveryItem[];
  onApprove: () => void;
  onRequestChanges: () => void;
};

export default function DeliveryReviewCard({ ticket, items, onApprove, onRequestChanges }: Props) {
  return (
    <View className="mb-3 rounded-2xl border border-border bg-card">
      {/* Header */}
      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {ticket.ticket_number && (
              <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#60A5FA', marginRight: 8 }}>
                {ticket.ticket_number}
              </Text>
            )}
            <Text className="text-base font-medium text-white">{ticket.supplier_name}</Text>
          </View>
          {ticket.priority === 'urgent' && (
            <View className="rounded-full bg-red-500/20 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-danger">URGENT</Text>
            </View>
          )}
        </View>
        <View className="mt-1 flex-row items-center">
          {ticket.delivery_date && (
            <Text className="text-xs text-slate-400">
              Ship: {new Date(ticket.delivery_date).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {/* Items */}
      <View className="px-4 py-3">
        <Text className="mb-2 text-xs font-bold uppercase text-slate-500">
          Items ({items.length})
        </Text>
        {items.map((item) => (
          <View key={item.id} className="mb-1 flex-row items-center">
            {item.material_code && (
              <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginRight: 6 }}>
                {item.material_code}
              </Text>
            )}
            <Text className="flex-1 text-sm text-white" numberOfLines={1}>
              {item.material_name}
            </Text>
            <Text className="ml-2 text-sm text-slate-400">
              {Math.round(item.quantity_ordered)} {item.unit}
            </Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View className="flex-row gap-2 px-4 pb-4">
        <Pressable
          onPress={onApprove}
          className="flex-1 h-14 flex-row items-center justify-center rounded-xl bg-success active:opacity-80"
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text className="ml-2 text-base font-bold text-white">Approve</Text>
        </Pressable>
        <Pressable
          onPress={onRequestChanges}
          className="flex-1 h-14 flex-row items-center justify-center rounded-xl border border-border active:opacity-80"
        >
          <Ionicons name="create-outline" size={20} color="#94A3B8" />
          <Text className="ml-2 text-base font-medium text-slate-400">Changes</Text>
        </Pressable>
      </View>
    </View>
  );
}
