/**
 * Bottom-sheet modal listing all 17 helpers with search.
 * Tap a tile to open the helper as a full-modal sub-view.
 */

import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/shared/lib/haptics';
import { HELPERS, type HelperId } from './helpers/registry';
import { HelperRouter } from './helpers/HelperRouter';

interface HelperSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function HelperSheet({ visible, onClose }: HelperSheetProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const tileWidth = isTablet ? '23%' : '31%';

  const [search, setSearch] = useState('');
  const [activeHelper, setActiveHelper] = useState<HelperId | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return HELPERS;
    return HELPERS.filter((h) => {
      const label = t(`calculator.helpers.${h.id}`).toLowerCase();
      return label.includes(q) || h.id.includes(q);
    });
  }, [search, t]);

  const handleClose = () => {
    setActiveHelper(null);
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-background">
        {activeHelper === null ? (
          <>
            <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
              <Text className="text-lg font-bold text-white">
                {t('calculator.tools')}
              </Text>
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close helpers"
                className="h-10 w-10 items-center justify-center rounded-full active:bg-border"
              >
                <Ionicons name="close" size={24} color="#F8FAFC" />
              </Pressable>
            </View>
            <View className="px-4 pt-3">
              <View className="flex-row items-center rounded-xl border border-border bg-card px-3 py-2">
                <Ionicons name="search" size={18} color="#64748B" />
                <TextInput
                  className="ml-2 flex-1 text-base text-white"
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('calculator.search_helpers')}
                  placeholderTextColor="#64748B"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <ScrollView
              className="flex-1 px-3 pt-3"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {filtered.map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => {
                      void haptic.light();
                      setActiveHelper(h.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t(`calculator.helpers.${h.id}`)}
                    className="items-center justify-center rounded-2xl border border-border bg-card p-3 active:opacity-70"
                    style={{ width: tileWidth as any, minHeight: 96 }}
                  >
                    <View
                      className="mb-2 h-12 w-12 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${h.color}20` }}
                    >
                      <Ionicons name={h.icon} size={24} color={h.color} />
                    </View>
                    <Text
                      className="text-center text-xs font-semibold text-white"
                      numberOfLines={2}
                    >
                      {t(`calculator.helpers.${h.id}`)}
                    </Text>
                  </Pressable>
                ))}
                {filtered.length === 0 ? (
                  <View className="w-full items-center justify-center py-12">
                    <Text className="text-sm text-slate-500">
                      {t('common.no_data')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </>
        ) : (
          <HelperRouter
            helperId={activeHelper}
            onBack={() => setActiveHelper(null)}
          />
        )}
      </View>
    </Modal>
  );
}
