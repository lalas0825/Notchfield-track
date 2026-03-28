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
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useCrewStore } from '@/features/crew/store/crew-store';
import { createPunchItem, type PunchPriority } from '../services/punch-service';

const PRIORITIES: { value: PunchPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#22C55E' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#F97316' },
  { value: 'critical', label: 'Critical', color: '#EF4444' },
];

type Props = {
  areaId: string;
  areaName: string;
};

export function PunchItemForm({ areaId, areaName }: Props) {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { workers } = useCrewStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PunchPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleSave = async () => {
    if (!user || !profile || !activeProject) return;
    setError(null);

    setSaving(true);
    const result = await createPunchItem({
      organizationId: profile.organization_id,
      projectId: activeProject.id,
      areaId,
      title,
      description,
      priority,
      photos,
      assignedTo: assignedTo ?? undefined,
      createdBy: user.id,
    });

    setSaving(false);
    if (result.success) {
      router.back();
    } else {
      setError(result.error ?? 'Failed to create');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <ScrollView className="flex-1 bg-background px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Area context */}
        <View className="mb-4 flex-row items-center rounded-xl border border-border bg-card px-4 py-3">
          <Ionicons name="location" size={16} color="#F97316" />
          <Text className="ml-2 text-base text-white">{areaName}</Text>
        </View>

        {/* Photo (required — take first) */}
        <Text className="mb-2 text-sm font-bold uppercase text-slate-400">
          Defect Photo <Text className="normal-case text-danger">(required)</Text>
        </Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {photos.map((uri, i) => (
            <View key={i} className="relative">
              <Image source={{ uri }} className="h-24 w-24 rounded-xl" />
              <Pressable
                onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-danger"
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={takePhoto}
            className="h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-brand-orange active:opacity-80"
          >
            <Ionicons name="camera" size={28} color="#F97316" />
          </Pressable>
        </View>

        {/* Title */}
        <Text className="mb-1 text-sm font-medium text-slate-400">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Grout missing NE corner"
          placeholderTextColor="#64748B"
          className="mb-4 h-14 rounded-xl border border-border bg-card px-4 text-base text-white"
        />

        {/* Description */}
        <Text className="mb-1 text-sm font-medium text-slate-400">Details (optional)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Additional context..."
          placeholderTextColor="#64748B"
          multiline
          className="mb-4 h-20 rounded-xl border border-border bg-card px-4 pt-3 text-base text-white"
        />

        {/* Priority */}
        <Text className="mb-2 text-sm font-medium text-slate-400">Priority</Text>
        <View className="mb-4 flex-row gap-2">
          {PRIORITIES.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => setPriority(p.value)}
              className={`flex-1 items-center rounded-xl border py-2.5 ${
                priority === p.value ? 'border-2' : 'border-border'
              }`}
              style={priority === p.value ? { borderColor: p.color, backgroundColor: `${p.color}15` } : undefined}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: priority === p.value ? p.color : '#94A3B8' }}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Assign to */}
        <Text className="mb-2 text-sm font-medium text-slate-400">Assign To</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {workers.filter((w) => w.role === 'foreman' || w.role === 'superintendent').map((w) => (
              <Pressable
                key={w.id}
                onPress={() => setAssignedTo(assignedTo === w.id ? null : w.id)}
                className={`items-center rounded-xl border px-4 py-2 ${
                  assignedTo === w.id ? 'border-brand-orange bg-brand-orange/10' : 'border-border bg-card'
                }`}
              >
                <Text className={`text-sm ${assignedTo === w.id ? 'text-brand-orange' : 'text-white'}`}>
                  {w.full_name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

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
            {saving ? 'Creating...' : 'Create Punch Item'}
          </Text>
        </Pressable>

        <View className="h-24" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
