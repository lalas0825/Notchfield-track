/**
 * PinDetailSheet — Sprint 47B
 * ==============================
 * Bottom-sheet modal showing pin detail. Resolve / reopen if permitted.
 */

import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type DrawingPin,
  parsePinPhotos,
  isPinResolved,
  defaultPinColor,
  getPinPhotoSignedUrl,
  resolvePin,
  reopenPin,
  type PinType,
} from '../services/pin-service';
import { haptic } from '@/shared/lib/haptics';

type Props = {
  pin: DrawingPin | null;
  canMutate: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function PinDetailSheet({ pin, canMutate, onClose, onChanged }: Props) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pin) { setPhotoUrls([]); return; }
    const paths = parsePinPhotos(pin.photos);
    if (paths.length === 0) { setPhotoUrls([]); return; }
    Promise.all(paths.map(getPinPhotoSignedUrl)).then((urls) => {
      setPhotoUrls(urls.filter((u): u is string => !!u));
    });
  }, [pin]);

  if (!pin) return null;

  const resolved = isPinResolved(pin);
  const color = pin.color ?? defaultPinColor((pin.pin_type as PinType) ?? 'note');

  const toggleResolved = async () => {
    setBusy(true);
    try {
      if (resolved) await reopenPin(pin.id);
      else await resolvePin(pin.id);
      haptic.success();
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!pin} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl border-t border-border bg-card px-5 pb-8 pt-4"
          style={{ maxHeight: '80%' }}
        >
          {/* Drag handle */}
          <View className="mb-3 items-center">
            <View className="h-1 w-12 rounded-full bg-slate-600" />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Type + resolved badge */}
            <View className="mb-2 flex-row items-center">
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: resolved ? '#64748B' : color }}
              >
                <Ionicons
                  name={
                    pin.pin_type === 'photo'
                      ? 'camera'
                      : pin.pin_type === 'rfi'
                        ? 'help'
                        : 'bookmark'
                  }
                  size={18}
                  color="#FFFFFF"
                />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {pin.pin_type}
                </Text>
                <Text className="text-base font-bold text-white" numberOfLines={2}>
                  {pin.title ?? '(no title)'}
                </Text>
              </View>
              {resolved && (
                <View className="rounded-full bg-success/20 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-success">RESOLVED</Text>
                </View>
              )}
            </View>

            {pin.description ? (
              <Text className="mb-3 mt-1 text-sm text-slate-300">{pin.description}</Text>
            ) : null}

            {/* Photos */}
            {photoUrls.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerStyle={{ gap: 8 }}
              >
                {photoUrls.map((url) => (
                  <Image
                    key={url}
                    source={{ uri: url }}
                    style={{ width: 120, height: 120, borderRadius: 8 }}
                  />
                ))}
              </ScrollView>
            )}

            {/* Meta */}
            <Text className="text-xs text-slate-500">
              Created {new Date(pin.created_at).toLocaleString()}
            </Text>

            {/* Actions */}
            {canMutate && (
              <Pressable
                onPress={toggleResolved}
                disabled={busy}
                className="mt-4 flex-row items-center justify-center rounded-2xl py-3 active:opacity-80"
                style={{
                  backgroundColor: resolved ? '#475569' : '#22C55E',
                  opacity: busy ? 0.5 : 1,
                  minHeight: 52,
                }}
              >
                <Ionicons
                  name={resolved ? 'refresh' : 'checkmark-circle'}
                  size={18}
                  color="#FFFFFF"
                />
                <Text className="ml-2 text-base font-bold text-white">
                  {resolved ? 'Reopen' : 'Mark Resolved'}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
