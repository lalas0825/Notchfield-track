/**
 * Shared chrome around every helper: header with title, close button,
 * scrollable body. The helper provides children that fill the body.
 */

import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HelperShellProps {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function HelperShell({ title, onBack, children, footer }: HelperShellProps) {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to helpers"
          className="mr-3 h-10 w-10 items-center justify-center rounded-full active:bg-border"
        >
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text className="text-lg font-bold text-white">{title}</Text>
      </View>
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? (
        <View className="border-t border-border bg-card px-4 py-3">{footer}</View>
      ) : null}
    </View>
  );
}
