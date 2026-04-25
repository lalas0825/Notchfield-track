import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FieldMessage } from '../types';
import { MESSAGE_TYPE_CONFIG } from '../types';
import { MessageTypeBadge } from './MessageTypeBadge';

/**
 * Single message bubble.
 *
 * - Own messages right-aligned (subtle brand-orange tint), others left-aligned (card).
 * - Type badge shown for non-info types.
 * - 🔒 lock icon overlaid when is_system=true (auto from blockPhase etc).
 * - Photos render as a horizontal scroll strip below the body.
 * - Long-press for future: copy / delete (deferred from v1).
 */
export function MessageBubble({
  message,
  isOwn,
  onPhotoPress,
}: {
  message: FieldMessage;
  isOwn: boolean;
  onPhotoPress?: (uri: string, index: number) => void;
}) {
  const cfg = MESSAGE_TYPE_CONFIG[message.message_type];
  const showBadge = message.message_type !== 'info';
  const time = formatTime(message.created_at);

  const accent = isOwn ? '#F97316' : cfg.color;
  const bgClass = isOwn ? 'bg-brand-orange/10' : 'bg-card';
  const align = isOwn ? 'items-end' : 'items-start';

  return (
    <View className={`mb-3 px-1 ${align}`}>
      {/* Sender + time line */}
      <View className="mb-1 flex-row items-center" style={{ flexDirection: isOwn ? 'row-reverse' : 'row' }}>
        {message.is_system && (
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#1E293B',
              alignItems: 'center',
              justifyContent: 'center',
              marginHorizontal: 4,
            }}
          >
            <Ionicons name="lock-closed" size={10} color="#94A3B8" />
          </View>
        )}
        <Text className="text-xs font-medium text-slate-400">
          {message.is_system ? 'Auto' : message.sender_name ?? 'Unknown'}
        </Text>
        <Text className="mx-1.5 text-xs text-slate-600">·</Text>
        <Text className="text-xs text-slate-500">{time}</Text>
        {showBadge && (
          <View className="ml-2">
            <MessageTypeBadge type={message.message_type} size="sm" />
          </View>
        )}
      </View>

      {/* Bubble */}
      <View
        className={`max-w-[88%] rounded-2xl border px-3 py-2.5 ${bgClass}`}
        style={{ borderColor: `${accent}33` }}
      >
        <Text className="text-base text-slate-100" style={{ lineHeight: 22 }}>
          {message.message}
        </Text>

        {message.photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2"
            contentContainerStyle={{ gap: 6 }}
          >
            {message.photos.map((uri, i) => (
              <Pressable
                key={`${uri}-${i}`}
                onPress={() => onPhotoPress?.(uri, i)}
                className="active:opacity-70"
              >
                <Image
                  source={{ uri }}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 8,
                    backgroundColor: '#1E293B',
                  }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  // Different day — short date
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
