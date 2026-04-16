/**
 * Work Ticket Create / Edit — Sprint 45B
 * Field names mirror Takeoff Web exactly:
 *   classification, regular_hours, overtime_hours, quantity
 * GC Notes removed from create — GC adds notes at signing time.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
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
  uploadPhotoFromUri as takeTicketPhotoFromUri,
} from '@/features/work-tickets/services/workTicketPhotoService';
import {
  TRADES,
  LABOR_CLASSIFICATIONS,
  MATERIAL_UNITS,
  type LaborEntry,
  type MaterialEntry,
  type WorkTicketPhoto,
} from '@/features/work-tickets/types';
import { haptic } from '@/shared/lib/haptics';
import { DatePickerField, todayISO } from '@/shared/components/DatePickerModal';

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
  const [photoUris, setPhotoUris] = useState<string[]>([]);
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
      })
      .catch((err) => {
        console.warn('[create] load failed', err);
        Alert.alert('Load failed', 'Could not load ticket.');
        router.back();
      });
  }, [editId, router]);

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

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: true });
    if (!result.canceled) {
      setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      haptic.light();
    }
  };

  const handlePickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Gallery permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      legacy: true,
    } as any);
    if (!result.canceled) {
      setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      haptic.light();
    }
  };

  const removePhotoUri = (idx: number) => { setPhotoUris((p) => p.filter((_, i) => i !== idx)); haptic.light(); };

  const handleSave = useCallback(async () => {
    const userId = profile?.id ?? user?.id;
    if (!profile || !userId) {
      Alert.alert('Not signed in', 'Please sign out and back in.');
      return;
    }
    if (!activeProject) {
      Alert.alert('No project selected', 'Select a project from the Tickets screen first.');
      return;
    }
    if (!areaDescription.trim()) {
      Alert.alert('Area required', 'Please enter the area / location.');
      return;
    }
    if (!workDescription.trim()) {
      Alert.alert('Description required', 'Please enter a work description.');
      return;
    }

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
          gc_notes: null,
        });
        // Upload any new photos for edited ticket
        if (photoUris.length > 0) {
          for (const uri of photoUris) {
            await takeTicketPhotoFromUri(editId, profile.organization_id, userId, profile.full_name ?? 'Foreman', uri);
          }
        }
      } else {
        const newTicket = await createWorkTicket({
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
          gc_notes: null,
          created_by: userId,
        });
        // Upload photos in the background after ticket is saved
        if (photoUris.length > 0 && newTicket?.id) {
          for (const uri of photoUris) {
            await takeTicketPhotoFromUri(newTicket.id, profile.organization_id, userId, profile.full_name ?? 'Foreman', uri);
          }
        }
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
    areaDescription, floor, priority, workDescription, labor, materials, photoUris, router,
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

          {/* Date picker */}
          <Section label="Service Date">
            <DatePickerField value={serviceDate} onChange={setServiceDate} />
          </Section>

          {/* Trade */}
          <Section label="Trade">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TRADES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => { setTrade(t); haptic.light(); }}
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

          {/* Area */}
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

          {/* Floor */}
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

          {/* Priority */}
          <Section label="Priority">
            <View className="flex-row gap-3">
              {(['normal', 'urgent'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => { setPriority(p); haptic.light(); }}
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

          {/* Work Description */}
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

          {/* Labor */}
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

          {/* Materials */}
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

          {/* Evidence Photos */}
          <Section label={`Evidence Photos (${photoUris.length})`}>
            {photoUris.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                className="mb-2"
              >
                {photoUris.map((uri, idx) => (
                  <View key={uri + idx} className="relative">
                    <Image
                      source={{ uri }}
                      style={{ width: 96, height: 96, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => removePhotoUri(idx)}
                      className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-red-500"
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color="#FFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleTakePhoto}
                className="flex-1 flex-row items-center justify-center rounded-xl bg-blue-600 py-3 active:opacity-80"
                style={{ minHeight: 48 }}
              >
                <Ionicons name="camera" size={18} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-bold text-white">Take Photo</Text>
              </Pressable>
              <Pressable
                onPress={handlePickPhotos}
                className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card py-3 active:opacity-80"
                style={{ minHeight: 48 }}
              >
                <Ionicons name="images-outline" size={18} color="#F8FAFC" />
                <Text className="ml-2 text-sm font-bold text-white">Gallery</Text>
              </Pressable>
            </View>
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
