/**
 * SheetNavBar — Sprint 47B
 * ==========================
 * Bottom navigation bar showing the current sheet with prev/next arrows.
 * Siblings come from `useSheetSiblings` — drawings within the same set.
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SheetSibling } from '../hooks/useSheetSiblings';

type Props = {
  siblings: SheetSibling[];
  currentId: string;
  onNavigate: (target: SheetSibling) => void;
};

export function SheetNavBar({ siblings, currentId, onNavigate }: Props) {
  if (siblings.length === 0) return null;
  const idx = siblings.findIndex((s) => s.id === currentId);
  if (idx < 0) return null;

  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const current = siblings[idx];
  const currentLabel = current.label ?? `Page ${current.page_number}`;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between border-t border-border bg-card/95 px-3 py-2"
    >
      <Pressable
        onPress={() => prev && onNavigate(prev)}
        disabled={!prev}
        className="flex-row items-center rounded-full px-3 py-2 active:opacity-60"
        style={{ opacity: prev ? 1 : 0.3, minHeight: 44 }}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={18} color="#F97316" />
        <Text className="ml-1 text-xs font-bold text-slate-300" numberOfLines={1}>
          {prev ? (prev.label ?? `Page ${prev.page_number}`) : '—'}
        </Text>
      </Pressable>

      <View className="flex-1 items-center px-2">
        <Text className="text-[10px] uppercase tracking-wider text-slate-500">
          {idx + 1} / {siblings.length}
        </Text>
        <Text className="text-sm font-bold text-white" numberOfLines={1}>
          {currentLabel}
        </Text>
      </View>

      <Pressable
        onPress={() => next && onNavigate(next)}
        disabled={!next}
        className="flex-row items-center rounded-full px-3 py-2 active:opacity-60"
        style={{ opacity: next ? 1 : 0.3, minHeight: 44 }}
        hitSlop={8}
      >
        <Text className="mr-1 text-xs font-bold text-slate-300" numberOfLines={1}>
          {next ? (next.label ?? `Page ${next.page_number}`) : '—'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#F97316" />
      </Pressable>
    </View>
  );
}
