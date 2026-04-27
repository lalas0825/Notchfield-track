/**
 * Sprint 71 — Deficiency detail screen with resolve flow.
 *
 * Shows: severity + status + title + description + responsibility +
 * before-photos + (if resolved) after-photos + (if rejected) reason.
 *
 * Foreman action when status ∈ {open, in_progress}:
 *   "Mark as Resolved" → camera/gallery → at least 1 after-photo →
 *   uploadDeficiencyPhotos → resolveDeficiencyViaWeb. Per spec §8
 *   auto-blindaje, resolution must have evidence; we enforce client-side
 *   AND the API rejects empty resolutionPhotos[].
 *
 * Supervisor verify/reject UI: deferred to Phase 2 per spec §4. The API
 * client functions exist (verifyAndForget, rejectAndForget) ready to
 * wire when the Compliance screen for supervisor lands.
 *
 * Looks up the deficiency from PowerSync local SQLite by id; falls back
 * to network if local has no match (rare — happens if a row arrives via
 * realtime before a sync completes).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { localQuery } from '@/shared/lib/powersync/write';
import { supabase } from '@/shared/lib/supabase/client';
import { resolveDeficiencyViaWeb } from '../services/deficiencyApiClient';
import { uploadDeficiencyPhotos } from '../services/deficiencyPhotos';
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  STATUS_LABEL,
  RESPONSIBILITY_LABEL,
} from '../types';
import type {
  Deficiency,
  DeficiencyResponsibility,
  DeficiencySeverity,
  DeficiencyStage,
  DeficiencyStatus,
} from '../types';

type RawRow = Record<string, unknown>;

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToDeficiency(row: RawRow): Deficiency {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    project_id: row.project_id as string,
    area_id: row.area_id as string,
    surface_id: (row.surface_id as string | null) ?? null,
    title: (row.title as string) ?? '',
    description: (row.description as string | null) ?? null,
    severity: (row.severity as DeficiencySeverity) ?? 'minor',
    stage: (row.stage as DeficiencyStage) ?? 'internal_qc',
    responsibility:
      (row.responsibility as DeficiencyResponsibility) ?? 'unknown',
    trade: (row.trade as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    library_id: (row.library_id as string | null) ?? null,
    status: (row.status as DeficiencyStatus) ?? 'open',
    photos: parseJsonArray(row.photos),
    resolution_photos: parseJsonArray(row.resolution_photos),
    assigned_to: (row.assigned_to as string | null) ?? null,
    created_by: row.created_by as string,
    resolved_at: (row.resolved_at as string | null) ?? null,
    resolved_by: (row.resolved_by as string | null) ?? null,
    verified_at: (row.verified_at as string | null) ?? null,
    verified_by: (row.verified_by as string | null) ?? null,
    rejected_reason: (row.rejected_reason as string | null) ?? null,
    closed_at: (row.closed_at as string | null) ?? null,
    estimated_cost_cents:
      typeof row.estimated_cost_cents === 'number'
        ? (row.estimated_cost_cents as number)
        : null,
    billed_amount_cents:
      typeof row.billed_amount_cents === 'number'
        ? (row.billed_amount_cents as number)
        : null,
    plan_x: typeof row.plan_x === 'number' ? (row.plan_x as number) : null,
    plan_y: typeof row.plan_y === 'number' ? (row.plan_y as number) : null,
    drawing_id: (row.drawing_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  };
}

export default function DeficiencyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const profile = useAuthStore((s) => s.profile);

  const [deficiency, setDeficiency] = useState<Deficiency | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const [showResolveStep, setShowResolveStep] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const rows = await localQuery<RawRow>(
      `SELECT * FROM deficiencies WHERE id = ? LIMIT 1`,
      [id],
    );
    let row = rows && rows.length > 0 ? rows[0] : null;
    if (!row) {
      // Fallback to direct Supabase if local SQLite hasn't synced yet
      const { data } = await supabase
        .from('deficiencies')
        .select('*')
        .eq('id', id)
        .single();
      if (data) row = data as RawRow;
    }
    setDeficiency(row ? rowToDeficiency(row) : null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleAddPhoto = useCallback(
    async (source: 'camera' | 'gallery') => {
      if (resolutionPhotos.length >= 4) {
        Alert.alert('Limit reached', 'Up to 4 resolution photos.');
        return;
      }
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission required',
          `${source === 'camera' ? 'Camera' : 'Gallery'} access needed.`,
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;
      setResolutionPhotos((p) => [...p, result.assets[0].uri]);
    },
    [resolutionPhotos.length],
  );

  const handleResolve = useCallback(async () => {
    if (!deficiency || !profile) return;
    if (resolutionPhotos.length === 0) {
      Alert.alert(
        'Photo required',
        'Capture at least one after-photo as evidence of the fix.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const urls = await uploadDeficiencyPhotos(
        resolutionPhotos,
        profile.organization_id,
        deficiency.id,
      );
      await resolveDeficiencyViaWeb(deficiency.id, urls);
      Alert.alert('Resolved', 'PM has been notified to verify.');
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not mark as resolved';
      Alert.alert('Failed', msg);
      setSubmitting(false);
    }
  }, [deficiency, profile, resolutionPhotos, router]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={DEFAULT_SCREEN_OPTIONS} />
        <View style={LoadingScreenStyle}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      </>
    );
  }

  if (!deficiency) {
    return (
      <>
        <Stack.Screen options={DEFAULT_SCREEN_OPTIONS} />
        <View style={LoadingScreenStyle}>
          <Text style={{ color: '#94A3B8' }}>Deficiency not found.</Text>
        </View>
      </>
    );
  }

  const canResolve =
    deficiency.status === 'open' || deficiency.status === 'in_progress';
  const isResolvedOrVerified =
    deficiency.status === 'resolved' || deficiency.status === 'verified';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Deficiency',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={{ paddingHorizontal: 8 }}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: '#0F172A' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 64 }}
      >
        {/* Severity + Status header */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 6,
              backgroundColor: SEVERITY_COLOR[deficiency.severity],
            }}
          >
            <Text
              style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}
            >
              {SEVERITY_LABEL[deficiency.severity].toUpperCase()}
            </Text>
          </View>
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 6,
              backgroundColor: '#1E293B',
              borderWidth: 1,
              borderColor: '#334155',
            }}
          >
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>
              {STATUS_LABEL[deficiency.status].toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Title + meta */}
        <Text
          style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '700' }}
        >
          {deficiency.title}
        </Text>
        {deficiency.description ? (
          <Text
            style={{
              color: '#94A3B8',
              fontSize: 14,
              marginTop: 6,
              lineHeight: 20,
            }}
          >
            {deficiency.description}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            gap: 16,
            marginTop: 12,
            flexWrap: 'wrap',
          }}
        >
          <Meta
            label="Responsibility"
            value={RESPONSIBILITY_LABEL[deficiency.responsibility]}
          />
          {deficiency.trade ? (
            <Meta label="Trade" value={deficiency.trade} />
          ) : null}
          {deficiency.category ? (
            <Meta label="Category" value={deficiency.category} />
          ) : null}
        </View>

        {/* Rejection reason (if rejected before) */}
        {deficiency.rejected_reason ? (
          <View
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              backgroundColor: '#1F0F0F',
              borderWidth: 1,
              borderColor: '#7F1D1D',
            }}
          >
            <Text
              style={{ color: '#F87171', fontSize: 11, fontWeight: '700' }}
            >
              REJECTED BY PM
            </Text>
            <Text
              style={{ color: '#FCA5A5', fontSize: 13, marginTop: 4 }}
            >
              {deficiency.rejected_reason}
            </Text>
          </View>
        ) : null}

        {/* Before photos */}
        {deficiency.photos.length > 0 ? (
          <PhotoSection
            label={`Reported · ${deficiency.photos.length} photo${
              deficiency.photos.length === 1 ? '' : 's'
            }`}
            photos={deficiency.photos}
          />
        ) : null}

        {/* After photos */}
        {deficiency.resolution_photos.length > 0 ? (
          <PhotoSection
            label={`Resolution · ${deficiency.resolution_photos.length} photo${
              deficiency.resolution_photos.length === 1 ? '' : 's'
            }`}
            photos={deficiency.resolution_photos}
            tint="#22C55E"
          />
        ) : null}

        {/* Resolve flow */}
        {canResolve ? (
          <View style={{ marginTop: 24 }}>
            {!showResolveStep ? (
              <Pressable
                onPress={() => setShowResolveStep(true)}
                style={{
                  height: 52,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#22C55E',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '700',
                  }}
                >
                  Mark as Resolved
                </Text>
              </Pressable>
            ) : (
              <View
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: '#1E293B',
                  borderWidth: 1,
                  borderColor: '#334155',
                }}
              >
                <Text
                  style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}
                >
                  Add resolution photos
                </Text>
                <Text
                  style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}
                >
                  At least one after-photo is required as evidence of the fix.
                </Text>

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 16,
                  }}
                >
                  {resolutionPhotos.map((uri, i) => (
                    <View key={`${uri}-${i}`} style={{ position: 'relative' }}>
                      <Image
                        source={{ uri }}
                        style={{
                          width: 96,
                          height: 96,
                          borderRadius: 8,
                          backgroundColor: '#0F172A',
                        }}
                      />
                      <Pressable
                        onPress={() =>
                          setResolutionPhotos((p) =>
                            p.filter((_, j) => j !== i),
                          )
                        }
                        disabled={submitting}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          backgroundColor: '#EF4444',
                          borderRadius: 12,
                          width: 24,
                          height: 24,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: '#1E293B',
                        }}
                      >
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                  {resolutionPhotos.length < 4 && !submitting ? (
                    <>
                      <Pressable
                        onPress={() => handleAddPhoto('camera')}
                        style={PhotoSlotStyle}
                      >
                        <Ionicons name="camera" size={20} color="#94A3B8" />
                        <Text style={PhotoSlotLabelStyle}>Camera</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleAddPhoto('gallery')}
                        style={PhotoSlotStyle}
                      >
                        <Ionicons name="image" size={20} color="#94A3B8" />
                        <Text style={PhotoSlotLabelStyle}>Gallery</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>

                <Pressable
                  onPress={handleResolve}
                  disabled={submitting || resolutionPhotos.length === 0}
                  style={{
                    marginTop: 16,
                    height: 48,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      submitting || resolutionPhotos.length === 0
                        ? '#334155'
                        : '#22C55E',
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : null}
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 15,
                      fontWeight: '700',
                    }}
                  >
                    {submitting ? 'Submitting…' : 'Submit Resolution'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!submitting) {
                      setShowResolveStep(false);
                      setResolutionPhotos([]);
                    }
                  }}
                  style={{
                    marginTop: 8,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#94A3B8', fontSize: 13 }}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {/* Status banner for resolved/verified */}
        {isResolvedOrVerified ? (
          <View
            style={{
              marginTop: 24,
              padding: 14,
              borderRadius: 10,
              backgroundColor:
                deficiency.status === 'verified' ? '#0B1A2E' : '#0B1F1A',
              borderWidth: 1,
              borderColor:
                deficiency.status === 'verified' ? '#1E40AF' : '#065F46',
            }}
          >
            <Text
              style={{
                color: deficiency.status === 'verified' ? '#60A5FA' : '#34D399',
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {deficiency.status === 'verified'
                ? '✓ Verified by PM'
                : '⌛ Awaiting PM Verification'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text
        style={{
          color: '#64748B',
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: '#F8FAFC',
          fontSize: 13,
          fontWeight: '600',
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function PhotoSection({
  label,
  photos,
  tint = '#94A3B8',
}: {
  label: string;
  photos: string[];
  tint?: string;
}) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text
        style={{
          color: tint,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {photos.map((uri, i) => (
          <Image
            key={`${uri}-${i}`}
            source={{ uri }}
            style={{
              width: 140,
              height: 140,
              borderRadius: 10,
              backgroundColor: '#0F172A',
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const DEFAULT_SCREEN_OPTIONS = {
  title: 'Deficiency',
  headerStyle: { backgroundColor: '#0F172A' },
  headerTintColor: '#F8FAFC',
};

const LoadingScreenStyle = {
  flex: 1,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: '#0F172A',
};

const PhotoSlotStyle = {
  width: 96,
  height: 96,
  borderRadius: 8,
  backgroundColor: '#0F172A',
  borderWidth: 1,
  borderColor: '#334155',
  borderStyle: 'dashed' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const PhotoSlotLabelStyle = {
  color: '#94A3B8',
  fontSize: 11,
  marginTop: 4,
};
