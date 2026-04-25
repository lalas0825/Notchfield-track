import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { normalizeTrackRole } from '@/shared/lib/permissions/trackPermissions';
import {
  resolvePunchItem,
  verifyPunchItem,
  rejectPunchItem,
  type PunchItem,
} from '@/features/punch/services/punch-service';
import { BeforeAfterView } from '@/features/punch/components/PunchItemCard';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

export default function PunchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [item, setItem] = useState<PunchItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bug fix 2026-04-25: see useLegalDocs.ts for the same fix rationale.
  const isSupervisor = normalizeTrackRole(profile?.role) === 'supervisor';

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('punch_items').select('*').eq('id', id).single();
      setItem(data as PunchItem | null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading || !item) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  const priorityColor = PRIORITY_COLORS[item.priority] ?? '#94A3B8';
  const photos = item.photos ?? [];
  const canResolve = !isSupervisor && (item.status === 'open' || item.status === 'rejected');
  const canVerify = isSupervisor && item.status === 'resolved';

  const takeAfterPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setResolutionPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleResolve = async () => {
    setError(null);
    setSaving(true);
    const result = await resolvePunchItem(item.id, resolutionPhotos);
    setSaving(false);
    if (result.success) {
      router.back();
    } else {
      setError(result.error ?? 'Failed');
    }
  };

  const handleVerify = async () => {
    setSaving(true);
    const result = await verifyPunchItem(item.id);
    setSaving(false);
    if (result.success) router.back();
  };

  const handleReject = async () => {
    setError(null);
    setSaving(true);
    const result = await rejectPunchItem(item.id, rejectReason);
    setSaving(false);
    if (result.success) {
      router.back();
    } else {
      setError(result.error ?? 'Failed');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Punch Item' }} />
      <ScrollView className="flex-1 bg-background px-4 pt-4">
        {/* Header */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-xl font-bold text-white">{item.title}</Text>
            <View className="ml-2 flex-row items-center gap-2">
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: priorityColor }} />
              <Text className="text-sm capitalize text-slate-400">{item.priority}</Text>
            </View>
          </View>
          {item.description && (
            <Text className="mt-2 text-base text-slate-300">{item.description}</Text>
          )}
          <Text className="mt-2 text-xs text-slate-500">
            Created {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>

        {/* Before/After comparison (if resolved/verified) */}
        {(item.resolution_photos ?? []).length > 0 && (
          <View className="mb-4">
            <Text className="mb-2 text-sm font-bold uppercase text-slate-400">Before / After</Text>
            <BeforeAfterView item={item} />
          </View>
        )}

        {/* Defect photos (before) */}
        {photos.length > 0 && (item.resolution_photos ?? []).length === 0 && (
          <View className="mb-4">
            <Text className="mb-2 text-sm font-bold uppercase text-slate-400">
              Defect Photos ({photos.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} className="h-40 w-40 rounded-xl" resizeMode="cover" />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Rejected reason */}
        {item.status === 'rejected' && item.rejected_reason && (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-sm font-bold text-danger">Rejected</Text>
            <Text className="mt-1 text-base text-white">{item.rejected_reason}</Text>
          </View>
        )}

        {/* Foreman: resolve with after photo */}
        {canResolve && (
          <View className="mb-4">
            <Text className="mb-2 text-sm font-bold uppercase text-slate-400">
              Resolve — Take "After" Photo
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {resolutionPhotos.map((uri, i) => (
                <View key={i} className="relative">
                  <Image source={{ uri }} className="h-24 w-24 rounded-xl" />
                  <Pressable
                    onPress={() => setResolutionPhotos((p) => p.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-danger"
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={takeAfterPhoto}
                className="h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-success active:opacity-80"
              >
                <Ionicons name="camera" size={28} color="#22C55E" />
                <Text className="mt-0.5 text-xs text-success">After</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleResolve}
              disabled={saving || resolutionPhotos.length === 0}
              className={`mt-3 h-14 items-center justify-center rounded-xl ${
                resolutionPhotos.length > 0 ? 'bg-success' : 'bg-slate-700'
              } active:opacity-80`}
            >
              <Text className="text-lg font-bold text-white">
                {saving ? 'Submitting...' : 'Mark Resolved'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Supervisor: verify or reject */}
        {canVerify && (
          <View className="mb-4 gap-2">
            <Pressable
              onPress={handleVerify}
              disabled={saving}
              className="h-14 flex-row items-center justify-center rounded-xl bg-success active:opacity-80"
            >
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text className="ml-2 text-lg font-bold text-white">Approve</Text>
            </Pressable>

            {!showReject ? (
              <Pressable
                onPress={() => setShowReject(true)}
                className="h-14 flex-row items-center justify-center rounded-xl border border-danger active:opacity-80"
              >
                <Ionicons name="close-circle" size={22} color="#EF4444" />
                <Text className="ml-2 text-lg font-bold text-danger">Reject</Text>
              </Pressable>
            ) : (
              <View className="rounded-xl border border-border bg-card p-4">
                <Text className="mb-2 text-sm font-medium text-slate-400">Rejection Reason</Text>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Why is this not acceptable?"
                  placeholderTextColor="#64748B"
                  multiline
                  className="mb-3 h-20 rounded-xl border border-border bg-background px-4 pt-3 text-base text-white"
                />
                <Pressable
                  onPress={handleReject}
                  disabled={saving || !rejectReason.trim()}
                  className="h-12 items-center justify-center rounded-xl bg-danger active:opacity-80"
                >
                  <Text className="text-base font-bold text-white">Confirm Rejection</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Error */}
        {error && (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base text-danger">{error}</Text>
          </View>
        )}

        <View className="h-24" />
      </ScrollView>
    </>
  );
}
