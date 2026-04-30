/**
 * Standalone Calculator screen under More menu.
 *
 * Universal — every role sees this. No project context required.
 * Same body as the Plans-tab FAB modal so logic stays in one place.
 */

import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalculatorBody } from '@/features/calculator/components/CalculatorBody';

export default function CalculatorScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('calculator.title') }} />
      <CalculatorBody />
    </View>
  );
}
