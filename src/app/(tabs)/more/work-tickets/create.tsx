/**
 * Work Ticket Create / Edit — Sprint 45B
 * Field names mirror Takeoff Web exactly:
 *   classification, regular_hours, overtime_hours, quantity
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import {
  createWorkTicket,
  getWorkTicket,
  updateWorkTicket,
  ensureLabor,
  ensureMaterials,
} from '@/features/work-tickets/services/work-tickets-service';
import {
  TRADES,
  LABOR_CLASSIFICATIONS,
  MATERIAL_UNITS,
  type LaborEntry,
  type MaterialEntry,
} from '@/features/work-tickets/types';
import { haptic } from '@/shared/lib/haptics';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateLabel(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function emptyLabor(): LaborEntry {
  return { name: '', classification: 'Mechanic', regular_hours: 8, overtime_hours: 0 };
}

function emptyMaterial(): MaterialEntry {
  return { description: '', quantity: 1, unit: 'pcs' };
}

export default function WorkTicketCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const isEdit = !!editId;

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const activeProject = useProjectStore((s) => s.activeProject);

  // Form state
  const [serviceDate, setServiceDate] = useState(todayISO());
  const [trade, setTrade] = useState<string>('Tile');
  const [areaDescription, setAreaDescription] = useState('');
  const [floor, setFloor] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [workDescription, setWorkDescription] = useState('');
  const [labor, setLabor] = useState<LaborEntry[]>([emptyLabor()]);
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [gcNotes, setGcNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editId) return;
    getWorkTicket(editId)
      .then((t) => {
        if (!t) return;
        if (t.status !== 'draft') {
          Alert.alert('Cannot edit', 'Only draft tickets can be edited.');
          router.back();
          return;
        }
        if (t.service_date) setServiceDate(t.service_date);
        if (t.trade) setTrade(t.trade);
        if (t.area_description) setAreaDescription(t.area_description);
        if (t.floor) setFloor(t.floor);
        if (t.priority === 'urgent' || t.priority === 'normal') setPriority(t.priority);
        if (t.work_description) setWorkDescription(t.work_description);
        const parsedLabor = ensureLabor(t.labor);
        if (parsedLabor.length > 0) setLabor(parsedLabor);
        setMaterials(ensureMaterials(t.materials));
        if (t.gc_notes) setGcNotes(t.gc_notes);
      })
      .catch((err) => {
        console.warn('[create] load failed', err);
        Alert.alert('Load failed', 'Could not load ticket.');
        router.back();
      });
  }, [editId, router]);

  const dateOffset = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setServiceDate(`${y}-${m}-${day}`);
    haptic.light();
  };

  const addLaborRow = () => { setLabor((l) => [...l, emptyLabor()]); haptic.light(); };
  const updateLaborRow = (i: number, patch: Partial<LaborEntry>) => {
    setLabor((l) => l.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const removeLaborRow = (i: number) => { setLabor((l) => l.filter((_, idx) => idx !== i)); haptic.light(); };

  const addMaterialRow = () => { setMaterials((m) => [...m, emptyMaterial()]); haptic.light(); };
  const updateMaterialRow = (i: number, patch: Partial<MaterialEntry>) => {
    setMaterials((m) => m.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const removeMaterialRow = (i: number) => { setMaterials((m) => m.filter((_, idx) => idx !== i)); haptic.light(); };

  const handleSave = useCallback(async () => {
    const userId = profile?.id ?? user?.id;
    if (!profile || !userId) {
      Alert.alert('Not signed in', 'Please sign out and back in.');
      return;
    }
    if (!activeProject) {
      Alert.alert('No project selected', 'Select a project from the Work Tickets screen first.');
      return;
    }
    if (!workDescription.trim()) {
      Alert.alert('Description required', 'Please enter a work description.');
      return;
    }
    if (!areaDescription.trim()) {
      Alert.alert('Area required', 'Please enter the area / location.');
      return;
    }

    // Strip empty rows
    const cleanLabor = labor.filter((l) => l.name.trim().length > 0);
    const cleanMaterials = materials.filter((m) => m.description.trim().length > 0);

    setLoading(true);
    try {
      if (isEdit && editId) {
        await updateWorkTicket(editId, {
          service_date: serviceDate,
          trade,
          area_description: areaDescription.trim(),
          floor: floor.trim() || null,
          priority,
          work_description: workDescription.trim(),
          labor: cleanLabor,
          materials: cleanMaterials,
          gc_notes: gcNotes.trim() || null,
        });
      } else {
        await createWorkTicket({
          organization_id: profile.organization_id,
          project_id: activeProject.id,
          service_date: serviceDate,
          trade,
          area_description: areaDescription.trim(),
          floor: floor.trim() || null,
          foreman_name: profile.full_name ?? 'Foreman',
          priority,
          work_description: workDescription.trim(),
          labor: cleanLabor,
          materials: cleanMaterials,
          gc_notes: gcNotes.trim() || null,
          created_by: userId,
        });
      }
      haptic.success();
      router.back();
    } catch (err) {
      const msg = (err as Error).message ?? 'Unknown error';
      Alert.alert('Save failed', msg);
    } finally {
      setLoading(false);
    }
  }, [
    user, profile, activeProject, isEdit, editId, serviceDate, trade,
    areaDescription, floor, priority, workDescription, labor, materials, gcNotes, router,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: isEdit ? 'Edit Ticket' : 'New Work Ticket',
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={loading} hitSlop={12}>
              <Text className="text-base font-bold text-brand-orange" style={{ opacity: loading ? 0.4 : 1 }}>
                {loading ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background"
      >
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">

          <Section label="Service Date">
            <View className="rounded-xl border border-border bg-card px-4 py-3">
              <Text className="text-base font-semibold text-white">{fmtDateLabel(serviceDate)}</Text>
              <View className="mt-2 flex-row gap-2">
                {[
                  { offset: 0, label: 'Today' },
                  { offset: 1, label: 'Yesterday' },
                  { offset: 2, label: '2d ago' },
                  { offset: 3, label: '3d ago' },
                ].map((opt) => (
                  <Pressable
                    key={opt.offset}
                    onPress={() => dateOffset(opt.offset)}
                    className="rounded-full border border-border bg-background px-3 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-slate-300">{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Section>

          <Section label="Trade">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TRADES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTrade(t)}
                  className={`rounded-full px-4 py-2 ${
                    trade === t ? 'bg-brand-orange' : 'border border-border bg-card'
                  }`}
                  style={{ minHeight: 40 }}
                >
                  <Text className={`text-sm font-bold ${trade === t ? 'text-white' : 'text-slate-400'}`}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Section>

          <Section label="Area / Location *">
            <TextInput
              value={areaDescription}
              onChangeText={setAreaDescription}
              placeholder="Floor 34, Unit 3406 Master Bath"
              placeholderTextColor="#64748B"
              className="rounded-xl border border-border bg-card px-4 text-base text-white"
              style={{ minHeight: 52 }}
            />
          </Section>

          <Section label="Floor (optional)">
            <TextInput
              value={floor}
              onChangeText={setFloor}
              placeholder="L3"
              placeholderTextColor="#64748B"
              className="rounded-xl border border-border bg-card px-4 text-base text-white"
              style={{ minHeight: 52 }}
            />
          </Section>

          <Section label="Priority">
            <View className="flex-row gap-3">
              {(['normal', 'urgent'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  className={`flex-1 flex-row items-center justify-center rounded-xl border px-4 py-3 ${
                    priority === p
                      ? p === 'urgent'
                        ? 'border-red-500 bg-red-500/20'
                        : 'border-brand-orange bg-brand-orange/20'
                      : 'border-border bg-card'
                  }`}
                  style={{ minHeight: 52 }}
                >
                  <Ionicons
                    name={priority === p ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={priority === p ? (p === 'urgent' ? '#EF4444' : '#F97316') : '#64748B'}
                  />
                  <Text
                    className={`ml-2 text-sm font-bold ${
                      priority === p ? (p === 'urgent' ? 'text-red-500' : 'text-brand-orange') : 'text-slate-400'
                    }`}
                  >
                    {p === 'urgent' ? '⚡ Urgent' : 'Normal'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section label="Work Description *">
            <TextInput
              value={workDescription}
              onChangeText={setWorkDescription}
              placeholder="Time and material to complete..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              className="rounded-xl border border-border bg-card px-4 py-3 text-base text-white"
              style={{ minHeight: 120 }}
            />
          </Section>

          <Section
            label="Labor"
            right={
              <Pressable onPress={addLaborRow} className="flex-row items-center" hitSlop={8}>
                <Ionicons name="add-circle" size={20} color="#0EA5E9" />
                <Text className="ml-1 text-sm font-bold text-sky-500">Add</Text>
              </Pressable>
            }
          >
            {labor.length === 0 && (
              <Text className="text-xs text-slate-500">No workers added yet.</Text>
            )}
            {labor.map((row, i) => (
              <View key={i} className="mb-2 rounded-xl border border-border bg-card p-3">
                <View className="flex-row items-center">
                  <TextInput
                    value={row.name}
                    onChangeText={(v) => updateLaborRow(i, { name: v })}
                    placeholder="Name"
                    placeholderTextColor="#64748B"
                    className="flex-1 text-base text-white"
                    style={{ minHeight: 40 }}
                  />
                  <Pressable onPress={() => removeLaborRow(i)} hitSlop={12}>
                    <Ionicons name="close-circle" size={22} color="#64748B" />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-2"
                  contentContainerStyle={{ gap: 6 }}
                >
                  {LABOR_CLASSIFICATIONS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => updateLaborRow(i, { classification: c })}
                      className={`rounded-full px-3 py-1 ${
                        row.classification === c ? 'bg-blue-600' : 'border border-border bg-background'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          row.classification === c ? 'text-white' : 'text-slate-400'
                        }`}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View className="mt-3 flex-row items-center gap-3">
                  <View className="flex-1">
                    <Text className="mb-1 text-[10px] uppercase text-slate-500">Reg hrs</Text>
                    <TextInput
                      value={String(row.regular_hours)}
                      onChangeText={(v) => updateLaborRow(i, { regular_hours: Number(v) || 0 })}
                      keyboardType="numeric"
                      className="rounded-lg border border-border bg-background px-3 text-base text-white"
                      style={{ minHeight: 40 }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-1 text-[10px] uppercase text-slate-500">OT hrs</Text>
                    <TextInput
                      value={String(row.overtime_hours)}
                      onChangeText={(v) => updateLaborRow(i, { overtime_hours: Number(v) || 0 })}
                      keyboardType="numeric"
                      className="rounded-lg border border-border bg-background px-3 text-base text-white"
                      style={{ minHeight: 40 }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </Section>

          <Section
            label="Materials"
            right={
              <Pressable onPress={addMaterialRow} className="flex-row items-center" hitSlop={8}>
                <Ionicons name="add-circle" size={20} color="#0EA5E9" />
                <Text className="ml-1 text-sm font-bold text-sky-500">Add</Text>
              </Pressable>
            }
          >
            {materials.length === 0 && (
              <Text className="text-xs text-slate-500">No materials added.</Text>
            )}
            {materials.map((row, i) => (
              <View key={i} className="mb-2 rounded-xl border border-border bg-card p-3">
                <View className="flex-row items-center">
                  <TextInput
                    value={row.description}
                    onChangeText={(v) => updateMaterialRow(i, { description: v })}
                    placeholder="Description"
                    placeholderTextColor="#64748B"
                    className="flex-1 text-base text-white"
                    style={{ minHeight: 40 }}
                  />
                  <Pressable onPress={() => removeMaterialRow(i)} hitSlop={12}>
                    <Ionicons name="close-circle" size={22} color="#64748B" />
                  </Pressable>
                </View>
                <View className="mt-2 flex-row items-center gap-3">
                  <View className="flex-1">
                    <Text className="mb-1 text-[10px] uppercase text-slate-500">Qty</Text>
                    <TextInput
                      value={String(row.quantity)}
                      onChangeText={(v) => updateMaterialRow(i, { quantity: Number(v) || 0 })}
                      keyboardType="numeric"
                      className="rounded-lg border border-border bg-background px-3 text-base text-white"
                      style={{ minHeight: 40 }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-1 text-[10px] uppercase text-slate-500">Unit</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                      {MATERIAL_UNITS.map((u) => (
                        <Pressable
                          key={u}
                          onPress={() => updateMaterialRow(i, { unit: u })}
                          className={`rounded-full px-3 py-1.5 ${
                            row.unit === u ? 'bg-blue-600' : 'border border-border bg-background'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              row.unit === u ? 'text-white' : 'text-slate-400'
                            }`}
                          >
                            {u}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>
            ))}
          </Section>

          <Section label="GC Notes (optional)">
            <TextInput
              value={gcNotes}
              onChangeText={setGcNotes}
              placeholder="(optional)"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="rounded-xl border border-border bg-card px-4 py-3 text-base text-white"
              style={{ minHeight: 80 }}
            />
          </Section>

          <Pressable
            onPress={handleSave}
            disabled={loading}
            className="mb-8 mt-2 flex-row items-center justify-center rounded-2xl bg-success py-4 active:opacity-80"
            style={{ opacity: loading ? 0.5 : 1, minHeight: 56 }}
          >
            <Ionicons name="save" size={20} color="#FFFFFF" />
            <Text className="ml-2 text-lg font-bold text-white">
              {isEdit ? 'Save Changes' : 'Save as Draft'}
            </Text>
          </Pressable>

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Section({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}
