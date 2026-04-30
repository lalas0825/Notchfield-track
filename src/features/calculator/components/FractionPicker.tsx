/**
 * Common-fractions picker. The keypad's quick-fraction row only has the
 * 4 most common; this picker covers everything you read off a plan
 * (halves through 1/32nds).
 *
 * Tap a fraction → inserted into the expression and the picker closes.
 */

import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/shared/lib/haptics';

const SECTIONS: { label: string; fractions: string[] }[] = [
  { label: 'Halves',     fractions: ['1/2'] },
  { label: 'Quarters',   fractions: ['1/4', '3/4'] },
  { label: 'Eighths',    fractions: ['1/8', '3/8', '5/8', '7/8'] },
  {
    label: 'Sixteenths',
    fractions: [
      '1/16', '3/16', '5/16', '7/16',
      '9/16', '11/16', '13/16', '15/16',
    ],
  },
  {
    label: 'Thirty-seconds',
    fractions: [
      '1/32', '3/32', '5/32', '7/32',
      '9/32', '11/32', '13/32', '15/32',
      '17/32', '19/32', '21/32', '23/32',
      '25/32', '27/32', '29/32', '31/32',
    ],
  },
];

interface FractionPickerProps {
  visible: boolean;
  onClose: () => void;
  onPick: (fraction: string) => void;
}

export function FractionPicker({ visible, onClose, onPick }: FractionPickerProps) {
  const { t } = useTranslation();

  const handlePick = (frac: string) => {
    void haptic.selection();
    onPick(frac);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
          <Text className="text-lg font-bold text-white">
            {t('calculator.fractions_title')}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close fractions"
            className="h-10 w-10 items-center justify-center rounded-full active:bg-border"
          >
            <Ionicons name="close" size={24} color="#F8FAFC" />
          </Pressable>
        </View>
        <ScrollView
          className="flex-1 px-4 pt-3"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {SECTIONS.map((section) => (
            <View key={section.label} className="mb-5">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section.label}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {section.fractions.map((frac) => (
                  <Pressable
                    key={frac}
                    onPress={() => handlePick(frac)}
                    accessibilityRole="button"
                    accessibilityLabel={frac}
                    className="rounded-xl border border-border bg-card px-4 py-3 active:opacity-70"
                    style={{ minWidth: 72 }}
                  >
                    <Text className="text-center text-base font-bold text-white">
                      {frac}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
