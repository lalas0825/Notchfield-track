import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useAreaMessages } from '../hooks/useAreaMessages';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';

/**
 * Inline thread mounted in AreaDetail. Shows the last 50 messages for an
 * area (or project-level if areaId is null). Composer at the bottom.
 *
 * Auto-scrolls to bottom on first load and on new messages from self.
 * Realtime updates from other users append silently.
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
  const listRef = useRef<FlatList>(null);
  const [photoModal, setPhotoModal] = useState<{ uri: string } | null>(null);
  const lastCountRef = useRef(0);

  // Auto-scroll on new messages (only when count grows — not on hydration)
  useEffect(() => {
    if (messages.length > lastCountRef.current && listRef.current) {
      // Defer to next tick so layout settles
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
    lastCountRef.current = messages.length;
  }, [messages.length]);

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

      {/* Body — list, loading, or empty state */}
      <View style={{ borderRadius: 16, backgroundColor: '#0B1220', overflow: 'hidden' }}>
        <View style={{ minHeight: 120, maxHeight: 420 }}>
          {loading && messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <ActivityIndicator size="small" color="#F97316" />
            </View>
          ) : error && messages.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="alert-circle" size={28} color="#EF4444" />
              <Text style={{ color: '#94A3B8', marginTop: 6, fontSize: 13, textAlign: 'center' }}>
                {error}
              </Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color="#334155" />
              <Text style={{ color: '#64748B', marginTop: 8, fontSize: 13, textAlign: 'center' }}>
                No notes yet.{'\n'}Add the first one for your team.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 12 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isOwn={item.sender_id === user.id}
                  onPhotoPress={(uri) => setPhotoModal({ uri })}
                />
              )}
              onContentSizeChange={() => {
                // Keep at bottom on initial render
                if (lastCountRef.current === 0 && messages.length > 0) {
                  listRef.current?.scrollToEnd({ animated: false });
                }
              }}
            />
          )}
        </View>

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
