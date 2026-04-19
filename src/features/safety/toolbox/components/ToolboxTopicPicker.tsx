/**
 * Alternatives picker shown when the foreman taps "Change topic" on the
 * This Week screen. Scrolls the full library (minus the current suggestion),
 * each row showing the title + hazard preview + trade chip.
 */
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToolboxLibraryTopic } from '../types';

type Props = {
  visible: boolean;
  library: ToolboxLibraryTopic[];
  currentTopicId: string | null;
  onSelect: (topic: ToolboxLibraryTopic) => void;
  onClose: () => void;
};

export function ToolboxTopicPicker({
  visible,
  library,
  currentTopicId,
  onSelect,
  onClose,
}: Props) {
  const items = library.filter((t) => t.id !== currentTopicId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View
          className="rounded-t-3xl border-t border-border bg-background"
          style={{ maxHeight: '85%' }}
        >
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text className="text-lg font-bold text-white">Pick a different topic</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView className="px-4 py-3">
            {items.length === 0 ? (
              <Text className="py-8 text-center text-slate-400">
                No other topics available — ask your PM to seed more library entries in Takeoff web.
              </Text>
            ) : (
              items.map((t) => {
                const hazardPreview = t.tags.slice(0, 3).join(' · ');
                const tradeChip =
                  t.trade.length === 0 ? 'Universal' : t.trade.join(' · ');
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      onSelect(t);
                      onClose();
                    }}
                    className="mb-2 rounded-xl border border-border bg-card p-3 active:opacity-80"
                  >
                    <Text className="text-base font-medium text-white">{t.title}</Text>
                    {t.category ? (
                      <Text className="mt-0.5 text-xs text-slate-500">{t.category}</Text>
                    ) : null}
                    <View className="mt-2 flex-row items-center">
                      <View className="rounded-full bg-brand-orange/15 px-2 py-0.5">
                        <Text className="text-[10px] font-bold uppercase text-brand-orange">
                          {tradeChip}
                        </Text>
                      </View>
                      {hazardPreview ? (
                        <Text className="ml-2 flex-1 text-xs text-slate-400" numberOfLines={1}>
                          {hazardPreview}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
            <View className="h-10" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
