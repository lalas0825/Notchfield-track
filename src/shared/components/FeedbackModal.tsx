/**
 * Feedback Modal — Sprint 45B
 * ================================
 * Users report bugs / request features / leave feedback from anywhere in the app.
 * Auto-captures: current route, device info, screen size, user role, project.
 *
 * Offline-first: text fields save via PowerSync. Screenshot uploads require
 * internet — if offline, the text report is saved without screenshots and
 * the user is notified.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
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
import { usePathname } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useTrackPermissions } from '@/shared/lib/permissions/TrackPermissionsContext';
import { haptic } from '@/shared/lib/haptics';
import {
  createFeedbackReport,
  uploadFeedbackScreenshot,
  type FeedbackSeverity,
  type FeedbackType,
} from '@/features/feedback/services/feedback-service';

const TYPE_OPTIONS: { value: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { value: 'bug',      label: 'Bug',      icon: 'bug',           color: '#EF4444' },
  { value: 'feature',  label: 'Feature',  icon: 'bulb',          color: '#F59E0B' },
  { value: 'feedback', label: 'Feedback', icon: 'chatbubble',    color: '#0EA5E9' },
];

const SEVERITY_OPTIONS: { value: FeedbackSeverity; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: '#9CA3AF' },
  { value: 'medium',   label: 'Medium',   color: '#F59E0B' },
  { value: 'high',     label: 'High',     color: '#F97316' },
  { value: 'critical', label: 'Critical', color: '#EF4444' },
];

const MAX_SCREENSHOTS = 3;

function getScreenName(pathname: string | null): string {
  if (!pathname) return 'Unknown';
  // Strip groups like (tabs) and clean up
  const cleaned = pathname.replace(/\([^)]+\)\//g, '').replace(/^\//, '');
  if (!cleaned) return 'Home';
  return cleaned
    .split('/')
    .map((seg) => seg.replace(/\[([^\]]+)\]/, (_, p) => `:${p}`))
    .join(' > ');
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function FeedbackModal({ visible, onClose }: Props) {
  const pathname = usePathname();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const activeProject = useProjectStore((s) => s.activeProject);
  const { role } = useTrackPermissions();

  const [type, setType] = useState<FeedbackType>('bug');
  const [severity, setSeverity] = useState<FeedbackSeverity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const context = useMemo(() => {
    const { width, height } = Dimensions.get('window');
    return {
      page_url: pathname ?? null,
      page_name: getScreenName(pathname),
      screen_size: `${Math.round(width)}×${Math.round(height)}`,
      device_info: `${Platform.OS} ${Platform.Version}`,
      reporter_role: role ?? profile?.role ?? null,
    };
  }, [pathname, role, profile]);

  const resetAndClose = useCallback(() => {
    setType('bug');
    setSeverity('medium');
    setTitle('');
    setDescription('');
    setLocalPhotos([]);
    setSubmitting(false);
    onClose();
  }, [onClose]);

  const takePhoto = useCallback(async () => {
    if (localPhotos.length >= MAX_SCREENSHOTS) {
      Alert.alert('Max 3 screenshots', 'Remove one first.');
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

  const pickFromGallery = useCallback(async () => {
    if (localPhotos.length >= MAX_SCREENSHOTS) {
      Alert.alert('Max 3 screenshots', 'Remove one first.');
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
      allowsMultipleSelection: false,
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
    const userId = profile?.id ?? user?.id;
    if (!profile || !userId) {
      Alert.alert('Not signed in', 'Please sign out and back in.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a brief title.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Please describe the issue.');
      return;
    }

    setSubmitting(true);
    try {
      // Create report first (works offline — PowerSync will sync later)
      const result = await createFeedbackReport({
        organization_id: profile.organization_id,
        project_id: activeProject?.id ?? null,
        reported_by: userId,
        reporter_name: profile.full_name,
        reporter_role: context.reporter_role,
        type,
        severity: type === 'bug' ? severity : null,
        title: title.trim(),
        description: description.trim(),
        page_url: context.page_url,
        page_name: context.page_name,
        device_info: context.device_info,
        screen_size: context.screen_size,
        screenshots: [], // placeholder — will be patched after upload (see below)
      });

      if (!result.success) {
        Alert.alert('Failed to submit', result.error ?? 'Unknown error');
        setSubmitting(false);
        return;
      }

      // Upload screenshots (online-only). If offline, report is saved without them.
      let uploadedPaths: string[] = [];
      let anyUploadFailed = false;
      if (localPhotos.length > 0) {
        for (let i = 0; i < localPhotos.length; i++) {
          const up = await uploadFeedbackScreenshot({
            localUri: localPhotos[i],
            organizationId: profile.organization_id,
            reportId: result.id,
            index: i,
          });
          if (up.success && up.path) {
            uploadedPaths.push(up.path);
          } else {
            anyUploadFailed = true;
          }
        }

        // Patch the report with the uploaded paths if any succeeded
        if (uploadedPaths.length > 0) {
          const { supabase } = await import('@/shared/lib/supabase/client');
          await supabase
            .from('feedback_reports')
            .update({ screenshots: uploadedPaths })
            .eq('id', result.id);
        }
      }

      haptic.success();
      const successMessage =
        anyUploadFailed
          ? 'Report submitted! Some screenshots failed to upload — they will be retried when you\'re back online.'
          : 'Report submitted! The admin will review it.';
      Alert.alert('Thanks for the feedback', successMessage, [
        { text: 'OK', onPress: resetAndClose },
      ]);
    } catch (err) {
      Alert.alert('Failed to submit', (err as Error).message ?? 'Unknown error');
      setSubmitting(false);
    }
  }, [
    profile, user, activeProject, type, severity, title, description,
    localPhotos, context, resetAndClose,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-bold text-white">Report an Issue</Text>
          <Pressable onPress={resetAndClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#94A3B8" />
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">

          {/* Type */}
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Type
          </Text>
          <View className="mb-4 flex-row gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { setType(opt.value); haptic.light(); }}
                  className={`flex-1 flex-row items-center justify-center rounded-xl border px-3 py-3 ${
                    active ? 'border-brand-orange' : 'border-border bg-card'
                  }`}
                  style={{
                    minHeight: 56,
                    backgroundColor: active ? `${opt.color}20` : undefined,
                  }}
                >
                  <Ionicons name={opt.icon} size={18} color={active ? opt.color : '#64748B'} />
                  <Text
                    className={`ml-2 text-sm font-bold ${active ? 'text-white' : 'text-slate-400'}`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Severity (bugs only) */}
          {type === 'bug' && (
            <>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Severity
              </Text>
              <View className="mb-4 flex-row gap-2">
                {SEVERITY_OPTIONS.map((opt) => {
                  const active = severity === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => { setSeverity(opt.value); haptic.light(); }}
                      className={`flex-1 rounded-full border px-2 py-2 ${
                        active ? '' : 'border-border bg-card'
                      }`}
                      style={{
                        minHeight: 40,
                        borderColor: active ? opt.color : '#334155',
                        backgroundColor: active ? `${opt.color}20` : undefined,
                      }}
                    >
                      <Text
                        className="text-center text-xs font-bold"
                        style={{ color: active ? opt.color : '#94A3B8' }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Title */}
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Title *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Brief description"
            placeholderTextColor="#64748B"
            className="mb-4 rounded-xl border border-border bg-card px-4 text-base text-white"
            style={{ minHeight: 52 }}
          />

          {/* Description */}
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Description *
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={
              type === 'bug'
                ? 'What happened? What did you expect?'
                : type === 'feature'
                ? 'Describe the feature you\'d like to see.'
                : 'Share your thoughts.'
            }
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-base text-white"
            style={{ minHeight: 120 }}
          />

          {/* Screenshots */}
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Screenshots ({localPhotos.length}/{MAX_SCREENSHOTS})
          </Text>
          <View className="mb-2 flex-row gap-2">
            <Pressable
              onPress={takePhoto}
              disabled={localPhotos.length >= MAX_SCREENSHOTS}
              className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card py-3 active:opacity-80"
              style={{ minHeight: 52, opacity: localPhotos.length >= MAX_SCREENSHOTS ? 0.4 : 1 }}
            >
              <Ionicons name="camera" size={18} color="#F8FAFC" />
              <Text className="ml-2 text-sm font-bold text-white">Take Photo</Text>
            </Pressable>
            <Pressable
              onPress={pickFromGallery}
              disabled={localPhotos.length >= MAX_SCREENSHOTS}
              className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card py-3 active:opacity-80"
              style={{ minHeight: 52, opacity: localPhotos.length >= MAX_SCREENSHOTS ? 0.4 : 1 }}
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
                    style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#334155' }}
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

          {/* Auto-captured context */}
          <View className="mb-4 rounded-xl border border-border bg-card/50 p-3">
            <Text className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Auto-captured context
            </Text>
            <ContextRow label="Page"    value={context.page_name} />
            <ContextRow label="Device"  value={context.device_info} />
            <ContextRow label="Screen"  value={context.screen_size} />
            <ContextRow label="Role"    value={context.reporter_role ?? '—'} />
            {activeProject && <ContextRow label="Project" value={activeProject.name} />}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="mb-6 flex-row items-center justify-center rounded-2xl bg-success py-4 active:opacity-80"
            style={{ minHeight: 56, opacity: submitting ? 0.5 : 1 }}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
            <Text className="ml-2 text-lg font-bold text-white">
              {submitting ? 'Submitting…' : 'Submit Report'}
            </Text>
          </Pressable>

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row py-0.5">
      <Text className="w-16 text-xs text-slate-500">{label}:</Text>
      <Text className="flex-1 text-xs text-slate-400" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
