/**
 * Reassuring "Done" footer button for helpers — the result is computed
 * reactively (no Calculate button needed), but users expect an action
 * button at the end of a form. This one copies the primary result to
 * the clipboard with a 1.5s confirmation, giving the user closure +
 * a useful side effect.
 */

import { useEffect, useState } from 'react';
import { Clipboard, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/shared/lib/haptics';

interface HelperDoneButtonProps {
  value: string;
  unit: string;
}

export function HelperDoneButton({ value, unit }: HelperDoneButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const handlePress = () => {
    void haptic.success();
    Clipboard.setString(`${value} ${unit}`.trim());
    setCopied(true);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${value} ${unit}`}
      className="mt-4 flex-row items-center justify-center rounded-2xl bg-brand-orange py-3 active:opacity-80"
      style={{ minHeight: 52 }}
    >
      <Ionicons
        name={copied ? 'checkmark-circle' : 'copy-outline'}
        size={20}
        color="#FFFFFF"
      />
      <Text className="ml-2 text-base font-bold text-white">
        {copied ? t('calculator.copied') : `${value} ${unit}`.trim()}
      </Text>
    </Pressable>
  );
}
