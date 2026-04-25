import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MessageType } from '../types';
import { MESSAGE_TYPE_CONFIG } from '../types';

/**
 * Compact pill: icon + label for a message type. Used inside the composer
 * type picker AND on bubbles for non-info types (info is the default, no
 * badge needed).
 */
export function MessageTypeBadge({
  type,
  size = 'sm',
  selected = false,
}: {
  type: MessageType;
  size?: 'sm' | 'md';
  selected?: boolean;
}) {
  const cfg = MESSAGE_TYPE_CONFIG[type];
  const px = size === 'md' ? 12 : 8;
  const py = size === 'md' ? 6 : 3;
  const iconSize = size === 'md' ? 14 : 12;
  const fontSize = size === 'md' ? 13 : 11;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: selected ? cfg.color : cfg.bgColor,
        borderWidth: 1,
        borderColor: cfg.color,
        paddingHorizontal: px,
        paddingVertical: py,
        borderRadius: 999,
      }}
    >
      <Ionicons name={cfg.icon as any} size={iconSize} color={selected ? '#FFFFFF' : cfg.color} />
      <Text
        style={{
          marginLeft: 4,
          color: selected ? '#FFFFFF' : cfg.color,
          fontSize,
          fontWeight: '600',
        }}
      >
        {cfg.label}
      </Text>
    </View>
  );
}
