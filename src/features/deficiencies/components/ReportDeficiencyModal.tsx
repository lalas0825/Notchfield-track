/**
 * Sprint 71 — Report Deficiency modal.
 *
 * Multi-section bottom sheet, NOT a wizard — all fields visible at once
 * so the foreman can scan + edit + submit in one motion. Sections:
 *
 *   1. Template (pick from library — optional, opens DeficiencyLibraryPicker)
 *   2. Title (required, pre-filled from template)
 *   3. Description (optional)
 *   4. Severity chips (pre-filled from template, override allowed)
 *   5. Responsibility chips (default 'unknown' per spec §8 auto-blindaje)
 *   6. Photos (recommended, not strictly required by Track but encouraged)
 *
 * Submit flow:
 *   - Generate temp deficiency id (storage path uses it; no row created yet)
 *   - Upload all staged photos in parallel → public URLs
 *   - POST to /api/deficiencies/create with URLs
 *   - On success: close modal, parent refetches the area's deficiency list
 *   - On failure: keep modal open, show inline error so foreman can retry
 *     without losing typed content
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { createDeficiencyViaWeb } from '../services/deficiencyApiClient';
import {
  uploadDeficiencyPhotos,
  tempDeficiencyId,
} from '../services/deficiencyPhotos';
import { DeficiencyLibraryPicker } from './DeficiencyLibraryPicker';
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  RESPONSIBILITY_LABEL,
} from '../types';
import type {
  DeficiencyLibrary,
  DeficiencySeverity,
  DeficiencyResponsibility,
} from '../types';

type Props = {
  visible: boolean;
  projectId: string;
  areaId: string;
  organizationId: string;
  onClose: () => void;
  /** Called after a successful create. Use to reload() the list. */
  onCreated: () => void;
};

const SEVERITY_OPTIONS: DeficiencySeverity[] = [
  'cosmetic',
  'minor',
  'major',
  'critical',
];

const RESPONSIBILITY_OPTIONS: DeficiencyResponsibility[] = [
  'own',
  'other_trade',
  'gc',
  'unknown',
];

const MAX_PHOTOS = 4;

export function ReportDeficiencyModal({
  visible,
  projectId,
  areaId,
  organizationId,
  onClose,
  onCreated,
}: Props) {
  const profile = useAuthStore((s) => s.profile);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [template, setTemplate] = useState<DeficiencyLibrary | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<DeficiencySeverity>('minor');
  const [responsibility, setResponsibility] =
    useState<DeficiencyResponsibility>('unknown');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setPickerOpen(false);
    setTemplate(null);
    setTitle('');
    setDescription('');
    setSeverity('minor');
    setResponsibility('unknown');
    setPhotos([]);
    setSubmitting(false);
  }, []);

  const handlePickTemplate = useCallback((t: DeficiencyLibrary) => {
    setTemplate(t);
    // Only override title if foreman hasn't already typed one
    setTitle((prev) => (prev.trim().length === 0 ? t.default_title : prev));
    setSeverity(t.default_severity);
  }, []);

  const handleAddPhoto = useCallback(
    async (source: 'camera' | 'gallery') => {
      if (photos.length >= MAX_PHOTOS) {
        Alert.alert('Limit reached', `Up to ${MAX_PHOTOS} photos per report.`);
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
      setPhotos((p) => [...p, result.assets[0].uri]);
    },
    [photos.length],
  );

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((p) => p.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Add a short title for the deficiency.');
      return;
    }
    if (!profile) return;

    setSubmitting(true);
    try {
      // Upload photos using a temp id — the bucket folder name only lives
      // in storage paths, never appears as a row id. The server stores
      // whatever URLs we send in the photos[] column.
      const tempId = tempDeficiencyId();
      let uploadedUrls: string[] = [];
      if (photos.length > 0) {
        uploadedUrls = await uploadDeficiencyPhotos(
          photos,
          organizationId,
          tempId,
        );
      }

      await createDeficiencyViaWeb({
        projectId,
        areaId,
        title: trimmed,
        description: description.trim() || undefined,
        severity,
        responsibility,
        trade: template?.trade,
        category: template?.category,
        libraryId: template?.id,
        photos: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      });

      reset();
      onCreated();
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not create deficiency';
      Alert.alert('Failed to report deficiency', msg);
      setSubmitting(false);
    }
  }, [
    title,
    description,
    severity,
    responsibility,
    photos,
    projectId,
    areaId,
    organizationId,
    template,
    profile,
    reset,
    onCreated,
    onClose,
  ]);

  const closeIfNotBusy = () => {
    if (!submitting) onClose();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={closeIfNotBusy}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            onPress={closeIfNotBusy}
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.6)',
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: '#1E293B',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderColor: '#334155',
                maxHeight: '92%',
              }}
            >
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#475569',
                  }}
                />
              </View>

              <ScrollView
                style={{ paddingHorizontal: 20 }}
                contentContainerStyle={{ paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text
                  style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '700' }}
                >
                  Report Deficiency
                </Text>
                <Text
                  style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}
                >
                  Document the issue with photos and severity. Goes to PM
                  for review.
                </Text>

                {/* Template picker */}
                <Text style={LabelStyle}>Template</Text>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  disabled={submitting}
                  style={{
                    backgroundColor: '#0F172A',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 14,
                    borderWidth: 1,
                    borderColor: '#334155',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Ionicons name="library" size={18} color="#94A3B8" />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: template ? '#F8FAFC' : '#64748B',
                      fontSize: 15,
                    }}
                  >
                    {template
                      ? template.default_title
                      : 'Pick from library (optional)'}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#475569"
                  />
                </Pressable>

                {/* Title */}
                <Text style={LabelStyle}>Title *</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Grout missing in NE corner"
                  placeholderTextColor="#64748B"
                  style={InputStyle}
                  editable={!submitting}
                />

                {/* Description */}
                <Text style={LabelStyle}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional — extra context for the PM"
                  placeholderTextColor="#64748B"
                  multiline
                  style={[
                    InputStyle,
                    {
                      height: 80,
                      textAlignVertical: 'top',
                      paddingTop: 12,
                    },
                  ]}
                  editable={!submitting}
                />

                {/* Severity */}
                <Text style={LabelStyle}>Severity</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {SEVERITY_OPTIONS.map((s) => {
                    const active = s === severity;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setSeverity(s)}
                        disabled={submitting}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 8,
                          alignItems: 'center',
                          backgroundColor: active ? SEVERITY_COLOR[s] : '#0F172A',
                          borderWidth: 1,
                          borderColor: active
                            ? SEVERITY_COLOR[s]
                            : '#334155',
                        }}
                      >
                        <Text
                          style={{
                            color: active ? '#FFFFFF' : '#94A3B8',
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          {SEVERITY_LABEL[s]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Responsibility */}
                <Text style={LabelStyle}>Responsibility</Text>
                <View
                  style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                >
                  {RESPONSIBILITY_OPTIONS.map((r) => {
                    const active = r === responsibility;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setResponsibility(r)}
                        disabled={submitting}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          backgroundColor: active ? '#F97316' : '#0F172A',
                          borderWidth: 1,
                          borderColor: active ? '#F97316' : '#334155',
                        }}
                      >
                        <Text
                          style={{
                            color: active ? '#FFFFFF' : '#94A3B8',
                            fontSize: 13,
                            fontWeight: '600',
                          }}
                        >
                          {RESPONSIBILITY_LABEL[r]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Photos */}
                <Text style={LabelStyle}>
                  Photos {photos.length > 0 ? `(${photos.length}/${MAX_PHOTOS})` : ''}
                </Text>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  {photos.map((uri, i) => (
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
                        onPress={() => handleRemovePhoto(i)}
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
                  {photos.length < MAX_PHOTOS && !submitting ? (
                    <>
                      <Pressable
                        onPress={() => handleAddPhoto('camera')}
                        style={PhotoSlotStyle}
                      >
                        <Ionicons name="camera" size={20} color="#94A3B8" />
                        <Text
                          style={{
                            color: '#94A3B8',
                            fontSize: 11,
                            marginTop: 4,
                          }}
                        >
                          Camera
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleAddPhoto('gallery')}
                        style={PhotoSlotStyle}
                      >
                        <Ionicons name="image" size={20} color="#94A3B8" />
                        <Text
                          style={{
                            color: '#94A3B8',
                            fontSize: 11,
                            marginTop: 4,
                          }}
                        >
                          Gallery
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>

                {/* Submit */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting || !title.trim()}
                  style={{
                    marginTop: 24,
                    height: 52,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      submitting || !title.trim() ? '#334155' : '#F97316',
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
                      fontSize: 16,
                      fontWeight: '700',
                    }}
                  >
                    {submitting ? 'Reporting…' : 'Report Deficiency'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={closeIfNotBusy}
                  style={{
                    marginTop: 8,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#94A3B8', fontSize: 14 }}>
                    Cancel
                  </Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <DeficiencyLibraryPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickTemplate}
        onSkip={() => {
          setTemplate(null);
        }}
      />
    </>
  );
}

const LabelStyle = {
  color: '#94A3B8',
  fontSize: 12,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
  marginTop: 18,
  marginBottom: 6,
};

const InputStyle = {
  backgroundColor: '#0F172A',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
  color: '#F8FAFC',
  fontSize: 15,
  borderWidth: 1,
  borderColor: '#334155',
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
