/**
 * AddPinSheet — Sprint 47B
 * ==========================
 * Bottom-sheet modal to create a new pin at the center of the current view.
 * Type chips (note/photo/rfi), title, description, up to 3 photos.
 * Offline-first: metadata via PowerSync, photos upload when online.
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  createPin,
  uploadPinPhoto,
  defaultPinColor,
  type PinType,
} from '../services/pin-service';
import { supabase } from '@/shared/lib/supabase/client';
import { haptic } from '@/shared/lib/haptics';

const TYPE_OPTIONS: { value: PinType; label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }[] = [
  { value: 'note',  label: 'Note',  icon: 'bookmark' },
  { value: 'photo', label: 'Photo', icon: 'camera' },
  { value: 'rfi',   label: 'RFI',   icon: 'help-circle' },
];

const MAX_PHOTOS = 3;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  // context
  organizationId: string;
  projectId: string;
  drawingId: string;
  createdBy: string;
  positionX: number;
  positionY: number;
};

export function AddPinSheet({
  visible,
  onClose,
  onCreated,
  organizationId,
  projectId,
  drawingId,
  createdBy,
  positionX,
  positionY,
}: Props) {
  const [pinType, setPinType] = useState<PinType>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setPinType('note');
    setTitle('');
    setDescription('');
    setLocalPhotos([]);
    setSubmitting(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const takePhoto = useCallback(async () => {
    if (localPhotos.length >= MAX_PHOTOS) {
      Alert.alert('Max 3 photos', 'Remove one first.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setLocalPhotos((p) => [...p, result.assets[0].uri]);
    haptic.light();
  }, [localPhotos.length]);

  const pickPhoto = useCallback(async () => {
    if (localPhotos.length >= MAX_PHOTOS) {
      Alert.alert('Max 3 photos', 'Remove one first.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setLocalPhotos((p) => [...p, result.assets[0].uri]);
    haptic.light();
  }, [localPhotos.length]);

  const removePhoto = useCallback((idx: number) => {
    setLocalPhotos((p) => p.filter((_, i) => i !== idx));
    haptic.light();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a brief title.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createPin({
        organization_id: organizationId,
        project_id: projectId,
        drawing_id: drawingId,
        pin_type: pinType,
        position_x: positionX,
        position_y: positionY,
        title: title.trim(),
        description: description.trim(),
        created_by: createdBy,
        photos: [],
      });

      if (!created.success) {
        Alert.alert('Failed', created.error ?? 'Unable to save pin.');
        setSubmitting(false);
        return;
      }

      // Upload photos online (best-effort). If offline, skip and user can
      // add photos later — pin itself is already saved.
      if (localPhotos.length > 0) {
        const uploaded: string[] = [];
        for (let i = 0; i < localPhotos.length; i++) {
          const up = await uploadPinPhoto({
            localUri: localPhotos[i],
            organizationId,
            pinId: created.id,
            index: i,
          });
          if (up.success && up.path) uploaded.push(up.path);
        }
        if (uploaded.length > 0) {
          await supabase
            .from('drawing_pins')
            .update({ photos: uploaded })
            .eq('id', created.id);
        }
      }

      haptic.success();
      onCreated();
      close();
    } catch (err) {
      Alert.alert('Failed', (err as Error).message ?? 'Unknown error');
      setSubmitting(false);
    }
  }, [
    title, description, pinType, organizationId, projectId, drawingId,
    createdBy, positionX, positionY, localPhotos, onCreated, close,
  ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={close}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl border-t border-border bg-card px-5 pb-8 pt-4"
          style={{ maxHeight: '88%' }}
        >
          <View className="mb-3 items-center">
            <View className="h-1 w-12 rounded-full bg-slate-600" />
          </View>

          <Text className="mb-3 text-lg font-bold text-white">New Pin</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Type</Text>
            <View className="mb-4 flex-row gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const active = pinType === opt.value;
                const color = defaultPinColor(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setPinType(opt.value); haptic.light(); }}
                    className={`flex-1 flex-row items-center justify-center rounded-xl border px-3 py-3 ${
                      active ? '' : 'border-border bg-background'
                    }`}
                    style={{
                      minHeight: 52,
                      borderColor: active ? color : '#334155',
                      backgroundColor: active ? `${color}25` : undefined,
                    }}
                  >
                    <Ionicons name={opt.icon} size={18} color={active ? color : '#64748B'} />
                    <Text
                      className={`ml-2 text-sm font-bold ${active ? 'text-white' : 'text-slate-400'}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Title */}
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Verify tile layout"
              placeholderTextColor="#64748B"
              className="mb-4 rounded-xl border border-border bg-background px-4 text-base text-white"
              style={{ minHeight: 52 }}
            />

            {/* Description */}
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Details…"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="mb-4 rounded-xl border border-border bg-background px-4 py-3 text-base text-white"
              style={{ minHeight: 100 }}
            />

            {/* Photos */}
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Photos ({localPhotos.length}/{MAX_PHOTOS})
            </Text>
            <View className="mb-2 flex-row gap-2">
              <Pressable
                onPress={takePhoto}
                disabled={localPhotos.length >= MAX_PHOTOS}
                className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-background py-3 active:opacity-80"
                style={{ minHeight: 52, opacity: localPhotos.length >= MAX_PHOTOS ? 0.4 : 1 }}
              >
                <Ionicons name="camera" size={18} color="#F8FAFC" />
                <Text className="ml-2 text-sm font-bold text-white">Take Photo</Text>
              </Pressable>
              <Pressable
                onPress={pickPhoto}
                disabled={localPhotos.length >= MAX_PHOTOS}
                className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-background py-3 active:opacity-80"
                style={{ minHeight: 52, opacity: localPhotos.length >= MAX_PHOTOS ? 0.4 : 1 }}
              >
                <Ionicons name="images" size={18} color="#F8FAFC" />
                <Text className="ml-2 text-sm font-bold text-white">Gallery</Text>
              </Pressable>
            </View>

            {localPhotos.length > 0 && (
              <View className="mb-4 flex-row gap-2">
                {localPhotos.map((uri, i) => (
                  <View key={i} className="relative">
                    <Image
                      source={{ uri }}
                      style={{ width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: '#334155' }}
                    />
                    <Pressable
                      onPress={() => removePhoto(i)}
                      className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-red-600"
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              className="mt-2 flex-row items-center justify-center rounded-2xl bg-success py-4 active:opacity-80"
              style={{ minHeight: 56, opacity: submitting ? 0.5 : 1 }}
            >
              <Ionicons name="save" size={20} color="#FFFFFF" />
              <Text className="ml-2 text-lg font-bold text-white">
                {submitting ? 'Saving…' : 'Save Pin'}
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
