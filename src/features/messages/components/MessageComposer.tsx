import { useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { supabase } from '@/shared/lib/supabase/client';
import { logger } from '@/shared/lib/logger';
import type { MessageType } from '../types';
import { MESSAGE_TYPES, MESSAGE_TYPE_CONFIG } from '../types';
import { MessageTypeBadge } from './MessageTypeBadge';

const MAX_PHOTOS = 3;
const MAX_BODY = 2000;

/**
 * Inline composer mounted at the bottom of MessageThread.
 * - Type chips (4 types) — defaults to 'info'
 * - Multi-line text input
 * - Camera + gallery for up to 3 photos
 * - Photo previews with remove buttons
 * - Send button enabled when body has content (photos optional)
 *
 * Photos uploaded directly to Supabase Storage `field-photos` bucket under
 * `messages/{org_id}/{date}/{uuid}.jpg`. URLs stored in field_messages.photos[].
 * If offline, user is prompted to send text-only or cancel.
 */
export function MessageComposer({
  organizationId,
  onSend,
  disabled,
}: {
  organizationId: string;
  onSend: (input: { messageType: MessageType; body: string; photos: string[] }) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
}) {
  const [type, setType] = useState<MessageType>('info');
  const [body, setBody] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && !sending && !disabled;

  const pickPhoto = async (source: 'camera' | 'library') => {
    if (photoUris.length >= MAX_PHOTOS) {
      Alert.alert('Maximum reached', `Up to ${MAX_PHOTOS} photos per message.`);
      return;
    }

    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission required', `${source === 'camera' ? 'Camera' : 'Gallery'} access is needed.`);
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false });

    if (result.canceled || !result.assets[0]) return;
    setPhotoUris((prev) => [...prev, result.assets[0].uri]);
  };

  const removePhoto = (idx: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== idx));
  };

  /**
   * Upload local URIs to Supabase Storage. Returns array of public URLs.
   * Throws on any failure (caller decides whether to fall back to text-only).
   */
  const uploadPhotos = async (uris: string[]): Promise<string[]> => {
    const date = new Date().toISOString().slice(0, 10);
    const urls: string[] = [];

    for (const uri of uris) {
      const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase();
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `messages/${organizationId}/${date}/${filename}`;

      // Read local file → bytes
      const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
        encoding: LegacyFileSystem.EncodingType.Base64,
      });
      const byteCharacters = atob(base64);
      const bytes = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        bytes[i] = byteCharacters.charCodeAt(i);
      }

      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const { error } = await supabase.storage
        .from('field-photos')
        .upload(path, bytes, { contentType, upsert: false });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from('field-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return urls;
  };

  const handleSend = async () => {
    if (!canSend) return;
    Keyboard.dismiss();
    setSending(true);

    try {
      let uploadedUrls: string[] = [];
      if (photoUris.length > 0) {
        try {
          uploadedUrls = await uploadPhotos(photoUris);
        } catch (e) {
          logger.warn('[Messages] photo upload failed', e);
          // Offer to send text-only. v1 limitation documented in Sprint 53A
          // expansion roadmap: offline photo queue (auto-attach when online)
          // is post-pilot — for now the user must re-attach manually.
          await new Promise<void>((resolve, reject) => {
            Alert.alert(
              'Photos need internet',
              'You\'re offline. Send the text now and add the photos later in a new message when you\'re back online?',
              [
                { text: 'Wait for connection', style: 'cancel', onPress: () => reject(new Error('User cancelled')) },
                { text: 'Send text only', onPress: () => resolve() },
              ],
            );
          });
        }
      }

      const result = await onSend({
        messageType: type,
        body: trimmed,
        photos: uploadedUrls,
      });

      if (result.success) {
        setBody('');
        setType('info');
        setPhotoUris([]);
      } else if (result.error) {
        Alert.alert('Could not send', result.error);
      }
    } catch (e) {
      // User cancelled photo fallback — silently abort
      logger.info('[Messages] send aborted', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: '#1E293B',
          backgroundColor: '#0F172A',
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        {/* Type chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
          keyboardShouldPersistTaps="handled"
        >
          {MESSAGE_TYPES.map((t) => {
            const cfg = MESSAGE_TYPE_CONFIG[t];
            const selected = t === type;
            return (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`Message type: ${cfg.label}`}
                accessibilityState={{ selected }}
              >
                <MessageTypeBadge type={t} size="md" selected={selected} />
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Photo previews */}
        {photoUris.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
          >
            {photoUris.map((uri, i) => (
              <View key={`${uri}-${i}`} style={{ position: 'relative' }}>
                <Image
                  source={{ uri }}
                  style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#1E293B' }}
                />
                <Pressable
                  onPress={() => removePhoto(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
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
          </ScrollView>
        )}

        {/* Input row: camera + gallery + textbox + send */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 }}>
          <View style={{ flexDirection: 'row', marginRight: 6 }}>
            <Pressable
              onPress={() => pickPhoto('camera')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 4,
              }}
            >
              <Ionicons name="camera" size={22} color="#94A3B8" />
            </Pressable>
            <Pressable
              onPress={() => pickPhoto('library')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Pick from gallery"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="image" size={22} color="#94A3B8" />
            </Pressable>
          </View>

          <TextInput
            value={body}
            onChangeText={(t) => setBody(t.slice(0, MAX_BODY))}
            placeholder={placeholderForType(type)}
            placeholderTextColor="#475569"
            multiline
            style={{
              flex: 1,
              backgroundColor: '#1E293B',
              color: '#F8FAFC',
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 10,
              fontSize: 15,
              minHeight: 40,
              maxHeight: 120,
            }}
            editable={!sending && !disabled}
          />

          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: canSend ? '#F97316' : '#334155',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 6,
            }}
          >
            <Ionicons name={sending ? 'hourglass' : 'send'} size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function placeholderForType(t: MessageType): string {
  switch (t) {
    case 'blocker':
      return 'What\'s blocking the work?';
    case 'safety':
      return 'Safety concern or PPE note...';
    case 'question':
      return 'Ask the team or supervisor...';
    default:
      return 'Add a note for the team...';
  }
}
