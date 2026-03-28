import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCrewStore } from '@/features/crew/store/crew-store';
import { useTickets } from '../hooks/useTickets';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#94A3B8' },
  { value: 'submitted', label: 'Submitted', color: '#F59E0B' },
  { value: 'reviewed', label: 'Reviewed', color: '#3B82F6' },
  { value: 'closed', label: 'Completed', color: '#22C55E' },
] as const;

export function TicketForm() {
  const router = useRouter();
  const { createTicket } = useTickets();
  const { areas, assignments, getAreaWorkers } = useCrewStore();

  // Auto-detect: if foreman has workers assigned, default to that area
  const firstAssignment = assignments[0];
  const defaultArea = firstAssignment
    ? areas.find((a) => a.id === firstAssignment.area_id)
    : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(defaultArea?.id ?? null);
  const [status, setStatus] = useState('draft');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedArea = areas.find((a) => a.id === selectedAreaId);
  const areaWorkers = selectedAreaId ? getAreaWorkers(selectedAreaId) : [];

  const takePhoto = async () => {
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      setError('Camera permission required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    // Completed tickets require at least one photo
    if (status === 'closed' && photos.length === 0) {
      setError('Completed tickets require at least one photo');
      return;
    }

    setSaving(true);

    // Build description with crew context
    let fullDescription = description;
    if (areaWorkers.length > 0) {
      const workerNames = areaWorkers.map((w) => w.full_name).join(', ');
      fullDescription = `${description}\n\n---\nCrew: ${workerNames}`;
    }

    const result = await createTicket({
      title: title.trim(),
      description: fullDescription,
      floor: selectedArea?.floor ?? null,
      area: selectedArea?.name ?? null,
      photos,
      status,
    });

    setSaving(false);
    if (result.success) {
      router.back();
    } else {
      setError(result.error ?? 'Failed to save');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ScrollView className="flex-1 bg-background px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Title */}
        <Text className="mb-1 text-sm font-medium text-slate-400">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Brief description of the issue"
          placeholderTextColor="#64748B"
          className="mb-4 h-14 rounded-xl border border-border bg-card px-4 text-base text-white"
        />

        {/* Description */}
        <Text className="mb-1 text-sm font-medium text-slate-400">Details</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What happened? What needs to be done?"
          placeholderTextColor="#64748B"
          multiline
          className="mb-4 h-24 rounded-xl border border-border bg-card px-4 pt-3 text-base text-white"
        />

        {/* Area selector — shows areas with assigned crew */}
        <Text className="mb-2 text-sm font-medium text-slate-400">Area</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {areas.map((area) => {
              const selected = selectedAreaId === area.id;
              const workerCount = getAreaWorkers(area.id).length;
              return (
                <Pressable
                  key={area.id}
                  onPress={() => setSelectedAreaId(area.id)}
                  className={`items-center rounded-xl border px-4 py-3 ${
                    selected ? 'border-brand-orange bg-brand-orange/10' : 'border-border bg-card'
                  }`}
                >
                  <Text className={`text-sm font-medium ${selected ? 'text-brand-orange' : 'text-white'}`}>
                    {area.name}
                  </Text>
                  {area.floor && (
                    <Text className="text-xs text-slate-500">{area.floor}</Text>
                  )}
                  {workerCount > 0 && (
                    <View className="mt-1 flex-row items-center">
                      <Ionicons name="people" size={10} color="#94A3B8" />
                      <Text className="ml-1 text-xs text-slate-400">{workerCount}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            {areas.length === 0 && (
              <Text className="text-sm text-slate-500">No areas available</Text>
            )}
          </View>
        </ScrollView>

        {/* Crew auto-detected */}
        {areaWorkers.length > 0 && (
          <View className="mb-4 rounded-xl border border-border bg-card px-4 py-3">
            <View className="flex-row items-center mb-1">
              <Ionicons name="people" size={16} color="#22C55E" />
              <Text className="ml-2 text-sm font-medium text-success">Crew on {selectedArea?.name}</Text>
            </View>
            <Text className="text-base text-white">
              {areaWorkers.map((w) => w.full_name).join(', ')}
            </Text>
          </View>
        )}

        {/* Status */}
        <Text className="mb-2 text-sm font-medium text-slate-400">Status</Text>
        <View className="mb-4 flex-row gap-2">
          {STATUS_OPTIONS.map((s) => (
            <Pressable
              key={s.value}
              onPress={() => setStatus(s.value)}
              className={`flex-1 items-center rounded-xl border py-2 ${
                status === s.value ? 'border-2' : 'border-border'
              }`}
              style={status === s.value ? { borderColor: s.color, backgroundColor: `${s.color}15` } : undefined}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: status === s.value ? s.color : '#94A3B8' }}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Photos */}
        <Text className="mb-2 text-sm font-medium text-slate-400">
          Photos {status === 'closed' && <Text className="text-danger">(required)</Text>}
        </Text>

        <View className="mb-4 flex-row flex-wrap gap-2">
          {photos.map((uri, i) => (
            <View key={i} className="relative">
              <Image
                source={{ uri }}
                className="h-20 w-20 rounded-xl"
              />
              <Pressable
                onPress={() => removePhoto(i)}
                className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-danger"
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}

          {/* Camera button — 80dp, prominent */}
          <Pressable
            onPress={takePhoto}
            className="h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-brand-orange active:opacity-80"
          >
            <Ionicons name="camera" size={28} color="#F97316" />
            <Text className="mt-0.5 text-xs text-brand-orange">Photo</Text>
          </Pressable>

          {/* Gallery button */}
          <Pressable
            onPress={pickFromGallery}
            className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-border active:opacity-80"
          >
            <Ionicons name="images-outline" size={24} color="#64748B" />
            <Text className="mt-0.5 text-xs text-slate-500">Gallery</Text>
          </Pressable>
        </View>

        {/* Error */}
        {error && (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base text-danger">{error}</Text>
          </View>
        )}

        {/* Save */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="mb-4 h-14 items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
        >
          <Text className="text-lg font-bold text-white">
            {saving ? 'Saving...' : 'Create Ticket'}
          </Text>
        </Pressable>

        <View className="h-24" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
