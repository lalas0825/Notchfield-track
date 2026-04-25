/**
 * AddPunchSheet — Sprint 53B
 * ============================
 * Bottom-sheet modal triggered from the Plans tab FAB to create a punch
 * item anchored to specific coordinates on a drawing.
 *
 * Required: title, area (NOT NULL on punch_items), priority, ≥1 photo.
 * Optional: description, assignee.
 *
 * Photos uploaded to Supabase Storage `field-photos/punch/{org}/{punchId}/...`
 * via uploadPunchPhoto helper. URLs go into punch_items.photos[]. If offline,
 * user is prompted to send text-only or cancel.
 */

import { useCallback, useEffect, useState } from 'react';
import {
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
import { logger } from '@/shared/lib/logger';
import { localQuery, generateUUID } from '@/shared/lib/powersync/write';
import {
  createPunchItem,
  uploadPunchPhoto,
  type PunchPriority,
} from '../services/punch-service';
import { useAssignableProfiles } from '../hooks/useAssignableProfiles';

const PRIORITIES: { value: PunchPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#22C55E' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#F97316' },
  { value: 'critical', label: 'Critical', color: '#EF4444' },
];

const MAX_PHOTOS = 3;

type AreaOption = {
  id: string;
  name: string;
  floor: string | null;
  area_code: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  organizationId: string;
  projectId: string;
  createdBy: string;
  /**
   * Plan-anchored creation context. Optional since Sprint 53A.1: the
   * Punch list screen FAB also opens this sheet WITHOUT a drawing/coords
   * (free-form punch creation). The service treats null plan coords as
   * "not pinned to a plan".
   */
  drawingId?: string | null;
  planX?: number | null;
  planY?: number | null;
};

export function AddPunchSheet({
  visible,
  onClose,
  onCreated,
  organizationId,
  projectId,
  drawingId = null,
  createdBy,
  planX = null,
  planY = null,
}: Props) {
  const { profiles: assignees } = useAssignableProfiles(organizationId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PunchPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load areas for the project (foreman picks which area the defect belongs to)
  useEffect(() => {
    if (!visible || !projectId) return;
    let cancelled = false;
    (async () => {
      const rows = await localQuery<AreaOption>(
        `SELECT id, name, floor, area_code FROM production_areas
           WHERE project_id = ?
           ORDER BY floor, area_code, name
           LIMIT 200`,
        [projectId],
      );
      if (cancelled) return;
      setAreas(rows ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, projectId]);

  const reset = useCallback(() => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setAssignedTo(null);
    setAreaId(null);
    setPhotos([]);
    setSubmitting(false);
  }, []);

  const close = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  const pickPhoto = useCallback(
    async (source: 'camera' | 'library') => {
      if (photos.length >= MAX_PHOTOS) {
        Alert.alert('Maximum reached', `Up to ${MAX_PHOTOS} photos.`);
        return;
      }
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', `${source === 'camera' ? 'Camera' : 'Gallery'} access needed.`);
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

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Briefly describe the defect.');
      return;
    }
    if (!areaId) {
      Alert.alert('Area required', 'Select the area this defect belongs to.');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Photo required', 'Take at least one photo of the defect.');
      return;
    }

    setSubmitting(true);
    try {
      // Upload photos FIRST so the punch_items.photos[] is populated with
      // public URLs (cross-device safe).
      const punchItemId = generateUUID();
      let uploadedUrls: string[] = [];
      try {
        uploadedUrls = await Promise.all(
          photos.map((uri, i) =>
            uploadPunchPhoto({
              localUri: uri,
              organizationId,
              punchItemId,
              index: i,
              kind: 'photos',
            }),
          ),
        );
      } catch (e) {
        logger.warn('[Punch] photo upload failed', e);
        Alert.alert(
          'Could not upload photos',
          'Punch items require photo evidence. Connect to internet and try again.',
        );
        setSubmitting(false);
        return;
      }

      const result = await createPunchItem({
        organizationId,
        projectId,
        areaId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        photos: uploadedUrls,
        assignedTo: assignedTo ?? undefined,
        createdBy,
        // Sprint 53A.1 — coords/drawing are optional now (free-form
        // create from Punch list FAB). Coerce null → undefined for the
        // service signature.
        planX: planX ?? undefined,
        planY: planY ?? undefined,
        drawingId: drawingId ?? undefined,
      });

      if (!result.success) {
        Alert.alert('Could not create', result.error ?? 'Unknown error');
        setSubmitting(false);
        return;
      }

      reset();
      onCreated();
      onClose();
    } catch (e) {
      logger.error('[Punch] create failed', e);
      Alert.alert('Failed', e instanceof Error ? e.message : 'Unknown error');
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={close}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }}
        />

        <View
          style={{
            backgroundColor: '#0F172A',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '92%',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#1E293B',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flag" size={18} color="#A855F7" />
              <Text style={{ marginLeft: 8, fontSize: 17, fontWeight: '700', color: '#F8FAFC' }}>
                New Punch Item
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={12}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          >
            {/* Photo (required) */}
            <Text style={{ marginBottom: 6, fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
              Defect Photo <Text style={{ textTransform: 'none', color: '#EF4444' }}>(required)</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {photos.map((uri, i) => (
                <View key={`${uri}-${i}`} style={{ position: 'relative' }}>
                  <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: '#1E293B' }} />
                  <Pressable
                    onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    hitSlop={6}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#EF4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => pickPhoto('camera')}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: '#A855F7',
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="camera" size={26} color="#A855F7" />
                  </Pressable>
                  <Pressable
                    onPress={() => pickPhoto('library')}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: '#475569',
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="image" size={26} color="#94A3B8" />
                  </Pressable>
                </View>
              )}
            </View>

            {/* Title */}
            <Text style={{ marginBottom: 4, fontSize: 13, fontWeight: '600', color: '#94A3B8' }}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Grout missing NE corner"
              placeholderTextColor="#475569"
              style={{
                marginBottom: 14,
                height: 48,
                borderRadius: 12,
                backgroundColor: '#1E293B',
                paddingHorizontal: 14,
                color: '#F8FAFC',
                fontSize: 15,
              }}
            />

            {/* Description */}
            <Text style={{ marginBottom: 4, fontSize: 13, fontWeight: '600', color: '#94A3B8' }}>
              Details (optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="More context..."
              placeholderTextColor="#475569"
              multiline
              style={{
                marginBottom: 14,
                minHeight: 80,
                borderRadius: 12,
                backgroundColor: '#1E293B',
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 12,
                color: '#F8FAFC',
                fontSize: 15,
              }}
            />

            {/* Priority */}
            <Text style={{ marginBottom: 6, fontSize: 13, fontWeight: '600', color: '#94A3B8' }}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
              {PRIORITIES.map((p) => {
                const selected = priority === p.value;
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => setPriority(p.value)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? p.color : '#334155',
                      backgroundColor: selected ? `${p.color}1F` : 'transparent',
                    }}
                  >
                    <Text style={{ color: selected ? p.color : '#94A3B8', fontWeight: '700', fontSize: 13 }}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Area picker */}
            <Text style={{ marginBottom: 6, fontSize: 13, fontWeight: '600', color: '#94A3B8' }}>
              Area <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
              style={{ marginBottom: 14 }}
            >
              {areas.length === 0 ? (
                <Text style={{ color: '#64748B', fontSize: 13 }}>No areas in this project.</Text>
              ) : (
                areas.map((a) => {
                  const selected = areaId === a.id;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setAreaId(a.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selected ? '#A855F7' : '#334155',
                        backgroundColor: selected ? '#A855F71F' : '#1E293B',
                      }}
                    >
                      {a.area_code && (
                        <Text style={{ fontSize: 10, color: selected ? '#A855F7' : '#94A3B8', fontFamily: 'monospace' }}>
                          {a.area_code}
                        </Text>
                      )}
                      <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600' }}>{a.name}</Text>
                      {a.floor && (
                        <Text style={{ fontSize: 10, color: '#64748B' }}>{a.floor}</Text>
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {/* Assignee */}
            <Text style={{ marginBottom: 6, fontSize: 13, fontWeight: '600', color: '#94A3B8' }}>
              Assign To (optional)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
              style={{ marginBottom: 16 }}
            >
              {assignees.length === 0 ? (
                <Text style={{ color: '#64748B', fontSize: 13 }}>No assignable users yet.</Text>
              ) : (
                assignees.map((p) => {
                  const selected = assignedTo === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setAssignedTo(selected ? null : p.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selected ? '#A855F7' : '#334155',
                        backgroundColor: selected ? '#A855F71F' : '#1E293B',
                      }}
                    >
                      <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600' }}>
                        {p.full_name ?? 'Unnamed'}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#64748B', textTransform: 'capitalize' }}>
                        {p.role ?? ''}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {/* Save */}
            <Pressable
              onPress={handleSave}
              disabled={submitting}
              style={{
                height: 52,
                borderRadius: 14,
                backgroundColor: submitting ? '#475569' : '#A855F7',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
                {submitting ? 'Creating...' : 'Create Punch Item'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
