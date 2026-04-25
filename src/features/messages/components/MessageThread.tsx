import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useAreaMessages } from '../hooks/useAreaMessages';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';

/**
 * Inline thread. Shows the last 50 messages for an area (or project-level
 * if areaId is null). Composer pinned at the bottom of the box.
 *
 * Layout (Sprint 53A.2 — refined per pilot feedback 2026-04-25):
 *   - Mounted as the LAST item in AreaDetail (after action buttons + block
 *     reasons) so it doesn't push primary controls off-screen.
 *   - Messages container has fixed max-height (~360dp) with INTERNAL
 *     vertical ScrollView. Page-level scroll stops just above the chat;
 *     scrolling within the chat is independent.
 *   - `nestedScrollEnabled` lets Android route the touch correctly to
 *     whichever ScrollView the user is gesturing in.
 *   - Inner ScrollView is fine (no VirtualizedList warning) because
 *     ScrollView-in-ScrollView is allowed; only nested FlatList triggers
 *     the windowing warning. We cap at 50 messages so non-virtualized
 *     rendering is plenty.
 */
export function MessageThread({
  projectId,
  areaId,
}: {
  projectId: string | null;
  areaId: string | null;
}) {
  const { user, profile } = useAuthStore();
  const { messages, loading, error, send } = useAreaMessages({ projectId, areaId });
  const [photoModal, setPhotoModal] = useState<{ uri: string } | null>(null);

  if (!user || !profile || !projectId) {
    return null;
  }

  const onSend = async (input: { messageType: any; body: string; photos: string[] }) => {
    return send({
      organizationId: profile.organization_id,
      senderId: user.id,
      messageType: input.messageType,
      body: input.body,
      photos: input.photos,
    });
  };

  return (
    <View style={{ marginTop: 12 }}>
      {/* Section header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
          marginBottom: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chatbubbles" size={18} color="#94A3B8" />
          <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>
            Notes
          </Text>
          {messages.length > 0 && (
            <View
              style={{
                marginLeft: 8,
                backgroundColor: '#1E293B',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>
                {messages.length}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Body — list, loading, or empty state. Internal scroll capped at
          ~360dp so the chat box doesn't dominate the page even when the
          thread grows long. */}
      <View style={{ borderRadius: 16, backgroundColor: '#0B1220', overflow: 'hidden' }}>
        {loading && messages.length === 0 ? (
          <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <ActivityIndicator size="small" color="#F97316" />
          </View>
        ) : error && messages.length === 0 ? (
          <View style={{ minHeight: 120, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="alert-circle" size={28} color="#EF4444" />
            <Text style={{ color: '#94A3B8', marginTop: 6, fontSize: 13, textAlign: 'center' }}>
              {error}
            </Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={{ minHeight: 120, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color="#334155" />
            <Text style={{ color: '#64748B', marginTop: 8, fontSize: 13, textAlign: 'center' }}>
              No notes yet.{'\n'}Add the first one for your team.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ maxHeight: 360 }}
            contentContainerStyle={{ padding: 12 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {messages.map((item) => (
              <MessageBubble
                key={item.id}
                message={item}
                isOwn={item.sender_id === user.id}
                onPhotoPress={(uri) => setPhotoModal({ uri })}
              />
            ))}
          </ScrollView>
        )}

        <MessageComposer organizationId={profile.organization_id} onSend={onSend} />
      </View>

      {/* Full-screen photo viewer */}
      <Modal
        visible={!!photoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModal(null)}
      >
        <Pressable
          onPress={() => setPhotoModal(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.92)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {photoModal && (
            <Image
              source={{ uri: photoModal.uri }}
              style={{ width: '100%', height: '85%' }}
              resizeMode="contain"
            />
          )}
          <Pressable
            onPress={() => setPhotoModal(null)}
            hitSlop={12}
            style={{
              position: 'absolute',
              top: 60,
              right: 20,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
