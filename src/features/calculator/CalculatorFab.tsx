/**
 * Floating calculator button for the Plans tab — mounted ONLY in
 * src/app/(tabs)/plans/[id].tsx, per pilot scope.
 *
 * Tap → opens the full calculator as a modal overlay (does not navigate
 * — the user keeps their place on the plan when closing).
 */

import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CalculatorBody } from './components/CalculatorBody';
import { haptic } from '@/shared/lib/haptics';

interface CalculatorFabProps {
  /** Distance from the bottom edge — pass 80 to clear the bottom tab bar */
  bottomOffset?: number;
}

export function CalculatorFab({ bottomOffset = 100 }: CalculatorFabProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          void haptic.medium();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('calculator.title')}
        style={{
          position: 'absolute',
          left: 16,
          bottom: bottomOffset,
          height: 56,
          width: 56,
          borderRadius: 28,
          backgroundColor: '#F97316',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      >
        <Ionicons name="calculator" size={26} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
            <Text className="text-lg font-bold text-white">
              {t('calculator.title')}
            </Text>
            <Pressable
              onPress={() => {
                void haptic.light();
                setOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close calculator"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-border"
            >
              <Ionicons name="close" size={24} color="#F8FAFC" />
            </Pressable>
          </View>
          <CalculatorBody />
        </View>
      </Modal>
    </>
  );
}
