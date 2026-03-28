/**
 * Haptic Feedback Utilities
 * ==========================
 * Wraps expo-haptics with Platform.OS guard so calls are safe on web.
 */

import { Platform } from 'react-native';

async function fire(
  fn: () => Promise<void>,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await fn();
  } catch {
    // Haptics not available — silently ignore
  }
}

export const haptic = {
  /** Light tap — checkbox, small toggle */
  light: async () => {
    const Haptics = await import('expo-haptics');
    return fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /** Medium tap — assignment, navigation */
  medium: async () => {
    const Haptics = await import('expo-haptics');
    return fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },

  /** Heavy tap — end day, check-in, destructive */
  heavy: async () => {
    const Haptics = await import('expo-haptics');
    return fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },

  /** Success notification — area complete, upload done */
  success: async () => {
    const Haptics = await import('expo-haptics');
    return fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },

  /** Error notification — blocked, failed */
  error: async () => {
    const Haptics = await import('expo-haptics');
    return fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },

  /** Selection change — picker, filter chip */
  selection: async () => {
    const Haptics = await import('expo-haptics');
    return fire(() => Haptics.selectionAsync());
  },
};
