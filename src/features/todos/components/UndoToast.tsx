/**
 * Sprint 70 — 5-second undo toast for mark-done.
 *
 * Shown at the bottom of the screen after the user taps a row to mark it
 * done. The actual API call (markDoneAndForget) is debounced 5 seconds
 * via this component — if the user taps "Undo" within the window, the
 * timer cancels and we restore the row via the optimistic store. If the
 * 5 seconds elapse, the API call commits and PowerSync replicates the
 * 'done' status (the sync rule excludes done rows so the local table
 * loses the row naturally).
 *
 * Multi-tap behaviour: if the user marks a 2nd todo before the 1st 5s
 * expires, the parent (TodayScreen) flushes the 1st (commits via
 * markDoneAndForget) and starts a fresh window for the 2nd. That logic
 * lives in TodayScreen since this component is presentational.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  /** Todo title shown on the left of the toast. Null hides the toast. */
  title: string | null;
  /** Total countdown in seconds. */
  durationSec?: number;
  /** Called when the user taps Undo. */
  onUndo: () => void;
};

export function UndoToast({ title, durationSec = 5, onUndo }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!title) return;
    setSecondsLeft(durationSec);
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      clearInterval(interval);
      Animated.timing(fade, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
    };
  }, [title, durationSec, fade]);

  if (!title) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 24,
        opacity: fade,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#0F172A',
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderColor: '#22C55E',
          maxWidth: '92%',
        }}
      >
        <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
        <Text
          numberOfLines={1}
          style={{
            color: '#F8FAFC',
            fontSize: 14,
            fontWeight: '600',
            flexShrink: 1,
          }}
        >
          {title}
        </Text>
        <View
          style={{
            width: 1,
            height: 16,
            backgroundColor: '#334155',
            marginHorizontal: 4,
          }}
        />
        <Pressable onPress={onUndo} hitSlop={6}>
          <Text
            style={{
              color: '#F97316',
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            UNDO
          </Text>
        </Pressable>
        <Text
          style={{
            color: '#64748B',
            fontSize: 12,
            fontWeight: '600',
            minWidth: 14,
            textAlign: 'right',
          }}
        >
          {secondsLeft}s
        </Text>
      </View>
    </Animated.View>
  );
}
