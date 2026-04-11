/**
 * PinOverlay — Sprint 47B
 * =========================
 * Colored pin markers over the PDF. Tap → pin detail sheet.
 * Same coordinate mapping approach as HyperlinkOverlay — fit-to-page only.
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { defaultPinColor, isPinResolved, type DrawingPin, type PinType } from '../services/pin-service';

type Props = {
  pins: DrawingPin[];
  pageWidth: number;
  pageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  visible: boolean;
  onPinPress: (pin: DrawingPin) => void;
};

const PIN_SIZE = 32;

export function PinOverlay({
  pins,
  pageWidth,
  pageHeight,
  viewportWidth,
  viewportHeight,
  visible,
  onPinPress,
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
      {pins.map((pin) => {
        const left = offsetX + pin.position_x * scale - PIN_SIZE / 2;
        const top = offsetY + pin.position_y * scale - PIN_SIZE;
        const color = pin.color ?? defaultPinColor((pin.pin_type as PinType) ?? 'note');
        const resolved = isPinResolved(pin);

        return (
          <Pressable
            key={pin.id}
            onPress={() => onPinPress(pin)}
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
                borderWidth: 2,
                borderColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
                opacity: resolved ? 0.7 : 1,
              }}
            >
              <Ionicons
                name={
                  pin.pin_type === 'photo'
                    ? 'camera'
                    : pin.pin_type === 'rfi'
                      ? 'help'
                      : 'bookmark'
                }
                size={14}
                color="#FFFFFF"
              />
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
            </View>
            {pin.title ? (
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
                {pin.title}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
