/**
 * WorkTicketPhotos — evidence photo gallery for a work ticket.
 *
 * Read-only when ticket.status !== 'draft' (photos are locked once
 * the ticket has been sent for signature).
 *
 * Offline: photos taken without connectivity show an uploading overlay
 * and auto-retry via `processPendingUploads` on mount + reconnect.
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { haptic } from '@/shared/lib/haptics';
import type { WorkTicketPhoto, WorkTicketStatus } from '../types';
import {
  parsePhotos,
  pickTicketPhotos,
  processPendingUploads,
  removeTicketPhoto,
  takeTicketPhoto,
  updatePhotoCaption,
} from '../services/workTicketPhotoService';

interface Props {
  ticketId: string;
  organizationId: string;
  status: WorkTicketStatus;
  userId: string;
  userName: string;
  photos: WorkTicketPhoto[] | string | null | undefined;
  onChange: () => void; // parent refetch callback
}

const THUMB = 96;

export function WorkTicketPhotos({
  ticketId,
  organizationId,
  status,
  userId,
  userName,
  photos: rawPhotos,
  onChange,
}: Props) {
  const photos = parsePhotos(rawPhotos);
  const isDraft = status === 'draft';
  const hasPending = photos.some((p) => p.pending_upload);

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<WorkTicketPhoto | null>(null);
  const [captionEdit, setCaptionEdit] = useState<WorkTicketPhoto | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');

  const handleRetryUploads = useCallback(async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const n = await processPendingUploads(ticketId, organizationId, true);
      if (n > 0) onChange();
      else Alert.alert('Upload failed', 'No photos could be uploaded. Check Metro logs for details.');
    } catch (err) {
      Alert.alert('Upload failed', (err as Error).message ?? 'Unknown error');
    } finally {
      setUploading(false);
    }
  }, [ticketId, organizationId, uploading, onChange]);

  const handleTake = useCallback(async () => {
    if (!isDraft || busy) return;
    try {
      setBusy(true);
      const photo = await takeTicketPhoto(ticketId, organizationId, userId, userName);
      if (photo) {
        haptic.success();
        onChange();
      }
    } catch (err) {
      Alert.alert('Photo Error', (err as Error).message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [isDraft, busy, ticketId, organizationId, userId, userName, onChange]);

  const handlePick = useCallback(async () => {
    if (!isDraft || busy) return;
    try {
      setBusy(true);
      const picked = await pickTicketPhotos(ticketId, organizationId, userId, userName);
      if (picked.length > 0) {
        haptic.success();
        onChange();
      }
    } catch (err) {
      Alert.alert('Photo Error', (err as Error).message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [isDraft, busy, ticketId, organizationId, userId, userName, onChange]);

  const handleDelete = useCallback(
    (photo: WorkTicketPhoto) => {
      if (!isDraft) return;
      Alert.alert('Delete photo?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTicketPhoto(ticketId, photo.id, organizationId);
              haptic.success();
              onChange();
            } catch (err) {
              Alert.alert('Failed', (err as Error).message ?? 'Unknown error');
            }
          },
        },
      ]);
    },
    [isDraft, ticketId, organizationId, onChange],
  );

  const openCaptionEdit = (photo: WorkTicketPhoto) => {
    setCaptionDraft(photo.caption ?? '');
    setCaptionEdit(photo);
  };

  const saveCaption = async () => {
    if (!captionEdit) return;
    try {
      await updatePhotoCaption(ticketId, captionEdit.id, captionDraft.trim());
      setCaptionEdit(null);
      onChange();
    } catch (err) {
      Alert.alert('Failed', (err as Error).message ?? 'Unknown error');
    }
  };

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Evidence Photos ({photos.length})
        </Text>
        {!isDraft && (
          <View className="flex-row items-center">
            <Ionicons name="lock-closed-outline" size={12} color="#64748B" />
            <Text className="ml-1 text-[10px] text-slate-500">Photos locked</Text>
          </View>
        )}
      </View>

      {photos.length === 0 ? (
        <View className="rounded-xl border border-dashed border-border bg-card px-4 py-6">
          <Text className="text-center text-xs text-slate-500">
            {isDraft
              ? 'No photos yet. Take or select photos as evidence.'
              : 'No evidence photos attached.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              onPress={() => setViewer(photo)}
              className="items-center"
              style={{ width: THUMB + 8 }}
            >
              <View style={{ width: THUMB, height: THUMB }} className="overflow-hidden rounded-lg border border-border bg-card">
                {photo.url || photo.local_uri ? (
                  <Image
                    source={{ uri: photo.url || photo.local_uri }}
                    style={{ width: THUMB, height: THUMB }}
                    resizeMode="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="image-outline" size={24} color="#475569" />
                  </View>
                )}
                {photo.pending_upload && !uploading && (
                  <View className="absolute bottom-1 right-1 h-5 w-5 items-center justify-center rounded-full bg-amber-500">
                    <Ionicons name="cloud-upload-outline" size={12} color="#FFF" />
                  </View>
                )}
                {photo.pending_upload && uploading && (
                  <View className="absolute inset-0 items-center justify-center bg-black/50">
                    <ActivityIndicator size="small" color="#F8FAFC" />
                  </View>
                )}
              </View>
              {photo.caption ? (
                <Text
                  className="mt-1 w-full text-center text-[10px] text-slate-400"
                  numberOfLines={2}
                >
                  {photo.caption}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}

      {isDraft && hasPending && (
        <Pressable
          onPress={handleRetryUploads}
          disabled={uploading}
          className="mt-2 flex-row items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 active:opacity-80"
          style={{ opacity: uploading ? 0.5 : 1 }}
        >
          <Ionicons name={uploading ? 'sync' : 'cloud-upload-outline'} size={16} color="#F59E0B" />
          <Text className="ml-2 text-xs font-bold text-amber-500">
            {uploading ? 'Uploading…' : `Retry Upload (${photos.filter((p) => p.pending_upload).length} pending)`}
          </Text>
        </Pressable>
      )}

      {isDraft && (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={handleTake}
            disabled={busy}
            className="flex-1 flex-row items-center justify-center rounded-xl bg-blue-600 py-3 active:opacity-80"
            style={{ minHeight: 48, opacity: busy ? 0.5 : 1 }}
          >
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text className="ml-2 text-sm font-bold text-white">Take Photo</Text>
          </Pressable>
          <Pressable
            onPress={handlePick}
            disabled={busy}
            className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card py-3 active:opacity-80"
            style={{ minHeight: 48, opacity: busy ? 0.5 : 1 }}
          >
            <Ionicons name="images-outline" size={18} color="#F8FAFC" />
            <Text className="ml-2 text-sm font-bold text-white">From Gallery</Text>
          </Pressable>
        </View>
      )}

      {/* Photo viewer / actions modal */}
      <Modal
        visible={!!viewer}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <View className="flex-1 bg-black/90">
          <Pressable
            onPress={() => setViewer(null)}
            className="absolute right-4 top-12 z-10 h-10 w-10 items-center justify-center rounded-full bg-black/60"
            hitSlop={12}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>

          {viewer && (viewer.url || viewer.local_uri) ? (
            <Image
              source={{ uri: viewer.url || viewer.local_uri }}
              style={{ flex: 1, width: '100%' }}
              resizeMode="contain"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-sm text-white">Photo unavailable</Text>
            </View>
          )}

          <View className="bg-black/80 px-4 pb-10 pt-3">
            {viewer?.caption ? (
              <Text className="mb-3 text-sm text-white" numberOfLines={3}>
                {viewer.caption}
              </Text>
            ) : null}
            <Text className="mb-2 text-[10px] text-slate-400">
              {viewer?.taken_by_name} · {viewer ? new Date(viewer.taken_at).toLocaleString() : ''}
            </Text>
            {isDraft && viewer && (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => {
                    const p = viewer;
                    setViewer(null);
                    openCaptionEdit(p);
                  }}
                  className="flex-1 flex-row items-center justify-center rounded-xl bg-card/80 py-3 active:opacity-80"
                  style={{ minHeight: 44 }}
                >
                  <Ionicons name="create-outline" size={16} color="#F8FAFC" />
                  <Text className="ml-2 text-sm font-bold text-white">Edit Caption</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const p = viewer;
                    setViewer(null);
                    handleDelete(p);
                  }}
                  className="flex-1 flex-row items-center justify-center rounded-xl bg-red-600 py-3 active:opacity-80"
                  style={{ minHeight: 44 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                  <Text className="ml-2 text-sm font-bold text-white">Delete</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit caption modal */}
      <Modal
        visible={!!captionEdit}
        transparent
        animationType="slide"
        onRequestClose={() => setCaptionEdit(null)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl bg-background p-5">
            <Text className="mb-3 text-base font-bold text-white">Edit Caption</Text>
            <TextInput
              value={captionDraft}
              onChangeText={setCaptionDraft}
              placeholder="Describe this photo…"
              placeholderTextColor="#64748B"
              multiline
              autoFocus
              className="rounded-xl border border-border bg-card px-4 py-3 text-base text-white"
              style={{ minHeight: 80 }}
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => setCaptionEdit(null)}
                className="flex-1 items-center rounded-xl border border-border bg-card py-3 active:opacity-80"
                style={{ minHeight: 48 }}
              >
                <Text className="text-sm font-bold text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveCaption}
                className="flex-1 items-center rounded-xl bg-success py-3 active:opacity-80"
                style={{ minHeight: 48 }}
              >
                <Text className="text-sm font-bold text-white">Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
