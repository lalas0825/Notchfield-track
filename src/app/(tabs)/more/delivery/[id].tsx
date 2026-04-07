import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  fetchDeliveryItems,
  confirmItem,
  confirmAllItems,
  finalizeTicket,
  updateDeliveredQty,
  type DeliveryItem,
} from '@/features/delivery/services/delivery-service';
import { useProjectStore } from '@/features/projects/store/project-store';
import { supabase } from '@/shared/lib/supabase/client';

type ItemCheck = {
  id: string;
  ticket_item_id: string;
  check_status: string;
  quantity_confirmed: number | null;
  quantity_short: number | null;
  shortage_reason: string | null;
};

const STATUS_BUTTONS: { value: 'received' | 'short' | 'damaged' | 'rejected'; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'received', label: 'Received', color: '#22C55E', icon: 'checkmark-circle' },
  { value: 'short', label: 'Short', color: '#F59E0B', icon: 'remove-circle' },
  { value: 'damaged', label: 'Damaged', color: '#F97316', icon: 'alert-circle' },
  { value: 'rejected', label: 'Rejected', color: '#EF4444', icon: 'close-circle' },
];

export default function DeliveryDetailScreen() {
  const { id: ticketId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [checks, setChecks] = useState<Map<string, ItemCheck>>(new Map());
  const [hasShortages, setHasShortages] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  useEffect(() => {
    async function load() {
      const [itemsData, ticketData, checksData] = await Promise.all([
        fetchDeliveryItems(ticketId),
        supabase.from('delivery_tickets').select('has_shortages, delivery_time').eq('id', ticketId).single(),
        supabase.from('delivery_ticket_item_checks').select('*').eq('ticket_id', ticketId),
      ]);
      setItems(itemsData);
      setHasShortages(ticketData.data?.has_shortages ?? false);
      setDeliveryTime(ticketData.data?.delivery_time ?? null);

      const checkMap = new Map<string, ItemCheck>();
      for (const c of (checksData.data ?? []) as ItemCheck[]) {
        checkMap.set(c.ticket_item_id, c);
      }
      setChecks(checkMap);
      setLoading(false);
    }
    load();
  }, [ticketId]);

  const pendingCount = items.filter((i) => i.receipt_status === 'pending').length;
  const allConfirmed = pendingCount === 0 && items.length > 0;

  /** Get the packed qty for an item (from warehouse check), fallback to ordered */
  const getPackedQty = (itemId: string, orderedQty: number): number => {
    const check = checks.get(itemId);
    return check?.quantity_confirmed ?? orderedQty;
  };

  const handleConfirmItem = async (itemId: string, status: 'received' | 'short' | 'damaged' | 'rejected') => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const packedQty = getPackedQty(item.id, item.quantity_ordered);
    const qty = status === 'received'
      ? packedQty
      : qtyInput ? parseFloat(qtyInput) : 0;

    // Over-consumption warning
    if (qty > item.quantity_ordered) {
      Alert.alert(
        'Over-delivery',
        `Receiving ${qty} but only ${item.quantity_ordered} ordered. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => doConfirm(itemId, status, qty) },
        ],
      );
      return;
    }

    await doConfirm(itemId, status, qty);
  };

  const doConfirm = async (itemId: string, status: 'received' | 'short' | 'damaged' | 'rejected', qty: number) => {
    setSaving(true);
    await confirmItem(itemId, status, qty, notesInput || undefined);

    // Update material_consumption if received and has area
    const item = items.find((i) => i.id === itemId);
    if (item && (status === 'received' || status === 'short') && item.area_id && profile && activeProject) {
      await updateDeliveredQty({
        organizationId: profile.organization_id,
        projectId: activeProject.id,
        areaId: item.area_id,
        materialName: item.material_name,
        materialCode: item.material_code,
        unit: item.unit,
        deliveredQty: qty,
      });
    }

    // Refresh items
    const updated = await fetchDeliveryItems(ticketId);
    setItems(updated);
    setActiveItemId(null);
    setQtyInput('');
    setNotesInput('');
    setSaving(false);
  };

  const handleConfirmAll = async () => {
    setSaving(true);
    await confirmAllItems(ticketId);

    // Update material_consumption for all items
    for (const item of items.filter((i) => i.receipt_status === 'pending')) {
      if (item.area_id && profile && activeProject) {
        await updateDeliveredQty({
          organizationId: profile.organization_id,
          projectId: activeProject.id,
          areaId: item.area_id,
          materialName: item.material_name,
          materialCode: item.material_code,
          unit: item.unit,
          deliveredQty: getPackedQty(item.id, item.quantity_ordered),
        });
      }
    }

    const updated = await fetchDeliveryItems(ticketId);
    setItems(updated);
    setSaving(false);
  };

  const handleFinalize = async () => {
    if (!user) return;
    setSaving(true);
    await finalizeTicket(ticketId, user.id);
    setSaving(false);
    router.back();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Delivery Confirmation' }} />
      <View className="flex-1 bg-background">
        <ScrollView className="flex-1 px-4 pt-4">
          {/* Partial shipment warning */}
          {hasShortages && (
            <View className="mb-4 rounded-xl border border-warning bg-amber-500/20 px-4 py-3">
              <View className="flex-row items-center">
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text className="ml-2 text-base font-bold text-warning">PARTIAL SHIPMENT</Text>
              </View>
              <Text className="mt-1 text-sm text-slate-300">
                Warehouse reported shortages on this delivery. Check quantities carefully.
              </Text>
            </View>
          )}

          {/* Summary */}
          <View className="mb-4 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <View className="flex-1">
              <Text className="text-base text-white">{items.length} items</Text>
              {deliveryTime && (
                <Text className="mt-0.5 text-xs text-slate-400">
                  🕐 Arrives {(() => {
                    const [h, m] = deliveryTime.split(':').map(Number);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const hour = h % 12 || 12;
                    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
                  })()}
                </Text>
              )}
            </View>
            <Text className="text-base font-bold" style={{ color: pendingCount > 0 ? '#F59E0B' : '#22C55E' }}>
              {pendingCount > 0 ? `${pendingCount} pending` : 'All confirmed'}
            </Text>
          </View>

          {/* Confirm All button */}
          {pendingCount > 0 && (
            <Pressable
              onPress={handleConfirmAll}
              disabled={saving}
              className="mb-4 h-14 flex-row items-center justify-center rounded-xl bg-success active:opacity-80"
            >
              <Ionicons name="checkmark-done" size={22} color="#FFFFFF" />
              <Text className="ml-2 text-lg font-bold text-white">Confirm All ({pendingCount})</Text>
            </Pressable>
          )}

          {/* Item list */}
          {items.map((item) => {
            const confirmed = item.receipt_status !== 'pending';
            const isActive = activeItemId === item.id;
            const check = checks.get(item.id);
            const statusColor = confirmed
              ? item.receipt_status === 'received' ? '#22C55E'
              : item.receipt_status === 'short' ? '#F59E0B'
              : item.receipt_status === 'damaged' ? '#F97316'
              : '#EF4444'
              : '#64748B';

            return (
              <View key={item.id} className="mb-2 rounded-xl border border-border bg-card">
                <Pressable
                  onPress={() => !confirmed && setActiveItemId(isActive ? null : item.id)}
                  className="flex-row items-center px-4 py-3 active:opacity-80"
                >
                  <View className="flex-1">
                    <Text className="text-base font-medium text-white">{item.material_name}</Text>
                    <Text className="mt-0.5 text-sm text-slate-400">
                      {item.quantity_ordered} {item.unit}
                      {item.material_code ? ` · ${item.material_code}` : ''}
                    </Text>
                    {check && check.check_status === 'verified' && (
                      <View className="mt-1 flex-row items-center">
                        <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                        <Text className="ml-1 text-xs font-medium text-success">
                          Packed: {check.quantity_confirmed} {item.unit}
                        </Text>
                      </View>
                    )}
                    {check && check.check_status === 'short' && (
                      <>
                        <View className="mt-1 flex-row items-center">
                          <Ionicons name="warning" size={14} color="#F59E0B" />
                          <Text className="ml-1 text-xs font-bold text-warning">
                            Packed: {check.quantity_confirmed} {item.unit} (short {check.quantity_short} {item.unit})
                          </Text>
                        </View>
                        {check.shortage_reason && (
                          <Text className="mt-0.5 text-xs text-slate-500">Reason: {check.shortage_reason}</Text>
                        )}
                      </>
                    )}
                    {check && check.check_status === 'damaged' && (
                      <View className="mt-1 flex-row items-center">
                        <Ionicons name="alert-circle" size={14} color="#EF4444" />
                        <Text className="ml-1 text-xs font-bold text-danger">Damaged in warehouse</Text>
                      </View>
                    )}
                    {check && check.check_status === 'unavailable' && (
                      <View className="mt-1 flex-row items-center">
                        <Ionicons name="close-circle" size={14} color="#EF4444" />
                        <Text className="ml-1 text-xs font-bold text-danger">Not available</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center">
                    {confirmed && item.quantity_received !== null && (
                      <Text className="mr-2 text-sm font-bold" style={{ color: statusColor }}>
                        {item.quantity_received} {item.unit}
                      </Text>
                    )}
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${statusColor}20` }}>
                      <Text className="text-xs font-bold capitalize" style={{ color: statusColor }}>
                        {item.receipt_status}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {/* Expanded confirmation panel */}
                {isActive && !confirmed && (
                  <View className="border-t border-border px-4 py-3">
                    {/* Quantity input (for short/damaged) */}
                    <View className="mb-3 flex-row items-center">
                      <Text className="mr-2 text-sm text-slate-400">Qty received:</Text>
                      <TextInput
                        value={qtyInput || String(getPackedQty(item.id, item.quantity_ordered))}
                        onChangeText={setQtyInput}
                        keyboardType="numeric"
                        className="h-10 w-24 rounded-lg border border-border bg-background px-3 text-center text-base text-white"
                      />
                      <Text className="ml-2 text-sm text-slate-500">{item.unit}</Text>
                    </View>

                    {/* Notes */}
                    <TextInput
                      value={notesInput}
                      onChangeText={setNotesInput}
                      placeholder="Notes (optional)"
                      placeholderTextColor="#64748B"
                      className="mb-3 h-10 rounded-lg border border-border bg-background px-3 text-sm text-white"
                    />

                    {/* Status buttons */}
                    <View className="flex-row gap-2">
                      {STATUS_BUTTONS.map((btn) => (
                        <Pressable
                          key={btn.value}
                          onPress={() => handleConfirmItem(item.id, btn.value)}
                          disabled={saving}
                          className="flex-1 items-center rounded-lg py-2 active:opacity-80"
                          style={{ backgroundColor: `${btn.color}20` }}
                        >
                          <Ionicons name={btn.icon} size={18} color={btn.color} />
                          <Text className="mt-0.5 text-[10px] font-bold" style={{ color: btn.color }}>
                            {btn.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <View className="h-32" />
        </ScrollView>

        {/* Finalize button */}
        {allConfirmed && (
          <View className="border-t border-border bg-card px-4 pb-8 pt-3">
            <Pressable
              onPress={handleFinalize}
              disabled={saving}
              className="h-14 flex-row items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
            >
              <Ionicons name="checkmark-done-circle" size={22} color="#FFFFFF" />
              <Text className="ml-2 text-lg font-bold text-white">
                {saving ? 'Finalizing...' : 'Finalize Delivery'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}
