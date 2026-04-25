/**
 * PunchPinOverlay — Sprint 53B
 * ==============================
 * Overlay layer for the PDF viewer rendering punch_items pinned to this
 * drawing. Distinct visual from Sprint 47B drawing_pins:
 *   - Flag icon (not bookmark)
 *   - Color by priority (low/medium/high/critical)
 *   - Ring around pin for status (open → full, in_progress → dashed, etc.)
 *   - Checkmark badge when resolved (awaiting verify)
 *
 * Same fit-to-page coordinate mapping as PinOverlay — visible only when
 * user is at baseline zoom.
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PunchItem } from '../services/punch-service';

type Props = {
  items: PunchItem[];
  pageWidth: number;
  pageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  visible: boolean;
  onItemPress: (item: PunchItem) => void;
};

const PIN_SIZE = 32;

const PRIORITY_COLOR: Record<string, string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

export function PunchPinOverlay({
  items,
  pageWidth,
  pageHeight,
  viewportWidth,
  viewportHeight,
  visible,
  onItemPress,
}: Props) {
  if (!visible || pageWidth <= 0 || pageHeight <= 0) return null;

  const scale = Math.min(viewportWidth / pageWidth, viewportHeight / pageHeight);
  const renderedW = pageWidth * scale;
  const renderedH = pageHeight * scale;
  const offsetX = (viewportWidth - renderedW) / 2;
  const offsetY = (viewportHeight - renderedH) / 2;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {items.map((item) => {
        if (item.plan_x == null || item.plan_y == null) return null;

        const left = offsetX + item.plan_x * scale - PIN_SIZE / 2;
        const top = offsetY + item.plan_y * scale - PIN_SIZE;
        const color = PRIORITY_COLOR[item.priority] ?? '#A855F7';
        const resolved = item.status === 'resolved';
        const rejected = item.status === 'rejected';

        return (
          <Pressable
            key={item.id}
            onPress={() => onItemPress(item)}
            style={{
              position: 'absolute',
              left,
              top,
              width: PIN_SIZE,
              height: PIN_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            hitSlop={6}
          >
            <View
              style={{
                width: PIN_SIZE,
                height: PIN_SIZE,
                borderRadius: PIN_SIZE / 2,
                backgroundColor: resolved ? '#64748B' : color,
                borderWidth: rejected ? 3 : 2,
                borderColor: rejected ? '#DC2626' : '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
                opacity: resolved ? 0.85 : 1,
              }}
            >
              <Ionicons name="flag" size={14} color="#FFFFFF" />
              {resolved && (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#22C55E',
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="checkmark" size={9} color="#FFFFFF" />
                </View>
              )}
              {rejected && (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#DC2626',
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="refresh" size={8} color="#FFFFFF" />
                </View>
              )}
            </View>
            {item.title ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  color: '#F8FAFC',
                  fontSize: 9,
                  fontWeight: '700',
                  maxWidth: 72,
                  textAlign: 'center',
                  textShadowColor: '#000',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }}
              >
                {item.title}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
