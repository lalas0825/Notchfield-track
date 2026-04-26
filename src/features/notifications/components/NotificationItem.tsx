/**
 * Sprint 69 — Notification list row.
 *
 * Layout (left → right):
 *   [severity-tinted icon disc] [title (bold) + body (1 line)] [time]
 *                                                              [unread dot]
 *
 * Unread = `read_at IS NULL`. Unread rows have a subtle severity-tinted
 * background and an orange dot on the right. Tapping marks read locally
 * (optimistic) and navigates to the notification's link target — entity
 * routing for the common cases, otherwise no-op (the `link_url` is a Web
 * URL that we don't try to parse on Track).
 *
 * Severity color usage:
 *   - info     — slate text, neutral disc
 *   - warning  — amber disc, amber tint on unread row
 *   - critical — red disc, red tint on unread row
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { resolveIcon } from '../services/iconMapper';
import { formatRelative } from '../services/relativeTime';
import type { Notification } from '../types';

type Props = {
  notification: Notification;
  onPress?: (n: Notification) => void;
};

const SEVERITY_DISC: Record<Notification['severity'], { bg: string; fg: string }> = {
  info: { bg: '#1E293B', fg: '#94A3B8' },
  warning: { bg: '#78350F', fg: '#F59E0B' },
  critical: { bg: '#7F1D1D', fg: '#EF4444' },
};

const UNREAD_TINT: Record<Notification['severity'], string> = {
  info: '#0F172A', // no extra tint for info — base bg
  warning: '#1F1409', // very subtle amber wash
  critical: '#1F0F0F', // very subtle red wash
};

export function NotificationItem({ notification, onPress }: Props) {
  const isUnread = !notification.read_at;
  const disc = SEVERITY_DISC[notification.severity];
  const rowBg = isUnread ? UNREAD_TINT[notification.severity] : 'transparent';
  const icon = resolveIcon(notification.icon);

  return (
    <Pressable
      onPress={() => onPress?.(notification)}
      android_ripple={{ color: '#1E293B' }}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: rowBg,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        gap: 12,
      }}
    >
      {/* Icon disc */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: disc.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon.family === 'ionicons' ? (
          <Ionicons name={icon.name} size={20} color={disc.fg} />
        ) : (
          <MaterialCommunityIcons name={icon.name} size={20} color={disc.fg} />
        )}
      </View>

      {/* Title + body */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{
            color: '#F8FAFC',
            fontSize: 15,
            fontWeight: isUnread ? '700' : '500',
            lineHeight: 20,
          }}
        >
          {notification.title}
        </Text>
        {notification.body ? (
          <Text
            numberOfLines={1}
            style={{
              color: '#94A3B8',
              fontSize: 13,
              marginTop: 2,
            }}
          >
            {notification.body}
          </Text>
        ) : null}
      </View>

      {/* Time + unread dot */}
      <View style={{ alignItems: 'flex-end', gap: 6, paddingTop: 2 }}>
        <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>
          {formatRelative(notification.created_at)}
        </Text>
        {isUnread ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#F97316',
            }}
          />
        ) : (
          <View style={{ width: 8, height: 8 }} />
        )}
      </View>
    </Pressable>
  );
}
