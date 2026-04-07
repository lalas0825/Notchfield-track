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
  fetchShipmentDetail,
  confirmItem,
  confirmAllItems,
  confirmShipmentItem,
  confirmShipmentAll,
  finalizeTicket,
  updateDeliveredQty,
  type DeliveryItem,
  type ShipmentDetail,
} from '@/features/delivery/services/delivery-service';
import { useProjectStore } from '@/features/projects/store/project-store';
import { supabase } from '@/shared/lib/supabase/client';

type ItemCheck = {
  id: string;
  ticket_item_id: string;
  shipment_item_id: string | null;
  check_status: string;
  quantity_confirmed: number | null;
  quantity_short: number | null;
  shortage_reason: string | null;
};

/** Unified row used by the screen — backed by either a shipment_item or a ticket_item */
type Row = {
  rowId: string; // shipment_item.id (shipment mode) OR ticket_item.id (legacy mode)
  ticketItemId: string;
  shipmentItemId: string | null;
  material_name: string;
  material_code: string | null;
  unit: string;
  quantity_to_confirm: number; // quantity_shipped (shipment) or quantity_ordered (legacy)
  quantity_ordered: number;
  receipt_status: string;
  quantity_received: number | null;
  area_id: string | null;
};

const STATUS_BUTTONS: { value: 'received' | 'short' | 'damaged' | 'rejected'; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'received', label: 'Received', color: '#22C55E', icon: 'checkmark-circle' },
  { value: 'short', label: 'Short', color: '#F59E0B', icon: 'remove-circle' },
  { value: 'damaged', label: 'Damaged', color: '#F97316', icon: 'alert-circle' },
  { value: 'rejected', label: 'Rejected', color: '#EF4444', icon: 'close-circle' },
];

export default function DeliveryDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const isShipmentMode = type === 'shipment';
  const [shipmentDetail, setShipmentDetail] = useState<ShipmentDetail | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headerTitle, setHeaderTitle] = useState('Delivery Confirmation');
  // checks keyed by ticketItemId (legacy mode) OR shipmentItemId (shipment mode)
  const [checks, setChecks] = useState<Map<string, ItemCheck>>(new Map());
  const [hasShortages, setHasShortages] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  const reload = async () => {
    if (isShipmentMode) {
      const detail = await fetchShipmentDetail(id);
      if (!detail) {
        setLoading(false);
        return;
      }
      setShipmentDetail(detail);
      setHasShortages(detail.ticket.has_shortages);
      setDeliveryTime(detail.shipment.delivery_time);
      const label =
        detail.shipment.total_shipments > 1
          ? `${detail.ticket.ticket_number ?? 'DT'} · Shipment ${detail.shipment.shipment_number} of ${detail.shipment.total_shipments}`
          : `${detail.ticket.ticket_number ?? 'Delivery'}`;
      setHeaderTitle(label);
      setRows(
        detail.items.map((it) => ({
          rowId: it.id,
          ticketItemId: it.ticket_item_id,
          shipmentItemId: it.id,
          material_name: it.material_name,
          material_code: it.material_code,
          unit: it.unit,
          quantity_to_confirm: it.quantity_shipped,
          quantity_ordered: it.quantity_ordered,
          receipt_status: it.receipt_status,
          quantity_received: it.quantity_received,
          area_id: it.area_id,
        })),
      );
      // Load checks filtered by shipment_id
      const { data: checksData } = await supabase
        .from('delivery_ticket_item_checks')
        .select('*')
        .eq('shipment_id', id);
      const checkMap = new Map<string, ItemCheck>();
      for (const c of (checksData ?? []) as ItemCheck[]) {
        // Key by shipment_item_id when present (one check per shipment item)
        const key = c.shipment_item_id ?? c.ticket_item_id;
        checkMap.set(key, c);
      }
      setChecks(checkMap);
    } else {
      // Legacy ticket flow
      const [itemsData, ticketData, checksData] = await Promise.all([
        fetchDeliveryItems(id),
        supabase.from('delivery_tickets').select('ticket_number, has_shortages, delivery_time').eq('id', id).single(),
        supabase.from('delivery_ticket_item_checks').select('*').eq('ticket_id', id),
      ]);
      setHasShortages(ticketData.data?.has_shortages ?? false);
      setDeliveryTime(ticketData.data?.delivery_time ?? null);
      setHeaderTitle(ticketData.data?.ticket_number ?? 'Delivery');
      setRows(
        itemsData.map((it) => ({
          rowId: it.id,
          ticketItemId: it.id,
          shipmentItemId: null,
          material_name: it.material_name,
          material_code: it.material_code,
          unit: it.unit,
          quantity_to_confirm: it.quantity_ordered,
          quantity_ordered: it.quantity_ordered,
          receipt_status: it.receipt_status,
          quantity_received: it.quantity_received,
          area_id: it.area_id,
        })),
      );
      const checkMap = new Map<string, ItemCheck>();
      for (const c of (checksData.data ?? []) as ItemCheck[]) {
        checkMap.set(c.ticket_item_id, c);
      }
      setChecks(checkMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type]);

  const pendingCount = rows.filter((r) => r.receipt_status === 'pending').length;
  const allConfirmed = pendingCount === 0 && rows.length > 0;

  /** Get the warehouse-packed qty for a row (defaults to the row's quantity_to_confirm) */
  const getPackedQty = (row: Row): number => {
    const key = row.shipmentItemId ?? row.ticketItemId;
    const check = checks.get(key);
    return check?.quantity_confirmed ?? row.quantity_to_confirm;
  };

  const handleConfirmRow = async (
    row: Row,
    status: 'received' | 'short' | 'damaged' | 'rejected',
  ) => {
    const packedQty = getPackedQty(row);
    const qty = status === 'received' ? packedQty : qtyInput ? parseFloat(qtyInput) : 0;

    // Over-delivery warning compared to row's expected qty
    if (qty > row.quantity_to_confirm) {
      Alert.alert(
        'Over-delivery',
        `Receiving ${qty} but only ${row.quantity_to_confirm} ${row.unit} expected. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => doConfirm(row, status, qty) },
        ],
      );
      return;
    }
    await doConfirm(row, status, qty);
  };

  const doConfirm = async (
    row: Row,
    status: 'received' | 'short' | 'damaged' | 'rejected',
    qty: number,
  ) => {
    setSaving(true);

    if (isShipmentMode) {
      await confirmShipmentItem(row.ticketItemId, status, qty, notesInput || undefined);
    } else {
      await confirmItem(row.ticketItemId, status, qty, notesInput || undefined);
    }

    // Update material_consumption
    if ((status === 'received' || status === 'short') && row.area_id && profile && activeProject) {
      await updateDeliveredQty({
        organizationId: profile.organization_id,
        projectId: activeProject.id,
        areaId: row.area_id,
        materialName: row.material_name,
        materialCode: row.material_code,
        unit: row.unit,
        deliveredQty: qty,
      });
    }

    await reload();
    setActiveRowId(null);
    setQtyInput('');
    setNotesInput('');
    setSaving(false);
  };

  const handleConfirmAll = async () => {
    setSaving(true);

    if (isShipmentMode && shipmentDetail) {
      // Update material_consumption first using packed quantities
      for (const row of rows.filter((r) => r.receipt_status === 'pending')) {
        if (row.area_id && profile && activeProject) {
          await updateDeliveredQty({
            organizationId: profile.organization_id,
            projectId: activeProject.id,
            areaId: row.area_id,
            materialName: row.material_name,
            materialCode: row.material_code,
            unit: row.unit,
            deliveredQty: getPackedQty(row),
          });
        }
      }
      if (user) {
        await confirmShipmentAll(id, user.id);
      }
    } else {
      // Legacy
      await confirmAllItems(id);
      for (const row of rows.filter((r) => r.receipt_status === 'pending')) {
        if (row.area_id && profile && activeProject) {
          await updateDeliveredQty({
            organizationId: profile.organization_id,
            projectId: activeProject.id,
            areaId: row.area_id,
            materialName: row.material_name,
            materialCode: row.material_code,
            unit: row.unit,
            deliveredQty: getPackedQty(row),
          });
        }
      }
    }

    await reload();
    setSaving(false);
  };

  const handleFinalize = async () => {
    if (!user) return;
    setSaving(true);
    if (!isShipmentMode) {
      // In shipment mode, confirmShipmentAll already handles parent ticket update
      await finalizeTicket(id, user.id);
    }
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
      <Stack.Screen options={{ title: headerTitle }} />
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
              <Text className="text-base text-white">{rows.length} items</Text>
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
          {rows.map((row) => {
            const confirmed = row.receipt_status !== 'pending';
            const isActive = activeRowId === row.rowId;
            const checkKey = row.shipmentItemId ?? row.ticketItemId;
            const check = checks.get(checkKey);
            const statusColor = confirmed
              ? row.receipt_status === 'received' ? '#22C55E'
              : row.receipt_status === 'short' ? '#F59E0B'
              : row.receipt_status === 'damaged' ? '#F97316'
              : '#EF4444'
              : '#64748B';

            return (
              <View key={row.rowId} className="mb-2 rounded-xl border border-border bg-card">
                <Pressable
                  onPress={() => !confirmed && setActiveRowId(isActive ? null : row.rowId)}
                  className="flex-row items-center px-4 py-3 active:opacity-80"
                >
                  <View className="flex-1">
                    <Text className="text-base font-medium text-white">{row.material_name}</Text>
                    <Text className="mt-0.5 text-sm text-slate-400">
                      {row.quantity_to_confirm} {row.unit}
                      {row.material_code ? ` · ${row.material_code}` : ''}
                    </Text>
                    {check && check.check_status === 'verified' && (
                      <View className="mt-1 flex-row items-center">
                        <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                        <Text className="ml-1 text-xs font-medium text-success">
                          Packed: {check.quantity_confirmed} {row.unit}
                        </Text>
                      </View>
                    )}
                    {check && check.check_status === 'short' && (
                      <>
                        <View className="mt-1 flex-row items-center">
                          <Ionicons name="warning" size={14} color="#F59E0B" />
                          <Text className="ml-1 text-xs font-bold text-warning">
                            Packed: {check.quantity_confirmed} {row.unit} (short {check.quantity_short} {row.unit})
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
                    {confirmed && row.quantity_received !== null && (
                      <Text className="mr-2 text-sm font-bold" style={{ color: statusColor }}>
                        {row.quantity_received} {row.unit}
                      </Text>
                    )}
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${statusColor}20` }}>
                      <Text className="text-xs font-bold capitalize" style={{ color: statusColor }}>
                        {row.receipt_status}
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
                        value={qtyInput || String(getPackedQty(row))}
                        onChangeText={setQtyInput}
                        keyboardType="numeric"
                        className="h-10 w-24 rounded-lg border border-border bg-background px-3 text-center text-base text-white"
                      />
                      <Text className="ml-2 text-sm text-slate-500">{row.unit}</Text>
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
                          onPress={() => handleConfirmRow(row, btn.value)}
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
